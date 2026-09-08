import assert from 'node:assert';
import test, { describe, beforeEach, afterEach } from 'node:test';
import {
  AiAgentConfig,
} from '../../../../../shared/aiAgents';
import {
  ClaudeCodeAdapter,
  CodexAdapter,
  CursorCliAdapter,
  AntigravityCliAdapter,
  QwenCodeAdapter,
  KimiCodeAdapter,
  OpenCodeAdapter,
  getAgentAdapter,
} from '../index';
import { AIAgentSessionManager } from '../../AIAgentSessionManager';
import {
  parseCleanVersion,
  getAugmentedEnv,
} from '../../aiAgentDetectionService';

describe('AI Agent Adapters', () => {
  describe('getAgentAdapter factory', () => {
    test('retrieves adapter for each supported agent id', () => {
      assert.ok(getAgentAdapter('claude') instanceof ClaudeCodeAdapter);
      assert.ok(getAgentAdapter('codex') instanceof CodexAdapter);
      assert.ok(getAgentAdapter('cursor') instanceof CursorCliAdapter);
      assert.ok(getAgentAdapter('antigravity') instanceof AntigravityCliAdapter);
      assert.ok(getAgentAdapter('qwen') instanceof QwenCodeAdapter);
      assert.ok(getAgentAdapter('kimi') instanceof KimiCodeAdapter);
      assert.ok(getAgentAdapter('opencode') instanceof OpenCodeAdapter);
    });
  });
});

describe('AI Agent Detection & Version Parsing', () => {
  test('parses valid version output from various agents', () => {
    assert.strictEqual(parseCleanVersion('0.23.0\n', '', 0), '0.23.0');
    assert.strictEqual(
      parseCleanVersion('codex-cli 0.153.4\n', '', 0),
      'codex-cli 0.153.4',
    );
    assert.strictEqual(
      parseCleanVersion('2.1.263 (Claude Code)\n', '', 0),
      '2.1.263 (Claude Code)',
    );
    assert.strictEqual(parseCleanVersion('v1.1.27\n', '', 0), 'v1.1.27');
  });

  test('rejects Node.js crash stack traces and errors from being parsed as versions', () => {
    // Kimi Code crash on Node 18
    assert.strictEqual(
      parseCleanVersion(
        '',
        'file:///usr/local/lib/node_modules/@moonshot-ai/kimi-code/dist/main.mjs:340989\nSyntaxError: Invalid regular expression flags',
        1,
      ),
      null,
    );

    // Qwen Code crash with SyntaxError
    assert.strictEqual(
      parseCleanVersion(
        'SyntaxError: Invalid flags supplied to RegExp constructor \'v\'\n',
        '',
        1,
      ),
      null,
    );

    // Command not found error
    assert.strictEqual(
      parseCleanVersion('kimi: command not found\n', '', 127),
      null,
    );
  });

  test('getAugmentedEnv returns clean env without Electron internal vars and preserves PATH', () => {
    const env = getAugmentedEnv();
    assert.strictEqual(env.ELECTRON_RUN_AS_NODE, undefined);
    assert.strictEqual(env.NODE_OPTIONS, undefined);
    const pathValue = env.PATH || env.Path;
    assert.ok(pathValue && pathValue.length > 0);
  });
});

describe('AIAgentSessionManager', () => {
  let manager: AIAgentSessionManager;
  let mockSender: any;
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
  });

  afterEach(() => {
    manager.disposeAll();
  });

  test('sets and gets terminal bindings', () => {
    manager.setBinding(
      'pane-1',
      '/repo/main',
      'claude',
      'agent',
      mockSender,
    );

    const binding = manager.getBinding('pane-1');
    assert.ok(binding);
    assert.strictEqual(binding?.mode, 'agent');
    assert.strictEqual(binding?.activeAgentId, 'claude');
    assert.strictEqual(binding?.worktreePath, '/repo/main');
  });

  test('closes session binding', () => {
    manager.setBinding(
      'pane-1',
      '/repo/main',
      'claude',
      'agent',
      mockSender,
    );
    assert.ok(manager.getBinding('pane-1'));

    manager.closeSession('pane-1');
    assert.strictEqual(manager.getBinding('pane-1'), undefined);
  });
});
