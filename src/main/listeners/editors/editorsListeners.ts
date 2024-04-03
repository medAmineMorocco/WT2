import { ipcMain } from 'electron';
import { exec } from 'child_process';

function openInEditor(editorCommand: string, path: string, event: any) {
  exec(`${editorCommand} ${path}`, (error) => {
    if (error) {
      event.sender.send('open-editor-error', error.toString());
    }
  });
}

ipcMain.on('open-intellij', function (event, path) {
  openInEditor('idea', path, event);
});

ipcMain.on('open-webstorm', function (event, path) {
  openInEditor('webstorm', path, event);
});

ipcMain.on('open-rider', function (event, path) {
  openInEditor('rider', path, event);
});

ipcMain.on('open-pycharm', function (event, path) {
  openInEditor('pycharm', path, event);
});

ipcMain.on('open-clion', function (event, path) {
  openInEditor('clion', path, event);
});

ipcMain.on('open-phpstorm', function (event, path) {
  openInEditor('phpstorm', path, event);
});

ipcMain.on('open-rubymine', function (event, path) {
  openInEditor('rubymine', path, event);
});

ipcMain.on('open-goland', function (event, path) {
  openInEditor('goland', path, event);
});

ipcMain.on('open-vscode', function (event, path) {
  openInEditor('code', path, event);
});
