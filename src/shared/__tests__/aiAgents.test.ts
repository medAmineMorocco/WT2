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

  describe('getInstallationGuide for Windows (win32)', () => {
    test('Cursor CLI suggests PowerShell irm command', () => {
      const guide = getInstallationGuide('cursor', 'win32');
      assert.strictEqual(
        guide.command,
        "irm 'https://cursor.com/install?win32=true' | iex",
      );
      assert.strictEqual(guide.requirement, 'Run in PowerShell');
      assert.ok(guide.url.includes('cursor.com'));
    });

    test('Antigravity CLI suggests PowerShell irm command', () => {
      const guide = getInstallationGuide('antigravity', 'win32');
      assert.strictEqual(
        guide.command,
        'irm https://antigravity.google/cli/install.ps1 | iex',
      );
      assert.strictEqual(guide.requirement, 'Run in PowerShell');
      assert.ok(guide.url.includes('antigravity.google'));
    });
  });

  describe('getInstallationGuide for Linux', () => {
    test('Cursor CLI suggests curl/bash command and terminal requirement', () => {
      const guide = getInstallationGuide('cursor', 'linux');
      assert.strictEqual(
        guide.command,
        'curl https://cursor.com/install -fsS | bash',
      );
      assert.strictEqual(guide.requirement, 'Run in Terminal');
      assert.ok(!guide.command.includes('irm'));
    });

    test('Antigravity CLI suggests curl/bash command and terminal requirement', () => {
      const guide = getInstallationGuide('antigravity', 'linux');
      assert.strictEqual(
        guide.command,
        'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      );
      assert.strictEqual(guide.requirement, 'Run in Terminal');
      assert.ok(!guide.command.includes('irm'));
    });
  });

  describe('getInstallationGuide for macOS (darwin)', () => {
    test('Cursor CLI suggests curl/bash command and terminal requirement', () => {
      const guide = getInstallationGuide('cursor', 'darwin');
      assert.strictEqual(
        guide.command,
        'curl https://cursor.com/install -fsS | bash',
      );
      assert.strictEqual(guide.requirement, 'Run in Terminal');
      assert.ok(!guide.command.includes('irm'));
    });

    test('Antigravity CLI suggests curl/bash command and terminal requirement', () => {
      const guide = getInstallationGuide('antigravity', 'darwin');
      assert.strictEqual(
        guide.command,
        'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      );
      assert.strictEqual(guide.requirement, 'Run in Terminal');
      assert.ok(!guide.command.includes('irm'));
    });
  });

  test('every configured agent has a valid installation guide across platforms', () => {
    const platforms = ['win32', 'darwin', 'linux'] as const;
    const allAgentIds = aiAgentsDefault.map((a) => a.id);

    for (const p of platforms) {
      for (const id of allAgentIds) {
        const guide = getInstallationGuide(id, p);
        assert.ok(guide, `Guide should exist for ${id} on ${p}`);
        assert.ok(guide.command.length > 0, `Command should not be empty for ${id} on ${p}`);
        assert.ok(guide.url.startsWith('https://'), `URL should be https for ${id} on ${p}`);
      }
    }
  });
});
