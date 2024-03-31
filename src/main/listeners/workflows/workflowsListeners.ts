import { spawn } from 'child_process';
import path from 'path';
import { ipcMain } from 'electron';

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

let worktreesStates: any[] = [];
let logStates: any[] = [];
function executeSequentially(
  event: any,
  worktreeLabel: string,
  commands: string[],
  currentIndex: number,
  normalizedPath: string,
  resolve: any,
) {
  if (currentIndex >= commands.length) {
    // All commands have been executed
    return;
  }
  const currentWorktree = worktreesStates.find(
    (item) => item.title === worktreeLabel,
  );
  if (currentWorktree.status !== 'processing') {
    worktreesStates = updateWorktreesStates(
      worktreesStates,
      worktreeLabel,
      currentIndex,
      'processing',
    );
    event.sender.send('workflow-started-states-updated', worktreesStates);
  }

  const command = commands[currentIndex];

  const commandProcess = spawn(command, [], {
    cwd: normalizedPath,
    shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
  });

  commandProcess.stdout.on('data', (data: any) => {
    logStates = logStates.map((item) => {
      if (item.label === worktreeLabel) {
        if (!item.data.includes(command)) {
          item.data.push(`:::: ${command} ::::`);
        }
        item.data.push(data.toString());
      }
      return item;
    });
    event.sender.send('workflow-started-log-received', logStates);
  });

  commandProcess.stderr.on('data', (data: any) => {
    logStates = logStates.map((item) => {
      if (item.label === worktreeLabel) {
        item.data.push(data.toString());
      }
      return item;
    });
    event.sender.send('workflow-started-log-received', logStates);
  });

  // Listen for the exit event to handle process completion
  commandProcess.on('exit', (code: any) => {
    if (code === 0) {
      if (currentIndex === commands.length - 1) {
        worktreesStates = updateWorktreesStates(
          worktreesStates,
          worktreeLabel,
          currentIndex,
          'success',
        );
        event.sender.send('workflow-started-states-updated', worktreesStates);
        resolve('finish commands');
      }

      setTimeout(() => {
        executeSequentially(
          event,
          worktreeLabel,
          commands,
          currentIndex + 1,
          normalizedPath,
          resolve,
        );
      }, 1000);
    } else {
      console.error(`Command exited with code ${code}`);
      worktreesStates = updateWorktreesStates(
        worktreesStates,
        worktreeLabel,
        currentIndex,
        'error',
      );
      setTimeout(() => {
        event.sender.send('workflow-started-states-updated', worktreesStates);
      }, 1000);
      resolve('finish commands');
    }
  });
}

ipcMain.on('play-workflow', async function (event, workflow) {
  console.log('workflow to play', workflow);

  if (workflow.mode === 'parallel') {
    console.log('parallel mode');
  } else {
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
        data: [],
      };
    });
    event.sender.send('workflow-started-log-received', logStates);
    // eslint-disable-next-line no-restricted-syntax
    for (let i = 0; i < workflow.worktrees.length; i++) {
      const worktree = workflow.worktrees[i];
      const normalizedPath = path.normalize(worktree.path);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(() => {
          executeSequentially(
            event,
            worktree.label,
            commands,
            0,
            normalizedPath,
            resolve,
          );
        }, 1000);
      });
      if (i === workflow.worktrees.length - 1) {
        event.sender.send('workflow-stopped');
      }
    }
  }
});

ipcMain.on('stop-workflow', function (event) {
  event.sender.send('workflow-stopped');
});
