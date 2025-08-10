import path from 'path';
import * as os from 'os';
import { existsSync, lstatSync } from 'node:fs';
import gitMainService from '../git/gitMainService';
import {
  assertBranchExists,
  assertBranchIsNotInUseInOtherWorktrees,
  assertBranchNotExists,
  assertTagExists,
  assertWorktreeCleanBeforeDelete,
  assertWorktreeExists,
  assertWorktreeNotExists,
  assertWorktreePathIsAvailable,
  assertWriteAccess,
} from '../../validators/worktreeValidators';

const { exec, execSync } = require('child_process');

function isPrimaryWorktree(directory: string) {
  return (
    existsSync(path.join(directory, '.git')) &&
    lstatSync(path.join(directory, '.git')).isDirectory()
  );
}

function sanitizeWorktreeName(worktreeName: string) {
  return worktreeName.replace(/\//g, '-').replace(/[:*?"<>|\\]/g, '-');
}

function resolveWorktreeNamePattern(
  pattern: string | null,
  repo: string,
  branch: string,
): string {
  if (!pattern || (pattern && pattern.trim() === '')) {
    return branch;
  }
  return pattern.replaceAll(/{repo}/g, repo).replaceAll(/{branch}/g, branch);
}

function findAll(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
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
              isPrimary: isPrimaryWorktree(pathRep),
              path: pathRep,
              name,
              resolvedName: path.basename(pathRep),
              head,
              isLocked,
              prunable,
            };
          });
          resolve(worktrees);
        },
      );
    } catch (e) {
      reject(e);
    }
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

function add(
  name: string,
  worktreePath: string,
  createWorktreeMode: string,
  dir: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      assertWorktreeNotExists(dir, name);
      assertWorktreePathIsAvailable(name, worktreePath);
      const parentDir = path.dirname(worktreePath);
      assertWriteAccess(parentDir);
      let command: string;
      if (createWorktreeMode === 'existing-branch') {
        assertBranchExists(dir, name);
        command = `"${gitCommand}" worktree add ${worktreePath} ${name}`;
      } else if (createWorktreeMode === 'existing-tag') {
        assertTagExists(dir, name);
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
        assertBranchNotExists(dir, name);
        command = `"${gitCommand}" worktree add -b ${name} ${worktreePath}`;
      }
      execSync(command, {
        cwd: dir,
      });
      resolve('created');
    } catch (e) {
      reject(e);
    }
  });
}

function addFromCommit(hash: string, worktreesPath: string, dir: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const branchNameForCommit = `temp-${hash}`;
      const separator = await getWorktreesSeparator();
      let worktreePath;
      if (worktreesPath) {
        worktreePath = worktreesPath + separator + branchNameForCommit;
      } else {
        worktreePath = path.join(dir, '..', branchNameForCommit);
      }
      const gitCommand = await gitMainService.gitCommand();
      assertBranchNotExists(dir, branchNameForCommit);
      assertWorktreeNotExists(dir, branchNameForCommit);
      assertWorktreePathIsAvailable(branchNameForCommit, worktreePath);
      const parentDir = path.dirname(worktreePath);
      assertWriteAccess(parentDir);
      try {
        execSync(`"${gitCommand}" branch ${branchNameForCommit} ${hash}`, {
          cwd: dir,
        });
      } catch (e) {
        reject(e);
      }
      const command = `"${gitCommand}" worktree add ${worktreePath} ${branchNameForCommit}`;
      execSync(command, {
        cwd: dir,
      });
      resolve('created');
    } catch (e) {
      reject(e);
    }
  });
}

function remove(
  worktreeName: string,
  worktreePath: string,
  dir: string,
  force: boolean,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      const sanitizedWorktreeName = sanitizeWorktreeName(worktreeName);
      assertWorktreeExists(dir, sanitizedWorktreeName);
      if (!force) {
        await assertWorktreeCleanBeforeDelete(worktreePath, gitCommand);
      }
      assertWriteAccess(worktreePath);
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
    } catch (e) {
      reject(e);
    }
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
    try {
      const gitCommand = await gitMainService.gitCommand();
      const sanitizedWorktreeName = sanitizeWorktreeName(name);
      assertWorktreeExists(dir, sanitizedWorktreeName);
      if (!force) {
        await assertWorktreeCleanBeforeDelete(worktreePath, gitCommand);
      }
      assertBranchIsNotInUseInOtherWorktrees(dir, name, worktreePath);
      assertWriteAccess(worktreePath);

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
            `"${gitCommand}" branch -D ${name}`,
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
    } catch (e) {
      reject(e);
    }
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
    try {
      const gitCommand = await gitMainService.gitCommand();
      assertWorktreeNotExists(dir, newName);
      const sanitizedNewWorktreeName = sanitizeWorktreeName(newName);
      const sanitizedOldWorktreeName = sanitizeWorktreeName(oldName);
      const resolvedOldWorktreeName = path.basename(oldWorktreePath);

      const resolvedNewWorktreeName = resolvedOldWorktreeName.replace(
        sanitizedOldWorktreeName,
        sanitizedNewWorktreeName,
      );
      const newWorktreePath = path.normalize(
        path.join(oldWorktreePath, '..', resolvedNewWorktreeName),
      );
      assertWorktreePathIsAvailable(newName, newWorktreePath);
      assertWriteAccess(oldWorktreePath);
      exec(
        `"${gitCommand}" worktree move ${resolvedOldWorktreeName} ${newWorktreePath} && "${gitCommand}" branch -m ${oldName} ${newName}`,
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
    } catch (e) {
      reject(e);
    }
  });
}

function prune(dir: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
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
    } catch (e) {
      reject(e);
    }
  });
}

function changeLock(toLock: boolean, worktreePath: string, dir: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      const resolvedWorktreeName = path.basename(worktreePath);
      assertWorktreeExists(dir, resolvedWorktreeName);
      const command = toLock
        ? `"${gitCommand}" worktree lock ${resolvedWorktreeName}`
        : `"${gitCommand}" worktree unlock ${resolvedWorktreeName}`;
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
    } catch (e) {
      reject(e);
    }
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

function moveWorktreeToFolder(
  name: string,
  newWorktreePath: string,
  worktreePath: string,
  dir: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      assertWorktreePathIsAvailable(name, newWorktreePath);
      const parentDir = path.dirname(newWorktreePath);
      assertWriteAccess(parentDir);
      const resolvedWorktreeName = path.basename(worktreePath);
      exec(
        `"${gitCommand}" worktree move ${resolvedWorktreeName} ${newWorktreePath}`,
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
    } catch (e) {
      reject(e);
    }
  });
}

function getPathPreviewOfPattern(
  name: string,
  worktreePath: string,
  pattern: string,
  dir: string,
) {
  return new Promise((resolve, reject) => {
    try {
      const sanitizedWorktreeName = sanitizeWorktreeName(name);

      const resolvedWorktreeName = resolveWorktreeNamePattern(
        pattern,
        path.basename(dir),
        sanitizedWorktreeName,
      );
      const pathPreview = path.normalize(
        path.join(worktreePath, '..', resolvedWorktreeName),
      );
      resolve(pathPreview);
    } catch (err: any) {
      reject(err.toString());
    }
  });
}

export default {
  findAll,
  add,
  addFromCommit,
  remove,
  removeWithLocalBranch,
  rename,
  prune,
  changeLock,
  getWorktreesFolder,
  getWorktreesSeparator,
  moveWorktreeToFolder,
  branchExists,
  getPathPreviewOfPattern,
};
