import path from 'path';
import * as os from 'os';
import gitMainService from '../git/gitMainService';

const { exec, execSync } = require('child_process');

function findAll(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    exec(
      `"${gitCommand}" worktree list`,
      {
        cwd: directory,
      },
      (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        const lines = stdout.trim().split('\n');

        const worktrees = lines.map((line: string) => {
          const lineBySpace = line.split(/\s+/g);
          const pathRep = lineBySpace[0];
          const head = lineBySpace[1];
          let name = '';
          if (lineBySpace[2]) {
            name = lineBySpace[2].replace('[', '').replace(']', '');
          }
          const isLocked = lineBySpace[3] === 'locked';
          const prunable = lineBySpace[3] === 'prunable';

          return {
            path: pathRep,
            name,
            head,
            isLocked,
            prunable,
          };
        });
        resolve(worktrees);
      },
    );
  });
}

async function branchExists(branchName: string, dir: string) {
  try {
    const gitCommand = await gitMainService.gitCommand();
    execSync(`"${gitCommand}" rev-parse --verify refs/heads/${branchName}`, {
      stdio: 'ignore',
      cwd: dir,
    });
    return true;
  } catch (error) {
    return false;
  }
}

function add(
  name: string,
  worktreePath: string,
  createWorktreeMode: string,
  dir: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    let command: string;
    if (createWorktreeMode === 'existing-branch') {
      command = `"${gitCommand}" worktree add ${worktreePath} ${name}`;
    } else if (createWorktreeMode === 'existing-tag') {
      const branchNameForTag = name.replaceAll('.', '-');
      const branchExist = await branchExists(branchNameForTag, dir);
      if (!branchExist) {
        try {
          execSync(`"${gitCommand}" branch ${branchNameForTag} ${name}`, {
            cwd: dir,
          });
        } catch (e) {
          reject(e);
        }
      }
      command = `"${gitCommand}" worktree add ${worktreePath} ${branchNameForTag}`;
    } else {
      command = `"${gitCommand}" worktree add -b ${name} ${worktreePath}`;
    }
    exec(
      command,
      {
        cwd: dir,
      },
      async (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        resolve(stdout);
      },
    );
  });
}

function remove(worktreePath: string, dir: string, force: boolean) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    const command = force
      ? `"${gitCommand}" worktree remove ${worktreePath} --force`
      : `"${gitCommand}" worktree remove ${worktreePath}`;
    exec(
      command,
      {
        cwd: dir,
      },
      (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        resolve(stdout);
      },
    );
  });
}

function removeWithLocalBranch(
  name: string,
  worktreePath: string,
  dir: string,
  force: boolean,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    const command = force
      ? `"${gitCommand}" worktree remove ${worktreePath} --force`
      : `"${gitCommand}" worktree remove ${worktreePath}`;
    exec(
      command,
      {
        cwd: dir,
      },
      (error: any) => {
        if (error) {
          reject(error);
        }
        exec(
          `"${gitCommand}" branch -d ${name}`,
          {
            cwd: dir,
          },
          (error2: any) => {
            if (error2) {
              reject(error2);
            }
            resolve('ok');
          },
        );
      },
    );
  });
}

function rename(
  oldName: string,
  newName: string,
  oldWorktreePath: string,
  dir: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    const newWorktreePath = path.normalize(
      path.join(oldWorktreePath, '..', newName),
    );
    exec(
      `"${gitCommand}" worktree move ${oldName} ${newWorktreePath} && "${gitCommand}" branch -m ${oldName} ${newName}`,
      {
        cwd: dir,
      },
      (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        resolve(stdout);
      },
    );
  });
}

function prune(dir: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    exec(
      `"${gitCommand}" worktree prune`,
      {
        cwd: dir,
      },
      (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        resolve(stdout);
      },
    );
  });
}

function changeLock(toLock: boolean, worktreeName: string, dir: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    const command = toLock
      ? `"${gitCommand}" worktree lock ${worktreeName}`
      : `"${gitCommand}" worktree unlock ${worktreeName}`;
    exec(
      command,
      {
        cwd: dir,
      },
      (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        resolve(stdout);
      },
    );
  });
}

function getWorktreesFolder(dir: string) {
  return new Promise((resolve, reject) => {
    try {
      const folder = path.normalize(path.join(dir, '..'));
      const separator = os.platform() === 'win32' ? '\\' : '/';
      resolve({
        folder,
        separator,
      });
    } catch (err: any) {
      reject(err.toString());
    }
  });
}

function getWorktreesSeparator() {
  return new Promise((resolve, reject) => {
    try {
      const separator = os.platform() === 'win32' ? '\\' : '/';
      resolve(separator);
    } catch (err: any) {
      reject(err.toString());
    }
  });
}

function moveWorktreeToFolder(
  name: string,
  newWorktreePath: string,
  dir: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    exec(
      `"${gitCommand}" worktree move ${name} ${newWorktreePath}`,
      {
        cwd: dir,
      },
      (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        resolve(stdout);
      },
    );
  });
}

export default {
  findAll,
  add,
  remove,
  removeWithLocalBranch,
  rename,
  prune,
  changeLock,
  getWorktreesFolder,
  getWorktreesSeparator,
  moveWorktreeToFolder,
};
