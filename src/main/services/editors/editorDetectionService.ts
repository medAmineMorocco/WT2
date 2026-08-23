import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { EditorDetectionResult } from '../../../shared/editors';
import log from '../../utils/logger';

interface EditorDefinition {
  label: string;
  key: string;
  defaultCommand: string;
  binaryNames: string[];
  windowsPaths: string[];
  macPaths: string[];
  linuxPaths: string[];
  folderKeywords: string[];
  toolboxFolderName?: string;
  versionArgs?: string[];
}

const home = os.homedir();
const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

const EDITORS_METADATA: EditorDefinition[] = [
  {
    label: 'Visual Studio',
    key: '0-10',
    defaultCommand: 'code',
    binaryNames: ['code.cmd', 'code.exe', 'code'],
    windowsPaths: [
      'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd',
      'C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd',
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
    ],
    macPaths: [
      '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      '/usr/local/bin/code',
      '/opt/homebrew/bin/code',
    ],
    linuxPaths: ['/usr/bin/code', '/snap/bin/code', '/usr/local/bin/code'],
    folderKeywords: ['vscode', 'microsoft vs code'],
    versionArgs: ['--version'],
  },
  {
    label: 'Cursor',
    key: '0-15',
    defaultCommand: 'cursor',
    binaryNames: ['cursor.cmd', 'cursor.exe', 'cursor'],
    windowsPaths: [
      'C:\\Program Files\\Cursor\\resources\\app\\bin\\cursor.cmd',
      'C:\\Program Files\\Cursor\\Cursor.exe',
      path.join(localAppData, 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor.cmd'),
      path.join(localAppData, 'Programs', 'cursor', 'Cursor.exe'),
    ],
    macPaths: [
      '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      '/usr/local/bin/cursor',
      '/opt/homebrew/bin/cursor',
    ],
    linuxPaths: ['/usr/bin/cursor', '/snap/bin/cursor', '/usr/local/bin/cursor'],
    folderKeywords: ['cursor'],
    versionArgs: ['--version'],
  },
  {
    label: 'Windsurf',
    key: '0-16',
    defaultCommand: 'windsurf',
    binaryNames: ['windsurf.cmd', 'windsurf.exe', 'windsurf'],
    windowsPaths: [
      path.join(localAppData, 'Programs', 'windsurf', 'bin', 'windsurf.cmd'),
      path.join(localAppData, 'Programs', 'windsurf', 'Windsurf.exe'),
      'C:\\Program Files\\Windsurf\\bin\\windsurf.cmd',
      'C:\\Program Files\\Windsurf\\Windsurf.exe',
    ],
    macPaths: [
      '/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf',
      '/usr/local/bin/windsurf',
    ],
    linuxPaths: ['/usr/bin/windsurf', '/usr/local/bin/windsurf'],
    folderKeywords: ['windsurf'],
    versionArgs: ['--version'],
  },
  {
    label: 'VSCodium',
    key: '0-17',
    defaultCommand: 'codium',
    binaryNames: ['codium.cmd', 'codium.exe', 'codium'],
    windowsPaths: [
      'C:\\Program Files\\VSCodium\\bin\\codium.cmd',
      'C:\\Program Files (x86)\\VSCodium\\bin\\codium.cmd',
      path.join(localAppData, 'Programs', 'VSCodium', 'bin', 'codium.cmd'),
      path.join(localAppData, 'Programs', 'VSCodium', 'VSCodium.exe'),
    ],
    macPaths: [
      '/Applications/VSCodium.app/Contents/Resources/app/bin/codium',
      '/usr/local/bin/codium',
    ],
    linuxPaths: ['/usr/bin/codium', '/snap/bin/codium', '/usr/local/bin/codium'],
    folderKeywords: ['vscodium', 'codium'],
    versionArgs: ['--version'],
  },
  {
    label: 'Webstorm',
    key: '0-3',
    defaultCommand: 'webstorm',
    binaryNames: ['webstorm.bat', 'webstorm64.exe', 'webstorm.exe', 'webstorm'],
    windowsPaths: [
      'C:\\Program Files\\JetBrains\\WebStorm\\bin\\webstorm.bat',
      'C:\\Program Files (x86)\\JetBrains\\WebStorm\\bin\\webstorm.bat',
      'C:\\Program Files\\JetBrains\\WebStorm\\bin\\webstorm64.exe',
    ],
    macPaths: [
      '/Applications/WebStorm.app/Contents/MacOS/webstorm',
      '/usr/local/bin/webstorm',
    ],
    linuxPaths: ['/opt/webstorm/bin/webstorm', '/usr/bin/webstorm', '/snap/bin/webstorm'],
    folderKeywords: ['webstorm'],
    toolboxFolderName: 'WebStorm',
    versionArgs: ['--version'],
  },
  {
    label: 'Intellij',
    key: '0-2',
    defaultCommand: 'idea',
    binaryNames: ['idea.bat', 'idea64.exe', 'idea.exe', 'idea'],
    windowsPaths: [
      'C:\\Program Files\\JetBrains\\IntelliJ IDEA\\bin\\idea.bat',
      'C:\\Program Files (x86)\\JetBrains\\IntelliJ IDEA\\bin\\idea.bat',
      'C:\\Program Files\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe',
      'C:\\Program Files\\JetBrains\\IntelliJ IDEA Community Edition\\bin\\idea.bat',
    ],
    macPaths: [
      '/Applications/IntelliJ IDEA.app/Contents/MacOS/idea',
      '/Applications/IntelliJ IDEA CE.app/Contents/MacOS/idea',
      '/usr/local/bin/idea',
    ],
    linuxPaths: ['/opt/intellij-idea/bin/idea', '/usr/bin/idea', '/snap/bin/idea'],
    folderKeywords: ['intellij', 'idea'],
    toolboxFolderName: 'IDEA',
    versionArgs: ['--version'],
  },
  {
    label: 'PyCharm',
    key: '0-5',
    defaultCommand: 'pycharm',
    binaryNames: ['pycharm.bat', 'pycharm64.exe', 'pycharm.exe', 'pycharm'],
    windowsPaths: [
      'C:\\Program Files\\JetBrains\\PyCharm\\bin\\pycharm.bat',
      'C:\\Program Files (x86)\\JetBrains\\PyCharm\\bin\\pycharm.bat',
      'C:\\Program Files\\JetBrains\\PyCharm\\bin\\pycharm64.exe',
      'C:\\Program Files\\JetBrains\\PyCharm Community Edition\\bin\\pycharm.bat',
    ],
    macPaths: [
      '/Applications/PyCharm.app/Contents/MacOS/pycharm',
      '/Applications/PyCharm CE.app/Contents/MacOS/pycharm',
      '/usr/local/bin/pycharm',
    ],
    linuxPaths: ['/opt/pycharm/bin/pycharm', '/usr/bin/pycharm', '/snap/bin/pycharm'],
    folderKeywords: ['pycharm'],
    toolboxFolderName: 'PyCharm',
    versionArgs: ['--version'],
  },
  {
    label: 'PhpStorm',
    key: '0-7',
    defaultCommand: 'phpstorm',
    binaryNames: ['phpstorm.bat', 'phpstorm64.exe', 'phpstorm.exe', 'phpstorm'],
    windowsPaths: [
      'C:\\Program Files\\JetBrains\\PhpStorm\\bin\\phpstorm.bat',
      'C:\\Program Files (x86)\\JetBrains\\PhpStorm\\bin\\phpstorm.bat',
      'C:\\Program Files\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe',
    ],
    macPaths: [
      '/Applications/PhpStorm.app/Contents/MacOS/phpstorm',
      '/usr/local/bin/phpstorm',
    ],
    linuxPaths: ['/opt/phpstorm/bin/phpstorm', '/usr/bin/phpstorm', '/snap/bin/phpstorm'],
    folderKeywords: ['phpstorm'],
    toolboxFolderName: 'PhpStorm',
    versionArgs: ['--version'],
  },
  {
    label: 'CLion',
    key: '0-6',
    defaultCommand: 'clion',
    binaryNames: ['clion.bat', 'clion64.exe', 'clion.exe', 'clion'],
    windowsPaths: [
      'C:\\Program Files\\JetBrains\\CLion\\bin\\clion.bat',
      'C:\\Program Files (x86)\\JetBrains\\CLion\\bin\\clion.bat',
      'C:\\Program Files\\JetBrains\\CLion\\bin\\clion64.exe',
    ],
    macPaths: [
      '/Applications/CLion.app/Contents/MacOS/clion',
      '/usr/local/bin/clion',
    ],
    linuxPaths: ['/opt/clion/bin/clion', '/usr/bin/clion', '/snap/bin/clion'],
    folderKeywords: ['clion'],
    toolboxFolderName: 'CLion',
    versionArgs: ['--version'],
  },
  {
    label: 'GoLand',
    key: '0-9',
    defaultCommand: 'goland',
    binaryNames: ['goland.bat', 'goland64.exe', 'goland.exe', 'goland'],
    windowsPaths: [
      'C:\\Program Files\\JetBrains\\GoLand\\bin\\goland.bat',
      'C:\\Program Files (x86)\\JetBrains\\GoLand\\bin\\goland.bat',
      'C:\\Program Files\\JetBrains\\GoLand\\bin\\goland64.exe',
    ],
    macPaths: [
      '/Applications/GoLand.app/Contents/MacOS/goland',
      '/usr/local/bin/goland',
    ],
    linuxPaths: ['/opt/goland/bin/goland', '/usr/bin/goland', '/snap/bin/goland'],
    folderKeywords: ['goland'],
    toolboxFolderName: 'GoLand',
    versionArgs: ['--version'],
  },
  {
    label: 'Rider',
    key: '0-4',
    defaultCommand: 'rider',
    binaryNames: ['rider.bat', 'rider64.exe', 'rider.exe', 'rider'],
    windowsPaths: [
      'C:\\Program Files\\JetBrains\\Rider\\bin\\rider.bat',
      'C:\\Program Files (x86)\\JetBrains\\Rider\\bin\\rider.bat',
      'C:\\Program Files\\JetBrains\\Rider\\bin\\rider64.exe',
    ],
    macPaths: [
      '/Applications/Rider.app/Contents/MacOS/rider',
      '/usr/local/bin/rider',
    ],
    linuxPaths: ['/opt/rider/bin/rider', '/usr/bin/rider', '/snap/bin/rider'],
    folderKeywords: ['rider'],
    toolboxFolderName: 'Rider',
    versionArgs: ['--version'],
  },
  {
    label: 'RubyMine',
    key: '0-8',
    defaultCommand: 'rubymine',
    binaryNames: ['rubymine.bat', 'rubymine64.exe', 'rubymine.exe', 'rubymine'],
    windowsPaths: [
      'C:\\Program Files\\JetBrains\\RubyMine\\bin\\rubymine.bat',
      'C:\\Program Files (x86)\\JetBrains\\RubyMine\\bin\\rubymine.bat',
      'C:\\Program Files\\JetBrains\\RubyMine\\bin\\rubymine64.exe',
    ],
    macPaths: [
      '/Applications/RubyMine.app/Contents/MacOS/rubymine',
      '/usr/local/bin/rubymine',
    ],
    linuxPaths: ['/opt/rubymine/bin/rubymine', '/usr/bin/rubymine', '/snap/bin/rubymine'],
    folderKeywords: ['rubymine'],
    toolboxFolderName: 'RubyMine',
    versionArgs: ['--version'],
  },
  {
    label: 'Android Studio',
    key: '0-13',
    defaultCommand: 'studio',
    binaryNames: ['studio.bat', 'studio64.exe', 'studio.exe', 'studio'],
    windowsPaths: [
      'C:\\Program Files\\Android\\Android Studio\\bin\\studio.bat',
      'C:\\Program Files (x86)\\Android\\Android Studio\\bin\\studio.bat',
      'C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe',
    ],
    macPaths: [
      '/Applications/Android Studio.app/Contents/MacOS/studio',
      '/usr/local/bin/studio',
    ],
    linuxPaths: ['/opt/android-studio/bin/studio.sh', '/usr/bin/studio', '/snap/bin/android-studio'],
    folderKeywords: ['android studio', 'androidstudio'],
    toolboxFolderName: 'AndroidStudio',
    versionArgs: ['--version'],
  },
  {
    label: 'Sublime Text',
    key: '0-14',
    defaultCommand: 'subl',
    binaryNames: ['subl.exe', 'sublime_text.exe', 'subl'],
    windowsPaths: [
      'C:\\Program Files\\Sublime Text\\subl.exe',
      'C:\\Program Files (x86)\\Sublime Text\\subl.exe',
      'C:\\Program Files\\Sublime Text 3\\subl.exe',
      'C:\\Program Files (x86)\\Sublime Text 3\\subl.exe',
      path.join(localAppData, 'Programs', 'Sublime Text', 'subl.exe'),
    ],
    macPaths: [
      '/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl',
      '/usr/local/bin/subl',
    ],
    linuxPaths: ['/opt/sublime_text/subl', '/usr/bin/subl', '/snap/bin/sublime-text'],
    folderKeywords: ['sublime text', 'sublime'],
    versionArgs: ['--version'],
  },
  {
    label: 'Zed',
    key: '0-18',
    defaultCommand: 'zed',
    binaryNames: ['zed.exe', 'zed'],
    windowsPaths: [
      path.join(localAppData, 'Programs', 'Zed', 'zed.exe'),
      path.join(localAppData, 'Programs', 'Zed', 'bin', 'zed.exe'),
    ],
    macPaths: ['/Applications/Zed.app/Contents/MacOS/zed', '/usr/local/bin/zed'],
    linuxPaths: ['/usr/bin/zed', '/usr/local/bin/zed', path.join(home, '.local', 'bin', 'zed')],
    folderKeywords: ['zed'],
    versionArgs: ['--version'],
  },
  {
    label: 'Brackets',
    key: '0-12',
    defaultCommand: 'brackets',
    binaryNames: ['brackets.exe', 'brackets'],
    windowsPaths: [
      'C:\\Program Files\\Brackets\\brackets.exe',
      'C:\\Program Files (x86)\\Brackets\\brackets.exe',
    ],
    macPaths: ['/Applications/Brackets.app/Contents/MacOS/Brackets'],
    linuxPaths: ['/opt/brackets/brackets', '/usr/bin/brackets'],
    folderKeywords: ['brackets'],
    versionArgs: ['--version'],
  },
];

function findExecutableInPath(bin: string): string | null {
  const isWindows = process.platform === 'win32';
  try {
    const cmd = isWindows ? `where.exe "${bin}"` : `which "${bin}"`;
    const out = execSync(cmd, { stdio: 'pipe', timeout: 2000 })
      .toString()
      .trim();
    if (out) {
      const lines = out.split('\r\n').join('\n').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && fs.existsSync(trimmed)) {
          return trimmed;
        }
      }
    }
  } catch {}
  return null;
}

