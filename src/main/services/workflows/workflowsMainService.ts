import path from 'path';

const fs = require('fs');
const { conf } = require('../../conf/conf');

function save(
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
  const baseDir = path.normalize(
    path.join(dir, '.git', conf.appPath, workflow.name),
  );
  if (fs.existsSync(baseDir)) {
    throw new Error('A workflow with this name already exists.');
  }
  fs.mkdirSync(baseDir);
  const targetDir = path.normalize(path.join(baseDir, 'details.json'));
  fs.writeFileSync(targetDir, JSON.stringify(workflow));
}

function duplicate(workflow: any, dir: string) {
  const workflowName = `${workflow.name} copy`;
  save(
    workflowName,
    workflow.command.value,
    workflow.commands?.map((cmd: any) => cmd.value),
    dir,
  );
}

function saveAll(workflows: any[], dir: string) {
  let count = 0;
  workflows.forEach((workflow: any) => {
    const baseDir = path.normalize(
      path.join(dir, '.git', conf.appPath, workflow.name),
    );
    if (fs.existsSync(baseDir)) {
      throw new Error('A workflow with this name already exists.');
    }
    fs.mkdirSync(baseDir);
    const targetDir = path.normalize(path.join(baseDir, 'details.json'));
    fs.writeFileSync(targetDir, JSON.stringify(workflow));
    count += 1;
  });
  return count;
}

function remove(name: string, dir: string) {
  const targetDir = path.normalize(path.join(dir, '.git', conf.appPath, name));
  fs.rmSync(targetDir, { recursive: true, force: true });
}

function update(
  name: string,
  newName: string,
  mainCommand: string,
  commands: string[],
  dir: string,
) {
  const baseDir = path.normalize(path.join(dir, '.git', conf.appPath, newName));
  if (fs.existsSync(baseDir)) {
    throw new Error('A workflow with this name already exists.');
  }
  remove(name, dir);
  save(newName, mainCommand, commands, dir);
}

function findAll(dir: string) {
  const baseDir = path.normalize(path.join(dir, '.git', conf.appPath));
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((dirent: any) => dirent.isDirectory())
    .map((dirent: any) => dirent.name)
    .map((name: string) => {
      const targetDir = path.normalize(
        path.join(baseDir, name, 'details.json'),
      );
      const workflow = JSON.parse(fs.readFileSync(targetDir, 'utf-8'));
      workflow.key = workflow.name;
      return workflow;
    });
}

export default {
  save,
  duplicate,
  update,
  saveAll,
  remove,
  findAll,
};
