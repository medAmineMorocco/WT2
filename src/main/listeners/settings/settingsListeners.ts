import { ipcMain } from 'electron';
import settingsMainService from '../../services/settings/settingsMainService';

ipcMain.on('get-terminals', function (event) {
  try {
    const terminals = settingsMainService.getTerminals();
    event.sender.send('terminals-found', 0, JSON.stringify(terminals));
  } catch (err: any) {
    event.sender.send('terminals-found', -1, err.message);
  }
});
