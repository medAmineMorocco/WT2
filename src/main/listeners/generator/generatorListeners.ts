import { dialog, ipcMain } from 'electron';
import path from 'path';
import log from 'electron-log';
import { runner } from 'hygen';
import generatorService from '../../services/generator/generatorMainService';
import utils from '../../utils/utils';
import { setStopExecution } from '../workflows/sharedState';

const { conf } = require('../../conf/conf');

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

async function runHygen(
  generatorName: string,
  options: string,
  templates: string,
  dir: string,
): Promise<string> {
  let output = '';

  const args = ['cli', generatorName];
  await runner(args, {
    templates,
    cwd: dir,
    logger: {
      log: (msg: string) => {
        console.log(msg);
      },
      err: (msg: string) => {
        output += `[ERR] ${msg}\n`;
      },
      ok: (msg: string) => {
        output += `[OK] ${msg}\n`;
      },
    },
    createPrompter: () => ({
      prompt: () => Promise.resolve(),
    }),
    localsDefaults: options,
  });

  return output;
}

ipcMain.on(
  'run-generator',
  async function (
    event,
    generatorName: string,
    parameters: any[],
    generatedAtWorktree: any,
    dir: string,
  ) {
    setStopExecution(false);
    const options = {} as any;
    Object.entries(parameters).forEach(([key, value]) => {
      options[key] = value;
    });
    const templatesPath = path.normalize(
      path.join(dir, '.git', conf.generatorPath, '_templates'),
    );
    process.env.HYGEN_TMPLS = templatesPath;

    event.sender.send(
      'workflow-started',
      [{ title: `Run Generator ${generatorName}` }],
      [
        {
          title: generatedAtWorktree.label,
          current: -1,
          status: 'wait',
        },
      ],
      [
        {
          label: generatedAtWorktree.label,
          key: '0',
          data: {
            '0': {
              command: `Run Generator ${generatorName}`,
              output: 'Processing...',
              status: 'processing',
            },
          },
        },
      ],
    );

    runHygen(
      generatorName,
      options,
      templatesPath,
      path.normalize(generatedAtWorktree.path),
    )
      .then((result: string) => {
        const logStates = [
          {
            label: generatedAtWorktree.label,
            key: '0',
            data: {
              '0': {
                command: `Run Generator ${generatorName}`,
                output: result,
                status: 'finished',
              },
            },
          },
        ];
        const worktreeStates = [
          {
            title: generatedAtWorktree.label,
            current: 0,
            status: 'success',
          },
        ];
        event.sender.send('workflow-started-log-received', logStates);
        event.sender.send('workflow-started-states-updated', worktreeStates);

        setStopExecution(true);
        event.sender.send('workflow-stopped');
      })
      .catch((err) => {
        event.sender.send('workflow-started-states-updated', [
          {
            title: generatedAtWorktree.label,
            current: 0,
            status: 'error',
          },
        ]);
        event.sender.send('workflow-started-log-received', [
          {
            label: generatedAtWorktree.label,
            key: 0,
            data: {
              '0': {
                command: `Run Generator ${generatorName}`,
                output: err ? err.message : '',
                status: 'error',
              },
            },
          },
        ]);
      });
  },
);
