import { execSync } from 'child_process';
import { BrowserWindow } from 'electron';
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
        'git log --oneline --decorate --graph --all --color=always --format="%C(auto)%h %C(auto)%d %C(italic)%an %C(auto)%ai %C(bold)%s" -500',
        options,
      );
      resolve(stdout);
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  showLog,
};
