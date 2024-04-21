import { BrowserWindow, ipcMain, shell } from 'electron';
import { exec } from 'child_process';
import path from 'path';

async function getEditorCommandOrGetDefault(
  editorLabel: string,
  defaultEditorCommand: string,
) {
  let command = defaultEditorCommand;

  const editors =
    await BrowserWindow.getFocusedWindow()?.webContents.executeJavaScript(
      'localStorage.getItem("editors");',
      true,
    );
  if (editors) {
    const foundEditor = JSON.parse(editors).find(
      (editor: any) => editor.label === editorLabel,
    );
    if (foundEditor && foundEditor.path) {
      command = foundEditor.path;
    }
  }
  return command;
}

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

ipcMain.on('open-intellij', async function (event, dir: string) {
  const command = await getEditorCommandOrGetDefault('Intellij', 'idea');
  openInEditor(command, dir, event);
});

ipcMain.on('open-webstorm', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Webstorm', 'webstorm');
  openInEditor(command, dir, event);
});

ipcMain.on('open-rider', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Rider', 'rider');
  openInEditor(command, dir, event);
});

ipcMain.on('open-pycharm', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('PyCharm', 'pycharm');
  openInEditor(command, dir, event);
});

ipcMain.on('open-clion', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('CLion', 'clion');
  openInEditor(command, dir, event);
});

ipcMain.on('open-phpstorm', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('PhpStorm', 'phpstorm');
  openInEditor(command, dir, event);
});

ipcMain.on('open-rubymine', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('RubyMine', 'rubymine');
  openInEditor(command, dir, event);
});

ipcMain.on('open-goland', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('GoLand', 'goland');
  openInEditor(command, dir, event);
});

ipcMain.on('open-vscode', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Visual Studio', 'code');
  openInEditor(command, dir, event);
});

ipcMain.on('open-eclipse', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Eclipse', 'eclipse');
  openInEditor(command, dir, event);
});

ipcMain.on('open-brackets', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Brackets', 'brackets');
  openInEditor(command, dir, event);
});

ipcMain.on('open-android-studio', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Android Studio', 'open');
  openInEditor(command, dir, event);
});

ipcMain.on('open-xcode', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Xcode', 'open');
  openInEditor(command, dir, event);
});

ipcMain.on('open-sublime', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Sublime Text', 'subl');
  openInEditor(command, dir, event);
});

ipcMain.on('open-vim', async function (event, dir) {
  const command = await getEditorCommandOrGetDefault('Vim', 'vim');
  openInEditor(command, dir, event);
});
