import { spawn } from 'child_process';
import path from 'path';
import { app, BrowserWindow, dialog, ipcMain, Notification } from 'electron';
import workflowsMainService from '../../services/workflows/workflowsMainService';
import gitMainService from '../../services/git/gitMainService';
import utils from '../../utils/utils';

function updateWorktreesStates(
  worktreesStates: any[],
  worktreeLabel: string,
  currentCommandIndex: number,
  status: string,
) {
  return worktreesStates.map((item: any) => {
    if (item.title === worktreeLabel) {
      item.current = currentCommandIndex;
      item.status = status;
    }
    return item;
  });
}

let focusedWindow: BrowserWindow | null;
let worktreesStates: any[] = [];
let logStates: any[] = [];

let stopExecution = false;
let abortController: AbortController;

async function executeCommand(
  command: any,
  normalizedPath: string,
  worktreeLabel: string,
  event: any,
) {
  abortController = new AbortController();
  const storedEncoding = await utils.getStorageItem('encoding');

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const shell = await gitMainService.getShell();
    const options: any = {
      cwd: normalizedPath,
      shell: shell || true,
      signal: abortController.signal,
    };

    const commandProcess = spawn(command.value, [], options);

    commandProcess.stdout.on('data', async (data: any) => {
      if (stopExecution) {
        abortController.abort();
        commandProcess.kill('SIGKILL');
      }
      logStates = await Promise.all(
        logStates.map(async (item) => {
          if (item.label === worktreeLabel) {
            const encoded = utils.setEncoding(data, storedEncoding);
            let log = '';
            if (item.data[command.key]) {
              log =
                (item.data[command.key] ? item.data[command.key].output : '') +
                encoded;
            } else {
              log = encoded;
            }
            item.data[command.key] = {
              command: command.value.includes('hygen')
                ? 'run generator'
                : command.value,
              output: log,
            };
          }
          return item;
        }),
      );
      event.sender.send('workflow-started-log-received', logStates);
    });

    commandProcess.stderr.on('data', async (data: any) => {
      logStates = await Promise.all(
        logStates.map(async (item) => {
          if (item.label === worktreeLabel) {
            const encoded = utils.setEncoding(data, storedEncoding);
            let log = '';
            if (item.data[command.key]) {
              log =
                (item.data[command.key] ? item.data[command.key].output : '') +
                encoded;
            } else {
              log = encoded;
            }
            item.data[command.key] = {
              command: command.value.includes('hygen')
                ? 'run generator'
                : command.value,
              output: log,
            };
          }
          return item;
        }),
      );
      event.sender.send('workflow-started-log-received', logStates);
    });

    commandProcess.on('exit', (code: any, signal: any) => {
      if (code === 0) {
        logStates = logStates.map((item) => {
          if (item.label === worktreeLabel) {
            item.data[command.key] = {
              command: command.value,
              output: item.data[command.key]
                ? item.data[command.key].output
                : '',
              status: 'finished',
            };
          }
          return item;
        });
        event.sender.send('workflow-started-log-received', logStates);
        resolve('finish command');
      }
      if (code !== 0 && signal === 'SIGTERM') {
        reject(new Error('SIGTERM'));
      } else {
        reject(new Error(code));
      }
    });
    commandProcess.on('error', async (err: any) => {
      logStates = await Promise.all(
        logStates.map(async (item) => {
          if (item.label === worktreeLabel) {
            const encoded = utils.setEncoding(
              Buffer.from(err.message),
              storedEncoding,
            );
            let log = '';
            if (item.data[command.key]) {
              log =
                (item.data[command.key] ? item.data[command.key].output : '') +
                encoded;
            } else {
              log = encoded;
            }
            item.data[command.key] = {
              command: command.value.includes('hygen')
                ? 'run generator'
                : command.value,
              output: log,
            };
          }
          return item;
        }),
      );
      event.sender.send('workflow-started-log-received', logStates);
      reject(new Error(err.toString()));
    });
  });
}

async function executeProcessesForDirectoriesInSeries(
  commands: any[],
  worktrees: any[],
  event: any,
) {
  // eslint-disable-next-line no-restricted-syntax
  for (const worktree of worktrees) {
    if (stopExecution) {
      event.sender.send('workflow-stopped');
      break;
    }
    let normalizedPath = path.normalize(worktree.path);

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < commands.length; i++) {
      if (stopExecution) {
        worktreesStates = updateWorktreesStates(
          worktreesStates,
          worktree.label,
          i,
          'warning',
        );
        event.sender.send('workflow-started-states-updated', worktreesStates);
        event.sender.send('workflow-stopped');
        break;
      }
      const command = commands[i];
      try {
        const currentWorktree = worktreesStates.find(
          (item) => item.title === worktree.label,
        );
        if (currentWorktree.status !== 'processing') {
          worktreesStates = updateWorktreesStates(
            worktreesStates,
            worktree.label,
            i,
            'processing',
          );
          event.sender.send('workflow-started-states-updated', worktreesStates);
        }
        if (command.postHook) {
          const mainRepoName = path.win32.basename(worktree.path);
          normalizedPath = path.normalize(
            worktree.path.replace(mainRepoName, command.worktreeName),
          );
        }
        // eslint-disable-next-line no-await-in-loop
        await executeCommand(command, normalizedPath, worktree.label, event);
        if (i === commands.length - 1) {
          worktreesStates = updateWorktreesStates(
            worktreesStates,
            worktree.label,
            i,
            'success',
          );
          event.sender.send('workflow-started-states-updated', worktreesStates);
        } else {
          worktreesStates = updateWorktreesStates(
            worktreesStates,
            worktree.label,
            i + 1,
            'processing',
          );
          event.sender.send('workflow-started-states-updated', worktreesStates);
        }
      } catch (err: any) {
        if (err.message.includes('aborted')) {
          worktreesStates = updateWorktreesStates(
            worktreesStates,
            worktree.label,
            i,
            'warning',
          );
          event.sender.send('workflow-started-states-updated', worktreesStates);
          return;
        }
        worktreesStates = updateWorktreesStates(
          worktreesStates,
          worktree.label,
          i,
          'error',
        );
        event.sender.send('workflow-started-states-updated', worktreesStates);
        return;
      }
    }
  }
}

