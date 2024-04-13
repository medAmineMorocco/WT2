import fs from 'fs';

export default function copyDirectory(source: string, destination: string) {
  return new Promise((resolve, reject) => {
    const options = {
      recursive: true,
    } as any;
    fs.cp(source, destination, options, (err) => {
      if (err) {
        reject(err.toString());
      }
      resolve('done');
    });
  });
}
