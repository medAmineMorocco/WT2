import fs from 'fs';
import path from 'path';
import { ipcMain, WebContents } from 'electron';
import log from '../../utils/logger';
import utils from '../../utils/utils';
import { AiAgentConfig, aiAgentsDefault } from '../../../shared/aiAgents';

const pty = require('node-pty');

type TerminalSession = {
  process: any;
  ownerId: number;
};

type TerminalSuggestion = {
  id: string;
  label: string;
  value: string;
  type: 'command' | 'directory' | 'file';
  description?: string;
};

const sessions = new Map<string, TerminalSession>();
const registeredOwners = new Set<number>();

let installedCommandsCache: string[] | null = null;
let installedCommandsPromise: Promise<string[]> | null = null;
const packageScriptsCache = new Map<
  string,
  { expiresAt: number; commands: { command: string; description: string }[] }
>();

const COMMON_COMMANDS = [
  'git status',
  'git log --oneline --decorate --graph',
  'git diff',
  'git branch',
  'git fetch',
  'git pull',
  'git push',
  'npm install',
  'npm run dev',
  'npm run build',
  'npm test',
  'yarn',
  'pnpm install',
];

const SHELL_BUILTINS = [
  'cd',
  'clear',
  'cls',
  'copy',
  'del',
  'dir',
  'echo',
  'exit',
  'export',
  'history',
  'ls',
  'mkdir',
  'move',
  'pwd',
  'rm',
  'rmdir',
  'set',
  'type',
  'where',
  'which',
];

function normalizedCommandName(fileName: string) {
  if (process.platform !== 'win32') return fileName;
  const extension = path.extname(fileName).toLowerCase();
  return ['.exe', '.cmd', '.bat', '.com', '.ps1'].includes(extension)
    ? fileName.slice(0, -extension.length)
    : '';
}

async function scanInstalledCommands() {
  const pathDirectories = (process.env.PATH || '')
    .split(path.delimiter)
    .map((directory) => directory.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
  const commandGroups = await Promise.all(
    pathDirectories.map(async (directory) => {
      try {
        const entries = await fs.promises.readdir(directory, {
          withFileTypes: true,
        });
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => normalizedCommandName(entry.name))
          .filter(Boolean);
      } catch {
        return [];
      }
    }),
  );
  return [...new Set([...SHELL_BUILTINS, ...commandGroups.flat()])].sort(
    (left, right) => left.localeCompare(right),
  );
}

function getInstalledCommands() {
  if (installedCommandsCache) return Promise.resolve(installedCommandsCache);
  if (!installedCommandsPromise) {
    installedCommandsPromise = scanInstalledCommands().then((commands) => {
      installedCommandsCache = commands;
      installedCommandsPromise = null;
      return commands;
    });
  }
  return installedCommandsPromise;
}

function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  try {
    session.process.kill();
  } catch (error) {
    log.warn(`Unable to close terminal ${sessionId}: ${error}`);
  }
}

function ownedSession(sessionId: string, ownerId: number) {
  const session = sessions.get(sessionId);
  return session?.ownerId === ownerId ? session : undefined;
}

function watchOwner(sender: WebContents) {
  if (registeredOwners.has(sender.id)) return;
  registeredOwners.add(sender.id);
  sender.once('destroyed', () => {
    registeredOwners.delete(sender.id);
    [...sessions.entries()]
      .filter(([, session]) => session.ownerId === sender.id)
      .forEach(([sessionId]) => closeSession(sessionId));
  });
}

function defaultShell() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe';
  if (process.platform === 'darwin') return process.env.SHELL || '/bin/zsh';
  return process.env.SHELL || '/bin/bash';
}

