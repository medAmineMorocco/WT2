import { execSync } from 'child_process';
import { BrowserWindow } from 'electron';
import { html } from 'diff2html';
import settingsMainService from '../settings/settingsMainService';
import { ColorSchemeType } from 'diff2html/lib/types';

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

function showDiff(directory: string, isDarkMode: boolean) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const stdout = execSync(
        'git diff d72d782ea0560d189f90433731c16dee6cd2aa7d 2bce4d8cdf4744e12db16be76984c50a67df5159',
        options,
      );
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

export default {
  showLog,
  showDiff,
  executeCommand,
};
