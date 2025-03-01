import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import gitMainService from '../../services/git/gitMainService';
import utils from '../../utils/utils';
import loggingService from '../../services/logging/loggingService';
import LogLevel from '../../enums/LogLevel';

ipcMain.on(
  'show-git-log',
  async function (event, directory: string, branch: string, author: string) {
    try {
      loggingService.logMessage(directory, 'Getting git log', LogLevel.INFO);
      const gitLog = await gitMainService.showLog(directory, branch, author);
      loggingService.logMessage(directory, 'Git log found', LogLevel.INFO);
      event.sender.send('receive-git-log', 0, gitLog);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to get git log: ${encoded}`,
        LogLevel.ERROR,
      );
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
      loggingService.logMessage(directory, 'Getting git diff', LogLevel.INFO);
      const gitDiffCompressed = await gitMainService.showDiff(
        val1,
        val2,
        diffFilters,
        isAll,
        directory,
      );
      loggingService.logMessage(directory, 'Git diff found', LogLevel.INFO);
      event.sender.send('receive-git-diff', 0, gitDiffCompressed);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to get git diff: ${encoded}`,
        LogLevel.ERROR,
      );
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
      loggingService.logMessage(
        directory,
        'Getting git diff stats',
        LogLevel.INFO,
      );
      const stats = await gitMainService.diffStats(
        val1,
        val2,
        diffFilters,
        isAll,
        directory,
      );
      loggingService.logMessage(
        directory,
        'Git diff stats found',
        LogLevel.INFO,
      );
      event.sender.send('receive-diff-stats', 0, stats);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to get git diff stats: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('receive-diff-stats', -1, encoded);
    }
  },
);

ipcMain.on('list-branches', async function (event, directory: string) {
  try {
    loggingService.logMessage(directory, 'Getting branches', LogLevel.INFO);
    const branches = await gitMainService.listBranches(directory);
    loggingService.logMessage(directory, 'Branches found', LogLevel.INFO);
    event.sender.send('receive-branches', 0, branches);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to get branches: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('receive-branches', -1, encoded);
  }
});

ipcMain.on('list-tags', async function (event, directory: string) {
  try {
    loggingService.logMessage(directory, 'Getting tags', LogLevel.INFO);
    const tags = await gitMainService.listTags(directory);
    loggingService.logMessage(directory, 'Tags found', LogLevel.INFO);
    event.sender.send('receive-tags', 0, tags);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to get tags: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('receive-tags', -1, encoded);
  }
});

ipcMain.on('list-worktrees', async function (event, directory: string) {
  try {
    loggingService.logMessage(directory, 'Getting worktrees', LogLevel.INFO);
    const worktrees = await gitMainService.listWorktrees(directory);
    loggingService.logMessage(directory, 'Worktrees found', LogLevel.INFO);
    event.sender.send('receive-worktrees', 0, worktrees);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to get worktrees: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('receive-worktrees', -1, encoded);
  }
});

ipcMain.on('list-authors', async function (event, directory: string) {
  try {
    loggingService.logMessage(directory, 'Getting authors', LogLevel.INFO);
    const authors = await gitMainService.listAuthors(directory);
    loggingService.logMessage(directory, 'Authors found', LogLevel.INFO);
    event.sender.send('receive-authors', 0, authors);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to get authors: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('receive-authors', -1, encoded);
  }
});

ipcMain.on('list-refs', async function (event, directory: string) {
  try {
    loggingService.logMessage(directory, 'Getting refs', LogLevel.INFO);
    const refs = await gitMainService.listRefs(directory);
    loggingService.logMessage(directory, 'Refs found', LogLevel.INFO);
    event.sender.send('receive-refs', 0, refs);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to get refs: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('receive-refs', -1, encoded);
  }
});

let abortController: AbortController;
let commandProcess: any;
ipcMain.on(
  'execute-command',
  async function (event, command: string, directory: string) {
    loggingService.logMessage(
      directory,
      `Executing command ${command}`,
      LogLevel.INFO,
    );
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
      loggingService.logMessage(
        directory,
        `Command output: ${encoded}`,
        LogLevel.INFO,
      );
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.stderr.on('data', async (data: any) => {
      const encoded = await utils.setStoredEncoding(data);
      loggingService.logMessage(
        directory,
        `Command error: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.on('error', async (err: any) => {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to execute command: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('command-receive-data', 0, encoded);
    });

    commandProcess.on('exit', () => {
      event.sender.send('command-finished');
    });
  },
);

ipcMain.on('stop-command', function (event) {
  abortController.abort();
  commandProcess.kill('SIGKILL');
  loggingService.logMessage('-', 'Command stopped by user', LogLevel.INFO);
  event.sender.send('command-stopped');
});
