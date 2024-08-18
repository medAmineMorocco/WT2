import { dialog, ipcMain } from 'electron';
import path from 'path';
import generatorService from '../../services/generator/generatorMainService';

ipcMain.on(
  'add-generator',
  function (event, generator: any, directory: string) {
    try {
      generatorService.save(generator, directory);
      event.sender.send('generator-created', 0);
    } catch (err: any) {
      event.sender.send('generator-created', -1, err.message);
    }
  },
);

ipcMain.on(
  'duplicate-generator',
  function (event, generator: any, directory: string) {
    try {
      generatorService.duplicate(generator, directory);
      event.sender.send('generator-duplicated', 0);
    } catch (err: any) {
      event.sender.send('generator-duplicated', -1, err.message);
    }
  },
);

ipcMain.on(
  'update-generator',
  function (
    event,
    generatorName: string,
    newGenerator: any,
    directory: string,
  ) {
    try {
      generatorService.update(generatorName, newGenerator, directory);
      event.sender.send('generator-updated', 0);
    } catch (err: any) {
      event.sender.send('generator-updated', -1, err.message);
    }
  },
);

ipcMain.on('get-generators', function (event, dir: string) {
  try {
    const generators = generatorService.findAll(dir);
    event.sender.send('generators-found', 0, JSON.stringify(generators));
  } catch (err: any) {
    event.sender.send('generators-found', -1, err.message);
  }
});

ipcMain.on('remove-generator', function (event, name: string, dir: string) {
  try {
    generatorService.remove(name, dir);
    event.sender.send('generator-removed', 0);
  } catch (err: any) {
    event.sender.send('generator-removed', -1, err.message);
  }
});

ipcMain.on('get-generator', function (event, name: string, dir: string) {
  try {
    const generator = generatorService.get(name, dir);
    event.sender.send('generator-found-by-name', 0, generator);
  } catch (err: any) {
    event.sender.send('generator-found-by-name', -1, err.message);
  }
});

ipcMain.on('open-dialog-import-generators', async function (event) {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  try {
    if (!result.canceled) {
      const [dir] = result.filePaths;

      const generators = generatorService.findAll(path.normalize(dir));
      event.sender.send(
        'generators-to-import-found',
        0,
        JSON.stringify(generators),
      );
    }
  } catch (err: any) {
    event.sender.send('generators-to-import-found', -1, err.message);
  }
});

ipcMain.on(
  'import-generators',
  async function (event, generators: any[], dir: string) {
    try {
      const count = generatorService.saveAll(generators, dir);
      event.sender.send('generators-imported', 0, count);
    } catch (err: any) {
      event.sender.send('generators-imported', -1, err.message);
    }
  },
);
