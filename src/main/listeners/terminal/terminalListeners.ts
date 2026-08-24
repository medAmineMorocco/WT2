import fs from 'fs';
import { ipcMain, WebContents } from 'electron';
import log from '../../utils/logger';
import utils from '../../utils/utils';
import {
  AiAgentConfig,
  AiAgentId,
  aiAgentsDefault,
} from '../../../shared/aiAgents';
import aiAgentDetectionService from '../../services/aiAgents/aiAgentDetectionService';
import shellDetectionService from '../../services/shells/shellDetectionService';

const pty = require('node-pty');

type TerminalSession = {
  process: any;
  ownerId: number;
  shell: string;
};

const sessions = new Map<string, TerminalSession>();
const registeredOwners = new Set<number>();

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
      const configuredShell = await utils.getStorageItem('shellPath');
      const shell = configuredShell || defaultShell();
      const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.ELECTRON_RUN_AS_NODE;
      delete cleanEnv.ELECTRON_NO_ASAR;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;
      delete cleanEnv.TS_NODE_COMPILER_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;

      const terminalProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: Math.max(2, cols),
        rows: Math.max(1, rows),
        cwd: directory,
        env: {
          ...cleanEnv,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      sessions.set(sessionId, {
        process: terminalProcess,
        ownerId: event.sender.id,
        shell,
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

function buildAgentCommand(
  shell: string,
  commandPath: string,
  args: string,
  prompt: string,
  agentId: string,
): string {
  const isPosixShell =
    /bash|sh|zsh|wsl/i.test(shell) || process.platform !== 'win32';
  const isPowerShell = /powershell|pwsh/i.test(shell);

  // Normalize path with forward slashes for cross-shell compatibility
  let normalizedPath = commandPath.trim().replace(/\\/g, '/');

  // In POSIX shells (like Git Bash on Windows), nodejs scripts (.cmd) have matching native shell scripts without .cmd
  if (isPosixShell && normalizedPath.toLowerCase().endsWith('.cmd')) {
    const withoutCmd = normalizedPath.slice(0, -4);
    if (fs.existsSync(withoutCmd)) {
      normalizedPath = withoutCmd;
    }
  }

  // Format prompt argument (Antigravity CLI uses -i flag for interactive prompts)
  let promptArg = '';
  if (prompt.trim()) {
    if (isPosixShell) {
      const escaped = prompt.trim().replace(/'/g, "'\\''");
      promptArg =
        agentId === 'antigravity' ? `-i '${escaped}'` : `'${escaped}'`;
    } else if (isPowerShell) {
      const escaped = prompt.trim().replace(/'/g, "''");
      promptArg =
        agentId === 'antigravity' ? `-i '${escaped}'` : `'${escaped}'`;
    } else {
      // CMD.exe
      const escaped = prompt.trim().replace(/"/g, '""');
      promptArg =
        agentId === 'antigravity' ? `-i "${escaped}"` : `"${escaped}"`;
    }
  }

  // Format command path for execution
  let formattedCmd = normalizedPath;
  if (isPosixShell) {
    formattedCmd = normalizedPath.includes(' ')
      ? `'${normalizedPath}'`
      : normalizedPath;
  } else if (isPowerShell) {
    formattedCmd = normalizedPath.includes(' ')
      ? `& '${normalizedPath}'`
      : normalizedPath;
  } else {
    // CMD
    formattedCmd = normalizedPath.includes(' ')
      ? `"${normalizedPath}"`
      : normalizedPath;
  }

  return [formattedCmd, args.trim(), promptArg].filter(Boolean).join(' ');
}

async function configuredAiAgents() {
  const stored = await utils.getStorageItem('aiAgents');
  if (!stored) return aiAgentsDefault;
  try {
    const configured = JSON.parse(stored) as AiAgentConfig[];
    return aiAgentsDefault.map((defaultAgent) => {
      const match = configured.find((agent) => agent.id === defaultAgent.id);
      let cmd = match?.command ?? defaultAgent.command;
      const lower = cmd.toLowerCase().trim();
      if (defaultAgent.id === 'cursor' && (lower.includes('resources\\app\\bin\\cursor') || lower.includes('resources/app/bin/cursor') || lower === 'cursor' || lower === 'cursor.exe' || lower === 'cursor.cmd')) {
        const lastSlash = Math.max(cmd.lastIndexOf('\\'), cmd.lastIndexOf('/'));
        if (lastSlash !== -1) {
          const dir = cmd.slice(0, lastSlash + 1);
          const file = cmd.slice(lastSlash + 1).toLowerCase();
          if (file.endsWith('.exe')) cmd = `${dir}cursor-agent.exe`;
          else if (file.endsWith('.cmd')) cmd = `${dir}cursor-agent.cmd`;
          else cmd = `${dir}cursor-agent`;
        } else {
          cmd = 'cursor-agent';
        }
      }
      if (defaultAgent.id === 'antigravity' && (lower.includes('programs\\antigravity ide') || lower.includes('programs/antigravity ide') || lower === 'antigravity' || lower === 'antigravity.exe' || lower === 'antigravity.cmd' || lower === 'antigravity-ide' || lower === 'antigravity-ide.exe' || lower === 'antigravity-ide.cmd')) {
        const lastSlash = Math.max(cmd.lastIndexOf('\\'), cmd.lastIndexOf('/'));
        if (lastSlash !== -1) {
          const dir = cmd.slice(0, lastSlash + 1);
          const file = cmd.slice(lastSlash + 1).toLowerCase();
          if (file.endsWith('.exe')) cmd = `${dir}agy.exe`;
          else if (file.endsWith('.cmd')) cmd = `${dir}agy.cmd`;
          else cmd = `${dir}agy`;
        } else {
          cmd = 'agy';
        }
      }
      return {
        ...defaultAgent,
        ...match,
        command: cmd,
      };
    });
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
      const command = buildAgentCommand(
        session.shell || defaultShell(),
        agent.command,
        agent.args,
        prompt,
        agent.id,
      );
      // Clear any partial text in the shell line before sending command
      session.process.write('\x03');
      setTimeout(() => {
        session.process.write(`${command}\r`);
      }, 50);
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
    const cmd = agent.command.trim();
    const isWindows = process.platform === 'win32';
    const cmdToRun =
      isWindows && cmd.includes(' ') && !cmd.startsWith('"') ? `"${cmd}"` : cmd;
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    delete cleanEnv.ELECTRON_NO_ASAR;
    delete cleanEnv.TS_NODE_TRANSPILE_ONLY;
    delete cleanEnv.TS_NODE_COMPILER_OPTIONS;
    delete cleanEnv.TS_NODE_PROJECT;

    const child = require('child_process').spawn(cmdToRun, ['--version'], {
      shell: isWindows,
      windowsHide: true,
      timeout: 5000,
      env: cleanEnv,
    });
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


ipcMain.handle('ai-agents:detect-all', async () => {
  return aiAgentDetectionService.detectAllAiAgents();
});

ipcMain.handle('ai-agents:detect-one', async (_event, agentId: AiAgentId) => {
  return aiAgentDetectionService.detectAiAgent(agentId);
});

ipcMain.handle('shells:detect-all', async () => {
  return shellDetectionService.detectAllShells();
});

ipcMain.handle('shells:get-active', async () => {
  return shellDetectionService.getDefaultOrActiveShell();
});

ipcMain.handle('shells:set-active', async (_event, shellPath: string) => {
  log.info('shellPath', shellPath);
  await utils.setStorageItem('shellPath', shellPath);
  return true;
});
