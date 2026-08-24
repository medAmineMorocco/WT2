import { exec } from 'child_process';
import { WebContents } from 'electron';
import {
  AgentAttachment,
  AgentExecutionState,
  AiAgentConfig,
  AiAgentId,
} from '../../../shared/aiAgents';
import log from '../../utils/logger';
import { AIAgentAdapter, getAgentAdapter } from './adapters';

export interface AgentPanelSession {
  sessionId: string;
  agentId: AiAgentId;
  state: AgentExecutionState;
  ptyProcess: any;
  sender: WebContents;
  generationId: number;
  stopTimeout: NodeJS.Timeout | null;
  outputTail: string;
}

export class AIAgentSessionManager {
  private sessions = new Map<string, AgentPanelSession>();

  getSession(sessionId: string): AgentPanelSession | undefined {
    return this.sessions.get(sessionId);
  }

  getOrCreateSession(
    sessionId: string,
    agentId: AiAgentId,
    ptyProcess: any,
    sender: WebContents,
  ): AgentPanelSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        agentId,
        state: 'idle',
        ptyProcess,
        sender,
        generationId: 0,
        stopTimeout: null,
        outputTail: '',
      };
      this.sessions.set(sessionId, session);
    } else {
      session.ptyProcess = ptyProcess;
      session.sender = sender;
      session.agentId = agentId;
    }
    return session;
  }

  private notifyState(
    session: AgentPanelSession,
    state: AgentExecutionState,
    message?: string,
  ) {
    session.state = state;
    if (state === 'idle' || state === 'error' || state === 'exited') {
      if (session.stopTimeout) {
        clearTimeout(session.stopTimeout);
        session.stopTimeout = null;
      }
    }

    if (!session.sender.isDestroyed()) {
      session.sender.send('terminal-ai-agent-state-changed', {
        sessionId: session.sessionId,
        agentId: session.agentId,
        state,
        message,
      });
    }
  }

  async startAgent(
    sessionId: string,
    agentConfig: AiAgentConfig,
    prompt: string,
    attachments: AgentAttachment[] = [],
    ptyProcess: any,
    sender: WebContents,
    shell: string,
  ): Promise<void> {
    const session = this.getOrCreateSession(
      sessionId,
      agentConfig.id,
      ptyProcess,
      sender,
    );

    if (session.state === 'working' || session.state === 'stopping') {
      log.warn(`Session ${sessionId} is already ${session.state}, cannot start.`);
      return;
    }

    const adapter = getAgentAdapter(agentConfig.id);
    const validation = adapter.validateAttachments(attachments);
    if (!validation.valid) {
      const errorMsg =
        validation.error ||
        `Attachments are not supported by ${adapter.label}.`;
      this.notifyState(session, 'error', errorMsg);
      throw new Error(errorMsg);
    }

    session.generationId += 1;
    const currentGeneration = session.generationId;
    session.agentId = agentConfig.id;
    session.outputTail = '';
    this.notifyState(session, 'starting');

    const command = adapter.buildCommand(
      shell,
      agentConfig,
      prompt,
      attachments,
    );

    // Gracefully clear line first then execute
    try {
      ptyProcess.write('\x03');
    } catch (err) {
      log.warn(`Failed writing clear signal to session ${sessionId}: ${err}`);
    }

    setTimeout(() => {
      if (session.generationId !== currentGeneration) return;
      try {
        ptyProcess.write(`${command}\r`);
        this.notifyState(session, 'working');
      } catch (err: any) {
        log.error(`Failed to write command for session ${sessionId}: ${err}`);
        this.notifyState(session, 'error', err?.message || 'Failed to start agent');
      }
    }, 60);
  }

  async interruptAgent(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.state !== 'working' && session.state !== 'starting') {
      return;
    }

    // Set state to stopping immediately to disable repeat clicks
    this.notifyState(session, 'stopping');

    const adapter = getAgentAdapter(session.agentId);
    const interruptSeq = adapter.getInterruptSequence();

    try {
      session.ptyProcess.write(interruptSeq);
      // Send secondary newline to ensure CLI returns to prompt
      setTimeout(() => {
        try {
          session.ptyProcess.write('\x03\r');
        } catch {}
      }, 100);
    } catch (err) {
      log.warn(`Error writing interrupt to session ${sessionId}: ${err}`);
    }

    // Set a safety timeout: if still not idle after 2.5s, safely kill child processes
    if (session.stopTimeout) clearTimeout(session.stopTimeout);

    session.stopTimeout = setTimeout(() => {
      if (session.state === 'stopping') {
        log.info(
          `Escalating interrupt to process tree cleanup for session ${sessionId}`,
        );
        this.killPtyChildProcesses(session.ptyProcess?.pid);
        this.notifyState(session, 'idle', 'Agent stopped.');
      }
    }, 2500);
  }

  switchAgent(
    sessionId: string,
    newAgentConfig: AiAgentConfig,
    ptyProcess: any,
    sender: WebContents,
  ): void {
    const session = this.getOrCreateSession(
      sessionId,
      newAgentConfig.id,
      ptyProcess,
      sender,
    );

    if (session.state === 'working' || session.state === 'stopping') {
      log.warn(
        `Cannot switch agent while session ${sessionId} is ${session.state}`,
      );
      return;
    }

    if (session.stopTimeout) {
      clearTimeout(session.stopTimeout);
      session.stopTimeout = null;
    }

    session.generationId += 1;
    session.agentId = newAgentConfig.id;
    session.outputTail = '';

    // Print a subtle switch banner into the terminal without clearing history
    try {
      ptyProcess.write(
        `\r\n\x1b[90m--- Switched to ${newAgentConfig.label} ---\x1b[0m\r\n`,
      );
    } catch {}

    this.notifyState(session, 'idle');
  }

  handleData(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.outputTail = `${session.outputTail}${data}`
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
      .slice(-600);

    const adapter = getAgentAdapter(session.agentId);

    if (session.state === 'working' || session.state === 'stopping') {
      if (adapter.isCompletionSignal(session.outputTail)) {
        const wasStopping = session.state === 'stopping';
        this.notifyState(
          session,
          'idle',
          wasStopping ? 'Agent stopped.' : 'Agent finished.',
        );
      }
    }
  }

  handleExit(sessionId: string, exitCode: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.notifyState(
      session,
      'exited',
      `Terminal exited with code ${exitCode}`,
    );
  }

  handleError(sessionId: string, errorMsg: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.notifyState(session, 'error', errorMsg);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.stopTimeout) {
      clearTimeout(session.stopTimeout);
      session.stopTimeout = null;
    }

    this.killPtyChildProcesses(session.ptyProcess?.pid);
    this.sessions.delete(sessionId);
  }

  private killPtyChildProcesses(pid?: number) {
    if (!pid || pid <= 0) return;

    try {
      if (process.platform === 'win32') {
        // Windows: taskkill /pid <pid> /T /F terminates the child tree
        exec(`taskkill /pid ${pid} /T /F`, (err) => {
          if (err) {
            log.warn?.(`Taskkill for pid ${pid} completed: ${err.message}`);
          }
        });
      } else {
        // POSIX: kill process group
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          try {
            process.kill(pid, 'SIGTERM');
          } catch {}
        }
      }
    } catch (error: any) {
      log.warn?.(`Failed killing child processes for pid ${pid}: ${error.message}`);
    }
  }
}

export const aiAgentSessionManager = new AIAgentSessionManager();
export default aiAgentSessionManager;
