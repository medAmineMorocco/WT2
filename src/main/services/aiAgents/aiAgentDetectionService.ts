import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawn } from 'child_process';
import {
  AiAgentId,
  detectPlatform,
  getInstallationGuide,
} from '../../../shared/aiAgents';
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
  antigravity: ['agy.exe', 'agy.cmd', 'agy'],
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
    const appData =
      process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
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
    [
      path.join(appData, 'Python'),
      path.join(localAppData, 'Programs', 'Python'),
    ]
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

    // Look in NVM directories if present (sort latest versions first)
    const nvmDir = path.join(home, '.nvm', 'versions', 'node');
    try {
      if (fs.existsSync(nvmDir)) {
        const versions = fs
          .readdirSync(nvmDir)
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        for (const v of versions) {
          dirs.add(path.join(nvmDir, v, 'bin'));
        }
      }
    } catch {
      // Ignore NVM scan errors
    }

    // Look in fnm, volta, asdf if present
    const fnmDirs = [
      path.join(home, '.local', 'share', 'fnm', 'current', 'bin'),
      path.join(home, '.fnm', 'current', 'bin'),
    ];
    for (const d of fnmDirs) {
      if (fs.existsSync(d)) dirs.add(d);
    }

    const voltaBin = path.join(home, '.volta', 'bin');
    if (fs.existsSync(voltaBin)) dirs.add(voltaBin);

    const asdfShims = path.join(home, '.asdf', 'shims');
    if (fs.existsSync(asdfShims)) dirs.add(asdfShims);
  }

  return Array.from(dirs).filter((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
}

export function getCleanEnv(): NodeJS.ProcessEnv {
  const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
  delete cleanEnv.NODE_OPTIONS;
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.TS_NODE_TRANSPILE_ONLY;
  delete cleanEnv.TS_NODE_COMPILER_OPTIONS;
  delete cleanEnv.TS_NODE_PROJECT;
  return cleanEnv;
}

export function getAugmentedEnv(): NodeJS.ProcessEnv {
  const cleanEnv = getCleanEnv();
  const searchDirs = getSearchDirectories();
  const sep = process.platform === 'win32' ? ';' : ':';
  const currentPath = cleanEnv.PATH || cleanEnv.Path || '';
  const currentEntries = new Set(
    currentPath
      .split(sep)
      .map((p) => p.trim())
      .filter(Boolean),
  );

  // Prepend discovered toolchain directories (e.g. NVM, Volta, fnm, ~/.local/bin)
  // so GUI-launched apps on Linux/macOS resolve modern node and agent executables
  const toPrepend = searchDirs.filter((dir) => !currentEntries.has(dir));
  if (toPrepend.length > 0) {
    const combined = [...toPrepend, currentPath].filter(Boolean).join(sep);
    cleanEnv.PATH = combined;
    if (process.platform === 'win32') {
      cleanEnv.Path = combined;
    }
  }

  return cleanEnv;
}

export function parseCleanVersion(
  rawStdout: string,
  rawStderr: string,
  exitCode: number | null,
): string | null {
  if (exitCode !== 0 && exitCode !== null) return null;

  // Use the first non-empty line from stdout
  const line = (rawStdout.trim().split('\n')[0] || '').trim();
  if (!line || line.length > 60) return null;

  const lower = line.toLowerCase();
  const containsErrorPattern =
    lower.includes('error') ||
    lower.includes('not found') ||
    lower.includes('cannot find') ||
    lower.includes('is not recognized') ||
    lower.includes('syntaxerror') ||
    lower.includes('typeerror') ||
    lower.includes('referenceerror') ||
    lower.includes('file://') ||
    lower.includes('node_modules') ||
    lower.includes('exception') ||
    lower.includes('traceback');

  if (containsErrorPattern) return null;

  // Must resemble a version string (e.g. "0.23.0", "v1.2.3", "codex-cli 0.153.4", "2.1.263 (Claude Code)")
  if (/\d+\.\d+/.test(line) || /^v?\d+/.test(line)) {
    return line;
  }

  return null;
}

function verifyExecutable(
  executablePath: string,
): Promise<{ ok: boolean; version: string | null }> {
  return new Promise((resolve) => {
    try {
      const isWindows = process.platform === 'win32';
      const cmdToRun =
        isWindows &&
        executablePath.includes(' ') &&
        !executablePath.startsWith('"')
          ? `"${executablePath}"`
          : executablePath;
      const child = spawn(cmdToRun, ['--version'], {
        shell: isWindows,
        windowsHide: true,
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: os.homedir(),
        env: getAugmentedEnv(),
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

      child.on('close', (code: number | null) => {
        const detectedVersion = parseCleanVersion(output, stderrOutput, code);
        if ((code === 0 || code === null) && detectedVersion) {
          finish(true, detectedVersion);
        } else if (fs.existsSync(executablePath)) {
          // Binary exists on disk, but --version failed or exited non-zero
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

interface CacheEntry {
  result: DetectionResult;
  expiresAt: number;
}

const detectionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

export interface AgentMaintenanceResult {
  ok: boolean;
  message: string;
  detection?: DetectionResult;
}

export function maintainAiAgent(
  agentId: AiAgentId,
  repair = false,
): Promise<AgentMaintenanceResult> {
  return new Promise((resolve) => {
    const npmPackage = getInstallationGuide(
      agentId,
      detectPlatform(),
    ).npmPackage;
    if (!npmPackage) {
      resolve({
        ok: false,
        message: 'Automatic maintenance is not available for this agent.',
      });
      return;
    }

    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'npm.cmd' : 'npm';
    const args = ['install', '-g', `${npmPackage}@latest`];
    if (repair) args.push('--force');

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: AgentMaintenanceResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const child = spawn(command, args, {
        shell: isWindows,
        windowsHide: true,
        cwd: os.homedir(),
        env: getAugmentedEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const timeout = setTimeout(
        () => {
          child.kill();
          finish({
            ok: false,
            message: 'The npm operation timed out after five minutes.',
          });
        },
        5 * 60 * 1000,
      );

      const appendOutput = (current: string, chunk: Buffer) =>
        `${current}${chunk.toString()}`.slice(-20000);
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout = appendOutput(stdout, chunk);
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr = appendOutput(stderr, chunk);
      });
      child.on('error', (error: Error) => {
        clearTimeout(timeout);
        finish({ ok: false, message: error.message });
      });
      child.on('close', async (code: number | null) => {
        clearTimeout(timeout);
        if (settled) return;
        const output = [stdout.trim(), stderr.trim()]
          .filter(Boolean)
          .join('\n');
        if (code !== 0) {
          finish({
            ok: false,
            message: output || `npm exited with code ${code ?? 'unknown'}.`,
          });
          return;
        }

        clearDetectionCache(agentId);
        const detection = await detectAiAgent(agentId);
        finish({
          ok: detection.found,
          message: detection.found
            ? `${repair ? 'Repaired' : 'Updated'} ${npmPackage} successfully.`
            : `${npmPackage} was installed, but its executable could not be detected.`,
          detection,
        });
      });
    } catch (error: any) {
      finish({ ok: false, message: error?.message || String(error) });
    }
  });
}

export function clearDetectionCache(agentId?: AiAgentId): void {
  if (agentId) {
    for (const key of detectionCache.keys()) {
      if (key.startsWith(`${agentId}::`)) {
        detectionCache.delete(key);
      }
    }
  } else {
    detectionCache.clear();
  }
}

export async function detectAiAgent(
  agentId: AiAgentId,
  customCommand?: string,
): Promise<DetectionResult> {
  const normalizedCmd = customCommand?.trim() || '';
  const cacheKey = `${agentId}::${normalizedCmd || 'default'}`;

  const cached = detectionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // 1. If a custom command was provided, check it first
  if (normalizedCmd) {
    try {
      const verification = await verifyExecutable(normalizedCmd);
      if (verification.ok) {
        const result: DetectionResult = {
          agentId,
          found: true,
          executablePath: normalizedCmd,
          command: normalizedCmd,
          version: verification.version,
        };
        detectionCache.set(cacheKey, {
          result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return result;
      }
    } catch {
      // Continue to default search if custom command verification failed
    }
  }

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
              const result: DetectionResult = {
                agentId,
                found: true,
                executablePath: candidatePath,
                command: candidatePath,
                version: verification.version,
              };
              detectionCache.set(cacheKey, {
                result,
                expiresAt: Date.now() + CACHE_TTL_MS,
              });
              return result;
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
      const result: DetectionResult = {
        agentId,
        found: true,
        executablePath: bin,
        command: bin,
        version: verification.version,
      };
      detectionCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return result;
    }
  }

  const notFoundResult: DetectionResult = {
    agentId,
    found: false,
    executablePath: null,
    command: null,
    version: null,
  };
  detectionCache.set(cacheKey, {
    result: notFoundResult,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return notFoundResult;
}

export async function detectAllAiAgents(): Promise<
  Record<AiAgentId, DetectionResult>
> {
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
  maintainAiAgent,
  getCleanEnv,
  getAugmentedEnv,
  parseCleanVersion,
};
