import { ipcMain } from 'electron';
import log from 'electron-log';
import branchesMainService from '../../services/branches/branchesMainService';

ipcMain.on('get-branches', async function (event, directory: string) {
  try {
    log.info('Getting branches');
    const branches = await branchesMainService.findAll(directory);
    log.debug(`branches: ${branches}`);
    event.sender.send('branches-found', 0, JSON.stringify(branches));
  } catch (err: any) {
    log.error(err.message);
    event.sender.send(
      'branches-found',
      -1,
      'Failed to retrieve branches. Please try again or check your repository setup.',
    );
  }
});
