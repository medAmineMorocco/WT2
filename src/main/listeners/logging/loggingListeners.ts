import { ipcMain } from 'electron';
import loggingService from '../../services/logging/loggingService';
import utils from '../../utils/utils';

ipcMain.on('get-logs', async function (event) {
  try {
    const logs = await loggingService.getLogs();
    event.sender.send('logs-found', 0, JSON.stringify(logs));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('logs-found', -1, encoded);
  }
});

ipcMain.on('clear-logs', async function (event) {
  try {
    loggingService.clearLogs();
    event.sender.send('logs-cleared', 0);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('logs-cleared', -1, encoded);
  }
});
