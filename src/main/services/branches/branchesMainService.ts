const { exec } = require('child_process');

function findAll(directory: string) {
  return new Promise((resolve, reject) => {
    exec(
      'git branch --format=%(refname:short)',
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
