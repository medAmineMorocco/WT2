import path from 'path';
import log from '../../utils/logger';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';
import { getStopExecution } from './sharedState';
import worktreeMainService from '../../services/worktrees/worktreeMainService';
import environmentIsolationService from '../../services/environment/environmentIsolationService';
import nodeModulesSharingService from '../../services/worktrees/nodeModulesSharingService';

const pty = require('node-pty');

let logStates: any[] = [];

let worktreesStates: any[] = [];

const MAX_WORKFLOW_COMMAND_OUTPUT_CHARS = 250000;

function boundedWorkflowOutput(value: string): string {
  if (value.length <= MAX_WORKFLOW_COMMAND_OUTPUT_CHARS) return value;
  return `[Earlier output omitted to limit memory usage]\n${value.slice(
    -MAX_WORKFLOW_COMMAND_OUTPUT_CHARS,
  )}`;
}

type ActiveProcessEntry = {
  process: any;
  kill: () => void;
};

const activeWorkflowProcesses = new Set<ActiveProcessEntry>();

export function stopActiveWorkflowProcesses() {
  activeWorkflowProcesses.forEach((entry) => {
    try {
      entry.kill();
    } catch (error) {
      log.warn(`Unable to stop workflow PTY: ${error}`);
    }
  });
  activeWorkflowProcesses.clear();
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
          output: boundedWorkflowOutput(
            utils.setEncoding(logOutput, storedEncoding),
          ),
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

  if (command.shareNodeModules) {
    const { projectPath, worktreePath } = command.shareNodeModules;
    try {
      await nodeModulesSharingService.linkNodeModules(
        projectPath,
        worktreePath,
      );
      const generatedOutput = `Shared node_modules with main worktree (${projectPath} -> ${worktreePath})`;
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

  if (command.sparseCheckout) {
    const { worktreePath, folders } = command.sparseCheckout;
    try {
      await worktreeMainService.configureSparseCheckout(worktreePath, folders);
      logStates = await getNewlogStates(
        worktreeLabel,
        `Sparse checkout configured for ${folders.length} selected folder${folders.length === 1 ? '' : 's'}`,
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
    const shellArgs =
      shellName === 'cmd.exe' || shellName === 'cmd'
        ? ['/d', '/s', '/c', command.value]
        : shellName === 'powershell.exe' ||
            shellName === 'powershell' ||
            shellName === 'pwsh.exe' ||
            shellName === 'pwsh'
          ? ['-NoLogo', '-NoProfile', '-Command', command.value]
          : shellName === 'fish.exe' || shellName === 'fish'
            ? ['-c', command.value]
            : shellName === 'nu.exe' || shellName === 'nu'
              ? ['-c', command.value]
              : shellName === 'wsl.exe' || shellName === 'wsl'
                ? ['-e', 'sh', '-lc', command.value]
                : ['-lc', command.value];

    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    delete cleanEnv.ELECTRON_NO_ASAR;
    delete cleanEnv.TS_NODE_TRANSPILE_ONLY;
    delete cleanEnv.TS_NODE_COMPILER_OPTIONS;
    delete cleanEnv.TS_NODE_PROJECT;

    const options: any = {
      cwd: normalizedPath,
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      useConpty: false,
      env: {
        ...cleanEnv,
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

    let isTerminated = false;
    const safeKillProcess = () => {
      if (isTerminated) return;
      isTerminated = true;
      if (!commandProcess) return;
      try {
        if (Array.isArray((commandProcess as any)._deferreds)) {
          (commandProcess as any)._deferreds = [];
        }
        commandProcess.kill();
      } catch (err) {
        log.warn(`Safe kill caught: ${err}`);
      }
    };

    let processEntry: ActiveProcessEntry | null = null;

    try {
      if (getStopExecution()) {
        fail(new Error('aborted'));
        return;
      }
      commandProcess = pty.spawn(shellExecutable, shellArgs, options);
      processEntry = {
        process: commandProcess,
        kill: safeKillProcess,
      };
      activeWorkflowProcesses.add(processEntry);
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

    if (getStopExecution()) {
      safeKillProcess();
      fail(new Error('aborted'));
      return;
    }

    commandProcess.onData(async (data: string) => {
      if (getStopExecution()) {
        safeKillProcess();
        fail(new Error('aborted'));
        return;
      }
      if (command.value.includes('hygen') && data.includes('Overwrite?')) {
        stoppedForPrompt = true;
        safeKillProcess();
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
      isTerminated = true;
      if (processEntry) {
        activeWorkflowProcesses.delete(processEntry);
      }
      if (getStopExecution() || stoppedForPrompt) {
        logStates = await getNewlogStates(
          worktreeLabel,
          '',
          storedEncoding,
          command,
          'error',
        );
        event.sender.send('workflow-started-log-received', logStates);
        fail(new Error('aborted'));
      } else if (exitCode === 0) {
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
      } else {
        logStates = await getNewlogStates(
          worktreeLabel,
          '',
          storedEncoding,
          command,
          'error',
        );
        event.sender.send('workflow-started-log-received', logStates);
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
    if (err.message.includes('aborted') || getStopExecution()) {
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
    if (getStopExecution()) {
      break;
    }
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
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    await executeProcessesAtWorktree(worktree, commands, event);
    if (getStopExecution()) {
      break;
    }
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
  try {
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
  } finally {
    try {
      if (logStates && logStates.length > 0) {
        event.sender.send('workflow-started-log-received', logStates);
      }
    } catch {}
    event.sender.send('workflow-stopped');
    stopActiveWorkflowProcesses();
  }
}
