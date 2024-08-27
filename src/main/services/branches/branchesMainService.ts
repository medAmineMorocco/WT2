import gitMainService from '../git/gitMainService';

const { exec } = require('child_process');

function findAll(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const gitCommand = await gitMainService.gitCommand();
    exec(
      `"${gitCommand}" branch --format=%(refname:short)`,
      {
        cwd: directory,
      },
      (error: any, stdout: any) => {
        if (error) {
          reject(error);
        }
        const branches = stdout.trim().split('\n');
        resolve(branches);
      },
    );
  });
}

export default {
  findAll,
};
