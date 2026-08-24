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
