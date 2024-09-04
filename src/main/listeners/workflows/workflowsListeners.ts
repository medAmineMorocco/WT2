import { ipcMain } from 'electron';
import log from 'electron-log';
import workflowsMainService from '../../services/workflows/workflowsMainService';
import utils from '../../utils/utils';
import { setStopExecution } from './sharedState';
import worktreeMainService from '../../services/worktrees/worktreeMainService';
import branchesMainService from '../../services/branches/branchesMainService';
import gitMainService from '../../services/git/gitMainService';
import playWorkflow from './processesListeners';

let focusedWindow: BrowserWindow | null;

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

ipcMain.on(
  'run-generator',
  async function (
    event,
    generatorName: string,
    parameters: any[],
    generatedAtWorktree: any,
    dir: string,
  ) {
    stopExecution = false;
    focusedWindow = BrowserWindow.getFocusedWindow();
    let options = '';
    Object.entries(parameters).forEach(([key, value]) => {
      options += ` --${key} ${value}`;
    });
    const hygenModulePath = require.resolve('hygen');
    const hygenPath = path.normalize(
      path.join(
        path.dirname(hygenModulePath),
        'node_modules',
        '..',
        '..',
        '..',
        '.bin',
        'hygen',
      ),
    );
    const templatesPath = path.normalize(
      path.join(dir, '.git', conf.generatorPath, '_templates'),
    );
    process.env.HYGEN_TMPLS = templatesPath;

    const command = {
      key: '0',
      value: `${hygenPath} cli "${generatorName}" ${options}`,
    };
    const workflow = {
      name: generatorName,
      command,
      commands: [],
      mode: 'sequential',
      worktrees: [generatedAtWorktree],
    } as any;
    event.sender.send('workflow-started');
    const commands = [workflow.command, ...workflow.commands];
    event.sender.send('workflow-started-with-commands', [
      { title: `run generator ${generatorName}` },
    ]);
    worktreesStates = workflow.worktrees.map((worktree: any) => {
      return {
        title: worktree.label,
        current: -1,
        status: 'wait',
      };
    });
    event.sender.send('workflow-started-states-updated', worktreesStates);
    logStates = workflow.worktrees.map((worktree: any, index: number) => {
      return {
        label: worktree.label,
        key: index.toString(),
        data: {},
      };
    });
    event.sender.send('workflow-started-log-received', logStates);
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
            `Your generator ${workflow.name} has finished executing.`,
          );
        }
      })
      .catch((error) => {
        console.error('An error occurred:', error);
      });
  },
);

async function showWorklowFinishedNotification(workflowName: string) {
  focusedWindow = BrowserWindow.getFocusedWindow();
  const notificationsEnabled =
    (await focusedWindow?.webContents.executeJavaScript(
      'localStorage.getItem("notificationsEnabled");',
      true,
    )) === 'true';
  // eslint-disable-next-line promise/always-return
  if (!focusedWindow?.isFocused() && notificationsEnabled) {
    sendNotification(`Your workflow ${workflowName} has finished executing.`);
  }
}

ipcMain.on('play-workflow', async function (event, workflow, dir) {
  setStopExecution(false);
  await playWorkflow(event, workflow, dir);
});

ipcMain.on('stop-workflow', function (event) {
  setStopExecution(true);
  log.info('Workflow stopped by user');
  event.sender.send('workflow-stopped');
});

function sanitizeWorktreeName(worktreeName: string) {
  return worktreeName.replace(/\//g, '-').replace(/[:*?"<>|\\]/g, '-');
}

ipcMain.on(
  'create-worktree-workflow',
  async function (
    event,
    values,
    createWorktreeMode,
    worktreeName,
    worktreesFolder,
    dir,
  ) {
    const pathSeparator = await worktreeMainService.getWorktreesSeparator();
    let command: string;
    let gitCmd;
    try {
      gitCmd = await gitMainService.gitCommand();
    } catch (e) {
      event.sender.send('workflow-stopped');
    }
    const sanitizedWorktreeName = sanitizeWorktreeName(worktreeName);
    if (createWorktreeMode === 'existing-branch') {
      command = `${gitCmd} worktree add ${worktreesFolder + pathSeparator + sanitizedWorktreeName} ${worktreeName}`;
    } else if (createWorktreeMode === 'existing-tag') {
      const branchNameForTag = worktreeName;
      const branchExist = await worktreeMainService.branchExists(
        branchNameForTag,
        dir,
      );
      if (!branchExist) {
        await branchesMainService.add(branchNameForTag, dir);
      }
      command = `${gitCmd} worktree add ${worktreesFolder + pathSeparator + branchNameForTag} ${branchNameForTag}`;
    } else {
      command = `${gitCmd} worktree add -b ${worktreeName} ${worktreesFolder + pathSeparator + sanitizedWorktreeName}`;
    }
    const workflow = {
      name: worktreeName,
      command: null,
      commands: [],
      mode: 'sequential',
      worktrees: [
        {
          label: 'Create Git Worktree',
          path: dir,
        },
      ],
    } as any;
    if (values.preHook) {
      workflow.command = {
        key: '0',
        value: values.preHook,
      };
      workflow.commands = [
        {
          key: '1',
          value: command,
          worktreeToCreate: true,
          display: 'Create Git Worktree',
        },
      ];
    }
    if (values.postHook && !values.preHook) {
      workflow.command = {
        key: '0',
        value: command,
        worktreeToCreate: true,
        display: 'Create Git Worktree',
      };

      const postHookPath =
        worktreesFolder + pathSeparator + sanitizedWorktreeName;
      log.debug(`postHookPath: ${postHookPath}`);

      workflow.commands = [
        {
          key: '1',
          value: values.postHook,
          postHook: true,
          postHookPath,
          worktreeName,
        },
      ];
    }
    if (values.postHook && values.preHook) {
      workflow.commands = [
        {
          key: '1',
          value: command,
          worktreeToCreate: true,
          display: 'Create Git Worktree',
        },
        {
          key: '2',
          value: values.postHook,
          postHook: true,
          postHookPath: worktreesFolder + pathSeparator + sanitizedWorktreeName,
          worktreeName,
        },
      ];
    }
    await playWorkflow(event, workflow, dir);
  },
);

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
