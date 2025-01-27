import { ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import axios from 'axios';

const TRIAL_PERIOD_DAYS: number = Number(process.env.TRIAL_PERIOD_DAYS) || 5;
const BACKEND_BASE_URL: string = process.env.BACKEND_BASE_URL || '';
const FILE_WHERE_TO_STORE_SUBSCRIPTION: string =
  process.env.FILE_WHERE_TO_STORE_SUBSCRIPTION || '';
const subscriptionOrTrialFilePath = path.join(
  os.homedir(),
  FILE_WHERE_TO_STORE_SUBSCRIPTION,
);

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

function getPackInfos() {
  return loadAndDecryptData(subscriptionOrTrialFilePath);
}

ipcMain.on('check-trial-expiration', function (event) {
  const currentDate = new Date();
  const packInfos = getPackInfos();
  if (!packInfos) {
    event.sender.send('is-expired', null, null);
    return;
  }
  if (packInfos.pack !== 'Free Trial') {
    event.sender.send('is-expired', packInfos.pack, packInfos);
  } else {
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
    try {
      const response = await axios.get(
        trialOrSubscription === 'trial'
          ? `${BACKEND_BASE_URL}/api/trials`
          : `${BACKEND_BASE_URL}/api/subscriptions`,
        {
          timeout: 5000,
          params: {
            email,
            licence,
          },
        },
      );
      const packInfos = {
        pack: response.data.pack,
        email: response.data.email,
      } as any;
      if (response.data && response.data.pack === 'Free Trial') {
        const { infos } = response.data;
        packInfos.startTrialDate = infos.startTrialDate;
      }

      const encryptedPackInfos = encryptData(JSON.stringify(packInfos));
      if (fs.existsSync(subscriptionOrTrialFilePath)) {
        fs.unlinkSync(subscriptionOrTrialFilePath);
      }
      fs.writeFileSync(
        subscriptionOrTrialFilePath,
        JSON.stringify(encryptedPackInfos),
      );

      if (process.platform === 'win32') {
        execSync(`attrib +H "${subscriptionOrTrialFilePath}"`);
      }

      event.sender.send(
        'is-subscribed',
        response.data.valid,
        response.data,
        response.data.reason,
      );
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        event.sender.send(
          'is-subscribed',
          false,
          null,
          'Failed to connect to the server. Please verify your network and try again.',
        );
        return;
      }
      if (error.code === 'ECONNABORTED') {
        event.sender.send(
          'is-subscribed',
          false,
          null,
          'The request timed out. Please check your network and try again.',
        );
        return;
      }
      if (error.response) {
        // The request was made, and the server responded with a status code not in the range of 2xx
        event.sender.send('is-subscribed', false, null, error.response.data);
      } else if (error.request) {
        // The request was made, but no response was received
        event.sender.send(
          'is-subscribed',
          false,
          null,
          "We couldn't get a response from the server. Please verify your network or try again",
        );
      } else {
        // Something else happened during the request
        event.sender.send('is-subscribed', false, null, error.message);
      }
    }
  },
);