function findJetBrainsInstallDir(folderKeywords: string[], binaryNames: string[]): string | null {
  if (process.platform !== 'win32') return null;
  const roots = [
    'C:\\Program Files\\JetBrains',
    'C:\\Program Files (x86)\\JetBrains',
    path.join(localAppData, 'Programs'),
  ];

  for (const jbDir of roots) {
    try {
      if (fs.existsSync(jbDir)) {
        const subdirs = fs.readdirSync(jbDir);
        for (const sub of subdirs) {
          const subLower = sub.toLowerCase();
          const matches = folderKeywords.some((kw) => subLower.includes(kw.toLowerCase()));
          if (matches) {
            const binDir = path.join(jbDir, sub, 'bin');
            if (fs.existsSync(binDir)) {
              for (const bin of binaryNames) {
                const target = path.join(binDir, bin);
                if (fs.existsSync(target)) {
                  return target;
                }
              }
              const files = fs.readdirSync(binDir);
              const bat = files.find((f) => f.endsWith('.bat') || f.endsWith('64.exe'));
              if (bat) {
                return path.join(binDir, bat);
              }
            }
          }
        }
      }
    } catch {}
  }
  return null;
}

function findJetBrainsToolboxEditor(toolboxFolderPrefix: string, binaryNames: string[]): string | null {
  const isWindows = process.platform === 'win32';
  const toolboxBase = isWindows
    ? path.join(localAppData, 'JetBrains', 'Toolbox', 'apps')
    : path.join(home, 'Library', 'Application Support', 'JetBrains', 'Toolbox', 'apps');

  try {
    if (!fs.existsSync(toolboxBase)) return null;
    const entries = fs.readdirSync(toolboxBase);
    const targetDir = entries.find((dir) =>
      dir.toLowerCase().includes(toolboxFolderPrefix.toLowerCase()),
    );
    if (!targetDir) return null;

    const appDir = path.join(toolboxBase, targetDir, 'ch-0');
    if (!fs.existsSync(appDir)) return null;

    const versions = fs.readdirSync(appDir);
    if (versions.length === 0) return null;
    const latestVersion = versions[versions.length - 1];
    const binDir = path.join(appDir, latestVersion, 'bin');
    if (!fs.existsSync(binDir)) return null;

    for (const bin of binaryNames) {
      const target = path.join(binDir, bin);
      if (fs.existsSync(target)) {
        return target;
      }
    }

    const binFiles = fs.readdirSync(binDir);
    const exe = binFiles.find(
      (f) =>
        f.endsWith('.bat') ||
        f.endsWith('64.exe') ||
        (isWindows ? f.endsWith('.exe') : !f.includes('.')),
    );
    if (exe) {
      return path.join(binDir, exe);
    }
  } catch {}
  return null;
}

