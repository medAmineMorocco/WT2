/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import fs from 'fs';
import os from 'os';
import * as Sentry from '@sentry/electron/main';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import './listeners/workflows/workflowsListeners';
import './listeners/editors/editorsListeners';
import './listeners/worktrees/worktreesListeners';
import './listeners/branches/branchesListeners';
import './listeners/git/gitListeners';
import './listeners/terminal/terminalListeners';
import './listeners/trial/trialListeners';
import './listeners/logging/loggingListeners';

Sentry.init({
  dsn: 'https://16dc0811aeb94357a43fc5a2d7af0e0c@app.glitchtip.com/10452',
});

const http = require('http');

const findPort = require('find-open-port');
const { conf } = require('./conf/conf');

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

/* if (isDebug) {
  require('electron-debug')();
} */

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    show: false,
    width,
    height,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.platform === 'win32') {
      app.setAppUserModelId(app.name);
    }
    mainWindow.maximize();

    const server = http.createServer((_: any, res: any) => {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(
        'pre code.hljs{display:block;overflow-x:auto;padding:1em}code.hljs{padding:3px 5px}/*!\n' +
          '  Theme: GitHub Dark\n' +
          '  Description: Dark theme as seen on github.com\n' +
          '  Author: github.com\n' +
          '  Maintainer: @Hirse\n' +
          '  Updated: 2021-05-15\n' +
          '\n' +
          '  Outdated base version: https://github.com/primer/github-syntax-dark\n' +
          "  Current colors taken from GitHub's CSS\n" +
          '*/.hljs{color:#c9d1d9;background:#0d1117}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#ff7b72}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#d2a8ff}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-variable{color:#79c0ff}.hljs-meta .hljs-string,.hljs-regexp,.hljs-string{color:#a5d6ff}.hljs-built_in,.hljs-symbol{color:#ffa657}.hljs-code,.hljs-comment,.hljs-formula{color:#8b949e}.hljs-name,.hljs-quote,.hljs-selector-pseudo,.hljs-selector-tag{color:#7ee787}.hljs-subst{color:#c9d1d9}.hljs-section{color:#1f6feb;font-weight:700}.hljs-bullet{color:#f2cc60}.hljs-emphasis{color:#c9d1d9;font-style:italic}.hljs-strong{color:#c9d1d9;font-weight:700}.hljs-addition{color:#aff5b4;background-color:#033a16}.hljs-deletion{color:#ffdcd7;background-color:#67060c}',
        'utf-8',
      );
    });

    findPort()
      .then(async (port: number) => {
        await mainWindow?.webContents.executeJavaScript(
          `localStorage.setItem("server-port", ${port});`,
        );
        const version = process.env.VERSION;
        await mainWindow?.webContents.executeJavaScript(
          `localStorage.setItem("version", '${version}');`,
        );

        server.listen(port);
      })
      .catch(() => {
        server.listen(3201);
      });
  });

  mainWindow.on('resize', () => {
    mainWindow?.setSize(width / 2, height);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.setMinimumSize(800, 800);

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);

function checkGitRepo(repoPath: string) {
  const gitDirectory = path.join(repoPath, '.git');
  return fs.existsSync(gitDirectory);
}

async function checkWorktree(repoPath: string) {
  try {
    const gitFile = path.join(repoPath, '.git');
    const gitContents = await fs.readFileSync(gitFile, 'utf8');
    return gitContents.includes('gitdir:');
  } catch (error) {
    return false;
  }
}

ipcMain.on('choose-dir', async function (event, keyTab) {
  if (mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    let pathDir;
    let name;
    let isGitRepo = false;
    let isWorktree = false;
    let isCanceled = false;
    if (result.canceled) {
      isCanceled = true;
      pathDir = null;
      name = null;
    } else {
      const [dir] = result.filePaths;
      if (checkGitRepo(dir)) {
        isGitRepo = true;
        if (await checkWorktree(dir)) {
          isWorktree = true;
        }
        pathDir = dir;
        name = path.basename(pathDir);
        const baseDir = path.join(pathDir, '.git', conf.appPath);
        if (!isWorktree && !fs.existsSync(path.normalize(baseDir))) {
          fs.mkdirSync(path.normalize(baseDir));
        }
      }
    }
    event.sender.send(
      `selected-repo-${keyTab}`,
      isCanceled,
      isGitRepo,
      isWorktree,
      pathDir,
      name,
    );
  }
});

ipcMain.on('change-theme', async function (event, isDarkMode, activeTab) {
  event.sender.send(`theme-changed-${activeTab}`, isDarkMode);
});

ipcMain.on('get-os-separator', async function (event) {
  const separator = os.platform() === 'win32' ? '\\' : '/';
  event.sender.send('os-separator-found', separator);
});
