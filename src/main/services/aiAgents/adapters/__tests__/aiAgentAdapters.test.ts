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
