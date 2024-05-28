import { BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import gitMainService from '../../services/git/gitMainService';
import settingsMainService from '../../services/settings/settingsMainService';

ipcMain.on(
  'show-git-log',
  async function (event, directory: string, branch: string) {
    try {
      const gitLog = await gitMainService.showLog(directory, branch);
      event.sender.send('receive-git-log', 0, gitLog);
    } catch (err: any) {
      event.sender.send('receive-git-log', -1, err.message);
    }
  },
);

ipcMain.on(
  'show-git-diff',
  async function (
    event,
    val1: string,
    val2: string,
    directory: string,
    isDarkMode: boolean,
  ) {
    try {
      const gitDiff = await gitMainService.showDiff(
        val1,
        val2,
        directory,
        isDarkMode,
      );
      event.sender.send('receive-git-diff', 0, gitDiff);
    } catch (err: any) {
      event.sender.send('receive-git-diff', -1, err.message);
    }
  },
);

ipcMain.on('list-branches', async function (event, directory: string) {
  try {
    const branches = await gitMainService.listBranches(directory);
    event.sender.send('receive-branches', 0, branches);
  } catch (err: any) {
    event.sender.send('receive-branches', -1, err.message);
  }
});

ipcMain.on('list-tags', async function (event, directory: string) {
  try {
    const tags = await gitMainService.listTags(directory);
    event.sender.send('receive-tags', 0, tags);
  } catch (err: any) {
    event.sender.send('receive-tags', -1, err.message);
  }
});

ipcMain.on('list-worktrees', async function (event, directory: string) {
  try {
    const worktrees = await gitMainService.listWorktrees(directory);
    event.sender.send('receive-worktrees', 0, worktrees);
  } catch (err: any) {
    event.sender.send('receive-worktrees', -1, err.message);
  }
});

let abortController: AbortController;
ipcMain.on(
  'execute-command',
  async function (event, command: string, directory: string) {
    abortController = new AbortController();

    const options: any = {
      cwd: directory,
      shell: true,
      signal: abortController.signal,
    };

    const terminal = await settingsMainService.getActualTerminal(
      BrowserWindow.getFocusedWindow(),
    );
    if (terminal) {
      options.shell = terminal;
    }
    const commandProcess = spawn(command, [], options);

    commandProcess.stdout.on('data', (data: any) => {
      event.sender.send('command-receive-data', 0, data.toString());
    });

    commandProcess.stderr.on('data', (data: any) => {
      event.sender.send('command-receive-data', 0, data.toString());
    });

    commandProcess.on('error', (err: any) => {
      event.sender.send('command-receive-data', 0, err.toString());
    });

    commandProcess.on('exit', (code: any) => {
      event.sender.send('command-finished');
    });
  },
);

ipcMain.on('stop-command', function (event) {
  abortController.abort();
  event.sender.send('command-stopped');
});
