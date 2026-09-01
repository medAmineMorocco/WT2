import { app } from 'electron';
import log from 'electron-log';

if (app) {
  log.transports.file.level = 'info';
  if (app.isPackaged) {
    log.transports.console.level = false;
  }
} else {
  // When running in tests or CLI outside the full Electron runtime
  log.transports.file.level = false;
}

export default log;
