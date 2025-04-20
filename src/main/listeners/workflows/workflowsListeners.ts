import path from 'path';
import { app, BrowserWindow, dialog, ipcMain, Notification } from 'electron';
import log from 'electron-log';
import workflowsMainService from '../../services/workflows/workflowsMainService';
import utils from '../../utils/utils';
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
  log.info(`Starting workflow ${workflow.name} with commands: ${commands}`);
  const commandsTitles = commands.map((command) => {
    return {
      title: command.value,
    };
  });
  event.sender.send('workflow-started-with-commands', commandsTitles);
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
  log.info('Workflow stopped by user');
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
      log.info(`Saving workflow ${name}`);
      workflowsMainService.save(name, mainCommand, commands, dir);
      event.sender.send('workflow-created', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to save workflow ${name}: ${err.message}`);
      event.sender.send('workflow-created', -1, encoded);
    }
  },
);

ipcMain.on(
  'duplicate-workflow',
  async function (event, workflow: any, dir: string) {
    try {
      log.info(`Duplicating workflow ${workflow.name}`);
      workflowsMainService.duplicate(workflow, dir);
      event.sender.send('workflow-duplicated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(
        `Failed to duplicate workflow ${workflow.name}: ${err.message}`,
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
      log.info(`Updating workflow ${name}`);
      workflowsMainService.update(name, newName, mainCommand, commands, dir);
      event.sender.send('workflow-updated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to update workflow ${name}: ${err.message}`);
      event.sender.send('workflow-updated', -1, encoded);
    }
  },
);

ipcMain.on(
  'remove-workflow',
  async function (event, name: string, dir: string) {
    try {
      log.info(`Removing workflow ${name}`);
      workflowsMainService.remove(name, dir);
      event.sender.send('workflow-removed', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to remove workflow ${name}: ${err.message}`);
      event.sender.send('workflow-removed', -1, encoded);
    }
  },
);

ipcMain.on('get-workflows', async function (event, dir: string) {
  try {
    log.info('Getting workflows');
    const workflows = workflowsMainService.findAll(dir);
    event.sender.send('workflows-found', 0, JSON.stringify(workflows));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(`Failed to get workflows: ${err.message}`);
    event.sender.send('workflows-found', -1, encoded);
  }
});

ipcMain.on(
  'import-workflows',
  async function (event, workflows: any[], dir: string) {
    try {
      log.info('Importing workflows');
      const count = workflowsMainService.saveAll(workflows, dir);
      event.sender.send('workflows-imported', 0, count);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to import workflows: ${err.message}`);
      event.sender.send('workflows-imported', -1, encoded);
    }
  },
);
