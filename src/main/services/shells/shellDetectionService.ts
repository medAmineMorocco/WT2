import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import { ShellDetectionResult, ShellId } from '../../../shared/shells';
import utils from '../../utils/utils';
import log from '../../utils/logger';

interface ShellCandidate {
  id: ShellId;
  name: string;
  description: string;
  icon: string;
  binaryNames: string[];
  knownPathsWindows: string[];
  knownPathsUnix: string[];
  versionArgs: string[];
}

const SHELL_DEFINITIONS: ShellCandidate[] = [
  {
    id: 'pwsh',
    name: 'PowerShell 7 (Core)',
    description: 'Cross-platform modern PowerShell',
    icon: 'powershell',
    binaryNames: ['pwsh.exe', 'pwsh'],
    knownPathsWindows: [
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe',
      'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
    ],
    knownPathsUnix: [
      '/usr/local/bin/pwsh',
      '/usr/bin/pwsh',
      '/opt/microsoft/powershell/7/pwsh',
      '/snap/bin/pwsh',
    ],
    versionArgs: ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
  },
  {
    id: 'powershell',
    name: 'Windows PowerShell',
    description: 'Built-in Windows PowerShell 5.1',
    icon: 'powershell',
    binaryNames: ['powershell.exe'],
    knownPathsWindows: [
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe',
    ],
    knownPathsUnix: [],
    versionArgs: ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
  },
  {
    id: 'git-bash',
    name: 'Git Bash',
    description: 'Bash environment included with Git for Windows',
    icon: 'git',
    binaryNames: ['bash.exe'],
    knownPathsWindows: [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe',
    ],
    knownPathsUnix: [],
    versionArgs: ['--version'],
  },
  {
    id: 'cmd',
    name: 'Command Prompt (CMD)',
    description: 'Standard Windows command interpreter',
    icon: 'cmd',
    binaryNames: ['cmd.exe', 'cmd'],
    knownPathsWindows: ['C:\\Windows\\System32\\cmd.exe', 'C:\\Windows\\SysWOW64\\cmd.exe'],
    knownPathsUnix: [],
    versionArgs: ['/c', 'ver'],
  },
  {
    id: 'fish',
    name: 'Fish Shell',
    description: 'Smart, user-friendly command line shell',
    icon: 'fish',
    binaryNames: ['fish.exe', 'fish'],
    knownPathsWindows: [
      'C:\\Program Files\\Fish\\fish.exe',
      'C:\\Program Files (x86)\\Fish\\fish.exe',
    ],
    knownPathsUnix: [
      '/usr/bin/fish',
      '/usr/local/bin/fish',
      '/opt/homebrew/bin/fish',
      '/opt/homebrew/sbin/fish',
      '/snap/bin/fish',
    ],
    versionArgs: ['--version'],
  },
  {
    id: 'zsh',
    name: 'Z Shell (Zsh)',
    description: 'Advanced shell with programmable completions',
    icon: 'terminal',
    binaryNames: ['zsh.exe', 'zsh'],
    knownPathsWindows: [],
    knownPathsUnix: [
      '/bin/zsh',
      '/usr/bin/zsh',
      '/usr/local/bin/zsh',
      '/opt/homebrew/bin/zsh',
    ],
    versionArgs: ['--version'],
  },
  {
    id: 'bash',
    name: 'GNU Bash',
    description: 'Standard GNU Bourne-Again SHell',
    icon: 'terminal',
    binaryNames: ['bash.exe', 'bash'],
    knownPathsWindows: [],
    knownPathsUnix: [
      '/bin/bash',
      '/usr/bin/bash',
      '/usr/local/bin/bash',
      '/opt/homebrew/bin/bash',
    ],
    versionArgs: ['--version'],
  },
  {
    id: 'nu',
    name: 'Nushell',
    description: 'Modern structured data shell',
    icon: 'terminal',
    binaryNames: ['nu.exe', 'nu'],
    knownPathsWindows: [
      'C:\\Program Files\\nu\\bin\\nu.exe',
    ],
    knownPathsUnix: [
      '/usr/bin/nu',
      '/usr/local/bin/nu',
      '/opt/homebrew/bin/nu',
    ],
    versionArgs: ['--version'],
  },
  {
    id: 'wsl',
    name: 'WSL Bash',
    description: 'Windows Subsystem for Linux default shell',
    icon: 'linux',
    binaryNames: ['wsl.exe'],
    knownPathsWindows: ['C:\\Windows\\System32\\wsl.exe'],
    knownPathsUnix: [],
    versionArgs: ['--version'],
  },
  {
    id: 'sh',
    name: 'POSIX sh',
    description: 'Standard POSIX compliant shell',
    icon: 'terminal',
    binaryNames: ['sh.exe', 'sh'],
    knownPathsWindows: [],
    knownPathsUnix: ['/bin/sh', '/usr/bin/sh'],
    versionArgs: ['-c', 'echo $0'],
  },
];

function getCleanEnv(): NodeJS.ProcessEnv {
  const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
  delete cleanEnv.NODE_OPTIONS;
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.TS_NODE_TRANSPILE_ONLY;
  delete cleanEnv.TS_NODE_COMPILER_OPTIONS;
  delete cleanEnv.TS_NODE_PROJECT;
  return cleanEnv;
}

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

