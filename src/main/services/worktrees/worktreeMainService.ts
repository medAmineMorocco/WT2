import fs from 'fs';
import path from 'path';
import * as os from 'os';
import copyDirectory from '../utils/fileService';
import { editorsCst } from '../../../renderer/modules/config/EditorsConfig';

const { exec, execSync } = require('child_process');

function findAll(directory: string) {
  return new Promise((resolve, reject) => {
    exec(
      'git worktree list',
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
          const name = lineBySpace[2].replace('[', '').replace(']', '');
          const isLocked = lineBySpace[3] === 'locked';

          return {
            path: pathRep,
            name,
            head,
            isLocked,
          };
        });
        resolve(worktrees);
      },
    );
  });
}

function add(
  name: string,
  worktreePath: string,
  createWorktreeMode: string,
  dir: string,
) {
  return new Promise((resolve, reject) => {
    let command: string;
    if (createWorktreeMode === 'existing-branch') {
      command = `git worktree add ${worktreePath} ${name}`;
    } else if (createWorktreeMode === 'existing-tag') {
      command = `git branch ${name.replaceAll('.', '-')} ${name}`;
    } else {
      command = `git worktree add -b ${name} ${worktreePath}`;
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
        if (createWorktreeMode === 'existing-tag') {
          try {
            // eslint-disable-next-line no-param-reassign
            name = name.replaceAll('.', '-');
            execSync(`git worktree add ${worktreePath} ${name}`, {
              cwd: dir,
            });
          } catch (e) {
            reject(e);
          }
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const editor of editorsCst) {
          if (editor.enabled && editor.settingsFolder) {
            const projectEditorSettingsFolder = path.join(
              dir,
              editor.settingsFolder,
            );
            if (
              fs.existsSync(projectEditorSettingsFolder) &&
              !fs.existsSync(path.join(worktreePath, editor.settingsFolder))
            ) {
              // eslint-disable-next-line no-await-in-loop
              await copyDirectory(
                projectEditorSettingsFolder,
                path.join(worktreePath, editor.settingsFolder),
              );
            }
          }
          if (editor.enabled && editor.settingsFile) {
            const projectEditorSettingsFile = path.join(
              dir,
              editor.settingsFile,
            );
            if (
              fs.existsSync(projectEditorSettingsFile) &&
              !fs.existsSync(path.join(worktreePath, editor.settingsFile))
            ) {
              fs.copyFileSync(
                projectEditorSettingsFile,
                path.join(worktreePath, editor.settingsFile),
              );
            }
          }
        }

        resolve(stdout);
      },
    );
  });
}

function remove(worktreePath: string, dir: string, force: boolean) {
  return new Promise((resolve, reject) => {
    const command = force
      ? `git worktree remove ${worktreePath} --force`
      : `git worktree remove ${worktreePath}`;
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
  return new Promise((resolve, reject) => {
    const command = force
      ? `git worktree remove ${worktreePath} --force`
      : `git worktree remove ${worktreePath}`;
    exec(
      `${command} && git branch -d ${name}`,
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

function rename(
  oldName: string,
  newName: string,
  oldWorktreePath: string,
  dir: string,
) {
  return new Promise((resolve, reject) => {
    const newWorktreePath = path.normalize(
      path.join(oldWorktreePath, '..', newName),
    );
    exec(
      `git worktree move ${oldName} ${newWorktreePath} && git branch -m ${oldName} ${newName}`,
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
  return new Promise((resolve, reject) => {
    exec(
      'git worktree prune',
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
  return new Promise((resolve, reject) => {
    const command = toLock
      ? `git worktree lock ${worktreeName}`
      : `git worktree unlock ${worktreeName}`;
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

export default {
  findAll,
  add,
  remove,
  removeWithLocalBranch,
  rename,
  prune,
  changeLock,
  getWorktreesFolder,
};
