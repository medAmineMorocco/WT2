import { ipcMain } from 'electron';
import log from 'electron-log';
import branchesMainService from '../../services/branches/branchesMainService';
import utils from '../../utils/utils';

ipcMain.on('get-branches', async function (event, directory: string) {
  try {
    log.info('Getting branches');
    const branches = await branchesMainService.findAll(directory);
    log.debug(`branches: ${branches}`);
    event.sender.send('branches-found', 0, JSON.stringify(branches));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(encoded);
    event.sender.send('branches-found', -1, encoded);
  }
});
