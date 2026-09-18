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
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  screen,
  nativeTheme,
} from 'electron';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import * as Sentry from '@sentry/electron/main';
import log from './utils/logger';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import './listeners/workflows/workflowsListeners';
import './listeners/editors/editorsListeners';
import './listeners/worktrees/worktreesListeners';
import './listeners/branches/branchesListeners';
import './listeners/git/gitListeners';
import './listeners/ssh/sshListeners';
import './listeners/terminal/terminalListeners';
import './listeners/trial/trialListeners';
import workflowsMainService from './services/workflows/workflowsMainService';
import utils from './utils/utils';
import gitMainService from './services/git/gitMainService';

Sentry.init({
  dsn: 'https://16dc0811aeb94357a43fc5a2d7af0e0c@app.glitchtip.com/10452',
  environment: app.isPackaged ? 'production' : 'development',
});

const http = require('http');

const findPort = require('find-open-port');
const { conf } = require('./conf/conf');

log.transports.file.level = 'info';
if (app.isPackaged) {
  // 🚫 No stdout in packaged Windows apps → prevents EPIPE crash
  log.transports.console.level = false;
}

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    if (app.isPackaged) {
      // 🚫 No stdout in packaged Windows apps → prevents EPIPE crash
      log.transports.console.level = false;
    }
  }
}

let mainWindow: BrowserWindow | null = null;
let menuBuilder: MenuBuilder | null = null;
let pendingOpenProject: { path: string; name: string } | null = null;

process.on('uncaughtException', (error: any) => {
  const msg = error?.message || String(error);
  if (
    msg.includes('Pty seems to have been killed already') ||
    msg.includes('AttachConsole failed') ||
    msg.includes('ESRCH')
  ) {
    log.warn(`Suppressed known pty shutdown exception: ${msg}`);
    return;
  }
  log.error('Uncaught Exception:', error);
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

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
    .catch(log.error);
};

function ensureConfig() {
  /*
  Windows → C:\Users\...\AppData\Roaming\WorktreeWise

  macOS → ~/Library/Application Support/WorktreeWise

  Linux → ~/.config/WorktreeWise
  */
  const configDir = app.getPath('userData');
  const configPath = path.join(configDir, 'worktreewise.json');

  if (!fs.existsSync(configPath)) {
    const exePath = process.execPath;

    fs.writeFileSync(
      configPath,
      JSON.stringify({ executable: exePath }, null, 2),
    );
  }
}

function getStoredTheme(): boolean {
  try {
    const configPath = path.join(app.getPath('userData'), 'worktreewise.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (typeof data.isDarkMode === 'boolean') {
        return data.isDarkMode;
      }
    }
  } catch (err) {
    log.error('Failed to read theme from config', err);
  }
  return false;
}

function saveStoredTheme(isDarkMode: boolean) {
  try {
    const configPath = path.join(app.getPath('userData'), 'worktreewise.json');
    let data: any = {};
    if (fs.existsSync(configPath)) {
      data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    data.isDarkMode = isDarkMode;
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
  } catch (err) {
    log.error('Failed to save theme to config', err);
  }
}

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const isDarkMode = getStoredTheme();
  nativeTheme.themeSource = isDarkMode ? 'dark' : 'light';

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const minWidth = Math.min(800, width);
  const minHeight = Math.min(600, height);

  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';

  mainWindow = new BrowserWindow({
    show: false,
    width,
    height,
    minWidth,
    minHeight,
    icon: getAssetPath(iconFile),
    backgroundColor: isDarkMode ? '#000000' : '#ffffff',
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      webviewTag: true,
    },
  });

  const isAllowedEmbeddedBrowserUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  mainWindow.webContents.on(
    'will-attach-webview',
    (event, webPreferences, params) => {
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      webPreferences.webSecurity = true;

      if (!isAllowedEmbeddedBrowserUrl(params.src)) {
        event.preventDefault();
      }
    },
  );

  mainWindow.webContents.on('did-attach-webview', (_event, guestContents) => {
    guestContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedEmbeddedBrowserUrl(url)) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    const preventUnsafeNavigation = (event: Electron.Event, url: string) => {
      if (!isAllowedEmbeddedBrowserUrl(url)) {
        event.preventDefault();
      }
    };
    guestContents.on('will-navigate', preventUnsafeNavigation);
    guestContents.on('will-redirect', preventUnsafeNavigation);
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
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
        await mainWindow?.webContents.executeJavaScript(
          `localStorage.setItem("VERSION", '${process.env.VERSION}');
                 localStorage.setItem("PAYMENT_PAGE_URL", '${process.env.PAYMENT_PAGE_URL}');`,
        );

        server.listen(port);
      })
      .catch(() => {
        server.listen(3201);
      });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  menuBuilder = new MenuBuilder(mainWindow);
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

function openProjectFromPath(projectPath: string) {
  const normalized = path.normalize(projectPath);
  if (!fs.existsSync(normalized)) {
    return;
  }

  // You decide what "open" means in WorktreeWise
  // Example: send to renderer
  const dirName = path.basename(normalized);

  if (
    !mainWindow ||
    (mainWindow && mainWindow.webContents && mainWindow.webContents.isLoading())
  ) {
    pendingOpenProject = { path: normalized, name: dirName };
    return;
  }

  mainWindow?.webContents.send('open-dir-from-outside', normalized, dirName);
}

