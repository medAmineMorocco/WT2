import { ipcMain, shell } from 'electron';
import { exec } from 'child_process';
import path from 'path';

function openInEditor(editorCommand: string, dir: string, event: any) {
  exec(`${editorCommand} ${dir}`, (error) => {
    if (error) {
      event.sender.send('open-editor-error', error.toString());
    }
  });
}

ipcMain.on('open-explorer', function (event, dir) {
  const normalizedPath = path.normalize(dir);
  shell.openPath(normalizedPath);
});

ipcMain.on('open-intellij', function (event, dir: string) {
  openInEditor('idea', dir, event);
});

ipcMain.on('open-webstorm', function (event, dir) {
  openInEditor('webstorm', dir, event);
});

ipcMain.on('open-rider', function (event, dir) {
  openInEditor('rider', dir, event);
});

ipcMain.on('open-pycharm', function (event, dir) {
  openInEditor('pycharm', dir, event);
});

ipcMain.on('open-clion', function (event, dir) {
  openInEditor('clion', dir, event);
});

ipcMain.on('open-phpstorm', function (event, dir) {
  openInEditor('phpstorm', dir, event);
});

ipcMain.on('open-rubymine', function (event, dir) {
  openInEditor('rubymine', dir, event);
});

ipcMain.on('open-goland', function (event, dir) {
  openInEditor('goland', dir, event);
});

ipcMain.on('open-vscode', function (event, dir) {
  openInEditor('code', dir, event);
});

ipcMain.on('open-eclipse', function (event, dir) {
  openInEditor('eclipse', dir, event);
});

ipcMain.on('open-brackets', function (event, dir) {
  openInEditor('brackets', dir, event);
});

ipcMain.on('open-android-studio', function (event, dir) {
  openInEditor('open', dir, event);
});

ipcMain.on('open-xcode', function (event, dir) {
  openInEditor('open', dir, event);
});

ipcMain.on('open-sublime', function (event, dir) {
  openInEditor('subl', dir, event);
});

ipcMain.on('open-vim', function (event, dir) {
  openInEditor('vim', dir, event);
});
