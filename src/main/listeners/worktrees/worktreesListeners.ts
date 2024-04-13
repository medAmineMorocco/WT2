import { ipcMain } from 'electron';
import worktreeMainService from '../../services/worktrees/worktreeMainService';

const intervalIds: any[] = [];
ipcMain.on(
  'create-worktree',
  async function (event, name, isExistingBranch, directory) {
    try {
      const result = await worktreeMainService.add(
        name,
        isExistingBranch,
        directory,
      );
      event.sender.send('worktree-created', 0, result);
    } catch (err: any) {
      event.sender.send('worktree-created', -1, err.message);
    }
  },
);

ipcMain.on('remove-worktree', async function (event, name, directory, force) {
  try {
    const result = await worktreeMainService.remove(name, directory, force);
    event.sender.send('worktree-removed', 0, result);
  } catch (err: any) {
    event.sender.send('worktree-removed', -1, err.message);
  }
});

ipcMain.on(
  'remove-worktree-local-branch',
  async function (event, name, directory, force) {
    try {
      const result = await worktreeMainService.removeWithLocalBranch(
        name,
        directory,
        force,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      event.sender.send('worktree-removed', -1, err.message);
    }
  },
);

ipcMain.on(
  'remove-worktree-local-remote-branch',
  async function (event, name, directory, force) {
    try {
      const result = await worktreeMainService.removeWithLocalAndRemoteBranch(
        name,
        directory,
        force,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      event.sender.send('worktree-removed', -1, err.message);
    }
  },
);

ipcMain.on(
  'rename-worktree',
  async function (event, oldName, newName, directory) {
    try {
      const result = await worktreeMainService.rename(
        oldName,
        newName,
        directory,
      );
      event.sender.send('worktree-renamed', 0, result);
    } catch (err: any) {
      event.sender.send('worktree-renamed', -1, err.message);
    }
  },
);

ipcMain.on('get-worktrees', async function (event, directory: string) {
  try {
    const worktrees = await worktreeMainService.findAll(directory);
    event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
  } catch (err: any) {
    event.sender.send('worktrees-found', -1, err.message);
  }
  intervalIds.push(
    setInterval(async () => {
      try {
        const worktrees = await worktreeMainService.findAll(directory);
        event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
      } catch (err: any) {
        event.sender.send('worktrees-found', -1, err.message);
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
    event.sender.send('worktrees-pruned', -1, err.message);
  }
});
