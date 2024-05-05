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

ipcMain.on(
  'execute-command',
  async function (event, command: string, directory: string) {
    try {
      const gitLog = await gitMainService.executeCommand(command, directory);
      event.sender.send('command-executed', 0, gitLog);
    } catch (err: any) {
      event.sender.send('command-executed', -1, err.message);
    }
  },
);
