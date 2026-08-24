import assert from 'node:assert';
import test, { describe, beforeEach, afterEach } from 'node:test';
import {
  AgentAttachment,
  AiAgentConfig,
} from '../../../../../shared/aiAgents';
import {
  ClaudeCodeAdapter,
  CodexAdapter,
  CursorCliAdapter,
  AntigravityCliAdapter,
  getAgentAdapter,
} from '../index';
import { AIAgentSessionManager } from '../../AIAgentSessionManager';

describe('AI Agent Adapters', () => {
  describe('ClaudeCodeAdapter', () => {
    const adapter = new ClaudeCodeAdapter();

    test('builds command with prompt in POSIX shell', () => {
      const config: AiAgentConfig = {
        id: 'claude',
        label: 'Claude Code',
        command: 'claude',
        args: '--verbose',
        enabled: true,
      };
      const cmd = adapter.buildCommand('/bin/bash', config, 'Fix bug in auth', []);
      assert.strictEqual(cmd, "claude --verbose 'Fix bug in auth'");
    });

    test('builds command with prompt and attachments using @ notation', () => {
      const config: AiAgentConfig = {
        id: 'claude',
        label: 'Claude Code',
        command: 'claude',
        args: '',
        enabled: true,
      };
      const attachments: AgentAttachment[] = [
        {
          id: 'att-1',
          name: 'screenshot.png',
          path: 'C:\\Users\\test\\screenshot.png',
        },
      ];
      const cmd = adapter.buildCommand('/bin/bash', config, 'Inspect this', attachments);
      assert.ok(cmd.includes('@C:/Users/test/screenshot.png'));
    });

    test('handles Windows PowerShell escaping', () => {
      const config: AiAgentConfig = {
        id: 'claude',
        label: 'Claude Code',
        command: 'C:\\Program Files\\Claude\\claude.exe',
        args: '',
        enabled: true,
      };
      const cmd = adapter.buildCommand('powershell.exe', config, "don't fail", []);
      assert.ok(cmd.includes("& 'C:/Program Files/Claude/claude.exe'"));
      assert.ok(cmd.includes("'don''t fail'"));
    });

    test('detects completion signals', () => {
      assert.strictEqual(adapter.isCompletionSignal('PS C:\\project> '), true);
      assert.strictEqual(adapter.isCompletionSignal('user@host:~/repo$ '), true);
      assert.strictEqual(adapter.isCompletionSignal('Claude finished.\n> '), true);
      assert.strictEqual(adapter.isCompletionSignal('Working on step 1...'), false);
    });
  });

  describe('CodexAdapter', () => {
    const adapter = new CodexAdapter();

    test('builds command with formatted prompt and attachments', () => {
      const config: AiAgentConfig = {
        id: 'codex',
        label: 'Codex',
        command: 'codex',
        args: '',
        enabled: true,
      };
      const attachments: AgentAttachment[] = [
        { id: '1', name: 'logs.txt', path: '/var/log/app.log' },
      ];
      const cmd = adapter.buildCommand('/bin/bash', config, 'Analyze logs', attachments);
      assert.ok(cmd.includes('codex'));
      assert.ok(cmd.includes('/var/log/app.log'));
    });

    test('detects completion signals', () => {
      assert.strictEqual(adapter.isCompletionSignal('PS C:\\work> '), true);
      assert.strictEqual(adapter.isCompletionSignal('Codex finished.'), true);
      assert.strictEqual(adapter.isCompletionSignal('codex > '), true);
    });
  });

  describe('CursorCliAdapter', () => {
    const adapter = new CursorCliAdapter();

    test('builds command with arguments and prompt', () => {
      const config: AiAgentConfig = {
        id: 'cursor',
        label: 'Cursor CLI',
        command: 'cursor-agent',
        args: '--model gpt-4o',
        enabled: true,
      };
      const cmd = adapter.buildCommand('cmd.exe', config, 'Refactor utils', []);
      assert.ok(cmd.includes('cursor-agent --model gpt-4o'));
      assert.ok(cmd.includes('"Refactor utils"'));
    });

    test('detects completion signals', () => {
      assert.strictEqual(adapter.isCompletionSignal('C:\\Users\\admin> '), true);
      assert.strictEqual(adapter.isCompletionSignal('cursor > '), true);
    });
  });

  describe('AntigravityCliAdapter', () => {
    const adapter = new AntigravityCliAdapter();

    test('builds command with -i interactive prompt flag', () => {
      const config: AiAgentConfig = {
        id: 'antigravity',
        label: 'Antigravity CLI',
        command: 'agy',
        args: '',
        enabled: true,
      };
      const cmd = adapter.buildCommand('/bin/zsh', config, 'Build feature', []);
      assert.strictEqual(cmd, "agy -i 'Build feature'");
    });

    test('detects completion signals', () => {
      assert.strictEqual(adapter.isCompletionSignal('PS C:\\agy> '), true);
      assert.strictEqual(adapter.isCompletionSignal('agy > '), true);
    });
  });

  describe('getAgentAdapter factory', () => {
    test('retrieves adapter for each supported agent id', () => {
      assert.ok(getAgentAdapter('claude') instanceof ClaudeCodeAdapter);
      assert.ok(getAgentAdapter('codex') instanceof CodexAdapter);
      assert.ok(getAgentAdapter('cursor') instanceof CursorCliAdapter);
      assert.ok(getAgentAdapter('antigravity') instanceof AntigravityCliAdapter);
    });
  });
});

