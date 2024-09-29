import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

ipcMain.on('autocomplete', (event, directory: string, input: string) => {
  try {
    const basePath = path.resolve(directory);
    const files = fs.readdirSync(basePath);

    const filteredFiles = files.filter((file) => file.startsWith(input));

    event.sender.send('autocomplete-results', filteredFiles, input);
  } catch (err) {
    event.sender.send('autocomplete-results', [], input);
  }
});