export async function detectAllEditors(): Promise<Record<string, EditorDetectionResult>> {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const results: Record<string, EditorDetectionResult> = {};

  for (const def of EDITORS_METADATA) {
    let foundPath: string | null = null;

    // 1. Check direct known file paths first (hardcoded paths)
    const candidatePaths = isWindows
      ? def.windowsPaths
      : isMac
        ? def.macPaths
        : def.linuxPaths;

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          foundPath = p;
          break;
        }
      } catch {}
    }

    // 2. Check dynamic JetBrains directories (versioned)
    if (!foundPath && def.folderKeywords && def.folderKeywords.length > 0) {
      const jbPath = findJetBrainsInstallDir(def.folderKeywords, def.binaryNames);
      if (jbPath && fs.existsSync(jbPath)) {
        foundPath = jbPath;
      }
    }

    // 3. Check JetBrains Toolbox
    if (!foundPath && def.toolboxFolderName) {
      const toolboxPath = findJetBrainsToolboxEditor(def.toolboxFolderName, def.binaryNames);
      if (toolboxPath && fs.existsSync(toolboxPath)) {
        foundPath = toolboxPath;
      }
    }

    // 4. Search PATH with where/which
    if (!foundPath) {
      for (const bin of def.binaryNames) {
        const full = findExecutableInPath(bin);
        if (full && fs.existsSync(full)) {
          foundPath = full;
          break;
        }
      }
    }

    results[def.label] = {
      label: def.label,
      key: def.key,
      found: !!foundPath,
      path: foundPath || '',
      version: foundPath ? 'Installed' : null,
    };
  }

  return results;
}

export default {
  detectAllEditors,
  EDITORS_METADATA,
};
