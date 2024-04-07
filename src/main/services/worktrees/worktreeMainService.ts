import fs from 'fs';
import { execSync } from 'child_process';

const { exec } = require('child_process');

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
          const path = lineBySpace[0];
          const head = lineBySpace[1];
          const name = lineBySpace[2].replace('[', '').replace(']', '');

          return {
            path,
            name,
            head,
          };
        });
        resolve(worktrees);
      },
    );
  });
}

function add(name: string, isExistingBranch: boolean, dir: string) {
  return new Promise((resolve, reject) => {
    const command = isExistingBranch
      ? `git worktree add ../${name} ${name}`
      : `git worktree add ../${name}`;
    exec(
      command,
      {
        cwd: dir,
      },
      async (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        const jetbrainsCachedDir = `${dir}\\.idea`;
        if (fs.existsSync(jetbrainsCachedDir)) {
          execSync(`cp -r .idea ../${name}`, {
            cwd: dir,
            shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
          });
        }
        resolve(stdout);
      },
    );
  });
}

function remove(name: string, dir: string, force: boolean) {
  return new Promise((resolve, reject) => {
    const command = force
      ? `git worktree remove ../${name} --force`
      : `git worktree remove ../${name}`;
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

function removeWithLocalBranch(name: string, dir: string, force: boolean) {
  return new Promise((resolve, reject) => {
    const command = force
      ? `git worktree remove ../${name} --force`
      : `git worktree remove ../${name}`;
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

function removeWithLocalAndRemoteBranch(
  name: string,
  dir: string,
  force: boolean,
) {
  return new Promise((resolve, reject) => {
    const command = force
      ? `git worktree remove ../${name} --force`
      : `git worktree remove ../${name}`;
    exec(
      `${command} && git push origin --delete ${name} && git branch -d ${name}`,
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

function rename(oldName: string, newName: string, dir: string) {
  return new Promise((resolve, reject) => {
    exec(
      `git worktree move ${oldName} ../${newName} && git branch -m ${oldName} ${newName}`,
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
  removeWithLocalAndRemoteBranch,
  rename,
};
