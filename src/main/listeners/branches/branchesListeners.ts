import { ipcMain } from 'electron';
import branchesMainService from '../../services/branches/branchesMainService';
import utils from '../../utils/utils';

ipcMain.on('get-branches', async function (event, directory: string) {
  try {
    const branches = await branchesMainService.findAll(directory);
    event.sender.send('branches-found', 0, JSON.stringify(branches));
  } catch (err: any) {
    event.sender.send(
      'branches-found',
      -1,
      utils.setEncoding(Buffer.from(err.message)),
    );
  }
});
