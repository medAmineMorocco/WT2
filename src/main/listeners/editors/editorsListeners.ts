import { BrowserWindow, ipcMain, shell } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import copyDirectory from '../../services/utils/fileService';
import { editorsCst } from '../../../renderer/modules/config/EditorsConfig';

async function getEditor(editorLabel: string) {
  const storedEditors =
    await BrowserWindow.getFocusedWindow()?.webContents.executeJavaScript(
      'localStorage.getItem("editors");',
      true,
    );
  const editors = storedEditors
    ? JSON.parse(storedEditors)
    : JSON.parse(JSON.stringify(editorsCst));
  return editors.find((editor: any) => editor.label === editorLabel);
}

function openInEditor(editorCommand: string, dir: string, event: any) {
  exec(`"${editorCommand}" ${dir}`, (error, stdout) => {
    if (error) {
      event.sender.send('open-editor-error', error.toString());
    }
    if (stdout) {
      event.sender.send('open-editor-error', stdout.toString());
    }
  });
}

async function copySettings(editor: any, worktreePath: string, dir: string) {
  if (editor.settingsFolder) {
    if (
      !fs.existsSync(path.join(worktreePath, editor.settingsFolder)) &&
      fs.existsSync(path.join(dir, editor.settingsFolder))
    ) {
      const projectEditorSettingsFolder = path.join(dir, editor.settingsFolder);
      await copyDirectory(
        projectEditorSettingsFolder,
        path.join(worktreePath, editor.settingsFolder),
      );
    }
  }
  if (editor.settingsFile) {
    if (
      !fs.existsSync(path.join(worktreePath, editor.settingsFile)) &&
      fs.existsSync(path.join(dir, editor.settingsFile))
    ) {
      const projectEditorSettingsFile = path.join(dir, editor.settingsFile);
      fs.copyFileSync(
        projectEditorSettingsFile,
        path.join(worktreePath, editor.settingsFile),
      );
    }
  }
}

ipcMain.on('open-explorer', function (event, dir) {
  const normalizedPath = path.normalize(dir);
  shell.openPath(normalizedPath);
});

ipcMain.on(
  'open-editor',
  async function (
    event,
    editorName: string,
    worktreePath: string,
    dir: string,
  ) {
    const editor = await getEditor(editorName);
    if (editor) {
      const command =
        editor.path !== ''
          ? path.normalize(editor.path)
          : editor.defaultCommand;
      await copySettings(editor, worktreePath, dir);
      openInEditor(command, worktreePath, event);
    }
  },
);
