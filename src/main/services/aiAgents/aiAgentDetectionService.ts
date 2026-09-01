import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawn } from 'child_process';
import { AiAgentId } from '../../../shared/aiAgents';
import log from '../../utils/logger';

export interface DetectionResult {
  agentId: AiAgentId;
  found: boolean;
  executablePath: string | null;
  version: string | null;
  command: string | null;
}

const AGENT_BINARIES: Record<AiAgentId, string[]> = {
  claude: ['claude.cmd', 'claude.exe', 'claude', 'claude.bat', 'claude.ps1'],
  codex: ['codex.cmd', 'codex.exe', 'codex', 'codex.bat', 'codex.ps1'],
  cursor: [
    'cursor-agent.cmd',
    'cursor-agent.exe',
    'cursor-agent',
    'agent.cmd',
    'agent.exe',
    'agent',
  ],
  antigravity: [
    'agy.exe',
    'agy.cmd',
    'agy',
  ],
  qwen: ['qwen.cmd', 'qwen.exe', 'qwen', 'qwen.bat', 'qwen.ps1'],
  kimi: [
    'kimi.cmd',
    'kimi.exe',
    'kimi',
    'kimi.bat',
    'kimi.ps1',
    'kimi-cli.cmd',
    'kimi-cli.exe',
    'kimi-cli',
    'kimi-code.cmd',
    'kimi-code.exe',
    'kimi-code',
  ],
  opencode: [
    'opencode.cmd',
    'opencode.exe',
    'opencode',
    'opencode.bat',
    'opencode.ps1',
    'opencode2.cmd',
    'opencode2.exe',
    'opencode2',
  ],
};

function getSearchDirectories(): string[] {
  const dirs = new Set<string>();
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const home = os.homedir();

  const addPathEntries = (value: string | undefined) => {
    if (!value) return;
    const separator = process.platform === 'win32' ? ';' : ':';
    value.split(separator).forEach((entry) => {
      const trimmed = entry
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/%([^%]+)%/g, (_match, variableName) => {
          const key = Object.keys(process.env).find(
            (candidate) =>
              candidate.toLowerCase() === String(variableName).toLowerCase(),
          );
          return (key && process.env[key]) || `%${variableName}%`;
        });
      if (trimmed) dirs.add(trimmed);
    });
  };

  // 1. Current Environment PATH entries
  addPathEntries(process.env.PATH || process.env.Path || '');

  // Electron can stay open while an installer updates PATH. Read the current
  // registry values as well so auto-detection works without restarting.
  if (isWindows) {
    const registryPaths = [
      ['HKCU\\Environment', 'Path'],
      [
        'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
        'Path',
      ],
    ];
    registryPaths.forEach(([registryKey, valueName]) => {
      try {
        const output = execFileSync(
          'reg.exe',
          ['query', registryKey, '/v', valueName],
          { windowsHide: true, encoding: 'utf8' },
        );
        const match = output.match(/\bPath\s+REG_(?:EXPAND_)?SZ\s+(.+)$/im);
        if (match) addPathEntries(match[1]);
      } catch {
        // Registry PATH lookup is an optional refresh aid.
      }
    });
  }

  // 2. Windows-specific well-known directories
  if (isWindows) {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppData =
      process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 =
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    dirs.add(path.join(programFiles, 'nodejs'));
    dirs.add(path.join(programFilesX86, 'nodejs'));
    dirs.add(path.join(appData, 'npm'));
    dirs.add(path.join(localAppData, 'pnpm'));
    dirs.add(path.join(localAppData, 'Microsoft', 'WinGet', 'Links'));
    dirs.add(path.join(localAppData, 'agy', 'bin'));
    dirs.add(path.join(localAppData, 'agy'));
    dirs.add(path.join(localAppData, 'cursor-agent'));
    dirs.add(path.join(localAppData, 'cursor-agent', 'bin'));
    dirs.add(path.join(localAppData, 'Programs', 'Python', 'Scripts'));
    dirs.add(path.join(home, '.cargo', 'bin'));
    dirs.add(path.join(home, '.yarn', 'bin'));
    dirs.add(path.join(home, '.local', 'bin'));
    dirs.add(path.join(home, '.cursor', 'bin'));
    dirs.add(path.join(home, '.agy', 'bin'));
    dirs.add(path.join(home, '.qwen', 'bin'));
    dirs.add(path.join(home, '.kimi', 'bin'));
    dirs.add(path.join(home, '.kimi-code', 'bin'));
    dirs.add(path.join(home, '.local', 'share', 'kimi', 'bin'));
    dirs.add(path.join(home, 'scoop', 'apps', 'kimi-cli', 'current'));
    dirs.add(path.join(home, 'scoop', 'apps', 'kimi-code', 'current'));
    dirs.add(path.join(home, 'pipx', 'venvs', 'kimi-cli', 'Scripts'));
    dirs.add(path.join(localAppData, 'pipx', 'venvs', 'kimi-cli', 'Scripts'));
    dirs.add(path.join(appData, 'uv', 'tools', 'kimi-cli', 'Scripts'));
    dirs.add(path.join(localAppData, 'uv', 'tools', 'kimi-cli', 'Scripts'));
    dirs.add(path.join(programFiles, 'Kimi Code'));
    dirs.add(path.join(localAppData, 'Programs', 'Kimi Code'));
    [path.join(appData, 'Python'), path.join(localAppData, 'Programs', 'Python')]
      .filter((pythonRoot) => fs.existsSync(pythonRoot))
      .forEach((pythonRoot) => {
        try {
          fs.readdirSync(pythonRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .forEach((entry) =>
              dirs.add(path.join(pythonRoot, entry.name, 'Scripts')),
            );
        } catch {
          // Continue with other known installation locations.
        }
      });
    dirs.add(path.join(home, '.opencode', 'bin'));
    dirs.add(path.join(home, '.gemini', 'bin'));
    dirs.add(path.join(home, '.qwen', 'bin'));
    dirs.add(path.join(home, '.kimi', 'bin'));
    dirs.add(path.join(home, '.kimi-code', 'bin'));
    dirs.add(path.join(home, '.local', 'share', 'kimi', 'bin'));
    dirs.add(path.join(home, '.opencode', 'bin'));
    dirs.add(path.join(home, '.gemini', 'antigravity-ide', 'bin'));
  } else {
    // 3. macOS and Linux well-known directories
    if (isMac) {
      dirs.add('/opt/homebrew/bin');
      dirs.add('/opt/homebrew/sbin');
      dirs.add('/usr/local/bin');
      dirs.add('/Applications/Cursor.app/Contents/Resources/app/bin');
      dirs.add('/Applications/Antigravity.app/Contents/Resources/app/bin');
    }
    dirs.add('/usr/local/bin');
    dirs.add('/usr/bin');
    dirs.add('/bin');
    dirs.add('/snap/bin');
    dirs.add(path.join(home, '.local', 'bin'));
    dirs.add(path.join(home, '.cargo', 'bin'));
    dirs.add(path.join(home, '.npm-global', 'bin'));
    dirs.add(path.join(home, '.gemini', 'bin'));

    // Look in NVM directories if present
    const nvmDir = path.join(home, '.nvm', 'versions', 'node');
    try {
      if (fs.existsSync(nvmDir)) {
        const versions = fs.readdirSync(nvmDir);
        for (const v of versions) {
          dirs.add(path.join(nvmDir, v, 'bin'));
        }
      }
    } catch {
      // Ignore NVM scan errors
    }
  }

  return Array.from(dirs).filter((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
}

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

function verifyExecutable(executablePath: string): Promise<{ ok: boolean; version: string | null }> {
  return new Promise((resolve) => {
    try {
      const isWindows = process.platform === 'win32';
      const cmdToRun = isWindows && executablePath.includes(' ') && !executablePath.startsWith('"')
        ? `"${executablePath}"`
        : executablePath;
      const child = spawn(cmdToRun, ['--version'], {
        shell: isWindows,
        windowsHide: true,
        timeout: 4000,
        env: getCleanEnv(),
      });

      let output = '';
      let stderrOutput = '';
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
        stderrOutput += chunk.toString();
      });

      child.on('error', () => finish(false, null));

      child.on('close', (code: number) => {
        const cleanOutput = (output.trim() || stderrOutput.trim()).split('\n')[0]?.trim() || '';
        const lower = cleanOutput.toLowerCase();
        const isError =
          lower.includes('is not recognized') ||
          lower.includes('not found') ||
          lower.includes('cannot find') ||
          lower.includes('error:');

        if (code === 0 && !isError && cleanOutput.length > 0) {
          finish(true, cleanOutput);
        } else if (!isError && cleanOutput.length > 0 && (code === 0 || code === 1)) {
          finish(true, cleanOutput);
        } else if (fs.existsSync(executablePath)) {
          finish(true, 'Installed');
        } else {
          finish(false, null);
        }
      });
    } catch {
      resolve({ ok: false, version: null });
    }
  });
}