describe('AIAgentSessionManager', () => {
  let manager: AIAgentSessionManager;
  let mockSender: any;
  let mockPty: any;
  let sentEvents: Array<{ channel: string; args: any[] }>;

  beforeEach(() => {
    manager = new AIAgentSessionManager();
    sentEvents = [];
    mockSender = {
      isDestroyed: () => false,
      send: (channel: string, ...args: any[]) => {
        sentEvents.push({ channel, args });
      },
    };
    mockPty = {
      pid: 12345,
      written: [] as string[],
      write: (data: string) => {
        mockPty.written.push(data);
      },
    };
  });

  afterEach(() => {
    manager.closeSession('panel-1');
    manager.closeSession('panel-2');
    manager.closeSession('panel-3');
    manager.closeSession('panel-4');
    manager.closeSession('panel-A');
    manager.closeSession('panel-B');
  });

  test('creates session and manages state transitions', async () => {
    const config: AiAgentConfig = {
      id: 'claude',
      label: 'Claude Code',
      command: 'claude',
      args: '',
      enabled: true,
    };

    await manager.startAgent(
      'panel-1',
      config,
      'Hello Claude',
      [],
      mockPty,
      mockSender,
      '/bin/bash',
    );

    const session = manager.getSession('panel-1');
    assert.ok(session !== undefined);
    assert.strictEqual(session?.agentId, 'claude');

    // Verify clear line was written
    assert.ok(mockPty.written.includes('\x03'));

    // Wait for the start timeout
    await new Promise((resolve) => setTimeout(resolve, 100));

    const stateEvent = sentEvents.find(
      (e) =>
        e.channel === 'terminal-ai-agent-state-changed' &&
        e.args[0].sessionId === 'panel-1' &&
        e.args[0].state === 'working',
    );
    assert.ok(stateEvent !== undefined);
  });

  test('interrupts agent and transitions state to stopping', async () => {
    const config: AiAgentConfig = {
      id: 'codex',
      label: 'Codex',
      command: 'codex',
      args: '',
      enabled: true,
    };

    await manager.startAgent(
      'panel-2',
      config,
      'Long running task',
      [],
      mockPty,
      mockSender,
      '/bin/bash',
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    await manager.interruptAgent('panel-2');

    const stoppingEvent = sentEvents.find(
      (e) =>
        e.channel === 'terminal-ai-agent-state-changed' &&
        e.args[0].sessionId === 'panel-2' &&
        e.args[0].state === 'stopping',
    );
    assert.ok(stoppingEvent !== undefined);
    assert.ok(mockPty.written.includes('\x03'));
  });

  test('switches agent without destroying session or clearing PTY', () => {
    const codexConfig: AiAgentConfig = {
      id: 'codex',
      label: 'Codex',
      command: 'codex',
      args: '',
      enabled: true,
    };

    manager.getOrCreateSession('panel-3', 'claude', mockPty, mockSender);
    manager.switchAgent('panel-3', codexConfig, mockPty, mockSender);

    const session = manager.getSession('panel-3');
    assert.strictEqual(session?.agentId, 'codex');
    assert.strictEqual(session?.state, 'idle');
    assert.ok(
      mockPty.written.some((w: string) => w.includes('Switched to Codex')),
    );
  });

  test('handles output completion detection', () => {
    const session = manager.getOrCreateSession(
      'panel-4',
      'claude',
      mockPty,
      mockSender,
    );
    session.state = 'working';

    manager.handleData('panel-4', 'Working...\nDone!\nPS C:\\repo> ');

    assert.strictEqual(session.state, 'idle');
    const idleEvent = sentEvents.find(
      (e) =>
        e.channel === 'terminal-ai-agent-state-changed' &&
        e.args[0].sessionId === 'panel-4' &&
        e.args[0].state === 'idle',
    );
    assert.ok(idleEvent !== undefined);
  });

  test('isolates sessions between different panels', async () => {
    const ptyA = { pid: 111, written: [] as string[], write: (d: string) => ptyA.written.push(d) };
    const ptyB = { pid: 222, written: [] as string[], write: (d: string) => ptyB.written.push(d) };

    const claudeConfig: AiAgentConfig = {
      id: 'claude',
      label: 'Claude Code',
      command: 'claude',
      args: '',
      enabled: true,
    };
    const codexConfig: AiAgentConfig = {
      id: 'codex',
      label: 'Codex',
      command: 'codex',
      args: '',
      enabled: true,
    };

    await manager.startAgent(
      'panel-A',
      claudeConfig,
      'Task A',
      [],
      ptyA,
      mockSender,
      '/bin/bash',
    );
    await manager.startAgent(
      'panel-B',
      codexConfig,
      'Task B',
      [],
      ptyB,
      mockSender,
      '/bin/bash',
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Interrupt panel A only
    await manager.interruptAgent('panel-A');

    const sessionA = manager.getSession('panel-A');
    const sessionB = manager.getSession('panel-B');

    assert.strictEqual(sessionA?.state, 'stopping');
    assert.strictEqual(sessionB?.state, 'working');
  });
});