function extractOpenPath(argv: string[]): string | null {
  const openIndex = argv.indexOf('--open');
  if (openIndex === -1) return null;

  for (let i = openIndex + 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      return arg;
    }
  }
  return null;
}

app.on('second-instance', (event, argv) => {
  // Windows/Linux: argv contains CLI args
  // macOS: args are still available, but app is already running
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  const projectPath = extractOpenPath(argv);
  if (projectPath) {
    openProjectFromPath(projectPath);
  }
});

app
  .whenReady()
  .then(async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId(app.name);
    }
    ensureConfig();
    await createWindow();

    const projectPath = extractOpenPath(process.argv);
    if (projectPath) {
      openProjectFromPath(projectPath);
    }

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) {
        createWindow();
      }
    });
  })
  .catch(log.error);

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

ipcMain.handle('choose-clone-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose where to clone the repository',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle(
  'clone-repository',
  async (
    _event,
    repositoryUrl: string,
    parentDirectory: string,
    folderName?: string,
  ) => {
    const url = repositoryUrl?.trim();
    const parent = parentDirectory?.trim();
    if (!url) throw new Error('Enter a repository URL.');
    if (!parent || !fs.existsSync(parent)) {
      throw new Error('Choose an existing destination folder.');
    }
    const inferredName = url
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.git$/i, '');
    const name = folderName?.trim() || inferredName;
    if (!name || name === '.' || name === '..' || /[\\/:*?"<>|]/.test(name)) {
      throw new Error('Enter a valid folder name for the cloned repository.');
    }
    const targetPath = path.join(parent, name);
    if (fs.existsSync(targetPath)) {
      throw new Error(`The destination already exists: ${targetPath}`);
    }

    const gitExecutable = await gitMainService.gitCommand();
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        gitExecutable,
        ['clone', '--progress', url, targetPath],
        {
          cwd: parent,
          shell: false,
          windowsHide: true,
        },
      );
      const stderr: Buffer[] = [];
      child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else {
          reject(
            new Error(
              Buffer.concat(stderr).toString().trim() ||
                `Git clone exited with code ${code}.`,
            ),
          );
        }
      });
    });

    const appMetadataPath = path.join(targetPath, '.git', conf.appPath);
    if (!fs.existsSync(appMetadataPath)) {
      fs.mkdirSync(appMetadataPath, { recursive: true });
    }
    return { path: targetPath, name };
  },
);

ipcMain.on(
  'choose-dir-from-outside',
  async function (event, dirPath, dirName, keyTab) {
    let isGitRepo = false;
    let isWorktree = false;
    if (checkGitRepo(dirPath)) {
      isGitRepo = true;
      if (await checkWorktree(dirPath)) {
        isWorktree = true;
      }
      const baseDir = path.join(dirPath, '.git', conf.appPath);
      if (!isWorktree && !fs.existsSync(path.normalize(baseDir))) {
        fs.mkdirSync(path.normalize(baseDir));
      }
    }
    event.sender.send(
      `selected-repo-${keyTab}`,
      false,
      isGitRepo,
      isWorktree,
      dirPath,
      dirName,
    );
  },
);

ipcMain.on('choose-worktrees-dir', async function (event) {
  if (mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (!result.canceled) {
      const [dir] = result.filePaths;
      const name = path.basename(dir);
      event.sender.send('selected-worktrees-dir', 0, dir, name);
    }
  }
});

ipcMain.on('open-dialog-import-workflows', async function (event) {
  if (mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    try {
      log.info('Searching for workflows to import');
      if (!result.canceled) {
        const [dir] = result.filePaths;

        const workflows = workflowsMainService.findAll(path.normalize(dir));
        event.sender.send(
          'workflows-to-import-found',
          0,
          JSON.stringify(workflows),
        );
      }
    } catch (err: any) {
      const encoded = await utils.setStoredEncoding(Buffer.from(err.message));
      log.error(`Failed to search for workflows to import: ${err.message}`);
      event.sender.send('workflows-to-import-found', -1, encoded);
    }
  }
});

ipcMain.on('change-theme', function (event, isDarkMode, activeTab) {
  nativeTheme.themeSource = isDarkMode ? 'dark' : 'light';
  saveStoredTheme(Boolean(isDarkMode));
  if (mainWindow) {
    mainWindow.setBackgroundColor(isDarkMode ? '#000000' : '#ffffff');
  }
  if (menuBuilder) {
    menuBuilder.buildMenu();
  }
  event.sender.send(`theme-changed-${activeTab}`, isDarkMode);
});

ipcMain.on('get-os-separator', function (event) {
  const separator = os.platform() === 'win32' ? '\\' : '/';
  event.sender.send('os-separator-found', separator);
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.on('check-repo-exists', function (event, repoPath) {
  console.log('repoPath', repoPath);
  const exists = fs.existsSync(path.normalize(repoPath));
  console.log('exists', exists);
  event.sender.send('is-repo-exist', exists);
});

ipcMain.on('renderer-ready', () => {
  if (pendingOpenProject && mainWindow) {
    mainWindow.webContents.send(
      'open-dir-from-outside',
      pendingOpenProject.path,
      pendingOpenProject.name,
    );
    pendingOpenProject = null;
  }
});