export async function detectAiAgent(agentId: AiAgentId): Promise<DetectionResult> {
  const binaryNames = AGENT_BINARIES[agentId] || [agentId];
  const searchDirs = getSearchDirectories();

  for (const dir of searchDirs) {
    for (const bin of binaryNames) {
      const candidatePath = path.join(dir, bin);
      try {
        if (fs.existsSync(candidatePath)) {
          const stats = fs.statSync(candidatePath);
          if (stats.isFile()) {
            const verification = await verifyExecutable(candidatePath);
            if (verification.ok) {
              return {
                agentId,
                found: true,
                executablePath: candidatePath,
                command: candidatePath,
                version: verification.version,
              };
            }
          }
        }
      } catch {
        // Continue searching next candidate
      }
    }
  }

  // Fallback: Test if the raw command works in current shell environment
  for (const bin of binaryNames) {
    const verification = await verifyExecutable(bin);
    if (verification.ok) {
      return {
        agentId,
        found: true,
        executablePath: bin,
        command: bin,
        version: verification.version,
      };
    }
  }

  return {
    agentId,
    found: false,
    executablePath: null,
    command: null,
    version: null,
  };
}

export async function detectAllAiAgents(): Promise<Record<AiAgentId, DetectionResult>> {
  const agentIds: AiAgentId[] = [
    'claude',
    'codex',
    'cursor',
    'antigravity',
    'qwen',
    'kimi',
    'opencode',
  ];
  const results: Partial<Record<AiAgentId, DetectionResult>> = {};

  await Promise.all(
    agentIds.map(async (id) => {
      try {
        results[id] = await detectAiAgent(id);
      } catch (error: any) {
        log.warn?.(`Failed auto-detecting AI agent ${id}: ${error?.message}`);
        results[id] = {
          agentId: id,
          found: false,
          executablePath: null,
          command: null,
          version: null,
        };
      }
    }),
  );

  return results as Record<AiAgentId, DetectionResult>;
}

export default {
  detectAiAgent,
  detectAllAiAgents,
};
