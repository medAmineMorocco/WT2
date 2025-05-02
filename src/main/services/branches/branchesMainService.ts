import gitMainService from '../git/gitMainService';

const { exec } = require('child_process');

function findAll(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      exec(
        `"${gitCommand}" branch --format="%(refname:short)"`,
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
    } catch (e) {
      reject(e);
    }
  });
}

function add(branchName: string, directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      exec(
        `"${gitCommand}" branch ${branchName}`,
        {
          cwd: directory,
        },
        (error: any) => {
          if (error) {
            reject(error);
          }
          resolve('created');
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

export default {
  findAll,
  add,
};
