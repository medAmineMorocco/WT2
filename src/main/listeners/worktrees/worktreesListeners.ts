import { BrowserWindow, dialog, ipcMain } from 'electron';
import log from '../../utils/logger';
import worktreeMainService from '../../services/worktrees/worktreeMainService';
import BusinessError from '../../exceptions/BusinessError';
import environmentIsolationService, {
  generateIsolatedEnvironmentSources,
} from '../../services/environment/environmentIsolationService';
import nodeModulesSharingService from '../../services/worktrees/nodeModulesSharingService';
import { EnvironmentIsolationConfig } from '../../../shared/environmentIsolation';

ipcMain.handle(
  'get-sparse-checkout-tree',
  async (_event, directory: string, ref?: string) =>
    worktreeMainService.getSparseCheckoutTree(directory, ref || 'HEAD'),
);

ipcMain.on(
  'check-main-node-modules',
  async function (event, directory: string) {
    try {
      const worktrees =
        await nodeModulesSharingService.getWorktreesWithNodeModules(directory);
      event.sender.send('main-node-modules-checked', 0, worktrees);
    } catch (err: any) {
      event.sender.send('main-node-modules-checked', -1, []);
    }
  },
);

ipcMain.on(
  'detect-environment-sources',
  async function (event, directory: string) {
    try {
      const sources =
        await environmentIsolationService.detectEnvironmentSources(directory);
      event.sender.send('environment-sources-detected', 0, sources);
    } catch (err: any) {
      event.sender.send('environment-sources-detected', -1, err.message);
    }
  },
);

ipcMain.on(
  'read-environment-source',
  async function (event, directory: string, source) {
    try {
      const settings = await environmentIsolationService.readEnvironmentSource(
        directory,
        source,
      );
      event.sender.send('environment-source-read', 0, settings, source);
    } catch (err: any) {
      event.sender.send('environment-source-read', -1, err.message, source);
    }
  },
);

ipcMain.on(
  'preview-environment-isolation',
  async function (
    event,
    directory: string,
    worktreeName: string,
    environmentIsolation: EnvironmentIsolationConfig,
    requestId: number,
  ) {
    try {
      const preview =
        await environmentIsolationService.generateIsolatedEnvironmentSources(
          {
            projectPath: directory,
            worktreePath: directory,
            worktreeName:
              environmentIsolationService.sanitizeWorktreeName(worktreeName),
          },
          environmentIsolation,
        );
      event.sender.send(
        'environment-isolation-previewed',
        0,
        preview,
        requestId,
      );
    } catch (err: any) {
      event.sender.send(
        'environment-isolation-previewed',
        -1,
        err.message,
        requestId,
      );
    }
  },
);

ipcMain.on(
  'preview-environment-suggestions',
  async function (
    event,
    directory: string,
    environmentIsolation: EnvironmentIsolationConfig,
    requestId: number,
  ) {
    try {
      const suggestions =
        await environmentIsolationService.previewSuggestedCommands(
          directory,
          environmentIsolation,
        );
      event.sender.send(
        'environment-suggestions-previewed',
        0,
        suggestions,
        requestId,
      );
    } catch (err: any) {
      event.sender.send(
        'environment-suggestions-previewed',
        -1,
        err.message,
        requestId,
      );
    }
  },
);

ipcMain.on(
  'create-worktree',
  async function (
    event,
    name,
    worktreePath,
    createWorktreeMode,
    directory,
    environmentIsolation?: EnvironmentIsolationConfig,
    shareNodeModules?: boolean,
    nodeModulesSourcePath?: string,
    sparseFolders?: string[],
  ) {
    let gitWorktreeCreated = false;
    try {
      log.info(`Creating a new worktree ${name} in path ${worktreePath}`);
      if (environmentIsolation || shareNodeModules) {
        event.sender.send(
          'worktree-creation-progress',
          'git',
          'Creating Git worktree',
        );
      }
      const result = await worktreeMainService.add(
        name,
        worktreePath,
        createWorktreeMode,
        directory,
        sparseFolders,
      );
      gitWorktreeCreated = true;
      if (shareNodeModules) {
        const sourcePath = nodeModulesSourcePath || directory;
        event.sender.send(
          'worktree-creation-progress',
          'node_modules',
          'Sharing node_modules with selected worktree',
        );
        await nodeModulesSharingService.linkNodeModules(
          sourcePath,
          worktreePath,
        );
      }
      if (environmentIsolation) {
        await environmentIsolationService.generateIsolatedEnvironmentSources(
          {
            projectPath: directory,
            worktreePath,
            worktreeName:
              environmentIsolationService.sanitizeWorktreeName(name),
          },
          environmentIsolation,
          (key, label) =>
            event.sender.send('worktree-creation-progress', key, label),
        );
      }
      event.sender.send(
        'worktree-creation-progress',
        'ready',
        'Worktree ready',
      );
      event.sender.send('worktree-created', 0, result);
    } catch (err: any) {
      log.error(
        `Failed to create worktree ${name} in path ${worktreePath}: ${err.message}`,
      );
      if (err instanceof BusinessError) {
        event.sender.send('worktree-created', -1, err.message);
      } else if (gitWorktreeCreated) {
        event.sender.send(
          'worktree-created',
          -1,
          `The Git worktree was created, but setup failed: ${err.message}`,
        );
      } else {
        event.sender.send(
          'worktree-created',
          -1,
          'Failed to create worktree. Please check your repository and try again.',
        );
      }
    }
  },
);

