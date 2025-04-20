import path from 'path';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';
import {
  getLogStates,
  getStopExecution,
  getWorktreesStates,
  setLogStates,
  setWorktreesStates,
} from './sharedState';

const execa = require('execa');

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
  return Promise.all(
    getLogStates().map(async (item: any) => {
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
      const newlogStates = await getNewlogStates(
        worktreeLabel,
        Buffer.from(err.message),
        storedEncoding,
        command,
        null,
      );
      setLogStates(newlogStates);
      event.sender.send('workflow-started-log-received', newlogStates);
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
      const newlogStates = await getNewlogStates(
        worktreeLabel,
        data,
        storedEncoding,
        command,
        null,
      );
      setLogStates(newlogStates);
      event.sender.send('workflow-started-log-received', newlogStates);
    });

    commandProcess?.stderr?.on('data', async (data: any) => {
      const newlogStates = await getNewlogStates(
        worktreeLabel,
        data,
        storedEncoding,
        command,
        null,
      );
      setLogStates(newlogStates);
      event.sender.send('workflow-started-log-received', newlogStates);
    });

    commandProcess?.on('exit', async (code: any, signal: any) => {
      if (code === 0) {
        const newlogStates = await getNewlogStates(
          worktreeLabel,
          '',
          storedEncoding,
          command,
          'finished',
        );
        setLogStates(newlogStates);
        event.sender.send('workflow-started-log-received', newlogStates);
        resolve('finish command');
      } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        reject(new Error('aborted'));
      } else {
        reject(new Error(code));
      }
    });

    commandProcess?.on('error', async (err: any) => {
      const newlogStates = await getNewlogStates(
        worktreeLabel,
        Buffer.from(err.message),
        storedEncoding,
        command,
        null,
      );
      setLogStates(newlogStates);
      event.sender.send('workflow-started-log-received', newlogStates);
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
    const currentWorktree = getWorktreesStates().find(
      (item: any) => item.title === worktree.label,
    );
    if (currentWorktree.status !== 'processing') {
      setWorktreesStates(
        updateWorktreesStates(
          getWorktreesStates(),
          worktree.label,
          i,
          'processing',
        ),
      );
      event.sender.send(
        'workflow-started-states-updated',
        getWorktreesStates(),
      );
    }
    let normalizedPath = path.normalize(worktree.path);
    if (command.postHook) {
      const mainRepoName = path.win32.basename(worktree.path);
      normalizedPath = path.normalize(
        worktree.path.replace(mainRepoName, command.worktreeName),
      );
    }
    // eslint-disable-next-line no-await-in-loop
    await executeCommand(command, normalizedPath, worktree.label, event);
    if (lastCommand) {
      setWorktreesStates(
        updateWorktreesStates(
          getWorktreesStates(),
          worktree.label,
          i,
          'success',
        ),
      );
      event.sender.send(
        'workflow-started-states-updated',
        getWorktreesStates(),
      );
    } else {
      setWorktreesStates(
        updateWorktreesStates(
          getWorktreesStates(),
          worktree.label,
          i + 1,
          'processing',
        ),
      );
      event.sender.send(
        'workflow-started-states-updated',
        getWorktreesStates(),
      );
    }
  } catch (err: any) {
    if (err.message.includes('aborted')) {
      setWorktreesStates(
        updateWorktreesStates(
          getWorktreesStates(),
          worktree.label,
          i,
          'warning',
        ),
      );
      event.sender.send(
        'workflow-started-states-updated',
        getWorktreesStates(),
      );
      return;
    }
    setWorktreesStates(
      updateWorktreesStates(getWorktreesStates(), worktree.label, i, 'error'),
    );
    event.sender.send('workflow-started-states-updated', getWorktreesStates());
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
      setWorktreesStates(
        updateWorktreesStates(
          getWorktreesStates(),
          worktree.label,
          i,
          'warning',
        ),
      );
      event.sender.send(
        'workflow-started-states-updated',
        getWorktreesStates(),
      );
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
