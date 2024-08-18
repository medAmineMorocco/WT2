import fs from 'fs';
import path from 'path';

const { conf } = require('../../conf/conf');

function save(generator: any, directory: string) {
  try {
    const worktreeWiseGeneratorDir = path.normalize(
      path.join(directory, '.git', conf.generatorPath, '_templates', 'cli'),
    );
    if (!fs.existsSync(worktreeWiseGeneratorDir)) {
      fs.mkdirSync(worktreeWiseGeneratorDir, { recursive: true });
    }
    const generatorDir = path.normalize(
      path.join(worktreeWiseGeneratorDir, generator.generatorName),
    );
    if (fs.existsSync(generatorDir)) {
      throw new Error('A generator with this name already exists.');
    }
    fs.mkdirSync(generatorDir);
    const metadataFile = path.normalize(
      path.join(generatorDir, 'metadata.json'),
    );
    fs.writeFileSync(metadataFile, JSON.stringify(generator));

    generator.files.forEach((file: any) => {
      const fileDir = path.normalize(
        path.join(generatorDir, `${file.fileName}.ejs.t`),
      );
      let fileContent = '---\n';
      Object.entries(file).forEach(([key, value]: any) => {
        if (
          key !== 'fileContent' &&
          key !== 'fileName' &&
          key !== 'key' &&
          value
        ) {
          fileContent += `${key}: ${value}\n`;
        }
      });
      fileContent += '---\n';
      fileContent += file.fileContent;
      fs.writeFileSync(fileDir, fileContent);
    });
  } catch (err: any) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new Error(
        'Insufficient permissions detected.Please ensure you have appropriate permissions set for the .git directory.',
      );
    }
    throw err;
  }
}

function duplicate(generator: any, directory: string) {
  const worktreeWiseGeneratorDir = path.normalize(
    path.join(directory, '.git', conf.generatorPath, '_templates', 'cli'),
  );
  let generatorName = `${generator.generatorName} copy`;
  let generatorDir = path.normalize(
    path.join(worktreeWiseGeneratorDir, generatorName),
  );
  while (fs.existsSync(generatorDir)) {
    generatorName += ' copy';
    generatorDir = path.normalize(
      path.join(worktreeWiseGeneratorDir, generatorName),
    );
  }
  generator.generatorName = generatorName;
  save(generator, directory);
}

function findAll(dir: string) {
  const baseDir = path.normalize(
    path.join(dir, '.git', conf.generatorPath, '_templates', 'cli'),
  );
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  return fs
    .readdirSync(baseDir)
    .filter((file) => {
      const filePath = path.join(baseDir, file);
      return fs.statSync(filePath).isDirectory();
    })
    .map((file) => {
      const metaDataFile = path.normalize(
        path.join(baseDir, file, 'metadata.json'),
      );
      const generator = JSON.parse(fs.readFileSync(metaDataFile, 'utf-8'));
      generator.key = generator.generatorName;
      return generator;
    });
}

function remove(name: string, dir: string) {
  try {
    const targetDir = path.normalize(
      path.join(dir, '.git', conf.generatorPath, '_templates', 'cli', name),
    );
    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch (err: any) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new Error(
        'Insufficient permissions detected.Please ensure you have appropriate permissions set for the .git directory.',
      );
    }
    throw err;
  }
}

function update(generatorName: string, newGenerator: any, directory: string) {
  remove(generatorName, directory);
  save(newGenerator, directory);
}

function get(name: string, dir: string) {
  const metadataGenerator = path.normalize(
    path.join(
      dir,
      '.git',
      conf.generatorPath,
      '_templates',
      'cli',
      name,
      'metadata.json',
    ),
  );
  return JSON.parse(fs.readFileSync(metadataGenerator, 'utf-8'));
}

function saveAll(generators: any[], dir: string) {
  let count = 0;
  generators.forEach((generator: any) => {
    save(generator, dir);
    count += 1;
  });
  return count;
}

export default {
  save,
  duplicate,
  update,
  findAll,
  remove,
  get,
  saveAll,
};
