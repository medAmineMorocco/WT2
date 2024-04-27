import { ipcMain } from 'electron';
import gitMainService from '../../services/git/gitMainService';

ipcMain.on('show-git-log', async function (event, directory: string) {
  try {
    const gitLog = await gitMainService.showLog(directory);
    event.sender.send('receive-git-log', 0, gitLog);
  } catch (err: any) {
    event.sender.send('receive-git-log', -1, err.message);
  }
});
