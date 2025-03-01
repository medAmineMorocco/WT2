import { dialog, ipcMain } from 'electron';
import path from 'path';
import generatorService from '../../services/generator/generatorMainService';
import utils from '../../utils/utils';
import loggingService from '../../services/logging/loggingService';
import LogLevel from '../../enums/LogLevel';

ipcMain.on(
  'add-generator',
  async function (event, generator: any, directory: string) {
    try {
      loggingService.logMessage(
        directory,
        `Creating generator with parameters ${generator}`,
        LogLevel.INFO,
      );
      generatorService.save(generator, directory);
      loggingService.logMessage(directory, `Generator created`, LogLevel.INFO);
      event.sender.send('generator-created', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to create generator: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('generator-created', -1, encoded);
    }
  },
);

ipcMain.on(
  'duplicate-generator',
  async function (event, generator: any, directory: string) {
    try {
      loggingService.logMessage(
        directory,
        `Duplicating generator with parameters ${generator}`,
        LogLevel.INFO,
      );
      generatorService.duplicate(generator, directory);
      loggingService.logMessage(
        directory,
        `Generator duplicated`,
        LogLevel.INFO,
      );
      event.sender.send('generator-duplicated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to duplicate generator: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('generator-duplicated', -1, encoded);
    }
  },
);

ipcMain.on(
  'update-generator',
  async function (
    event,
    generatorName: string,
    newGenerator: any,
    directory: string,
  ) {
    try {
      loggingService.logMessage(
        directory,
        `Updating generator ${generatorName} with parameters ${newGenerator}`,
        LogLevel.INFO,
      );
      generatorService.update(generatorName, newGenerator, directory);
      loggingService.logMessage(directory, `Generator updated`, LogLevel.INFO);
      event.sender.send('generator-updated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        directory,
        `Failed to update generator: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('generator-updated', -1, encoded);
    }
  },
);

ipcMain.on('get-generators', async function (event, dir: string) {
  try {
    loggingService.logMessage(dir, 'Getting generators', LogLevel.INFO);
    const generators = generatorService.findAll(dir);
    loggingService.logMessage(dir, 'Generators found', LogLevel.INFO);
    event.sender.send('generators-found', 0, JSON.stringify(generators));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      dir,
      `Failed to get generators: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('generators-found', -1, encoded);
  }
});

ipcMain.on(
  'remove-generator',
  async function (event, name: string, dir: string) {
    try {
      loggingService.logMessage(
        dir,
        `Removing generator with name ${name}`,
        LogLevel.INFO,
      );
      generatorService.remove(name, dir);
      loggingService.logMessage(dir, `Generator removed`, LogLevel.INFO);
      event.sender.send('generator-removed', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        dir,
        `Failed to remove generator: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('generator-removed', -1, encoded);
    }
  },
);

ipcMain.on('get-generator', async function (event, name: string, dir: string) {
  try {
    loggingService.logMessage(
      dir,
      `Getting generator with name ${name}`,
      LogLevel.INFO,
    );
    const generator = generatorService.get(name, dir);
    loggingService.logMessage(dir, `Generator found`, LogLevel.INFO);
    event.sender.send('generator-found-by-name', 0, generator);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      dir,
      `Failed to get generator: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('generator-found-by-name', -1, encoded);
  }
});

ipcMain.on('open-dialog-import-generators', async function (event) {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  try {
    loggingService.logMessage(
      '-',
      'Opening dialog to import generators',
      LogLevel.INFO,
    );
    if (!result.canceled) {
      const [dir] = result.filePaths;

      const generators = generatorService.findAll(path.normalize(dir));
      loggingService.logMessage(
        '-',
        'Generators to import found',
        LogLevel.INFO,
      );
      event.sender.send(
        'generators-to-import-found',
        0,
        JSON.stringify(generators),
      );
    }
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    loggingService.logMessage(
      '-',
      `Failed to open dialog to import generators: ${encoded}`,
      LogLevel.ERROR,
    );
    event.sender.send('generators-to-import-found', -1, encoded);
  }
});

ipcMain.on(
  'import-generators',
  async function (event, generators: any[], dir: string) {
    try {
      loggingService.logMessage(
        dir,
        `Importing generators with parameters ${generators}`,
        LogLevel.INFO,
      );
      const count = generatorService.saveAll(generators, dir);
      loggingService.logMessage(dir, `Generators imported`, LogLevel.INFO);
      event.sender.send('generators-imported', 0, count);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      loggingService.logMessage(
        dir,
        `Failed to import generators: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('generators-imported', -1, encoded);
    }
  },
);
