import { app } from 'electron';
import log from 'electron-log';

// Always write to file
log.transports.file.level = 'info';

// Disable console in production (Windows-safe)
if (app?.isPackaged) {
  log.transports.console.level = false;
}

export default log;
