import path from 'path';

const fs = require('fs');
const { conf } = require('../../conf/conf');

function add(
  name: string,
  mainCommand: string,
  commands: string[],
  dir: string,
) {
  const mappedCommands = !commands
    ? []
    : commands.map((cmd: string, index: number) => {
        return {
          key: (index + 1).toString(),
          value: cmd,
        };
      });
  const workflow = {
    name,
    command: {
      key: '0',
      value: mainCommand,
    },
    commands: mappedCommands,
  };
  const baseDir = `${dir}\\.git\\${conf.appPath}\\${name}`;
  fs.mkdirSync(path.normalize(baseDir));
  const targetDir = `${baseDir}\\details.json`;
  fs.writeFileSync(path.normalize(targetDir), JSON.stringify(workflow));
}

function remove(name: string, dir: string) {
  const targetDir = `${dir}\\.git\\${conf.appPath}\\${name}`;
  fs.rmSync(path.normalize(targetDir), { recursive: true, force: true });
}

function findAll(dir: string) {
  const baseDir = `${dir}\\.git\\${conf.appPath}`;
  return fs
    .readdirSync(path.normalize(baseDir), { withFileTypes: true })
    .filter((dirent: any) => dirent.isDirectory())
    .map((dirent: any) => dirent.name)
    .map((dirName: string) => {
      const targetDir = `${baseDir}\\${dirName}\\details.json`;
      return JSON.parse(fs.readFileSync(targetDir, 'utf-8'));
    });
}

function findAllWithDetails(dir: string) {
  const baseDir = `${dir}\\.git\\${conf.appPath}`;
  return findAll(dir).map((workflow: any) => {
    const targetDir = `${baseDir}\\${workflow}\\details.json`;
    const data = fs.readFileSync(path.normalize(targetDir), {
      encoding: 'utf8',
    });
    return JSON.parse(data);
  });
}

function findByName(dir: string, workflow: string) {
  const targetDir = `${dir}\\.git\\${conf.appPath}\\${workflow}\\details.json`;
  const data = fs.readFileSync(path.normalize(targetDir), {
    encoding: 'utf8',
  });
  return JSON.parse(data);
}

export default {
  add,
  remove,
  findAll,
  findAllWithDetails,
  findByName,
};
