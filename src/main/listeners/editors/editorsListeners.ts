import { ipcMain, shell } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import copyDirectory from '../../services/utils/fileService';
import { editorsCst } from '../../../renderer/modules/config/EditorsConfig';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';
import loggingService from '../../services/logging/loggingService';
import LogLevel from '../../enums/LogLevel';

async function getEditor(editorLabel: string) {
  const storedEditors = await utils.getStorageItem('editors');
  const editors = storedEditors
    ? JSON.parse(storedEditors)
    : JSON.parse(JSON.stringify(editorsCst));
  return editors.find((editor: any) => editor.label === editorLabel);
}

async function openInEditor(editorCommand: string, dir: string, event: any) {
  const shellPath = await gitMainService.getShell();
  const options: any = {
    shell: shellPath || true,
    encoding: 'buffer',
  };
  exec(`"${editorCommand}" ${dir}`, options, async (error, stdout, stderr) => {
    if (stderr) {
      const encoded = await utils.setStoredEncoding(stderr);
      loggingService.logMessage(
        dir,
        `Failed to open editor: ${encoded}`,
        LogLevel.ERROR,
      );
      event.sender.send('open-editor-error', encoded);
    } else {
      loggingService.logMessage(
        dir,
        'Editor opened successfully',
        LogLevel.INFO,
      );
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
  loggingService.logMessage(dir, 'Opening explorer', LogLevel.INFO);
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
    loggingService.logMessage(
      dir,
      `Opening ${editorName} in ${worktreePath}`,
      LogLevel.INFO,
    );
    const editor = await getEditor(editorName);
    if (editor) {
      const command =
        editor.path !== ''
          ? path.normalize(editor.path)
          : editor.defaultCommand;
      await copySettings(editor, worktreePath, dir);
      await openInEditor(command, worktreePath, event);
    }
  },
);
