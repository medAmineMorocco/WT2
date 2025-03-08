import LogLevel from '../../enums/LogLevel';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const logFilePath = path.join(
  app.getPath('userData'),
  'worktreewise_logs.json',
);

if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, JSON.stringify([]), 'utf-8');
}

function getLogs() {
  if (!fs.existsSync(logFilePath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(logFilePath, 'utf-8'));
  } catch (error) {
    return [];
  }
}

function clearLogs() {
  if (!fs.existsSync(logFilePath)) {
    return;
  }

  try {
    fs.writeFileSync(logFilePath, JSON.stringify([]), 'utf-8');
  } catch (error) {
    console.error('Failed to clear logs:', error);
  }
}

function logMessage(directory: string, message: string, level: LogLevel) {
  const timestamp = new Date().toISOString();
  const repository = directory !== '-' ? path.basename(directory) : '-';
  const logEntry = {
    repository,
    level,
    time: timestamp,
    message,
  };
  const logs = getLogs();
  logs.push(logEntry);
  fs.writeFileSync(logFilePath, JSON.stringify(logs), 'utf-8');
}

export default {
  getLogs,
  logMessage,
  clearLogs,
};
