import path from 'path';
import log from '../../utils/logger';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';
import { getStopExecution } from './sharedState';
import worktreeMainService from '../../services/worktrees/worktreeMainService';
import environmentIsolationService from '../../services/environment/environmentIsolationService';

const pty = require('node-pty');

let logStates: any[] = [];

let worktreesStates: any[] = [];

const activeWorkflowProcesses = new Set<any>();

export function stopActiveWorkflowProcesses() {
  activeWorkflowProcesses.forEach((process) => {
    try {
      process.kill();
    } catch (error) {
      log.warn(`Unable to stop workflow PTY: ${error}`);
    }
  });
}

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
          suggestedCommands: command.suggestedCommands || [],
        };
        if (status) {
          item.data[command.key].status = status;
        }
        if (command.value.includes('hygen')) {
          item.data[command.key].output = item.data[
            command.key
          ]?.output.replace(/Loaded templates: .*\n/, 'Loaded templates:\n');
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
  log.info(`command to execute: ${command.value}`);
  const storedEncoding = (await utils.getStorageItem('encoding')) || 'utf-8';

  if (command.environmentIsolation) {
    const { projectPath, worktreePath, worktreeName, config } =
      command.environmentIsolation;
    try {
      const result =
        await environmentIsolationService.generateIsolatedEnvironmentSources(
          {
            projectPath,
            worktreePath,
            worktreeName:
              environmentIsolationService.sanitizeWorktreeName(worktreeName),
          },
          config,
        );
      command.suggestedCommands = result.suggestedCommands;
      const generatedOutput = result.generatedSources
        .map(
          (source) =>
            `Generated ${source.relativePath}\n\n${source.displayContents}`,
        )
        .join('\n\n');
      logStates = await getNewlogStates(
        worktreeLabel,
        generatedOutput,
        storedEncoding,
        command,
        'finished',
      );
      event.sender.send('workflow-started-log-received', logStates);
      return 'finish command';
    } catch (err: any) {
      logStates = await getNewlogStates(
        worktreeLabel,
        Buffer.from(err.message),
        storedEncoding,
        command,
        'error',
      );
      event.sender.send('workflow-started-log-received', logStates);
      throw err;
    }
  }

  // Workflows intentionally execute in a pseudo terminal so commands receive
  // the same terminal semantics as the integrated terminal. PTY output merges
  // stdout/stderr, which is also how users see it in a normal shell.
  return new Promise(async (resolve, reject) => {
    const shell = await gitMainService.getShell();
    const shellExecutable =
      shell ||
      (process.platform === 'win32'
        ? process.env.COMSPEC || 'cmd.exe'
        : process.env.SHELL || '/bin/bash');
    const shellName = path.basename(shellExecutable).toLowerCase();
    const shellArgs = shellName === 'cmd.exe' || shellName === 'cmd'
      ? ['/d', '/s', '/c', command.value]
      : shellName === 'powershell.exe' || shellName === 'powershell' || shellName === 'pwsh.exe' || shellName === 'pwsh'
        ? ['-NoLogo', '-NoProfile', '-Command', command.value]
        : ['-lc', command.value];
    const options: any = {
      cwd: normalizedPath,
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    };

    let commandProcess: any;
    let stoppedForPrompt = false;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      commandProcess = pty.spawn(shellExecutable, shellArgs, options);
      activeWorkflowProcesses.add(commandProcess);
    } catch (err: any) {
      logStates = await getNewlogStates(
        worktreeLabel,
        Buffer.from(err.message),
        storedEncoding,
        command,
        null,
      );
      event.sender.send('workflow-started-log-received', logStates);
      fail(new Error(err.toString()));
      return;
    }

    commandProcess.onData(async (data: string) => {
      if (getStopExecution()) {
        commandProcess.kill();
      }
      if (command.value.includes('hygen') && data.includes('Overwrite?')) {
        stoppedForPrompt = true;
        commandProcess.kill();
      }
      logStates = await getNewlogStates(
        worktreeLabel,
        Buffer.from(data),
        storedEncoding,
        command,
        null,
      );
      event.sender.send('workflow-started-log-received', logStates);
    });

    commandProcess.onExit(async ({ exitCode }: { exitCode: number }) => {
      activeWorkflowProcesses.delete(commandProcess);
      if (exitCode === 0) {
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
        finish('finish command');
      } else if (getStopExecution() || stoppedForPrompt) {
        fail(new Error('aborted'));
      } else {
        logStates = await getNewlogStates(
          worktreeLabel,
          '',
          storedEncoding,
          command,
          'error',
        );
        fail(new Error(String(exitCode)));
      }
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
