import path from 'path';
import log from 'electron-log';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';
import { getStopExecution } from './sharedState';
import worktreeMainService from '../../services/worktrees/worktreeMainService';

const execa = require('execa');

let logStates: any[] = [];

let worktreesStates: any[] = [];

function updateWorktreesStates(
  worktreesStatesInput: any[],
  worktreeLabel: string,
  currentCommandIndex: number,
  status: string,
) {
  return worktreesStatesInput.map((item: any) => {
    if (item.title === worktreeLabel) {
      item.current = currentCommandIndex;
      item.status = status;
    }
    return item;
  });
}

async function getNewlogStates(
  worktreeLabel: string,
  data: any,
  storedEncoding: any,
  command: any,
  status: string | null,
) {
  log.info(
    `getNewlogStates with params: {worktreeLabel: ${worktreeLabel}} {command: ${JSON.stringify(command)}} {status: ${status}}`,
  );
  return Promise.all(
    logStates.map(async (item: any) => {
      if (item.label === worktreeLabel) {
        let logOutput = '';
        if (item.data[command.key]) {
          logOutput =
            (item.data[command.key] ? item.data[command.key].output : '') +
            data.toString();
        } else {
          logOutput = data.toString();
        }
        item.data[command.key] = {
          command: command.display ? command.display : command.value,
          output: utils.setEncoding(logOutput, storedEncoding),
        };
        if (status) {
          item.data[command.key].status = status;
        }
      }
      return item;
    }),
  );
}

async function executeCommand(
  command: any,
  normalizedPath: string,
  worktreeLabel: string,
  event: any,
) {
  const storedEncoding = (await utils.getStorageItem('encoding')) || 'utf-8';

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const shell = await gitMainService.getShell();
    const options: any = {
      cwd: normalizedPath,
      shell: shell || true,
    };

    let commandProcess;

    try {
      commandProcess = execa(command.value, [], options);
    } catch (err: any) {
      logStates = await getNewlogStates(
        worktreeLabel,
        Buffer.from(err.message),
        storedEncoding,
        command,
        null,
      );
      event.sender.send('workflow-started-log-received', logStates);
      reject(new Error(err.toString()));
    }

    commandProcess?.stdout?.on('data', async (data: any) => {
      if (getStopExecution()) {
        commandProcess.kill('SIGTERM');

        setTimeout(() => {
          if (!commandProcess.killed) {
            commandProcess.kill('SIGKILL');
          }
        }, 5000);
      }
      logStates = await getNewlogStates(
        worktreeLabel,
        data,
        storedEncoding,
        command,
        null,
      );
      event.sender.send('workflow-started-log-received', logStates);
    });

    commandProcess?.stderr?.on('data', async (data: any) => {
      logStates = await getNewlogStates(
        worktreeLabel,
        data,
        storedEncoding,
        command,
        null,
      );
      event.sender.send('workflow-started-log-received', logStates);
    });

    commandProcess?.on('exit', async (code: any, signal: any) => {
      if (code === 0) {
        logStates = await getNewlogStates(
          worktreeLabel,
          '',
          storedEncoding,
          command,
          'finished',
        );
        event.sender.send('workflow-started-log-received', logStates);
        if (command.worktreeToCreate) {
          const worktrees = await worktreeMainService.findAll(normalizedPath);
          event.sender.send('worktrees-found', 0, JSON.stringify(worktrees));
        }
        resolve('finish command');
      } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        reject(new Error('aborted'));
      } else {
        reject(new Error(code));
      }
    });

    commandProcess?.on('error', async (err: any) => {
      logStates = await getNewlogStates(
        worktreeLabel,
        Buffer.from(err.message),
        storedEncoding,
        command,
        null,
      );
      event.sender.send('workflow-started-log-received', logStates);
      reject(new Error(err.toString()));
    });
  });
}

async function executeCommandAtWorktree(
  command: any,
  i: number,
  lastCommand: boolean,
  worktree: any,
  event: any,
) {
  try {
    const currentWorktree = worktreesStates.find(
      (item: any) => item.title === worktree.label,
    );
    let normalizedPath = path.normalize(worktree.path);
    if (command.postHook) {
      normalizedPath = path.normalize(command.postHookPath);
    }
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
    if (lastCommand) {
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
  }
}

// eslint-disable-next-line import/prefer-default-export
export async function executeProcessesAtWorktree(
  worktree: any,
  commands: any[],
  event: any,
) {
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < commands.length; i++) {
    if (getStopExecution()) {
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
    // eslint-disable-next-line no-await-in-loop
    await executeCommandAtWorktree(
      command,
      i,
      i === commands.length - 1,
      worktree,
      event,
    );
  }
}

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

export default async function playWorkflow(
  event: any,
  workflow: any,
  dir: string,
) {
  const worktreesRepository = (await worktreeMainService.findAll(dir)) as any;
  const worktreesRepositoryNames = worktreesRepository.map(
    (worktree: any) => worktree.name,
  );
  if (workflow.worktrees && workflow.worktrees.includes(undefined)) {
    event.sender.send(
      'workflow-started-failed-worktree-not-found',
      `Some selected worktrees have been deleted.Please update your selection.`,
    );
    event.sender.send('workflow-stopped');
    return;
  }
  const worktreesWorkflow = workflow.worktrees
    .filter((worktree: any) => worktree.value)
    .map((worktree: any) => worktree.value);
  // eslint-disable-next-line no-restricted-syntax
  for (const worktreesWorkflowElement of worktreesWorkflow) {
    if (!worktreesRepositoryNames.includes(worktreesWorkflowElement)) {
      event.sender.send(
        'workflow-started-failed-worktree-not-found',
        `Some selected worktrees have been deleted: ${worktreesWorkflowElement}.Please update your selection.`,
      );
      event.sender.send('workflow-stopped');
      return;
    }
  }

  const commands = [workflow.command, ...workflow.commands];

  log.info(
    `Starting workflow ${workflow.name} with commands: ${JSON.stringify(commands)}`,
  );
  const commandsTitles = commands.map((command) => {
    return {
      title: command.display ? command.display : command.value,
    };
  });
  worktreesStates = workflow.worktrees.map((worktree: any) => {
    return {
      title: worktree.label,
      current: -1,
      status: 'wait',
    };
  });
  logStates = workflow.worktrees.map((worktree: any, index: number) => {
    return {
      label: worktree.label,
      key: index.toString(),
      data: {
        '0': {
          command: commandsTitles[0].title,
          output: '',
          status: 'processing',
        },
      },
    };
  });
  event.sender.send(
    'workflow-started',
    commandsTitles,
    worktreesStates,
    logStates,
  );
  event.sender.send('workflow-started-states-updated', worktreesStates);
  event.sender.send('workflow-started-log-received', logStates);
  if (workflow.mode === 'parallel') {
    await executeProcessesForDirectoriesInParallel(
      commands,
      workflow.worktrees,
      event,
    );
  } else {
    await executeProcessesForDirectoriesInSeries(
      commands,
      workflow.worktrees,
      event,
    );
  }
  event.sender.send('workflow-stopped');
}