async function executeProcessesForDirectoriesInParallel(
  commands: any[],
  worktrees: any[],
  event: any,
) {
  // eslint-disable-next-line array-callback-return
  const promises = worktrees.map(async (worktree) => {
    const normalizedPath = path.normalize(worktree.path);
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < commands.length; i++) {
      if (stopExecution) {
        worktreesStates = updateWorktreesStates(
          worktreesStates,
          worktree.label,
          i,
          'warning',
        );
        event.sender.send('workflow-started-states-updated', worktreesStates);
        event.sender.send('workflow-stopped');
        break;
      }
      const command = commands[i];
      try {
        const currentWorktree = worktreesStates.find(
          (item) => item.title === worktree.label,
        );
        if (currentWorktree.status !== 'processing') {
          worktreesStates = updateWorktreesStates(
            worktreesStates,
            worktree.label,
            i,
            'processing',
          );
          event.sender.send('workflow-started-states-updated', worktreesStates);
        }
        // eslint-disable-next-line no-await-in-loop
        await executeCommand(command, normalizedPath, worktree.label, event);
        if (i === commands.length - 1) {
          worktreesStates = updateWorktreesStates(
            worktreesStates,
            worktree.label,
            i,
            'success',
          );
          event.sender.send('workflow-started-states-updated', worktreesStates);
        } else {
          worktreesStates = updateWorktreesStates(
            worktreesStates,
            worktree.label,
            i + 1,
            'processing',
          );
          event.sender.send('workflow-started-states-updated', worktreesStates);
        }
      } catch (err: any) {
        if (err.message.includes('aborted')) {
          worktreesStates = updateWorktreesStates(
            worktreesStates,
            worktree.label,
            i,
            'warning',
          );
          event.sender.send('workflow-started-states-updated', worktreesStates);
          return;
        }
        worktreesStates = updateWorktreesStates(
          worktreesStates,
          worktree.label,
          i,
          'error',
        );
        event.sender.send('workflow-started-states-updated', worktreesStates);
        return;
      }
    }
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
  stopExecution = false;
  focusedWindow = BrowserWindow.getFocusedWindow();
  event.sender.send('workflow-started');
  const commands = [workflow.command, ...workflow.commands];
  event.sender.send(
    'workflow-started-with-commands',
    commands.map((command) => {
      return {
        title: command.value,
      };
    }),
  );
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
  stopExecution = true;
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
      workflowsMainService.save(name, mainCommand, commands, dir);
      event.sender.send('workflow-created', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('workflow-created', -1, encoded);
    }
  },
);

ipcMain.on(
  'duplicate-workflow',
  async function (event, workflow: any, dir: string) {
    try {
      workflowsMainService.duplicate(workflow, dir);
      event.sender.send('workflow-duplicated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
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
      workflowsMainService.update(name, newName, mainCommand, commands, dir);
      event.sender.send('workflow-updated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('workflow-updated', -1, encoded);
    }
  },
);

ipcMain.on(
  'remove-workflow',
  async function (event, name: string, dir: string) {
    try {
      workflowsMainService.remove(name, dir);
      event.sender.send('workflow-removed', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('workflow-removed', -1, encoded);
    }
  },
);

ipcMain.on('get-workflows', async function (event, dir: string) {
  try {
    const workflows = workflowsMainService.findAll(dir);
    event.sender.send('workflows-found', 0, JSON.stringify(workflows));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('workflows-found', -1, encoded);
  }
});

ipcMain.on('open-dialog-import-workflows', async function (event) {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  try {
    if (!result.canceled) {
      const [dir] = result.filePaths;

      const workflows = workflowsMainService.findAll(path.normalize(dir));
      event.sender.send(
        'workflows-to-import-found',
        0,
        JSON.stringify(workflows),
      );
    }
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    event.sender.send('workflows-to-import-found', -1, encoded);
  }
});

ipcMain.on(
  'import-workflows',
  async function (event, workflows: any[], dir: string) {
    try {
      const count = workflowsMainService.saveAll(workflows, dir);
      event.sender.send('workflows-imported', 0, count);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      event.sender.send('workflows-imported', -1, encoded);
    }
  },
);
