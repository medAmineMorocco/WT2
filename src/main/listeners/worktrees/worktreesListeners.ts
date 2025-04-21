import { ipcMain } from 'electron';
import log from 'electron-log';
import worktreeMainService from '../../services/worktrees/worktreeMainService';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';

const intervalIds: any[] = [];
ipcMain.on(
  'create-worktree',
  async function (event, name, worktreePath, createWorktreeMode, directory) {
    try {
      log.info(`Creating a new worktree ${name} in path ${worktreePath}`);
      const result = await worktreeMainService.add(
        name,
        worktreePath,
        createWorktreeMode,
        directory,
      );
      event.sender.send('worktree-created', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(
        `Failed to create worktree ${name} in path ${worktreePath}: ${err.message}`,
      );
      event.sender.send('worktree-created', -1, encoded);
    }
  },
);

ipcMain.on(
  'remove-worktree',
  async function (event, worktreePath, directory, force) {
    try {
      log.info(`Removing worktree in path ${worktreePath}`);
      const result = await worktreeMainService.remove(
        worktreePath,
        directory,
        force,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(
        `Failed to remove worktree in path ${worktreePath}: ${err.message}`,
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
      log.info(
        `Removing worktree with local branch ${name} in path ${worktreePath}`,
      );
      const result = await worktreeMainService.removeWithLocalBranch(
        name,
        worktreePath,
        directory,
        force,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(
        `Failed to remove worktree with local branch ${name} in path ${worktreePath}: ${err.message}`,
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
      log.info(`Renaming worktree ${oldName} to ${newName}`);
      const result = await worktreeMainService.rename(
        oldName,
        newName,
        oldWorktreePath,
        directory,
      );
      event.sender.send('worktree-renamed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(
        `Failed to rename worktree ${oldName} to ${newName}: ${err.message}`,
      );
      event.sender.send('worktree-renamed', -1, encoded);
    }
  },
);

ipcMain.on('get-worktrees', async function (event, directory: string) {
  const gitCommand = await gitMainService.gitCommand();
  try {
    log.info('Getting worktrees');
    const worktrees = await worktreeMainService.findAll(directory, gitCommand);
    event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(`Failed to get worktrees: ${err.message}`);
    event.sender.send('worktrees-found', -1, encoded);
  }
});

ipcMain.on(
  'get-worktrees-periodically',
  async function (event, directory: string) {
    const gitCommand = await gitMainService.gitCommand();
    intervalIds.push(
      setInterval(async () => {
        try {
          log.info('Getting worktrees periodically');
          const worktrees = await worktreeMainService.findAll(
            directory,
            gitCommand,
          );
          event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
        } catch (err: any) {
          const encoded = await utils.setStoredEncoding(
            Buffer.from(err.message),
          );
          log.error(`Failed to get worktrees: ${err.message}`);
          event.sender.send('worktrees-found', -1, encoded);
        }
      }, 10000),
    );
  },
);

ipcMain.on('clear-interval', function (event) {
  if (intervalIds) {
    intervalIds.forEach((interval) => clearInterval(interval));
  }
});

ipcMain.on('prune-worktrees', async function (event, directory: string) {
  try {
    log.info('Pruning worktrees');
    await worktreeMainService.prune(directory);
    event.sender.send('worktrees-pruned', 0);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(`Failed to prune worktrees: ${err.message}`);
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
      log.info(`Changing lock of worktree ${worktreeName} to ${toLock}`);
      await worktreeMainService.changeLock(toLock, worktreeName, directory);
      event.sender.send('worktrees-changed-lock', 0, toLock);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(
        `Failed to change lock of worktree ${worktreeName} to ${toLock}: ${err.message}`,
      );
      event.sender.send('worktrees-changed-lock', -1, toLock, encoded);
    }
  },
);

ipcMain.on('get-worktrees-folder', async function (event, directory: string) {
  try {
    log.info('Getting worktrees folder');
    const { folder, separator }: any =
      await worktreeMainService.getWorktreesFolder(directory);
    event.sender.send(
      'worktrees-folder-found',
      0,
      JSON.stringify({ folder, separator }),
    );
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(`Failed to get worktrees folder: ${err.message}`);
    event.sender.send('worktrees-folder-found', -1, encoded);
  }
});

ipcMain.on('get-worktrees-separator', async function (event) {
  try {
    log.info('Getting worktrees separator');
    const separator = await worktreeMainService.getWorktreesSeparator();
    event.sender.send('worktrees-separator-found', 0, separator);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(`Failed to get worktrees separator: ${err.message}`);
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
      log.info(`Moving worktree ${name} to folder ${newWorktreePath}`);
      await worktreeMainService.moveWorktreeToFolder(
        name,
        newWorktreePath,
        directory,
      );
      event.sender.send('worktree-moved-to-folder', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(
        `Failed to move worktree ${name} to folder ${newWorktreePath}: ${err.message}`,
      );
      event.sender.send('worktree-moved-to-folder', -1, encoded);
    }
  },
);
