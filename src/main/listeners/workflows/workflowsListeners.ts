import path from 'path';
import { app, BrowserWindow, dialog, ipcMain, Notification } from 'electron';
import workflowsMainService from '../../services/workflows/workflowsMainService';
import utils from '../../utils/utils';
import loggingService from '../../services/logging/loggingService';
import LogLevel from '../../enums/LogLevel';
import { executeProcessesAtWorktree } from './processesListeners';
import {
  getStopExecution,
  getWorktreesStates,
  setLogStates,
  setStopExecution,
  setWorktreesStates,
} from './sharedState';

let focusedWindow: BrowserWindow | null;

async function executeProcessesForDirectoriesInSeries(
  commands: any[],
  worktrees: any[],
  event: any,
) {
  // eslint-disable-next-line no-restricted-syntax
  for (const worktree of worktrees) {
    if (getStopExecution()) {
      event.sender.send('workflow-stopped');
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    await executeProcessesAtWorktree(worktree, commands, event);
  }
}

async function executeProcessesForDirectoriesInParallel(
  commands: any[],
  worktrees: any[],
  event: any,
) {
  const promises = worktrees.map(async (worktree) => {
    await executeProcessesAtWorktree(worktree, commands, event);
  });
  await Promise.all(promises);
}

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

function sendNotification(msg: string) {
  const notification = new Notification({
    title: msg,
    body: 'You can review the results now.',
    icon: getAssetPath('icon.png'),
  });
  notification.show();

  notification.on('click', () => {
    focusedWindow?.focus();
  });
}

ipcMain.on('play-workflow', async function (event, workflow) {
  setStopExecution(false);
  focusedWindow = BrowserWindow.getFocusedWindow();
  event.sender.send('workflow-started');
  const commands = [workflow.command, ...workflow.commands];
  loggingService.logMessage(
    '-',
    `Starting workflow ${workflow.name} with commands: ${commands}`,
    LogLevel.INFO,
  );
  event.sender.send(
    'workflow-started-with-commands',
    commands.map((command) => {
      return {
        title: command.value,
      };
    }),
  );
  const worktreesStates = workflow.worktrees.map((worktree: any) => {
    return {
      title: worktree.label,
      current: -1,
      status: 'wait',
    };
  });
  setWorktreesStates(worktreesStates);
  event.sender.send('workflow-started-states-updated', getWorktreesStates());
  const logStates = workflow.worktrees.map((worktree: any, index: number) => {
    return {
      label: worktree.label,
      key: index.toString(),
      data: {},
    };
  });
  setLogStates(logStates);
  event.sender.send('workflow-started-log-received', logStates);
  if (workflow.mode === 'parallel') {
    executeProcessesForDirectoriesInParallel(
      commands,
      workflow.worktrees,
      event,
    )
      .then(async () => {
        event.sender.send('workflow-stopped');
        const notificationsEnabled =
          (await focusedWindow?.webContents.executeJavaScript(
            'localStorage.getItem("notificationsEnabled");',
            true,
          )) === 'true';
        // eslint-disable-next-line promise/always-return
        if (!focusedWindow?.isFocused() && notificationsEnabled) {
          sendNotification(
            `Your workflow ${workflow.name} has finished executing.`,
          );
        }
      })
      .catch((error) => {
        console.error('An error occurred:', error);
      });
  } else {
    executeProcessesForDirectoriesInSeries(commands, workflow.worktrees, event)
      .then(async () => {
        event.sender.send('workflow-stopped');
        const notificationsEnabled =
          (await focusedWindow?.webContents.executeJavaScript(
            'localStorage.getItem("notificationsEnabled");',
            true,
          )) === 'true';
        // eslint-disable-next-line promise/always-return
        if (!focusedWindow?.isFocused() && notificationsEnabled) {
          sendNotification(
            `Your workflow ${workflow.name} has finished executing.`,
          );
        }
      })
      .catch((error) => {
        console.error('An error occurred:', error);
      });
  }
});

ipcMain.on('stop-workflow', function (event) {
  setStopExecution(true);
  loggingService.logMessage('-', 'Workflow stopped by user', LogLevel.INFO);
  event.sender.send('workflow-stopped');
});

ipcMain.on(
  'add-workflow',
  async function (
    event,
    name: string,
    mainCommand: string,
    commands: string[],
    dir: string,
  ) {
    try {
      loggingService.logMessage(dir, `Saving workflow ${name}`, LogLevel.INFO);
      workflowsMainService.save(name, mainCommand, commands, dir);
      loggingService.logMessage(
        dir,
        `Workflow ${name} saved successfully`,
        LogLevel.INFO,
      );
      event.sender.send('workflow-created', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        dir,
        `Failed to save workflow ${name}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('workflow-created', -1, encoded);
    }
  },
);

ipcMain.on(
  'duplicate-workflow',
  async function (event, workflow: any, dir: string) {
    try {
      loggingService.logMessage(
        dir,
        `Duplicating workflow ${workflow.name}`,
        LogLevel.INFO,
      );
      workflowsMainService.duplicate(workflow, dir);
      loggingService.logMessage(
        dir,
        `Workflow ${workflow.name} duplicated successfully`,
        LogLevel.INFO,
      );
      event.sender.send('workflow-duplicated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        dir,
        `Failed to duplicate workflow ${workflow.name}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('workflow-duplicated', -1, encoded);
    }
  },
);

ipcMain.on(
  'update-workflow',
  async function (
    event,
    name,
    newName: string,
    mainCommand: string,
    commands: string[],
    dir: string,
  ) {
    try {
      loggingService.logMessage(
        dir,
        `Updating workflow ${name}`,
        LogLevel.INFO,
      );
      workflowsMainService.update(name, newName, mainCommand, commands, dir);
      loggingService.logMessage(
        dir,
        `Workflow ${name} updated successfully`,
        LogLevel.INFO,
      );
      event.sender.send('workflow-updated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        dir,
        `Failed to update workflow ${name}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('workflow-updated', -1, encoded);
    }
  },
);

ipcMain.on(
  'remove-workflow',
  async function (event, name: string, dir: string) {
    try {
      loggingService.logMessage(
        dir,
        `Removing workflow ${name}`,
        LogLevel.INFO,
      );
      workflowsMainService.remove(name, dir);
      loggingService.logMessage(
        dir,
        `Workflow ${name} removed successfully`,
        LogLevel.INFO,
      );
      event.sender.send('workflow-removed', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        dir,
        `Failed to remove workflow ${name}: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('workflow-removed', -1, encoded);
    }
  },
);

ipcMain.on('get-workflows', async function (event, dir: string) {
  try {
    loggingService.logMessage(dir, 'Getting workflows', LogLevel.INFO);
    const workflows = workflowsMainService.findAll(dir);
    loggingService.logMessage(dir, 'Workflows found', LogLevel.INFO);
    event.sender.send('workflows-found', 0, JSON.stringify(workflows));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      dir,
      `Failed to get workflows: ${err.message}`,
      LogLevel.ERROR,
    );
    event.sender.send('workflows-found', -1, encoded);
  }
});

ipcMain.on('open-dialog-import-workflows', async function (event) {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  try {
    loggingService.logMessage(
      '-',
      'Searching for workflows to import',
      LogLevel.INFO,
    );
    if (!result.canceled) {
      const [dir] = result.filePaths;

      const workflows = workflowsMainService.findAll(path.normalize(dir));
      loggingService.logMessage(
        '-',
        'Workflows to import found',
        LogLevel.INFO,
      );
      event.sender.send(
        'workflows-to-import-found',
        0,
        JSON.stringify(workflows),
      );
    }
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      '-',
      `Failed to search for workflows to import: ${err.message}`,
      LogLevel.ERROR,
    );
    event.sender.send('workflows-to-import-found', -1, encoded);
  }
});

ipcMain.on(
  'import-workflows',
  async function (event, workflows: any[], dir: string) {
    try {
      loggingService.logMessage(dir, 'Importing workflows', LogLevel.INFO);
      const count = workflowsMainService.saveAll(workflows, dir);
      loggingService.logMessage(
        dir,
        'Workflows imported successfully',
        LogLevel.INFO,
      );
      event.sender.send('workflows-imported', 0, count);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        dir,
        `Failed to import workflows: ${err.message}`,
        LogLevel.ERROR,
      );
      event.sender.send('workflows-imported', -1, encoded);
    }
  },
);
