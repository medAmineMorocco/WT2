import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import loggingService from '../../services/logging/loggingService';
import LogLevel from '../../enums/LogLevel';

ipcMain.on('autocomplete', (event, directory: string, input: string) => {
  try {
    loggingService.logMessage(
      directory,
      `Autocompleting ${input}`,
      LogLevel.INFO,
    );
    const basePath = path.resolve(directory);
    const files = fs.readdirSync(basePath);

    const filteredFiles = files.filter((file) => file.startsWith(input));
    loggingService.logMessage(
      directory,
      `Autocompleted ${input} to ${filteredFiles}`,
      LogLevel.INFO,
    );
    event.sender.send('autocomplete-results', filteredFiles, input);
  } catch (err) {
    loggingService.logMessage(
      directory,
      `Failed to autocomplete ${input}: ${err}`,
      LogLevel.ERROR,
    );
    event.sender.send('autocomplete-results', [], input);
  }
});
