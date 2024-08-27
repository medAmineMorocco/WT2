import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import gitMainService from '../../services/git/gitMainService';

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
    diffFilters: string,
    isAll: boolean,
    directory: string,
  ) {
    try {
      const gitDiff = await gitMainService.showDiff(
        val1,
        val2,
        diffFilters,
        isAll,
        directory,
      );
      event.sender.send('receive-git-diff', 0, gitDiff);
    } catch (err: any) {
      event.sender.send('receive-git-diff', -1, err.message);
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
      event.sender.send('receive-diff-stats', -1, err.message);
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

ipcMain.on('list-refs', async function (event, directory: string) {
  try {
    const refs = await gitMainService.listRefs(directory);
    event.sender.send('receive-refs', 0, refs);
  } catch (err: any) {
    event.sender.send('receive-refs', -1, err.message);
  }
});

function setEncoding(buffer: any) {
  const defaultEncoding = chardet.detect(buffer);
  return iconv
    .decode(buffer, defaultEncoding !== 'UTF-8' ? 'cp437' : 'utf8')
    .toString();
}

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

    commandProcess.stdout.on('data', (data: any) => {
      event.sender.send('command-receive-data', 0, setEncoding(data));
    });

    commandProcess.stderr.on('data', (data: any) => {
      event.sender.send('command-receive-data', 0, setEncoding(data));
    });

    commandProcess.on('error', (err: any) => {
      const encoder = new TextEncoder();
      event.sender.send(
        'command-receive-data',
        0,
        setEncoding(encoder.encode(err.message)),
      );
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
