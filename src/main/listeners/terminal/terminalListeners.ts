import { ipcMain, WebContents } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  AiAgentConfig,
  AiAgentId,
  aiAgentsDefault,
} from '../../../shared/aiAgents';
import log from '../../utils/logger';
import utils from '../../utils/utils';
import aiAgentDetectionService from '../../services/aiAgents/aiAgentDetectionService';
import aiAgentSessionManager from '../../services/aiAgents/AIAgentSessionManager';
import modelsDevService from '../../services/aiAgents/modelsDevService';
import shellDetectionService from '../../services/shells/shellDetectionService';

const pty = require('node-pty');

type TerminalSession = {
  process: any;
  ownerId: number;
  shell: string;
  directory: string;
  outputBuffer: string;
};

const sessions = new Map<string, TerminalSession>();
const registeredOwners = new Set<number>();
const MAX_TERMINAL_OUTPUT_BUFFER_CHARS = 30000;

function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  aiAgentSessionManager.closeSession(sessionId);
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
  async (
    event,
    sessionId: string,
    directory: string,
    cols = 80,
    rows = 24,
    isDarkMode = false,
  ) => {
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
          COLORFGBG: isDarkMode ? '15;0' : '0;15',
          TERM_THEME: isDarkMode ? 'dark' : 'light',
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      let termExited = false;
      const rawTermResize = terminalProcess.resize?.bind(terminalProcess);
      if (rawTermResize) {
        terminalProcess.resize = (c: number, r: number) => {
          if (termExited) return;
          const agent = (terminalProcess as any)._agent;
          if (agent && agent._exitCode !== undefined) return;
          try {
            rawTermResize(c, r);
            if (Array.isArray((terminalProcess as any)._deferreds)) {
              (terminalProcess as any)._deferreds = (
                terminalProcess as any
              )._deferreds.map((d: any) => {
                if (d.__safeWrapped) return d;
                const origRun = d.run;
                return {
                  __safeWrapped: true,
                  run: () => {
                    try {
                      if (
                        !termExited &&
                        (!agent || agent._exitCode === undefined)
                      ) {
                        return origRun();
                      }
                    } catch (deferredErr: any) {
                      log.warn(
                        `Suppressed deferred terminal resize error: ${deferredErr?.message}`,
                      );
                    }
                  },
                };
              });
            }
          } catch (err: any) {
            log.warn(`Suppressed terminal resize error: ${err?.message}`);
          }
        };
      }

      sessions.set(sessionId, {
        process: terminalProcess,
        ownerId: event.sender.id,
        shell,
        directory,
        outputBuffer: '',
      });

      aiAgentSessionManager.setBinding(
        sessionId,
        directory,
        'claude',
        'terminal',
        event.sender,
      );

      terminalProcess.onData((data: string) => {
        const terminalSession = sessions.get(sessionId);
        if (terminalSession) {
          terminalSession.outputBuffer = (
            terminalSession.outputBuffer + data
          ).slice(-MAX_TERMINAL_OUTPUT_BUFFER_CHARS);
        }
        if (!event.sender.isDestroyed()) {
          const binding = aiAgentSessionManager.getBinding(sessionId);
          if (!binding || binding.mode === 'terminal') {
            event.sender.send('terminal-data', sessionId, data);
          }
        }
      });
      terminalProcess.onExit(({ exitCode }: { exitCode: number }) => {
        termExited = true;
        if (Array.isArray((terminalProcess as any)._deferreds)) {
          (terminalProcess as any)._deferreds = [];
        }
        sessions.delete(sessionId);
        if (!event.sender.isDestroyed()) {
          const binding = aiAgentSessionManager.getBinding(sessionId);
          if (!binding || binding.mode === 'terminal') {
            event.sender.send('terminal-exit', sessionId, exitCode);
          }
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

ipcMain.on(
  'terminal-input',
  (event, sessionId: string, data: string, smartContextEnabled?: boolean) => {
    const binding = aiAgentSessionManager.getBinding(sessionId);
    if (binding && binding.mode === 'agent') {
      if (typeof smartContextEnabled === 'boolean') {
        aiAgentSessionManager.setSmartContext(sessionId, smartContextEnabled);
      }
      aiAgentSessionManager.handleInput(sessionId, data);
    } else {
      ownedSession(sessionId, event.sender.id)?.process.write(data);
    }
  },
);

async function configuredAiAgents(): Promise<AiAgentConfig[]> {
  const stored = await utils.getStorageItem('aiAgents');
  if (!stored) return aiAgentsDefault;
  try {
    const configured = JSON.parse(stored) as AiAgentConfig[];
    return aiAgentsDefault.map((defaultAgent) => {
      const match = configured.find((agent) => agent.id === defaultAgent.id);
      let cmd = match?.command ?? defaultAgent.command;
      const lower = cmd.toLowerCase().trim();
      if (
        defaultAgent.id === 'cursor' &&
        (lower.includes('resources\\app\\bin\\cursor') ||
          lower.includes('resources/app/bin/cursor') ||
          lower === 'cursor' ||
          lower === 'cursor.exe' ||
          lower === 'cursor.cmd')
      ) {
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
      if (
        defaultAgent.id === 'antigravity' &&
        (lower.includes('programs\\antigravity ide') ||
          lower.includes('programs/antigravity ide') ||
          lower === 'antigravity' ||
          lower === 'antigravity.exe' ||
          lower === 'antigravity.cmd' ||
          lower === 'antigravity-ide' ||
          lower === 'antigravity-ide.exe' ||
          lower === 'antigravity-ide.cmd')
      ) {
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
  'terminal-switch-mode',
  async (
    event,
    sessionId: string,
    mode: 'terminal' | 'agent',
    agentId?: AiAgentId,
    worktreePath?: string,
    cols = 80,
    rows = 24,
    isDarkMode = false,
    model?: string,
    reasoningEffort?: string,
    launchOptionIds?: string[],
  ) => {
    const session = ownedSession(sessionId, event.sender.id);
    const targetPath = worktreePath || session?.directory || '';

    const binding = aiAgentSessionManager.getBinding(sessionId);
    const targetAgentId = agentId || binding?.activeAgentId || 'claude';

    aiAgentSessionManager.setBinding(
      sessionId,
      targetPath,
      targetAgentId,
      mode,
      event.sender,
    );

    if (mode === 'agent') {
      try {
        const agents = await configuredAiAgents();
        const agent = agents.find(
          (candidate) => candidate.id === targetAgentId,
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

        aiAgentSessionManager.switchActiveAgent(
          sessionId,
          targetPath,
          agent,
          cols,
          rows,
          isDarkMode,
          event.sender,
          model,
          reasoningEffort,
          launchOptionIds,
        );
      } catch (error: any) {
        log.error(
          `Failed switching to AI agent ${targetAgentId} on session ${sessionId}: ${error.message}`,
        );
        event.sender.send(
          'terminal-ai-agent-error',
          sessionId,
          error.message || 'Unable to start the AI agent.',
        );
      }
    } else if (session) {
      event.sender.send(
        'terminal-shell-rehydrate',
        sessionId,
        session.outputBuffer,
      );
    } else {
      event.sender.send('terminal-shell-needs-create', sessionId);
    }
  },
);

ipcMain.on(
  'terminal-switch-ai-agent',
  async (
    event,
    sessionId: string,
    newAgentId: string,
    worktreePath?: string,
    cols = 80,
    rows = 24,
    isDarkMode = false,
    model?: string,
    reasoningEffort?: string,
    launchOptionIds?: string[],
  ) => {
    const session = ownedSession(sessionId, event.sender.id);
    const targetPath = worktreePath || session?.directory || '';
    try {
      const agents = await configuredAiAgents();
      const agent = agents.find((candidate) => candidate.id === newAgentId);
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

      aiAgentSessionManager.switchActiveAgent(
        sessionId,
        targetPath,
        agent,
        cols,
        rows,
        isDarkMode,
        event.sender,
        model,
        reasoningEffort,
        launchOptionIds,
      );
    } catch (error: any) {
      log.error(`Failed to switch agent on ${sessionId}: ${error.message}`);
      event.sender.send(
        'terminal-ai-agent-error',
        sessionId,
        error.message || 'Unable to switch agent.',
      );
    }
  },
);

ipcMain.on(
  'terminal-switch-ai-agent-model',
  async (
    event,
    sessionId: string,
    agentId: string,
    model: string,
    worktreePath?: string,
    cols = 80,
    rows = 24,
    isDarkMode = false,
    reasoningEffort?: string,
    launchOptionIds?: string[],
  ) => {
    const session = ownedSession(sessionId, event.sender.id);
    const targetPath = worktreePath || session?.directory || '';
    try {
      const agents = await configuredAiAgents();
      const agent = agents.find((candidate) => candidate.id === agentId);
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

      aiAgentSessionManager.switchActiveAgent(
        sessionId,
        targetPath,
        agent,
        cols,
        rows,
        isDarkMode,
        event.sender,
        model,
        reasoningEffort,
        launchOptionIds,
      );
    } catch (error: any) {
      log.error(
        `Failed to switch agent model on ${sessionId}: ${error.message}`,
      );
      event.sender.send(
        'terminal-ai-agent-error',
        sessionId,
        error.message || 'Unable to switch agent model.',
      );
    }
  },
);

ipcMain.on(
  'terminal-stop-ai-agent',
  async (
    event,
    sessionId: string,
    worktreePath?: string,
    agentId?: AiAgentId,
  ) => {
    const session = ownedSession(sessionId, event.sender.id);
    const targetPath = worktreePath || session?.directory || '';
    try {
      aiAgentSessionManager.stopAgent(sessionId, targetPath, agentId);
    } catch (error: any) {
      log.error(
        `Failed to interrupt AI agent on ${sessionId}: ${error.message}`,
      );
    }
  },
);

ipcMain.on(
  'terminal-set-smart-context',
  (event, sessionId: string, enabled: boolean) => {
    const binding = aiAgentSessionManager.getBinding(sessionId);
    if (!binding || binding.sender.id !== event.sender.id) return;
    aiAgentSessionManager.setSmartContext(sessionId, enabled);
  },
);

ipcMain.on('test-ai-agent', async (event, agent: AiAgentConfig) => {
  try {
    if (!agent.command?.trim())
      throw new Error('Enter an executable command first.');
    const cmd = agent.command.trim();
    const isWindows = process.platform === 'win32';
    let cmdToRun =
      isWindows && cmd.includes(' ') && !cmd.startsWith('"') ? `"${cmd}"` : cmd;

    // Resolve bare command names on non-Windows using augmented search paths
    if (!isWindows && !cmdToRun.includes(path.sep)) {
      const searchDirs = aiAgentDetectionService.getSearchDirectories();
      for (const dir of searchDirs) {
        const fullPath = path.join(dir, cmdToRun);
        if (fs.existsSync(fullPath)) {
          cmdToRun = fullPath;
          break;
        }
      }
    }

    const cleanEnv = aiAgentDetectionService.getAugmentedEnv();

    const child = require('child_process').spawn(cmdToRun, ['--version'], {
      shell: isWindows,
      windowsHide: true,
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: os.homedir(),
      env: cleanEnv,
    });
    let output = '';
    let stderrOutput = '';
    let settled = false;
    const sendResult = (code: number, message: string) => {
      if (settled) return;
      settled = true;
      event.sender.send('ai-agent-tested', agent.id, code, message);
    };
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });
    child.on('error', (error: Error) => {
      sendResult(-1, error.message);
    });
    child.on('close', (code: number | null, signal: string | null) => {
      const trimmedOut = output.trim();
      const trimmedErr = stderrOutput.trim();
      const combined = [trimmedOut, trimmedErr].filter(Boolean).join('\n');

      const firstLine = (trimmedOut.split('\n')[0] || '').trim();
      const looksLikeVersion = /\d+\.\d+/.test(firstLine);

      if (
        code === 0 ||
        (looksLikeVersion && !trimmedErr.toLowerCase().includes('error'))
      ) {
        sendResult(0, firstLine || combined || 'Verified OK');
        return;
      }

      if (child.killed || signal === 'SIGTERM') {
        sendResult(
          -1,
          'Command timed out after 15s. The agent took too long to respond.',
        );
        return;
      }

      if (code === null) {
        sendResult(
          -1,
          signal
            ? `Terminated by signal ${signal}`
            : 'Process terminated unexpectedly',
        );
        return;
      }

      sendResult(-1, combined || `Exited with code ${code}`);
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
      aiAgentSessionManager.resize(sessionId, cols, rows);
      const session = ownedSession(sessionId, event.sender.id);
      if (session?.process) {
        const agent = (session.process as any)._agent;
        if (!agent || agent._exitCode === undefined) {
          session.process.resize(cols, rows);
        }
      }
    } catch (error: any) {
      log.warn(
        `Unable to resize terminal ${sessionId}: ${error?.message || error}`,
      );
    }
  },
);

ipcMain.on('terminal-close', (event, sessionId: string) => {
  if (ownedSession(sessionId, event.sender.id)) closeSession(sessionId);
});

ipcMain.handle('ai-agents:detect-all', async () => {
  return aiAgentDetectionService.detectAllAiAgents();
});

ipcMain.handle(
  'ai-agents:detect-one',
  async (_event, agentId: AiAgentId, customCommand?: string) => {
    return aiAgentDetectionService.detectAiAgent(agentId, customCommand);
  },
);

ipcMain.handle(
  'ai-agents:maintain',
  async (_event, agentId: AiAgentId, repair = false) => {
    if (!aiAgentsDefault.some((agent) => agent.id === agentId)) {
      return { ok: false, message: 'Unknown AI agent.' };
    }
    return aiAgentDetectionService.maintainAiAgent(agentId, repair === true);
  },
);

ipcMain.handle(
  'ai-agents:get-models',
  async (_event, agentId: AiAgentId, customCommand?: string) => {
    return modelsDevService.getModelsForAgent(agentId, customCommand);
  },
);

ipcMain.handle('shells:detect-all', async () => {
  return shellDetectionService.detectAllShells();
});

ipcMain.handle('shells:get-active', async () => {
  return shellDetectionService.getDefaultOrActiveShell();
});
