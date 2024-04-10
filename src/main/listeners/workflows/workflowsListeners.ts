import { spawn } from 'child_process';
import path from 'path';
import { BrowserWindow, dialog, ipcMain, Notification } from 'electron';
import workflowsMainService from '../../services/workflows/workflowsMainService';

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

function removeANSI(str: string) {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  );
}

let focusedWindow: BrowserWindow | null;
let worktreesStates: any[] = [];
let logStates: any[] = [];

let stopExecution = false;
function executeCommand(
  command: any,
  normalizedPath: string,
  worktreeLabel: string,
  event: any,
) {
  return new Promise((resolve, reject) => {
    const commandProcess = spawn(command.value, [], {
      cwd: normalizedPath,
      shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
    });

    commandProcess.stdout.on('data', (data: any) => {
      if (stopExecution) {
        commandProcess.kill();
      }
      logStates = logStates.map((item) => {
        if (item.label === worktreeLabel) {
          let log = '';
          if (item.data[command.key]) {
            log = item.data[command.key].output + removeANSI(data.toString());
          } else {
            log = removeANSI(data.toString());
          }
          item.data[command.key] = {
            command: command.value,
            output: log,
          };
        }
        return item;
      });
      event.sender.send('workflow-started-log-received', logStates);
    });

    commandProcess.stderr.on('data', (data: any) => {
      logStates = logStates.map((item) => {
        if (item.label === worktreeLabel) {
          if (!item.data[command.key]) {
            item.data[command.key] = {
              command: command.value,
              output: data.toString(),
            };
          }
        }
        return item;
      });
      event.sender.send('workflow-started-log-received', logStates);
    });

    commandProcess.on('exit', (code: any) => {
      if (code === 0) {
        resolve('finish command');
      } else {
        reject(new Error(code));
      }
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
      } catch (e) {
        worktreesStates = updateWorktreesStates(
          worktreesStates,
          worktree.label,
          i,
          'error',
        );
        event.sender.send('workflow-started-states-updated', worktreesStates);
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
      } catch (e) {
        worktreesStates = updateWorktreesStates(
          worktreesStates,
          worktree.label,
          i,
          'error',
        );
        event.sender.send('workflow-started-states-updated', worktreesStates);
      }
    }
  });
  await Promise.all(promises);
}

function sendNotification(msg: string) {
  const notification = new Notification({
    title: 'WorktreeWise',
    body: msg,
  });
  notification.show();

  notification.on('click', () => {
    focusedWindow?.focus();
  });
}

ipcMain.on('play-workflow', async function (event, workflow) {
  console.log('workflow to play', workflow);
  stopExecution = false;
  focusedWindow = BrowserWindow.getFocusedWindow();
  event.sender.send('workflow-started');
  const commands = [workflow.command, ...workflow.commands];
  event.sender.send('workflow-started-with-commands', commands);
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
      .then(() => {
        event.sender.send('workflow-stopped');
        // eslint-disable-next-line promise/always-return
        if (!focusedWindow?.isFocused()) {
          sendNotification(`Workflow ${workflow.name} finished !`);
        }
      })
      .catch((error) => {
        console.error('An error occurred:', error);
      });
  } else {
    executeProcessesForDirectoriesInSeries(commands, workflow.worktrees, event)
      .then(() => {
        event.sender.send('workflow-stopped');
        // eslint-disable-next-line promise/always-return
        if (!focusedWindow?.isFocused()) {
          sendNotification(`Workflow ${workflow.name} finished !`);
        }
      })
      .catch((error) => {
        console.error('An error occurred:', error);
      });
  }
});

ipcMain.on('stop-workflow', function (event) {
  console.log('stop workflow');
  stopExecution = true;
  event.sender.send('workflow-stopped');
});

ipcMain.on(
  'add-workflow',
  function (
    event,
    name: string,
    mainCommand: string,
    commands: string[],
    dir: string,
  ) {
    try {
      workflowsMainService.save('', name, mainCommand, commands, dir);
      event.sender.send('workflow-created', 0);
    } catch (err: any) {
      event.sender.send('workflow-created', -1, err.message);
    }
  },
);

ipcMain.on(
  'update-workflow',
  function (
    event,
    id: string,
    name: string,
    mainCommand: string,
    commands: string[],
    dir: string,
  ) {
    try {
      workflowsMainService.save(id, name, mainCommand, commands, dir);
      event.sender.send('workflow-updated', 0);
    } catch (err: any) {
      event.sender.send('workflow-updated', -1, err.message);
    }
  },
);

ipcMain.on('remove-workflow', function (event, name: string, dir: string) {
  try {
    workflowsMainService.remove(name, dir);
    event.sender.send('workflow-removed', 0);
  } catch (err: any) {
    event.sender.send('workflow-removed', -1, err.message);
  }
});

ipcMain.on('get-workflows', function (event, dir: string) {
  try {
    const workflows = workflowsMainService.findAll(dir);
    event.sender.send('workflows-found', 0, JSON.stringify(workflows));
  } catch (err: any) {
    event.sender.send('workflows-found', -1, err.message);
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
    event.sender.send('workflows-to-import-found', -1, err.message);
  }
});

ipcMain.on(
  'import-workflows',
  async function (event, workflows: any[], dir: string) {
    try {
      workflowsMainService.saveAll(workflows, dir);
      event.sender.send('workflows-imported', 0);
    } catch (err: any) {
      event.sender.send('workflows-imported', -1, err.message);
    }
  },
);
