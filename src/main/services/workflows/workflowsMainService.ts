import path from 'path';

const fs = require('fs');
const { conf } = require('../../conf/conf');

function save(
  id: string,
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
    id: id !== '' ? id : new Date().getTime().toString(),
    name,
    command: {
      key: '0',
      value: mainCommand,
    },
    commands: mappedCommands,
  };
  const baseDir = `${dir}\\.git\\${conf.appPath}\\${workflow.id}`;
  if (!fs.existsSync(path.normalize(baseDir))) {
    fs.mkdirSync(path.normalize(baseDir));
  }
  const targetDir = `${baseDir}\\details.json`;
  fs.writeFileSync(path.normalize(targetDir), JSON.stringify(workflow));
}

function remove(id: string, dir: string) {
  const targetDir = `${dir}\\.git\\${conf.appPath}\\${id}`;
  fs.rmSync(path.normalize(targetDir), { recursive: true, force: true });
}

function findAll(dir: string) {
  const baseDir = `${dir}\\.git\\${conf.appPath}`;
  return fs
    .readdirSync(path.normalize(baseDir), { withFileTypes: true })
    .filter((dirent: any) => dirent.isDirectory())
    .map((dirent: any) => dirent.name)
    .map((id: string) => {
      const targetDir = `${baseDir}\\${id}\\details.json`;
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
  save,
  remove,
  findAll,
  findAllWithDetails,
  findByName,
};
