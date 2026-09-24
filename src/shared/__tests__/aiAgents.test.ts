import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  AiAgentId,
  aiAgentsDefault,
  detectPlatform,
  getAgentLaunchOptions,
  getInstallationGuide,
  normalizeAgentLaunchOptionIds,
  resolveAgentLaunchArgs,
} from '../aiAgents';

describe('aiAgents shared definitions', () => {
  test('detectPlatform returns a supported platform', () => {
    const platform = detectPlatform();
    assert.ok(['win32', 'darwin', 'linux'].includes(platform));
  });

  describe('getInstallationGuide suggestions', () => {
    test('Claude Code suggests npm install command', () => {
      const guide = getInstallationGuide('claude');
      assert.strictEqual(
        guide.command,
        'npm install -g @anthropic-ai/claude-code',
      );
      assert.ok(guide.url.startsWith('https://'));
      assert.strictEqual(guide.npmPackage, '@anthropic-ai/claude-code');
    });

    test('Codex suggests npm install command', () => {
      const guide = getInstallationGuide('codex');
      assert.strictEqual(guide.command, 'npm install -g @openai/codex');
      assert.ok(guide.url.startsWith('https://'));
    });

    test('Qwen Code suggests npm install command', () => {
      const guide = getInstallationGuide('qwen');
      assert.strictEqual(
        guide.command,
        'npm install -g @qwen-code/qwen-code@latest',
      );
      assert.ok(guide.url.startsWith('https://'));
    });

    test('Kimi Code suggests npm install command', () => {
      const guide = getInstallationGuide('kimi');
      assert.strictEqual(
        guide.command,
        'npm install -g @moonshot-ai/kimi-code',
      );
      assert.ok(guide.url.startsWith('https://'));
    });

    test('OpenCode suggests npm install command', () => {
      const guide = getInstallationGuide('opencode');
      assert.strictEqual(guide.command, 'npm install -g opencode-ai');
      assert.ok(guide.url.startsWith('https://'));
    });

    test('Cursor CLI does not suggest shell commands, only official installation URL', () => {
      const guide = getInstallationGuide('cursor');
      assert.strictEqual(guide.command, undefined);
      assert.ok(guide.url.includes('cursor.com'));
    });

    test('Antigravity CLI does not suggest shell commands, only official installation URL', () => {
      const guide = getInstallationGuide('antigravity');
      assert.strictEqual(guide.command, undefined);
      assert.ok(guide.url.includes('antigravity.google'));
    });
  });

  test('every configured agent only suggests npm install commands or points to docs', () => {
    const platforms = ['win32', 'darwin', 'linux'] as const;
    const allAgentIds = aiAgentsDefault.map((a) => a.id);

    for (const p of platforms) {
      for (const id of allAgentIds) {
        const guide = getInstallationGuide(id, p);
        assert.ok(guide, `Guide should exist for ${id} on ${p}`);
        if (guide.command) {
          assert.ok(
            guide.command.startsWith('npm install'),
            `Command for ${id} on ${p} should be an npm install command, got: ${guide.command}`,
          );
          assert.ok(
            guide.npmPackage,
            `An npm-managed agent should expose its validated package name: ${id}`,
          );
        }
        assert.ok(
          guide.url.startsWith('https://'),
          `URL should be https for ${id} on ${p}`,
        );
      }
    }
  });

  describe('agent launch options', () => {
    test('provides agent-specific interactive options', () => {
      assert.ok(
        getAgentLaunchOptions('codex').some(({ id }) => id === 'search'),
      );
      assert.ok(
        getAgentLaunchOptions('cursor').some(({ id }) => id === 'auto-review'),
      );
      assert.ok(
        !getAgentLaunchOptions('qwen').some(({ id }) => id === 'search'),
      );
    });

    test('drops unknown option ids and keeps the latest mutually exclusive value', () => {
      assert.deepStrictEqual(
        normalizeAgentLaunchOptionIds('codex', [
          'search',
          'sandbox-read-only',
          'unknown',
          'sandbox-workspace-write',
        ]),
        ['search', 'sandbox-workspace-write'],
      );
    });

    test('resolves selections only through the curated argument allow-list', () => {
      assert.deepStrictEqual(
        resolveAgentLaunchArgs('kimi', ['continue', 'plan', '--bad-flag']),
        ['--continue', '--plan'],
      );
    });
  });
});
