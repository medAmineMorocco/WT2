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

function add(name: string, dir: string) {
  return new Promise((resolve, reject) => {
    exec(
      `git worktree add ../${name}`,
      {
        cwd: dir,
      },
      async (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        // const jetbrainsCachedDir = `${dir}\\.idea`;
        // if (fs.existsSync(jetbrainsCachedDir)) {
        //   await execPromisify(`cp -r .idea ../${name}`, { cwd: dir });
        // }
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

export default {
  findAll,
  add,
  remove,
  removeWithLocalBranch,
  removeWithLocalAndRemoteBranch,
};