ipcMain.on(
  'create-worktree-from-commit',
  async function (event, hash, worktreesPath, directory, pattern) {
    try {
      log.info(`Creating a new worktree from commit with hash ${hash}`);
      const result = await worktreeMainService.addFromCommit(
        hash,
        worktreesPath,
        directory,
        pattern,
      );
      event.sender.send('worktree-from-commit-created', 0, result);
    } catch (err: any) {
      log.error(
        `Failed to create worktree from commit hash ${hash}: ${err.message}`,
      );
      if (err instanceof BusinessError) {
        event.sender.send('worktree-from-commit-created', -1, err.message);
      } else {
        event.sender.send(
          'worktree-from-commit-created',
          -1,
          'Failed to create worktree from commit. Please check your repository and try again.',
        );
      }
    }
  },
);

ipcMain.on(
  'remove-worktree',
  async function (event, worktreeName, worktreePath, directory, force) {
    try {
      log.info(`Removing worktree in path ${worktreePath}`);
      const result = await worktreeMainService.remove(
        worktreeName,
        worktreePath,
        directory,
        force,
      );
      event.sender.send('worktree-removed', 0, result);
    } catch (err: any) {
      log.error(
        `Failed to remove worktree in path ${worktreePath}: ${err.message}`,
      );
      if (err instanceof BusinessError) {
        event.sender.send(
          'worktree-removed',
          -1,
          err.message,
          worktreePath,
          worktreeName,
          false,
        );
      } else {
        event.sender.send(
          'worktree-removed',
          -1,
          'Failed to remove worktree. Please ensure the worktree exists and try again.',
          worktreePath,
          worktreeName,
          false,
        );
      }
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
      log.error(
        `Failed to remove worktree with local branch ${name} in path ${worktreePath}: ${err.message}`,
      );
      if (err instanceof BusinessError) {
        event.sender.send(
          'worktree-removed',
          -1,
          err.message,
          worktreePath,
          name,
          false,
        );
      } else {
        event.sender.send(
          'worktree-removed',
          -1,
          'Failed to remove worktree and local branch. Please ensure the worktree and branch exist and try again.',
          worktreePath,
          name,
          true,
        );
      }
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
      log.error(
        `Failed to rename worktree ${oldName} to ${newName}: ${err.message}`,
      );
      if (err instanceof BusinessError) {
        event.sender.send('worktree-renamed', -1, err.message);
      } else {
        event.sender.send(
          'worktree-renamed',
          -1,
          'Failed to rename worktree. Please check the worktree name and try again.',
        );
      }
    }
  },
);

ipcMain.on('get-worktrees', async function (event, directory: string) {
  try {
    log.info('Getting worktrees', directory);
    const worktrees = await worktreeMainService.findAll(directory);
    event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
  } catch (err: any) {
    log.error(`Failed to get worktrees: ${err.message}`);
    if (err instanceof BusinessError) {
      event.sender.send('worktrees-found', -1, err.message);
    } else {
      event.sender.send('worktrees-found', -1, 'Failed to retrieve worktrees.');
    }
  }
});

ipcMain.on('get-worktree-dashboard', async function (event, directory: string) {
  try {
    const dashboard = await worktreeMainService.getDashboard(directory);
    event.sender.send('worktree-dashboard-found', 0, dashboard);
    void (async () => {
      for (const item of dashboard) {
        if (!item.diskUsagePending || event.sender.isDestroyed()) continue;
        try {
          const usage = await worktreeMainService.getDashboardDiskUsage(
            item.path,
          );
          if (!event.sender.isDestroyed()) {
            event.sender.send(
              'worktree-dashboard-disk-usage-found',
              item.path,
              usage,
            );
          }
        } catch (diskError: any) {
          log.warn(
            `Failed to calculate disk usage for ${item.path}: ${diskError.message}`,
          );
        }
      }
    })();
  } catch (err: any) {
    log.error(`Failed to get worktree dashboard: ${err.message}`);
    event.sender.send(
      'worktree-dashboard-found',
      -1,
      'Failed to load the worktree dashboard.',
    );
  }
});