ipcMain.on(
  'terminal-create',
  async (event, sessionId: string, directory: string, cols = 80, rows = 24) => {
    try {
      const stat = await fs.promises.stat(directory);
      if (!stat.isDirectory())
        throw new Error('The worktree path is not a directory.');

      closeSession(sessionId);
      watchOwner(event.sender);
      void getInstalledCommands();
      const configuredShell = await utils.getStorageItem('shellPath');
      const shell = configuredShell || defaultShell();
      const terminalProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: Math.max(2, cols),
        rows: Math.max(1, rows),
        cwd: directory,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      sessions.set(sessionId, {
        process: terminalProcess,
        ownerId: event.sender.id,
      });
      event.sender.send(
        'terminal-command-index',
        sessionId,
        COMMON_COMMANDS.map((command) => ({
          id: `command:${command}`,
          label: command,
          value: command,
          type: 'command' as const,
        })),
      );
      Promise.all([
        getInstalledCommands(),
        packageScriptSuggestions(directory),
      ]).then(([installedCommands, scripts]) => {
        if (event.sender.isDestroyed()) return;
        const catalog = [
          ...COMMON_COMMANDS.map((command) => ({
            id: `command:${command}`,
            label: command,
            value: command,
            type: 'command' as const,
          })),
          ...scripts.map(({ command, description }) => ({
            id: `command:${command}`,
            label: command,
            value: command,
            type: 'command' as const,
            description,
          })),
          ...installedCommands.map((command) => ({
            id: `command:${command}`,
            label: command,
            value: command,
            type: 'command' as const,
            description: 'Installed command',
          })),
        ].filter(
          (suggestion, index, suggestions) =>
            suggestions.findIndex((item) => item.value === suggestion.value) ===
            index,
        );
        event.sender.send('terminal-command-index', sessionId, catalog);
      });
      terminalProcess.onData((data: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('terminal-data', sessionId, data);
        }
      });
      terminalProcess.onExit(({ exitCode }: { exitCode: number }) => {
        sessions.delete(sessionId);
        if (!event.sender.isDestroyed()) {
          event.sender.send('terminal-exit', sessionId, exitCode);
        }
      });
      event.sender.send('terminal-ready', sessionId);
    } catch (error: any) {
      log.error(`Failed to create terminal in ${directory}: ${error.message}`);
      event.sender.send(
        'terminal-error',
        sessionId,
        error.message || 'Unable to start the terminal.',
      );
    }
  },
);

ipcMain.on('terminal-input', (event, sessionId: string, data: string) => {
  ownedSession(sessionId, event.sender.id)?.process.write(data);
});

function quoteForShell(value: string) {
  if (process.platform === 'win32') return `"${value.replace(/"/g, '""')}"`;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function configuredAiAgents() {
  const stored = await utils.getStorageItem('aiAgents');
  if (!stored) return aiAgentsDefault;
  try {
    const configured = JSON.parse(stored) as AiAgentConfig[];
    return aiAgentsDefault.map((defaultAgent) => ({
      ...defaultAgent,
      ...configured.find((agent) => agent.id === defaultAgent.id),
    }));
  } catch {
    return aiAgentsDefault;
  }
}

ipcMain.on(
  'terminal-start-ai-agent',
  async (event, sessionId: string, agentId: string, prompt: string) => {
    const session = ownedSession(sessionId, event.sender.id);
    if (!session) return;
    try {
      const agent = (await configuredAiAgents()).find(
        (candidate) => candidate.id === agentId,
      );
      if (!agent?.enabled) {
        throw new Error(
          'This AI agent is disabled. Enable and configure it in Settings > AI Agents.',
        );
      }
      if (!agent.command.trim()) {
        throw new Error(
          'Configure an executable command for this AI agent in Settings > AI Agents.',
        );
      }
      const command = [
        quoteForShell(agent.command.trim()),
        agent.args.trim(),
        prompt.trim() ? quoteForShell(prompt.trim()) : '',
      ]
        .filter(Boolean)
        .join(' ');
      session.process.write(`${command}\r`);
      event.sender.send('terminal-ai-agent-started', sessionId, agent.id);
    } catch (error: any) {
      event.sender.send(
        'terminal-ai-agent-error',
        sessionId,
        error.message || 'Unable to start the AI agent.',
      );
    }
  },
);

ipcMain.on('test-ai-agent', async (event, agent: AiAgentConfig) => {
  try {
    if (!agent.command?.trim())
      throw new Error('Enter an executable command first.');
    const child = require('child_process').spawn(
      agent.command.trim(),
      ['--version'],
      {
        shell: false,
        windowsHide: true,
      },
    );
    let output = '';
    let settled = false;
    const sendResult = (code: number, message: string) => {
      if (settled) return;
      settled = true;
      event.sender.send('ai-agent-tested', agent.id, code, message);
    };
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', (error: Error) => {
      sendResult(-1, error.message);
    });
    child.on('close', (code: number) => {
      sendResult(
        code === 0 ? 0 : -1,
        output.trim() || `Exited with code ${code}`,
      );
    });
  } catch (error: any) {
    event.sender.send('ai-agent-tested', agent.id, -1, error.message);
  }
});

ipcMain.on(
  'terminal-resize',
  (event, sessionId: string, cols: number, rows: number) => {
    if (cols < 2 || rows < 1) return;
    try {
      ownedSession(sessionId, event.sender.id)?.process.resize(cols, rows);
    } catch (error) {
      log.warn(`Unable to resize terminal ${sessionId}: ${error}`);
    }
  },
);

