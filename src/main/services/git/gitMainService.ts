import { execSync } from 'child_process';

function showLog(directory: string, branch: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const command = branch
        ? `git log ${branch} --oneline --decorate --graph --color=always --format="%C(auto)%h %C(auto)%d %C(auto)%ai %C(bold)%s %C(auto)<%an>"`
        : 'git log --oneline --decorate --all --graph --color=always --format="%C(auto)%h %C(auto)%d %C(auto)%ai %C(bold)%s %C(auto)<%an>"';
      const stdout = execSync(command, options);
      resolve(stdout);
    } catch (error) {
      reject(error);
    }
  });
}

function showDiff(val1: string, val2: string, directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      maxBuffer: 1024 * 1024 * 10, // 10 MB buffer size
      shell: true,
    } as any;
    try {
      const stdout = execSync(`git diff ${val1} ${val2}`, options);
      resolve(stdout.toString());
    } catch (error) {
      reject(error);
    }
  });
}

function executeCommand(command: string, directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const stdout = execSync(command, options);
      resolve(stdout);
    } catch (error) {
      reject(error);
    }
  });
}

function listBranches(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const allBranches = execSync(
        'git branch --format="%(refname:short)"',
        options,
      )
        .toString()
        .trim()
        .split('\n');

      const worktreeOutput = execSync('git worktree list --porcelain', options);

      const worktreeBranches = worktreeOutput
        .toString()
        .trim()
        .split('\n')
        .filter((line) => line.startsWith('branch '))
        .map((line) => line.split(' ')[1].replace('refs/heads/', ''));

      const branchesNotInWorktrees = allBranches.filter(
        (branch) => !worktreeBranches.includes(branch),
      );

      resolve(branchesNotInWorktrees);
    } catch (error) {
      reject(error);
    }
  });
}

function listTags(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const stdout = execSync('git tag', options)
        .toString()
        .trim()
        .split('\n')
        .filter((value) => value !== '');
      resolve(stdout);
    } catch (error) {
      reject(error);
    }
  });
}

function listWorktrees(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const worktreesOutput = execSync(
        'git worktree list --porcelain',
        options,
      );
      const worktreeBranches = worktreesOutput
        .toString()
        .trim()
        .split('\n')
        .filter((line) => line.startsWith('branch '))
        .map((line) => line.split(' ')[1].replace('refs/heads/', ''));
      resolve(worktreeBranches);
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  showLog,
  showDiff,
  executeCommand,
  listBranches,
  listTags,
  listWorktrees,
};
