import { ipcMain, shell } from 'electron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import copyDirectory from '../../services/utils/fileService';
import { editorsCst } from '../../../renderer/modules/config/EditorsConfig';
import utils from '../../utils/utils';
import gitMainService from '../../services/git/gitMainService';

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
      log.error(`Failed to open editor: ${stderr.toString()}`);
      event.sender.send(
        'open-editor-error',
        'Failed to open the editor. Please check your editor path in the settings and try again.',
      );
    } else {
      log.info('Editor opened successfully');
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
  log.info('Opening explorer');
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
    log.info(`Opening ${editorName} in ${worktreePath}`);
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
