import { ipcMain } from 'electron';
import branchesMainService from '../../services/branches/branchesMainService';
import utils from '../../utils/utils';
import loggingService from '../../services/logging/loggingService';
import LogLevel from '../../enums/LogLevel';

ipcMain.on('get-branches', async function (event, directory: string) {
  try {
    loggingService.logMessage(directory, 'Getting branches', LogLevel.INFO);
    const branches = await branchesMainService.findAll(directory);
    loggingService.logMessage(directory, 'Branches found', LogLevel.INFO);
    event.sender.send('branches-found', 0, JSON.stringify(branches));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to get branches: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('branches-found', -1, encoded);
  }
});
