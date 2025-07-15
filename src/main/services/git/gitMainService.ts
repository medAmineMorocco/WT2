import { execSync } from 'child_process';
import log from 'electron-log';
import utils from '../../utils/utils';
import BusinessError from '../../exceptions/BusinessError';

const zlib = require('zlib');

async function gitCommand() {
  const storedGitExecutable = await utils.getStorageItem('gitExecutablePath');
  const gitExecutable = storedGitExecutable || 'git';

  let output;
  try {
    output = execSync(`"${gitExecutable}" --version`, { stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    throw new BusinessError(
      `Git is not installed, not accessible, or the path "${gitExecutable}" is invalid. Please check your settings.`,
    );
  }

  if (!output.toLowerCase().includes('git version')) {
    throw new BusinessError(
      `"${gitExecutable}" is not a valid Git executable. Please configure a correct path in the settings.`,
    );
  }

  return gitExecutable;
}

function getShell() {
  return utils.getStorageItem('shellPath');
}

function showLog(directory: string, branch: string, author: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const gitCmd = await gitCommand();
      const command = branch
        ? `"${gitCmd}" log -n 500 ${branch} ${author ? `--author="${author}"` : ''} --oneline --decorate --graph --abbrev-commit --no-color --format="%s %d <%an> [%ci] %h"`
        : `"${gitCmd}" log -n 500 --all ${author ? `--author="${author}"` : ''} --oneline --decorate --graph --abbrev-commit --no-color --format="%s %d <%an> [%ci] %h"`;
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
    } as any;
    try {
      const gitCmd = await gitCommand();
      log.debug(`** gitCmd: ${gitCmd}`);

      const allBranches = execSync(
        `"${gitCmd}" branch --format="%(refname:short)"`,
        options,
      )
        .toString()
        .trim()
        .split('\n');
      log.debug(`** allBranches: ${allBranches}`);

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
      log.debug(`** worktreeBranches: ${worktreeBranches}`);

      const branchesNotInWorktrees = allBranches.filter(
        (branch) => !worktreeBranches.includes(branch),
      );
      log.debug(`** branchesNotInWorktrees: ${branchesNotInWorktrees}`);

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
      log.debug(`** gitCmd: ${gitCmd}`);

      const allTags = execSync(`"${gitCmd}" tag`, options)
        .toString()
        .trim()
        .split('\n')
        .filter((value) => value !== '');
      log.debug(`** allTags: ${allTags}`);

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
      log.debug(`** worktreeBranches: ${worktreeBranches}`);

      const tagsNotInWorktrees = allTags.filter(
        (tag) => !worktreeBranches.includes(tag.replaceAll('.', '-')),
      );
      log.debug(`** tagsNotInWorktrees: ${tagsNotInWorktrees}`);

      resolve(tagsNotInWorktrees);
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

async function listAuthors(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const gitCmd = await gitCommand();
      const output = execSync(
        `"${gitCmd}" shortlog -s -n --all --no-merges`,
        options,
      );
      const authors = output
        .toString()
        .trim()
        .split('\n')
        .map((line) => line.trim().replace(/^\d+\s+/, '')) // Remove commit counts
        .filter(Boolean); // Remove any empty lines
      resolve(authors);
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  showLog,
  showDiff,
  diffStats,
  executeCommand,
  listBranches,
  listTags,
  listWorktrees,
  listAuthors,
  listRefs,
  gitCommand,
  getShell,
};