ipcMain.on('terminal-close', (event, sessionId: string) => {
  if (ownedSession(sessionId, event.sender.id)) closeSession(sessionId);
});

async function packageScriptSuggestions(directory: string) {
  const cached = packageScriptsCache.get(directory);
  if (cached && cached.expiresAt > Date.now()) return cached.commands;
  try {
    const packageJson = JSON.parse(
      await fs.promises.readFile(path.join(directory, 'package.json'), 'utf8'),
    );
    const commands = Object.keys(packageJson.scripts || {}).map((script) => ({
      command: `npm run ${script}`,
      description: `package.json script: ${script}`,
    }));
    packageScriptsCache.set(directory, {
      expiresAt: Date.now() + 30_000,
      commands,
    });
    return commands;
  } catch {
    return [];
  }
}

function pathQuery(input: string) {
  const tokenStart =
    Math.max(input.lastIndexOf(' '), input.lastIndexOf('\t')) + 1;
  const rawToken = input.slice(tokenStart);
  const quote =
    rawToken.startsWith('"') || rawToken.startsWith("'") ? rawToken[0] : '';
  return { tokenStart, token: quote ? rawToken.slice(1) : rawToken, quote };
}

async function getSuggestions(directory: string, input: string) {
  const suggestions: TerminalSuggestion[] = [];
  const normalizedInput = input.trimStart().toLowerCase();
  const [scripts, installedCommands] = await Promise.all([
    packageScriptSuggestions(directory),
    getInstalledCommands(),
  ]);
  const isCommandName = !normalizedInput.includes(' ');
  [
    ...COMMON_COMMANDS.map((command) => ({
      command,
      description: undefined as string | undefined,
    })),
    ...scripts,
    ...(isCommandName
      ? installedCommands.map((command) => ({
          command,
          description: 'Installed command',
        }))
      : []),
  ]
    .filter(({ command }) => command.toLowerCase().startsWith(normalizedInput))
    .filter(
      ({ command }, index, commands) =>
        commands.findIndex((item) => item.command === command) === index,
    )
    .slice(0, 8)
    .forEach(({ command, description }) => {
      suggestions.push({
        id: `command:${command}`,
        label: command,
        value: command,
        type: 'command',
        description,
      });
    });

  const { tokenStart, token, quote } = pathQuery(input);
  if (token || input.endsWith(' ')) {
    const slashIndex = Math.max(
      token.lastIndexOf('/'),
      token.lastIndexOf('\\'),
    );
    const parentToken = slashIndex >= 0 ? token.slice(0, slashIndex + 1) : '';
    const namePrefix = slashIndex >= 0 ? token.slice(slashIndex + 1) : token;
    const parentPath = path.resolve(directory, parentToken || '.');
    try {
      const entries = await fs.promises.readdir(parentPath, {
        withFileTypes: true,
      });
      entries
        .filter((entry) =>
          entry.name.toLowerCase().startsWith(namePrefix.toLowerCase()),
        )
        .slice(0, 8)
        .forEach((entry) => {
          const suffix = entry.isDirectory() ? path.sep : '';
          const completedToken = `${parentToken}${entry.name}${suffix}`;
          const completedInput = `${input.slice(0, tokenStart)}${quote}${completedToken}`;
          suggestions.push({
            id: `path:${completedToken}`,
            label: completedToken,
            value: completedInput,
            type: entry.isDirectory() ? 'directory' : 'file',
            description: entry.isDirectory() ? 'Directory' : 'File',
          });
        });
    } catch {
      // An incomplete or inaccessible path simply has no suggestions.
    }
  }

  return suggestions.slice(0, 10);
}

ipcMain.on(
  'terminal-suggestions',
  async (
    event,
    sessionId: string,
    requestId: number,
    directory: string,
    input: string,
  ) => {
    try {
      const suggestions = await getSuggestions(directory, input);
      event.sender.send(
        'terminal-suggestions-result',
        sessionId,
        requestId,
        suggestions,
      );
    } catch (error) {
      log.warn(`Unable to create terminal suggestions: ${error}`);
      event.sender.send(
        'terminal-suggestions-result',
        sessionId,
        requestId,
        [],
      );
    }
  },
);

// Kept for the compact command input used by existing log views.
ipcMain.on('autocomplete', async (event, directory: string, input: string) => {
  try {
    const files = await fs.promises.readdir(path.resolve(directory));
    event.sender.send(
      'autocomplete-results',
      files.filter((file) => file.startsWith(input)),
      input,
    );
  } catch (error) {
    log.error(`Failed to autocomplete ${input}: ${error}`);
    event.sender.send('autocomplete-results', [], input);
  }
});