function verifyShellExecutable(
  executablePath: string,
  args: string[],
): Promise<{ ok: boolean; version: string | null }> {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(executablePath)) {
        resolve({ ok: false, version: null });
        return;
      }

      const isWindows = process.platform === 'win32';
      // Never wrap in quotes when shell is false, as CreateProcess handles it natively
      const child = spawn(executablePath, args, {
        shell: false,
        windowsHide: true,
        timeout: 3000,
        env: getCleanEnv(),
      });

      let output = '';
      let errorOutput = '';
      let settled = false;

      const finish = (ok: boolean, version: string | null) => {
        if (settled) return;
        settled = true;
        resolve({ ok, version });
      };

      child.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        errorOutput += chunk.toString();
      });

      child.on('error', () => {
        // If file exists on disk, treat as installed even if spawn --version errored
        if (fs.existsSync(executablePath)) {
          finish(true, 'Installed');
        } else {
          finish(false, null);
        }
      });

      child.on('close', (code: number) => {
        const clean = (output.trim() || errorOutput.trim()).split('\n')[0]?.trim() || '';
        const lower = clean.toLowerCase();

        const isInvalid =
          lower.includes('is not recognized') ||
          lower.includes('not found') ||
          lower.includes('cannot find') ||
          lower.includes('error: createprocess');

        if (code === 0 && !isInvalid && clean.length > 0) {
          finish(true, clean);
        } else if (!isInvalid && clean.length > 0 && (code === 0 || code === 1)) {
          finish(true, clean);
        } else if (fs.existsSync(executablePath)) {
          finish(true, 'Installed');
        } else {
          finish(false, null);
        }
      });
    } catch {
      if (fs.existsSync(executablePath)) {
        resolve({ ok: true, version: 'Installed' });
      } else {
        resolve({ ok: false, version: null });
      }
    }
  });
}

export async function detectAllShells(): Promise<ShellDetectionResult[]> {
  const isWindows = process.platform === 'win32';
  const home = os.homedir();
  const results: ShellDetectionResult[] = [];

  // If git.exe exists, derive Git Bash path
  let derivedGitBashPath: string | null = null;
  if (isWindows) {
    const gitPath = findExecutableInPath('git.exe');
    if (gitPath) {
      const gitDir = path.dirname(path.dirname(gitPath));
      const testBash = path.join(gitDir, 'bin', 'bash.exe');
      const testUsrBash = path.join(gitDir, 'usr', 'bin', 'bash.exe');
      if (fs.existsSync(testBash)) {
        derivedGitBashPath = testBash;
      } else if (fs.existsSync(testUsrBash)) {
        derivedGitBashPath = testUsrBash;
      }
    }
  }

  for (const def of SHELL_DEFINITIONS) {
    let foundPath: string | null = null;
    let version: string | null = null;

    const candidatePaths = isWindows ? [...def.knownPathsWindows] : [...def.knownPathsUnix];

    if (isWindows) {
      if (def.id === 'git-bash') {
        if (derivedGitBashPath) {
          candidatePaths.unshift(derivedGitBashPath);
        }
        candidatePaths.push(
          path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'Git', 'bin', 'bash.exe'),
          path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'Git', 'usr', 'bin', 'bash.exe'),
        );
      } else if (def.id === 'pwsh') {
        candidatePaths.push(
          path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Microsoft', 'WindowsApps', 'pwsh.exe'),
        );
      } else if (def.id === 'nu') {
        candidatePaths.push(
          path.join(home, '.cargo', 'bin', 'nu.exe'),
          path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'nu', 'bin', 'nu.exe'),
        );
      }
    }

    // 1. Check known candidates
    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          const check = await verifyShellExecutable(p, def.versionArgs);
          if (check.ok) {
            foundPath = p;
            version = check.version;
            break;
          }
        }
      } catch {}
    }

    // 2. Search PATH with where/which
    if (!foundPath && def.id !== 'bash') {
      for (const bin of def.binaryNames) {
        const found = findExecutableInPath(bin);
        if (found && fs.existsSync(found)) {
          // On Windows, avoid picking System32\bash.exe for Git Bash
          if (isWindows && def.id === 'git-bash' && found.toLowerCase().includes('system32')) {
            continue;
          }
          const check = await verifyShellExecutable(found, def.versionArgs);
          if (check.ok) {
            foundPath = found;
            version = check.version;
            break;
          }
        }
      }
    }

    if (foundPath) {
      results.push({
        id: def.id,
        name: def.name,
        description: def.description,
        path: foundPath,
        found: true,
        version: version || 'Available',
        icon: def.icon,
      });
    } else {
      const defaultExample =
        candidatePaths[0] || (def.binaryNames[0] ? def.binaryNames[0] : '');
      results.push({
        id: def.id,
        name: def.name,
        description: def.description,
        path: defaultExample,
        found: false,
        version: null,
        icon: def.icon,
      });
    }
  }

  return results;
}

export async function getDefaultOrActiveShell(): Promise<string> {
  const storedShell = await utils.getStorageItem('shellPath');
  if (storedShell && storedShell.trim()) {
    return storedShell.trim();
  }

  if (process.platform === 'win32') {
    if (fs.existsSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe')) {
      return 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
    }
    if (fs.existsSync('C:\\Program Files\\Git\\bin\\bash.exe')) {
      return 'C:\\Program Files\\Git\\bin\\bash.exe';
    }
    if (fs.existsSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')) {
      return 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    }
    return process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
  }

  if (process.platform === 'darwin') {
    return process.env.SHELL || '/bin/zsh';
  }

  return process.env.SHELL || '/bin/bash';
}

export default {
  detectAllShells,
  getDefaultOrActiveShell,
};
