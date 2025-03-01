import { dialog, ipcMain } from 'electron';
import path from 'path';
import worktreeMainService from '../../services/worktrees/worktreeMainService';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';
import loggingService from '../../services/logging/loggingService';
import LogLevel from '../../enums/LogLevel';

const intervalIds: any[] = [];
ipcMain.on(
  'create-worktree',
  async function (event, name, worktreePath, createWorktreeMode, directory) {
    try {
      loggingService.logMessage(
        directory,
        `Creating a new worktree ${name} in path ${worktreePath}`,
        LogLevel.INFO,
      );
      const result = await worktreeMainService.add(
        name,
        worktreePath,
        createWorktreeMode,
        directory,
      );
      loggingService.logMessage(
        directory,
        `Worktree ${name} was created successfully in path ${worktreePath}`,
        LogLevel.INFO,
      );
      event.sender.send('worktree-created', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to create worktree ${name} in path ${worktreePath}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('worktree-created', -1, encoded);
    }
  },
);

ipcMain.on(
  'remove-worktree',
  async function (event, worktreePath, directory, force) {
    try {
      loggingService.logMessage(
        directory,
        `Removing worktree in path ${worktreePath}`,
        LogLevel.INFO,
      );
      const result = await worktreeMainService.remove(
        worktreePath,
        directory,
        force,
      );
      loggingService.logMessage(
        directory,
        `Worktree in path ${worktreePath} was removed successfully`,
        LogLevel.INFO,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to remove worktree in path ${worktreePath}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send(
        'worktree-removed',
        -1,
        encoded,
        worktreePath,
        null,
        false,
      );
    }
  },
);

ipcMain.on(
  'remove-worktree-local-branch',
  async function (event, name, worktreePath, directory, force) {
    try {
      loggingService.logMessage(
        directory,
        `Removing worktree with local branch ${name} in path ${worktreePath}`,
        LogLevel.INFO,
      );
      const result = await worktreeMainService.removeWithLocalBranch(
        name,
        worktreePath,
        directory,
        force,
      );
      loggingService.logMessage(
        directory,
        `Worktree with local branch ${name} in path ${worktreePath} was removed successfully`,
        LogLevel.INFO,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to remove worktree with local branch ${name} in path ${worktreePath}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send(
        'worktree-removed',
        -1,
        encoded,
        worktreePath,
        name,
        true,
      );
    }
  },
);

ipcMain.on(
  'rename-worktree',
  async function (event, oldName, newName, oldWorktreePath, directory) {
    try {
      loggingService.logMessage(
        directory,
        `Renaming worktree ${oldName} to ${newName}`,
        LogLevel.INFO,
      );
      const result = await worktreeMainService.rename(
        oldName,
        newName,
        oldWorktreePath,
        directory,
      );
      loggingService.logMessage(
        directory,
        `Worktree ${oldName} was renamed to ${newName}`,
        LogLevel.INFO,
      );
      event.sender.send('worktree-renamed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to rename worktree ${oldName} to ${newName}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('worktree-renamed', -1, encoded);
    }
  },
);

ipcMain.on('get-worktrees', async function (event, directory: string) {
  const gitCommand = await gitMainService.gitCommand();
  try {
    loggingService.logMessage(directory, 'Getting worktrees', LogLevel.INFO);
    const worktrees = await worktreeMainService.findAll(directory, gitCommand);
    loggingService.logMessage(directory, 'Worktrees found', LogLevel.INFO);
    event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to get worktrees: ${err.message}`,
      LogLevel.ERROR,
    );
    event.sender.send('worktrees-found', -1, encoded);
  }
  intervalIds.push(
    setInterval(async () => {
      try {
        const worktrees = await worktreeMainService.findAll(
          directory,
          gitCommand,
        );
        event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
      } catch (err: any) {
        const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
        event.sender.send('worktrees-found', -1, encoded);
      }
    }, 10000),
  );
});

ipcMain.on('clear-interval', function (event) {
  if (intervalIds) {
    intervalIds.forEach((interval) => clearInterval(interval));
  }
});

ipcMain.on('prune-worktrees', async function (event, directory: string) {
  try {
    loggingService.logMessage(directory, 'Pruning worktrees', LogLevel.INFO);
    await worktreeMainService.prune(directory);
    loggingService.logMessage(directory, 'Worktrees pruned', LogLevel.INFO);
    event.sender.send('worktrees-pruned', 0);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to prune worktrees: ${err.message}`,
      LogLevel.ERROR,
    );
    event.sender.send('worktrees-pruned', -1, encoded);
  }
});

ipcMain.on(
  'change-lock-worktree',
  async function (
    event,
    toLock: boolean,
    worktreeName: string,
    directory: string,
  ) {
    try {
      loggingService.logMessage(
        directory,
        `Changing lock of worktree ${worktreeName} to ${toLock}`,
        LogLevel.INFO,
      );
      await worktreeMainService.changeLock(toLock, worktreeName, directory);
      loggingService.logMessage(
        directory,
        `Lock of worktree ${worktreeName} was changed to ${toLock}`,
        LogLevel.INFO,
      );
      event.sender.send('worktrees-changed-lock', 0, toLock);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to change lock of worktree ${worktreeName} to ${toLock}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('worktrees-changed-lock', -1, toLock, encoded);
    }
  },
);

ipcMain.on('get-worktrees-folder', async function (event, directory: string) {
  try {
    loggingService.logMessage(
      directory,
      'Getting worktrees folder',
      LogLevel.INFO,
    );
    const { folder, separator }: any =
      await worktreeMainService.getWorktreesFolder(directory);
    loggingService.logMessage(
      directory,
      `Worktrees folder found: ${folder}`,
      LogLevel.INFO,
    );
    event.sender.send(
      'worktrees-folder-found',
      0,
      JSON.stringify({ folder, separator }),
    );
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      directory,
      `Failed to get worktrees folder: ${err.message}`,
      LogLevel.ERROR,
    );
    event.sender.send('worktrees-folder-found', -1, encoded);
  }
});

ipcMain.on('get-worktrees-separator', async function (event) {
  try {
    loggingService.logMessage(
      '-',
      'Getting worktrees separator',
      LogLevel.INFO,
    );
    const separator = await worktreeMainService.getWorktreesSeparator();
    loggingService.logMessage(
      '-',
      `Worktrees separator found: ${separator}`,
      LogLevel.INFO,
    );
    event.sender.send('worktrees-separator-found', 0, separator);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      '-',
      `Failed to get worktrees separator: ${err.message}`,
      LogLevel.ERROR,
    );
    event.sender.send('worktrees-separator-found', -1, encoded);
  }
});

ipcMain.on(
  'move-worktree-to-folder',
  async function (
    event,
    name: string,
    newWorktreePath: string,
    directory: string,
  ) {
    try {
      loggingService.logMessage(
        directory,
        `Moving worktree ${name} to folder ${newWorktreePath}`,
        LogLevel.INFO,
      );
      await worktreeMainService.moveWorktreeToFolder(
        name,
        newWorktreePath,
        directory,
      );
      loggingService.logMessage(
        directory,
        `Worktree ${name} was moved to folder ${newWorktreePath}`,
        LogLevel.INFO,
      );
      event.sender.send('worktree-moved-to-folder', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to move worktree ${name} to folder ${newWorktreePath}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('worktree-moved-to-folder', -1, encoded);
    }
  },
);

ipcMain.on('choose-worktrees-dir', async function (event) {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  loggingService.logMessage('-', 'Choosing worktrees directory', LogLevel.INFO);
  if (!result.canceled) {
    const [dir] = result.filePaths;
    const name = path.basename(dir);
    loggingService.logMessage(
      '-',
      `Worktrees directory chosen: ${dir}`,
      LogLevel.INFO,
    );
    event.sender.send('selected-worktrees-dir', 0, dir, name);
  }
});
