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
  const baseDir = path.normalize(
    path.join(dir, '.git', conf.appPath, workflow.id),
  );
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
  }
  const targetDir = path.normalize(path.join(baseDir, 'details.json'));
  fs.writeFileSync(targetDir, JSON.stringify(workflow));
}

function duplicate(workflow: any, dir: string) {
  const workflowName = `${workflow.name} copy`;
  save(
    '',
    workflowName,
    workflow.command.value,
    workflow.commands?.map((cmd: any) => cmd.value),
    dir,
  );
}

function saveAll(workflows: any[], dir: string) {
  let count = 0;
  workflows.forEach((workflow: any) => {
    workflow.id = new Date().getTime().toString();
    const baseDir = path.normalize(
      path.join(dir, '.git', conf.appPath, workflow.id),
    );
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir);
    }
    const targetDir = path.normalize(path.join(baseDir, 'details.json'));
    fs.writeFileSync(targetDir, JSON.stringify(workflow));
    count += 1;
  });
  return count;
}

function remove(id: string, dir: string) {
  const targetDir = path.normalize(path.join(dir, '.git', conf.appPath, id));
  fs.rmSync(targetDir, { recursive: true, force: true });
}

function findAll(dir: string) {
  const baseDir = path.normalize(path.join(dir, '.git', conf.appPath));
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((dirent: any) => dirent.isDirectory())
    .map((dirent: any) => dirent.name)
    .map((id: string) => {
      const targetDir = path.normalize(path.join(baseDir, id, 'details.json'));
      const workflow = JSON.parse(fs.readFileSync(targetDir, 'utf-8'));
      workflow.key = workflow.id;
      return workflow;
    });
}

export default {
  save,
  duplicate,
  saveAll,
  remove,
  findAll,
};
