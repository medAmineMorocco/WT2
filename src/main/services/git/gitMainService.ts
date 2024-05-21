import { execSync } from 'child_process';
import { BrowserWindow } from 'electron';
import { html } from 'diff2html';
import { ColorSchemeType } from 'diff2html/lib/types';
import settingsMainService from '../settings/settingsMainService';

function showLog(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    const terminal = await settingsMainService.getActualTerminal(
      BrowserWindow.getFocusedWindow(),
    );
    if (terminal) {
      options.shell = terminal;
    }
    try {
      const stdout = execSync(
        'git log --oneline --decorate --graph --all --color=always --format="%C(auto)%h %C(auto)%d %C(auto)%ai %C(bold)%s %C(auto)<%an>" -500',
        options,
      );
      resolve(stdout);
    } catch (error) {
      reject(error);
    }
  });
}

function showDiff(
  val1: string,
  val2: string,
  directory: string,
  isDarkMode: boolean,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      maxBuffer: 1024 * 1024 * 10, // 10 MB buffer size
      shell: true,
    } as any;
    try {
      const stdout = execSync(`git diff ${val1} ${val2}`, options);
      const htmlDiff = html(stdout.toString(), {
        outputFormat: 'side-by-side',
        colorScheme: isDarkMode ? ColorSchemeType.DARK : ColorSchemeType.LIGHT,
      });
      resolve(htmlDiff);
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
    const terminal = await settingsMainService.getActualTerminal(
      BrowserWindow.getFocusedWindow(),
    );
    if (terminal) {
      options.shell = terminal;
    }
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
