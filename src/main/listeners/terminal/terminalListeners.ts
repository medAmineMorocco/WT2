import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import log from '../../utils/logger';

ipcMain.on('autocomplete', (event, directory: string, input: string) => {
  try {
    log.info(`Autocompleting ${input}`);
    const basePath = path.resolve(directory);
    const files = fs.readdirSync(basePath);

    const filteredFiles = files.filter((file) => file.startsWith(input));
    event.sender.send('autocomplete-results', filteredFiles, input);
  } catch (err) {
    log.error(`Failed to autocomplete ${input}: ${err}`);
    event.sender.send('autocomplete-results', [], input);
  }
});
