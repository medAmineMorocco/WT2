import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  AiAgentId,
  aiAgentsDefault,
  detectPlatform,
  getInstallationGuide,
} from '../aiAgents';

describe('aiAgents shared definitions', () => {
  test('detectPlatform returns a supported platform', () => {
    const platform = detectPlatform();
    assert.ok(['win32', 'darwin', 'linux'].includes(platform));
  });

  describe('getInstallationGuide suggestions', () => {
    test('Claude Code suggests npm install command', () => {
      const guide = getInstallationGuide('claude');
      assert.strictEqual(guide.command, 'npm install -g @anthropic-ai/claude-code');
      assert.ok(guide.url.startsWith('https://'));
    });

    test('Codex suggests npm install command', () => {
      const guide = getInstallationGuide('codex');
      assert.strictEqual(guide.command, 'npm install -g @openai/codex');
      assert.ok(guide.url.startsWith('https://'));
    });

    test('Qwen Code suggests npm install command', () => {
      const guide = getInstallationGuide('qwen');
      assert.strictEqual(guide.command, 'npm install -g @qwen-code/qwen-code@latest');
      assert.ok(guide.url.startsWith('https://'));
    });

    test('Kimi Code suggests npm install command', () => {
      const guide = getInstallationGuide('kimi');
      assert.strictEqual(guide.command, 'npm install -g @moonshot-ai/kimi-code');
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
        }
        assert.ok(guide.url.startsWith('https://'), `URL should be https for ${id} on ${p}`);
      }
    }
  });
});
