import assert from 'node:assert';
import test, { describe, beforeEach, afterEach } from 'node:test';
import {
  AiAgentConfig,
  formatVersionBadge,
  getAgentModels,
  REASONING_EFFORT_OPTIONS,
  getReasoningEffortOptions,
  getReasoningEffortFlag,
  normalizeAgentModel,
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
import {
  modelsDevService,
  sortModelsNewestFirst,
} from '../../modelsDevService';

describe('AI Agent Adapters', () => {
  describe('getAgentAdapter factory', () => {
    test('retrieves adapter for each supported agent id', () => {
      assert.ok(getAgentAdapter('claude') instanceof ClaudeCodeAdapter);
      assert.ok(getAgentAdapter('codex') instanceof CodexAdapter);
      assert.ok(getAgentAdapter('cursor') instanceof CursorCliAdapter);
      assert.ok(
        getAgentAdapter('antigravity') instanceof AntigravityCliAdapter,
      );
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
        "SyntaxError: Invalid flags supplied to RegExp constructor 'v'\n",
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

  test('formatVersionBadge extracts clean version tag', () => {
    assert.strictEqual(formatVersionBadge('2.1.268 (Claude Code)'), 'v2.1.268');
    assert.strictEqual(formatVersionBadge('0.23.0'), 'v0.23.0');
    assert.strictEqual(formatVersionBadge('v1.5.0'), 'v1.5.0');
    assert.strictEqual(formatVersionBadge('codex-cli 0.153.4'), 'v0.153.4');
    assert.strictEqual(formatVersionBadge(''), null);
    assert.strictEqual(formatVersionBadge(null), null);
    assert.strictEqual(formatVersionBadge(undefined), null);
  });

  test('getAgentModels returns valid model catalogs for supported agents', () => {
    const claudeModels = getAgentModels('claude');
    assert.ok(claudeModels.length > 3);
    assert.strictEqual(claudeModels[0].id, '');
    assert.strictEqual(claudeModels[0].label, 'Default');
    assert.ok(claudeModels.some((m) => m.id === 'sonnet'));

    const codexModels = getAgentModels('codex');
    assert.ok(codexModels.some((m) => m.id === 'o3-mini'));

    const cursorModels = getAgentModels('cursor');
    assert.ok(cursorModels.some((m) => m.id === 'auto'));

    const agyModels = getAgentModels('antigravity');
    assert.ok(agyModels.some((m) => m.id === 'gemini-3.8-flash'));

    const qwenModels = getAgentModels('qwen');
    assert.ok(qwenModels.some((m) => m.id === 'qwen-2.5-coder-32b'));

    const kimiModels = getAgentModels('kimi');
    assert.ok(kimiModels.some((m) => m.id === 'moonshot-v1-128k'));

    const opencodeModels = getAgentModels('opencode');
    assert.deepStrictEqual(opencodeModels, [{ id: '', label: 'Default' }]);
  });

  test('migrates retired Claude model IDs to stable CLI aliases', () => {
    assert.strictEqual(
      normalizeAgentModel('claude', 'claude-3-5-haiku-latest'),
      'haiku',
    );
    assert.strictEqual(normalizeAgentModel('claude', 'sonnet'), 'sonnet');
    assert.strictEqual(normalizeAgentModel('codex', 'gpt-4o'), 'gpt-4o');
    assert.strictEqual(
      normalizeAgentModel('cursor', 'claude-3.5-sonnet'),
      'auto',
    );
    assert.strictEqual(
      normalizeAgentModel('opencode', 'deepseek-chat'),
      'deepseek/deepseek-chat',
    );
  });

  test('REASONING_EFFORT_OPTIONS has valid effort levels', () => {
    assert.strictEqual(REASONING_EFFORT_OPTIONS[0].id, '');
    assert.ok(REASONING_EFFORT_OPTIONS.some((o) => o.id === 'low'));
    assert.ok(REASONING_EFFORT_OPTIONS.some((o) => o.id === 'medium'));
    assert.ok(REASONING_EFFORT_OPTIONS.some((o) => o.id === 'high'));
  });

  test('getReasoningEffortFlag resolves agent-specific effort flags', () => {
    // Claude Code uses --effort
    assert.deepStrictEqual(getReasoningEffortFlag('claude', 'low'), {
      flag: '--effort',
      value: 'low',
    });
    assert.deepStrictEqual(getReasoningEffortFlag('claude', 'high'), {
      flag: '--effort',
      value: 'high',
    });

    // Codex CLI uses --reasoning-effort
    assert.deepStrictEqual(getReasoningEffortFlag('codex', 'medium'), {
      flag: '-c',
      value: 'model_reasoning_effort=medium',
    });
    // Codex maps xhigh to high
    assert.deepStrictEqual(getReasoningEffortFlag('codex', 'xhigh'), {
      flag: '-c',
      value: 'model_reasoning_effort=high',
    });

    // Antigravity CLI uses --effort and accepts low/medium/high only
    assert.deepStrictEqual(getReasoningEffortFlag('antigravity', 'high'), {
      flag: '--effort',
      value: 'high',
    });
    assert.deepStrictEqual(
      getReasoningEffortOptions('antigravity').map(({ id }) => id),
      ['low', 'medium', 'high'],
    );
    assert.deepStrictEqual(getReasoningEffortOptions('cursor'), []);
    assert.deepStrictEqual(getReasoningEffortOptions('opencode'), []);
    assert.strictEqual(getReasoningEffortFlag('cursor', 'high'), null);

    // Empty effort returns null
    assert.strictEqual(getReasoningEffortFlag('claude', ''), null);
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
    manager.setBinding('pane-1', '/repo/main', 'claude', 'agent', mockSender);

    const binding = manager.getBinding('pane-1');
    assert.ok(binding);
    assert.strictEqual(binding?.mode, 'agent');
    assert.strictEqual(binding?.activeAgentId, 'claude');
    assert.strictEqual(binding?.worktreePath, '/repo/main');
  });

  test('closes session binding', () => {
    manager.setBinding('pane-1', '/repo/main', 'claude', 'agent', mockSender);
    assert.ok(manager.getBinding('pane-1'));

    manager.closeSession('pane-1');
    assert.strictEqual(manager.getBinding('pane-1'), undefined);
  });
});

describe('ModelsDevService', () => {
  test('orders catalog models by newest release first', () => {
    const models = sortModelsNewestFirst([
      { id: 'older', label: 'Older', releaseDate: '2025-01-01' },
      { id: 'newest', label: 'Newest', releaseDate: '2026-05-01' },
      { id: 'middle', label: 'Middle', releaseDate: '2025-12-01' },
    ]);
    assert.deepStrictEqual(
      models.map((model) => model.id),
      ['newest', 'middle', 'older'],
    );
  });

  test('returns fallback base models if catalog is empty or fails', async () => {
    const models = await modelsDevService.getModelsForAgent('claude');
    assert.ok(Array.isArray(models));
    assert.ok(models.length > 0);
    assert.ok(models.some((m) => m.id === 'sonnet'));
  });

  test('contains dynamic models when catalog is fetched or cached', async () => {
    const codexModels = await modelsDevService.getModelsForAgent('codex');
    assert.ok(Array.isArray(codexModels));
    assert.ok(codexModels.some((m) => m.id === 'o3-mini'));
  });
});
