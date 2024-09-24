import { dialog, ipcMain } from 'electron';
import path from 'path';
import worktreeMainService from '../../services/worktrees/worktreeMainService';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';

const intervalIds: any[] = [];
ipcMain.on(
  'create-worktree',
  async function (event, name, worktreePath, createWorktreeMode, directory) {
    try {
      const result = await worktreeMainService.add(
        name,
        worktreePath,
        createWorktreeMode,
        directory,
      );
      event.sender.send('worktree-created', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('worktree-created', -1, encoded);
    }
  },
);

ipcMain.on(
  'remove-worktree',
  async function (event, worktreePath, directory, force) {
    try {
      const result = await worktreeMainService.remove(
        worktreePath,
        directory,
        force,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
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
      const result = await worktreeMainService.removeWithLocalBranch(
        name,
        worktreePath,
        directory,
        force,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
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
      const result = await worktreeMainService.rename(
        oldName,
        newName,
        oldWorktreePath,
        directory,
      );
      event.sender.send('worktree-renamed', 0, result);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('worktree-renamed', -1, encoded);
    }
  },
);

ipcMain.on('get-worktrees', async function (event, directory: string) {
  const gitCommand = await gitMainService.gitCommand();
  try {
    const worktrees = await worktreeMainService.findAll(directory, gitCommand);
    event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
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
    await worktreeMainService.prune(directory);
    event.sender.send('worktrees-pruned', 0);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
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
      await worktreeMainService.changeLock(toLock, worktreeName, directory);
      event.sender.send('worktrees-changed-lock', 0, toLock);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('worktrees-changed-lock', -1, toLock, encoded);
    }
  },
);

ipcMain.on('get-worktrees-folder', async function (event, directory: string) {
  try {
    const { folder, separator }: any =
      await worktreeMainService.getWorktreesFolder(directory);
    event.sender.send(
      'worktrees-folder-found',
      0,
      JSON.stringify({ folder, separator }),
    );
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('worktrees-folder-found', -1, encoded);
  }
});

ipcMain.on('get-worktrees-separator', async function (event) {
  try {
    const separator = await worktreeMainService.getWorktreesSeparator();
    event.sender.send('worktrees-separator-found', 0, separator);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
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
      await worktreeMainService.moveWorktreeToFolder(
        name,
        newWorktreePath,
        directory,
      );
      event.sender.send('worktree-moved-to-folder', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('worktree-moved-to-folder', -1, encoded);
    }
  },
);

ipcMain.on('choose-worktrees-dir', async function (event) {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (!result.canceled) {
    const [dir] = result.filePaths;
    const name = path.basename(dir);

    event.sender.send('selected-worktrees-dir', 0, dir, name);
  }
});
