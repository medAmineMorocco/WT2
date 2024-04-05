import { ipcMain } from 'electron';
import worktreeMainService from '../../services/worktreeMainService';

ipcMain.on('create-worktree', async function (event, name, directory) {
  try {
    const result = await worktreeMainService.add(name, directory);
    event.sender.send('worktree-created', 0, result);
  } catch (err) {
    event.sender.send('worktree-created', -1, err);
  }
});

ipcMain.on('remove-worktree', async function (event, name, directory, force) {
  try {
    const result = await worktreeMainService.remove(name, directory, force);
    event.sender.send('worktree-removed', 0, result);
  } catch (err) {
    event.sender.send('worktree-removed', -1, err);
  }
});

ipcMain.on('get-worktrees', async function (event, directory: string) {
  try {
    const worktrees = await worktreeMainService.findAll(directory);
    event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
  } catch (err) {
    event.sender.send('worktrees-found', -1, err);
  }
});
