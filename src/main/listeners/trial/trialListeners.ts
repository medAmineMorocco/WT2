import { ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';

const PRO_VERSION = false;
const TRIAL_PERIOD_DAYS = 5;

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
  const [day, month, year] = dateString.split('/');
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

function loadAndDecryptTrialData(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const decryptedData = decryptData(
    encryptedData.encryptedData,
    encryptedData.iv,
  );

  // Convert decrypted string back to object
  const parsedData = JSON.parse(decryptedData);

  // Convert the startTrialDate string back to a Date object
  parsedData.startTrialDate = parseStringToDate(parsedData.startTrialDate);

  return parsedData;
}

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Function to encrypt data
function encryptData(data: any) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encryptedData: encrypted };
}

ipcMain.on('check-trial-expiration', function (event) {
  if (PRO_VERSION) {
    event.sender.send('is-expired', PRO_VERSION, false, null);
  } else {
    const trialFilePath = path.join(os.homedir(), '.sys_cache_75h4kF.tmp');
    let decryptedTrialData = loadAndDecryptTrialData(trialFilePath);

    const currentDate = new Date();
    if (!decryptedTrialData) {
      decryptedTrialData = {
        startTrialDate: currentDate,
      };

      const trialData = {
        startTrialDate: formatDate(currentDate),
      };

      const encryptedTrialData = encryptData(JSON.stringify(trialData));

      fs.writeFileSync(trialFilePath, JSON.stringify(encryptedTrialData));

      if (process.platform === 'win32') {
        execSync(`attrib +H "${trialFilePath}"`);
      }
    }

    const daysSinceStart = Math.floor(
      (currentDate.getTime() - decryptedTrialData.startTrialDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const daysRemaining = TRIAL_PERIOD_DAYS - daysSinceStart;

    event.sender.send(
      'is-expired',
      PRO_VERSION,
      daysSinceStart > TRIAL_PERIOD_DAYS,
      daysRemaining,
    );
  }
});
