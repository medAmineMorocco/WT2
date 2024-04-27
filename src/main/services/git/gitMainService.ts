import { exec } from 'child_process';

function showLog(directory: string) {
  return new Promise((resolve, reject) => {
    exec(
      'git log --oneline --decorate --graph --all -500',
      {
        cwd: directory,
      },
      (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        const branches = stdout.toString();
        resolve(branches);
      },
    );
  });
}

export default {
  showLog,
};
