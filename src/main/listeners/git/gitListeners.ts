import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import log from 'electron-log';
import gitMainService from '../../services/git/gitMainService';
import utils from '../../utils/utils';

ipcMain.on(
  'show-git-log',
  async function (
    event,
    directory: string,
    branch: string,
    author: string,
    skip = 0,
    limit = 40,
  ) {
    try {
      log.info('Getting git log');
      const gitLog = await gitMainService.showLog(
        directory,
        branch,
        author,
        skip,
        limit,
      );
      event.sender.send('receive-git-log', 0, gitLog, skip);
    } catch (err: any) {
      log.error(`Failed to get git log: ${err.message}`);
      event.sender.send('receive-git-log', -1, 'Failed to load Git log.');
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
      log.info('Getting git diff');
      const gitDiffCompressed = await gitMainService.showDiff(
        val1,
        val2,
        diffFilters,
        isAll,
        directory,
      );
      event.sender.send('receive-git-diff', 0, gitDiffCompressed);
    } catch (err: any) {
      log.error(`Failed to get git diff: ${err.message}`);
      event.sender.send(
        'receive-git-diff',
        -1,
        'Failed to display Git diff. Please verify your selections and try again.',
      );
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
      log.info('Getting git diff stats');
      const stats = await gitMainService.diffStats(
        val1,
        val2,
        diffFilters,
        isAll,
        directory,
      );
      event.sender.send('receive-diff-stats', 0, stats);
    } catch (err: any) {
      log.error(`Failed to get git diff stats: ${err.message}`);
      event.sender.send(
        'receive-diff-stats',
        -1,
        'Failed to retrieve Git diff statistics.',
      );
    }
  },
);

ipcMain.on('list-branches', async function (event, directory: string) {
  try {
    log.info('Getting branches');
    const branches = await gitMainService.listBranches(directory);
    event.sender.send('receive-branches', 0, JSON.stringify(branches));
  } catch (err: any) {
    log.error(`Failed to get branches: ${err.message}`);
    event.sender.send('receive-branches', -1, 'Failed to list branches.');
  }
});

ipcMain.on('list-tags', async function (event, directory: string) {
  try {
    log.info('Getting tags');
    const tags = await gitMainService.listTags(directory);
    event.sender.send('receive-tags', 0, tags);
  } catch (err: any) {
    log.error(`Failed to get tags: ${err.message}`);
    event.sender.send('receive-tags', -1, 'Failed to list tags.');
  }
});

ipcMain.on('list-worktrees', async function (event, directory: string) {
  try {
    log.info('Getting worktrees');
    const worktrees = await gitMainService.listWorktrees(directory);
    event.sender.send('receive-worktrees', 0, worktrees);
  } catch (err: any) {
    log.error(`Failed to get worktrees: ${err.message}`);
    event.sender.send('receive-worktrees', -1, 'Failed to list worktrees.');
  }
});

ipcMain.on('list-authors', async function (event, directory: string) {
  try {
    log.info('Getting authors');
    const authors = await gitMainService.listAuthors(directory);
    event.sender.send('receive-authors', 0, authors);
  } catch (err: any) {
    log.error(`Failed to get authors: ${err.message}`);
    event.sender.send('receive-authors', -1, 'Failed to list authors.');
  }
});

ipcMain.on('list-refs', async function (event, directory: string) {
  try {
    log.info('Getting refs');
    const refs = await gitMainService.listRefs(directory);
    event.sender.send('receive-refs', 0, refs);
  } catch (err: any) {
    log.error(`Failed to get refs: ${err.message}`);
    event.sender.send('receive-refs', -1, 'Failed to list git references.');
  }
});

let abortController: AbortController;
let commandProcess: any;
ipcMain.on(
  'execute-command',
  async function (event, command: string, directory: string) {
    log.info(`Executing command ${command}`);
    abortController = new AbortController();
    const shell = await gitMainService.getShell();
    const options: any = {
      cwd: directory,
      shell: shell || true,
      signal: abortController.signal,
    };

    commandProcess = spawn(command, [], options);

    commandProcess.stdout.on('data', async (data: any) => {
      const encoded = await utils.setStoredEncoding(data);
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.stderr.on('data', async (data: any) => {
      const encoded = await utils.setStoredEncoding(data);
      log.error(`Command error: ${encoded}`);
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.on('error', async (err: any) => {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to execute command: ${encoded}`);
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.on('exit', () => {
      event.sender.send('command-finished');
    });
  },
);

ipcMain.on('stop-command', function (event) {
  log.info('Command stopped by user');
  abortController.abort();
  commandProcess.kill('SIGKILL');
  event.sender.send('command-stopped');
});
