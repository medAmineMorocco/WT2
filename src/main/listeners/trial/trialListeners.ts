import { app, ipcMain, net } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import loggingService from '../../services/logging/loggingService';
import LogLevel from '../../enums/LogLevel';

const TRIAL_PERIOD_DAYS: number = Number(process.env.TRIAL_PERIOD_DAYS) || 5;
const BACKEND_BASE_URL: string = process.env.BACKEND_BASE_URL || '';
const FILE_WHERE_TO_STORE_SUBSCRIPTION: string =
  process.env.FILE_WHERE_TO_STORE_SUBSCRIPTION || '';
const subscriptionOrTrialFilePath = path.join(
  os.homedir(),
  FILE_WHERE_TO_STORE_SUBSCRIPTION,
);

const secondFilePath = path.join(app.getPath('userData'), '.cache_store.tmp');

// Encryption Setup (same as before)
const algorithm = 'aes-256-cbc';
const key = Buffer.from('0123456789abcdef0123456789abcdef', 'utf-8'); // 32-byte key for AES-256
const iv = Buffer.from('abcdef9876543210', 'utf-8');

function decryptData(encryptedData: any, ivHex: any) {
  const ivBuffer = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

function parseStringToDate(dateString: string) {
  const [year, month, day] = dateString.split('-');
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

function loadAndDecryptData(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const decryptedData = decryptData(
    encryptedData.encryptedData,
    encryptedData.iv,
  );

  // Convert decrypted string back to object
  return JSON.parse(decryptedData);
}

// Function to encrypt data
function encryptData(data: any) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encryptedData: encrypted };
}

function syncFiles() {
  if (
    !fs.existsSync(subscriptionOrTrialFilePath) &&
    fs.existsSync(secondFilePath)
  ) {
    fs.writeFileSync(
      subscriptionOrTrialFilePath,
      fs.readFileSync(secondFilePath, 'utf-8'),
    );
  }
  if (
    !fs.existsSync(secondFilePath) &&
    fs.existsSync(subscriptionOrTrialFilePath)
  ) {
    fs.writeFileSync(
      secondFilePath,
      fs.readFileSync(subscriptionOrTrialFilePath, 'utf-8'),
    );
  }
}

function getPackInfos() {
  let packInfos = loadAndDecryptData(subscriptionOrTrialFilePath);
  if (!packInfos) {
    packInfos = loadAndDecryptData(secondFilePath);
  }
  syncFiles();
  return packInfos;
}

ipcMain.on('check-trial-expiration', function (event) {
  const packInfos = getPackInfos();
  if (!packInfos) {
    event.sender.send('is-expired', null, null);
    return;
  }
  if (packInfos.pack !== 'Free Trial') {
    event.sender.send('is-expired', packInfos.pack, packInfos);
  } else {
    const currentDate = new Date();
    const { startTrialDate } = packInfos;
    const daysSinceStart = Math.abs(
      (currentDate.getTime() - parseStringToDate(startTrialDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const daysRemaining = Math.trunc(TRIAL_PERIOD_DAYS - daysSinceStart);

    const infos = {
      isExpiredReceived: daysSinceStart > TRIAL_PERIOD_DAYS,
      daysRemainingReceived: daysRemaining,
      startTrialDateReceived: startTrialDate,
    };

    event.sender.send('is-expired', packInfos.pack, infos);
  }
});

ipcMain.on(
  'verify-subscription',
  async function (event, trialOrSubscription, email, licence) {
    loggingService.logMessage(
      '-',
      `Verifying ${trialOrSubscription === 'trial' ? 'trial' : 'subscription'} for email ${email} and licence ${licence}`,
      LogLevel.INFO,
    );
    const requestURL =
      trialOrSubscription === 'trial'
        ? `${BACKEND_BASE_URL}/api/trials`
        : `${BACKEND_BASE_URL}/api/subscriptions`;

    const fullUrl = `${requestURL}?email=${email}&licence=${licence}`;

    const request = net.request({
      method: 'GET',
      url: fullUrl,
    });

    const timeoutId = setTimeout(() => {
      request.abort();
      loggingService.logMessage('-', 'Request timed out', LogLevel.ERROR);
      event.sender.send(
        'is-subscribed',
        false,
        null,
        'The request timed out. Please check your network and try again.',
      );
    }, 8000);

    request.on('response', (response) => {
      let body = '';

      response.on('data', (chunk) => {
        body += chunk.toString();
      });

      response.on('end', () => {
        let data;
        try {
          data = JSON.parse(body);
        } catch (e) {
          event.sender.send(
            'is-subscribed',
            false,
            null,
            'Failed to connect to the server. Please verify your network and try again.',
          );
          return;
        }
        const packInfos = {
          pack: data.pack,
          email: data.email,
        } as any;

        if (data.pack === 'Free Trial') {
          const { infos } = data;
          packInfos.startTrialDate = infos.startTrialDate;
        }

        const encryptedPackInfos = encryptData(JSON.stringify(packInfos));
        if (fs.existsSync(subscriptionOrTrialFilePath)) {
          fs.unlinkSync(subscriptionOrTrialFilePath);
        }

        if (fs.existsSync(secondFilePath)) {
          fs.unlinkSync(secondFilePath);
        }

        fs.writeFileSync(
          subscriptionOrTrialFilePath,
          JSON.stringify(encryptedPackInfos),
        );

        fs.writeFileSync(secondFilePath, JSON.stringify(encryptedPackInfos));

        if (process.platform === 'win32') {
          execSync(`attrib +H "${subscriptionOrTrialFilePath}"`);
          execSync(`attrib +H "${secondFilePath}"`);
        }

        clearTimeout(timeoutId);
        loggingService.logMessage(
          '-',
          `Subscription/Trial verified: ${data.valid}`,
          LogLevel.INFO,
        );
        event.sender.send('is-subscribed', data.valid, data, data.reason);
      });
    });

    request.on('error', (error: any) => {
      loggingService.logMessage('-', `Error: ${error.message}`, LogLevel.ERROR);
      if (error.message === 'net::ERR_CONNECTION_REFUSED') {
        clearTimeout(timeoutId);
        event.sender.send(
          'is-subscribed',
          false,
          null,
          'Failed to connect to the server. Please verify your network and try again.',
        );
      } else {
        clearTimeout(timeoutId);
        event.sender.send('is-subscribed', false, null, error.message);
      }
    });

    request.end();
  },
);
