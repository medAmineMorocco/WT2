import { dialog, ipcMain } from 'electron';
import path from 'path';
import log from 'electron-log';
import generatorService from '../../services/generator/generatorMainService';
import utils from '../../utils/utils';

ipcMain.on(
  'add-generator',
  async function (event, generator: any, directory: string) {
    try {
      log.info(`Creating generator with parameters ${generator}`);
      generatorService.save(generator, directory);
      event.sender.send('generator-created', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to create generator: ${encoded}`);
      event.sender.send('generator-created', -1, encoded);
    }
  },
);

ipcMain.on(
  'duplicate-generator',
  async function (event, generator: any, directory: string) {
    try {
      log.info(`Duplicating generator with parameters ${generator}`);
      generatorService.duplicate(generator, directory);
      event.sender.send('generator-duplicated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to duplicate generator: ${encoded}`);
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
      log.info(
        `Updating generator ${generatorName} with parameters ${newGenerator}`,
      );
      generatorService.update(generatorName, newGenerator, directory);
      event.sender.send('generator-updated', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to update generator: ${encoded}`);
      event.sender.send('generator-updated', -1, encoded);
    }
  },
);

ipcMain.on('get-generators', async function (event, dir: string) {
  try {
    log.info('Getting generators');
    const generators = generatorService.findAll(dir);
    event.sender.send('generators-found', 0, JSON.stringify(generators));
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(`Failed to get generators: ${encoded}`);
    event.sender.send('generators-found', -1, encoded);
  }
});

ipcMain.on(
  'remove-generator',
  async function (event, name: string, dir: string) {
    try {
      log.info(`Removing generator with name ${name}`);
      generatorService.remove(name, dir);
      event.sender.send('generator-removed', 0);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to remove generator: ${encoded}`);
      event.sender.send('generator-removed', -1, encoded);
    }
  },
);

ipcMain.on('get-generator', async function (event, name: string, dir: string) {
  try {
    log.info(`Getting generator with name ${name}`);
    const generator = generatorService.get(name, dir);
    event.sender.send('generator-found-by-name', 0, generator);
  } catch (err: any) {
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(`Failed to get generator: ${encoded}`);
    event.sender.send('generator-found-by-name', -1, encoded);
  }
});

ipcMain.on('open-dialog-import-generators', async function (event) {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  try {
    log.info('Opening dialog to import generators');
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
    const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
    log.error(`Failed to open dialog to import generators: ${encoded}`);
    event.sender.send('generators-to-import-found', -1, encoded);
  }
});

ipcMain.on(
  'import-generators',
  async function (event, generators: any[], dir: string) {
    try {
      log.info(`Importing generators with parameters ${generators}`);
      const count = generatorService.saveAll(generators, dir);
      event.sender.send('generators-imported', 0, count);
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to import generators: ${encoded}`);
      event.sender.send('generators-imported', -1, encoded);
    }
  },
);
