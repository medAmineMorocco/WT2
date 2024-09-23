import { execSync } from 'child_process';
import utils from '../../utils/utils';

const zlib = require('zlib');

async function gitCommand() {
  const storedGitExecutable = await utils.getStorageItem('gitExecutablePath');
  return storedGitExecutable || 'git';
}

function getShell() {
  return utils.getStorageItem('shellPath');
}

function showLog(directory: string, branch: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const gitCmd = await gitCommand();
      const command = branch
        ? `"${gitCmd}" log ${branch} --oneline --decorate --graph --color=always --format="%C(auto)%h %C(auto)%d %C(auto)%ai %C(bold)%s %C(auto)<%an>"`
        : `"${gitCmd}" log --oneline --decorate --all --graph --color=always --format="%C(auto)%h %C(auto)%d %C(auto)%ai %C(bold)%s %C(auto)<%an>"`;
      const stdout = execSync(command, options);
      const compressed = zlib.gzipSync(stdout.toString());
      resolve(compressed);
    } catch (error) {
      reject(error);
    }
  });
}

function showDiff(
  val1: string,
  val2: string,
  diffFilters: string,
  isAll: boolean,
  directory: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      maxBuffer: 1024 * 1024 * 10, // 10 MB buffer size
      shell: true,
    } as any;
    try {
      const gitCmd = await gitCommand();
      let command = `"${gitCmd}" diff ${val1} ${val2}`;
      if (isAll) {
        const stdout = execSync(command, options);
        const compressed = zlib.gzipSync(stdout.toString());
        resolve(compressed);
      }
      command += ' --diff-filter=';
      if (diffFilters.includes('added')) {
        command += 'A';
      }
      if (diffFilters.includes('deleted')) {
        command += 'D';
      }
      if (diffFilters.includes('modified')) {
        command += 'M';
      }
      const stdout = execSync(command, options);
      const compressed = zlib.gzipSync(stdout.toString());
      resolve(compressed);
    } catch (error) {
      reject(error);
    }
  });
}

function diffStats(
  val1: string,
  val2: string,
  diffFilters: string,
  isAll: boolean,
  directory: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const gitCmd = await gitCommand();
      const stats = {} as any;
      let command = `"${gitCmd}" diff ${val1} ${val2} --name-only`;
      let commandAll = command;

      let stdout;
      let files;

      commandAll += ' --diff-filter=';
      if (diffFilters.includes('added')) {
        command += ' --diff-filter=A';
        commandAll += 'A';

        stdout = execSync(command, options);
        files = stdout
          .toString()
          .split('\n')
          .filter((line) => line.trim() !== '');
        stats.added = files.length;
      }
      if (diffFilters.includes('deleted')) {
        command += ' --diff-filter=D';
        commandAll += 'D';

        stdout = execSync(command, options);
        files = stdout
          .toString()
          .split('\n')
          .filter((line) => line.trim() !== '');
        stats.deleted = files.length;
      }
      if (diffFilters.includes('modified')) {
        command += ' --diff-filter=M';
        commandAll += 'M';

        stdout = execSync(command, options);
        files = stdout
          .toString()
          .split('\n')
          .filter((line) => line.trim() !== '');
        stats.modified = files.length;
      }

      if (isAll) {
        stdout = execSync(command, options);
        files = stdout
          .toString()
          .split('\n')
          .filter((line) => line.trim() !== '');
        stats.all = files.length;
      } else {
        stdout = execSync(commandAll, options);
        files = stdout
          .toString()
          .split('\n')
          .filter((line) => line.trim() !== '');
        stats.all = files.length;
      }

      resolve(stats);
    } catch (error) {
      reject(error);
    }
  });
}

function executeCommand(command: string, directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const shell = await getShell();
    const options = {
      cwd: directory,
      shell: shell || true,
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
      const gitCmd = await gitCommand();
      const allBranches = execSync(
        `"${gitCmd}" branch --format="%(refname:short)"`,
        options,
      )
        .toString()
        .trim()
        .split('\n');

      const worktreeOutput = execSync(
        `"${gitCmd}" worktree list --porcelain`,
        options,
      );

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
      const gitCmd = await gitCommand();
      const stdout = execSync(`"${gitCmd}" tag`, options)
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
      const gitCmd = await gitCommand();
      const worktreesOutput = execSync(
        `"${gitCmd}" worktree list --porcelain`,
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

async function listRefs(directory: string) {
  // eslint-disable-next-line no-useless-catch
  try {
    const refs = {} as any;
    refs.branches = await listBranches(directory);
    refs.tags = await listTags(directory);
    refs.worktrees = await listWorktrees(directory);
    return refs;
  } catch (err) {
    throw err;
  }
}

export default {
  showLog,
  showDiff,
  diffStats,
  executeCommand,
  listBranches,
  listTags,
  listWorktrees,
  listRefs,
  gitCommand,
  getShell,
};
