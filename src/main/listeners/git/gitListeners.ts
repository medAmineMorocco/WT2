import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import gitMainService from '../../services/git/gitMainService';
import utils from '../../utils/utils';

ipcMain.on(
  'show-git-log',
  async function (event, directory: string, branch: string) {
    try {
      const gitLog = await gitMainService.showLog(directory, branch);
      event.sender.send('receive-git-log', 0, gitLog);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('receive-git-log', -1, encoded);
    }
  },
);

ipcMain.on(
  'show-git-diff',
  async function (
    event,
    val1: string,
    val2: string,
    diffFilters: string,
    isAll: boolean,
    directory: string,
  ) {
    try {
      const gitDiffCompressed = await gitMainService.showDiff(
        val1,
        val2,
        diffFilters,
        isAll,
        directory,
      );
      event.sender.send('receive-git-diff', 0, gitDiffCompressed);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('receive-git-diff', -1, encoded);
    }
  },
);

ipcMain.on(
  'git-diff-stats',
  async function (
    event,
    val1: string,
    val2: string,
    diffFilters: string,
    isAll: boolean,
    directory: string,
  ) {
    try {
      const stats = await gitMainService.diffStats(
        val1,
        val2,
        diffFilters,
        isAll,
        directory,
      );
      event.sender.send('receive-diff-stats', 0, stats);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('receive-diff-stats', -1, encoded);
    }
  },
);

ipcMain.on('list-branches', async function (event, directory: string) {
  try {
    const branches = await gitMainService.listBranches(directory);
    event.sender.send('receive-branches', 0, branches);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('receive-branches', -1, encoded);
  }
});

ipcMain.on('list-tags', async function (event, directory: string) {
  try {
    const tags = await gitMainService.listTags(directory);
    event.sender.send('receive-tags', 0, tags);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('receive-tags', -1, encoded);
  }
});

ipcMain.on('list-worktrees', async function (event, directory: string) {
  try {
    const worktrees = await gitMainService.listWorktrees(directory);
    event.sender.send('receive-worktrees', 0, worktrees);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('receive-worktrees', -1, encoded);
  }
});

ipcMain.on('list-refs', async function (event, directory: string) {
  try {
    const refs = await gitMainService.listRefs(directory);
    event.sender.send('receive-refs', 0, refs);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('receive-refs', -1, encoded);
  }
});

let abortController: AbortController;
ipcMain.on(
  'execute-command',
  async function (event, command: string, directory: string) {
    abortController = new AbortController();
    const shell = await gitMainService.getShell();
    const options: any = {
      cwd: directory,
      shell: shell || true,
      signal: abortController.signal,
    };

    const commandProcess = spawn(command, [], options);

    commandProcess.stdout.on('data', async (data: any) => {
      const encoded = await utils.setStoredEncoding(data);
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.stderr.on('data', async (data: any) => {
      const encoded = await utils.setStoredEncoding(data);
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.on('error', async (err: any) => {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.on('exit', () => {
      event.sender.send('command-finished');
    });
  },
);

ipcMain.on('stop-command', function (event) {
  abortController.abort();
  event.sender.send('command-stopped');
});
