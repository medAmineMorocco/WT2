import assert from 'node:assert';
import test, { describe, beforeEach } from 'node:test';
import {
  DEFAULT_SSH_SETTINGS,
  loadStoredSshSettings,
  saveStoredSshSettings,
  STORAGE_KEY_SSH,
  SshSettings,
} from '../ssh';

describe('SSH Shared Definitions', () => {
  const memoryStore: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(memoryStore)) {
      delete memoryStore[key];
    }
    // Mock window.localStorage
    (global as any).window = {
      localStorage: {
        getItem: (k: string) => memoryStore[k] || null,
        setItem: (k: string, v: string) => {
          memoryStore[k] = v;
        },
      },
    };
  });

  test('default settings have expected values', () => {
    assert.strictEqual(DEFAULT_SSH_SETTINGS.useLocalAgent, false);
    assert.strictEqual(DEFAULT_SSH_SETTINGS.privateKeyPath, '');
    assert.strictEqual(DEFAULT_SSH_SETTINGS.publicKeyPath, '');
    assert.strictEqual(DEFAULT_SSH_SETTINGS.useGitCredentialManager, true);
  });

  test('returns default settings when storage is empty', () => {
    const settings = loadStoredSshSettings();
    assert.deepStrictEqual(settings, DEFAULT_SSH_SETTINGS);
  });

  test('saves and loads SSH settings accurately', () => {
    const custom: SshSettings = {
      useLocalAgent: true,
      privateKeyPath: 'C:\\Users\\test\\.ssh\\id_ed25519',
      publicKeyPath: 'C:\\Users\\test\\.ssh\\id_ed25519.pub',
      useGitCredentialManager: false,
    };

    saveStoredSshSettings(custom);
    const loaded = loadStoredSshSettings();
    assert.deepStrictEqual(loaded, custom);
  });

  test('handles corrupted localStorage JSON gracefully', () => {
    memoryStore[STORAGE_KEY_SSH] = '{not-valid-json';
    const settings = loadStoredSshSettings();
    assert.deepStrictEqual(settings, DEFAULT_SSH_SETTINGS);
  });
});