ipcMain.on(
  'prune-worktrees',
  async function (event, directory: string, worktreePaths: string[] = []) {
    try {
      log.info('Pruning worktrees');
      await worktreeMainService.prune(directory, worktreePaths);
      event.sender.send('worktrees-pruned', 0);
    } catch (err: any) {
      log.error(`Failed to prune worktrees: ${err.message}`);
      if (err instanceof BusinessError) {
        event.sender.send('worktrees-pruned', -1, err.message);
      } else {
        event.sender.send('worktrees-pruned', -1, 'Failed to prune worktrees.');
      }
    }
  },
);

ipcMain.handle('preview-prune-worktrees', async (_event, directory: string) =>
  worktreeMainService.previewPrune(directory),
);

ipcMain.on(
  'choose-moved-worktrees-for-repair',
  async function (event, allowMultiple = true) {
    const result = await dialog.showOpenDialog(
      BrowserWindow.getFocusedWindow()!,
      {
        title: allowMultiple
          ? 'Select relocated worktree folders'
          : 'Select the relocated worktree folder',
        properties: allowMultiple
          ? ['openDirectory', 'multiSelections']
          : ['openDirectory'],
      },
    );
    if (!result.canceled) {
      event.sender.send(
        'moved-worktrees-selected-for-repair',
        result.filePaths,
        allowMultiple ? 'multiple' : 'single',
      );
    }
  },
);

ipcMain.on(
  'repair-moved-worktrees',
  async function (event, directory: string, movedWorktreePaths: string[]) {
    try {
      log.info(`Repairing moved worktrees from ${directory}`);
      await worktreeMainService.repairMovedWorktrees(
        directory,
        movedWorktreePaths,
      );
      event.sender.send('moved-worktrees-repaired', 0, movedWorktreePaths);
    } catch (err: any) {
      log.error(`Failed to repair moved worktrees: ${err.message}`);
      event.sender.send(
        'moved-worktrees-repaired',
        -1,
        err.message || 'Git could not repair the selected worktree folders.',
      );
    }
  },
);

ipcMain.on(
  'change-lock-worktree',
  async function (
    event,
    toLock: boolean,
    worktreePath: string,
    directory: string,
    reason?: string,
  ) {
    try {
      log.info(
        `Changing lock of worktree with path ${worktreePath} to ${toLock}`,
      );
      await worktreeMainService.changeLock(
        toLock,
        worktreePath,
        directory,
        reason,
      );
      event.sender.send('worktrees-changed-lock', 0, toLock);
    } catch (err: any) {
      log.error(
        `Failed to change lock of worktree with path ${worktreePath} to ${toLock}: ${err.message}`,
      );
      if (err instanceof BusinessError) {
        event.sender.send('worktrees-changed-lock', -1, toLock, err.message);
      } else {
        event.sender.send(
          'worktrees-changed-lock',
          -1,
          toLock,
          'Failed to change the lock status of the worktree.',
        );
      }
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
    log.error(`Failed to get worktrees folder: ${err.message}`);
    if (err instanceof BusinessError) {
      event.sender.send('worktrees-folder-found', -1, err.message);
    } else {
      event.sender.send(
        'worktrees-folder-found',
        -1,
        'Failed to retrieve the path of the worktree.',
      );
    }
  }
});

ipcMain.on('get-worktrees-separator', async function (event) {
  try {
    log.info('Getting worktrees separator');
    const separator = await worktreeMainService.getWorktreesSeparator();
    event.sender.send('worktrees-separator-found', 0, separator);
  } catch (err: any) {
    log.error(`Failed to get worktrees separator: ${err.message}`);
  }
});

ipcMain.on(
  'move-worktree-to-folder',
  async function (
    event,
    name: string,
    newWorktreePath: string,
    worktreePath: string,
    directory: string,
  ) {
    try {
      log.info(`Moving worktree ${name} to folder ${newWorktreePath}`);
      await worktreeMainService.moveWorktreeToFolder(
        name,
        newWorktreePath,
        worktreePath,
        directory,
      );
      event.sender.send('worktree-moved-to-folder', 0);
    } catch (err: any) {
      log.error(
        `Failed to move worktree ${name} to folder ${newWorktreePath}: ${err.message}`,
      );
      if (err instanceof BusinessError) {
        event.sender.send('worktree-moved-to-folder', -1, err.message);
      } else {
        event.sender.send(
          'worktree-moved-to-folder',
          -1,
          'Failed to move worktree to the specified folder.',
        );
      }
    }
  },
);

ipcMain.on(
  'get-preview-path-change-pattern',
  async function (
    event,
    name: string,
    worktreePath: string,
    pattern: string,
    dir: string,
  ) {
    try {
      log.info('Getting worktrees separator');
      const path = await worktreeMainService.getPathPreviewOfPattern(
        name,
        worktreePath,
        pattern,
        dir,
      );
      event.sender.send('received-preview-path-change-pattern', 0, path);
    } catch (err: any) {
      log.error(`Failed to get preview: ${err.message}`);
    }
  },
);
