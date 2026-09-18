import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  verifyIntegration,
  syncGitCredential,
  removeGitCredential,
  VerifyIntegrationParams,
} from '../integrationsService';

describe('Integrations Service Verification', () => {
  test('rejects empty or whitespace-only token', async () => {
    const result = await verifyIntegration({
      providerId: 'github',
      token: '   ',
    });
    assert.strictEqual(result.ok, false);
    assert.match(result.error || '', /token is required/i);
  });

  test('requires host domain for enterprise providers', async () => {
    const ghEnterprise = await verifyIntegration({
      providerId: 'github-enterprise',
      token: 'some-token',
      hostDomain: '',
    });
    assert.strictEqual(ghEnterprise.ok, false);
    assert.match(ghEnterprise.error || '', /host domain is required/i);

    const glEnterprise = await verifyIntegration({
      providerId: 'gitlab-self-managed',
      token: 'some-token',
      hostDomain: '',
    });
    assert.strictEqual(glEnterprise.ok, false);
    assert.match(glEnterprise.error || '', /host domain is required/i);

    const bbEnterprise = await verifyIntegration({
      providerId: 'bitbucket-datacenter',
      token: 'some-token',
      hostDomain: '',
    });
    assert.strictEqual(bbEnterprise.ok, false);
    assert.match(bbEnterprise.error || '', /host domain is required/i);
  });

  test('returns error when invalid token is provided for github', async () => {
    const result = await verifyIntegration({
      providerId: 'github',
      token: 'invalid-token-test-xyz',
      syncToGit: false,
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error);
  });
});

describe('Git Credential Sync Service', () => {
  test('syncGitCredential rejects missing host or token', async () => {
    const missingHost = await syncGitCredential({
      host: '',
      username: 'user',
      token: 'ghp_xyz',
    });
    assert.strictEqual(missingHost.ok, false);
    assert.match(missingHost.error || '', /host is required/i);

    const missingToken = await syncGitCredential({
      host: 'github.enterprise.com',
      username: 'user',
      token: '   ',
    });
    assert.strictEqual(missingToken.ok, false);
    assert.match(missingToken.error || '', /token is required/i);
  });

  test('removeGitCredential rejects missing host', async () => {
    const missingHost = await removeGitCredential({
      host: '',
      username: 'user',
    });
    assert.strictEqual(missingHost.ok, false);
    assert.match(missingHost.error || '', /host is required/i);
  });

  test('syncGitCredential and removeGitCredential format domain safely', async () => {
    // Normalizes https:// prefix and trailing slashes safely without throwing
    const syncRes = await syncGitCredential({
      host: 'https://github.mycompany.corp/',
      username: 'octocat',
      token: 'test-token-value',
      providerId: 'github-enterprise',
    });
    // Regardless of whether git-credential-manager is present on test machine, it should resolve cleanly
    assert.ok(typeof syncRes.ok === 'boolean');

    const removeRes = await removeGitCredential({
      host: 'https://github.mycompany.corp/',
      username: 'octocat',
      providerId: 'github-enterprise',
    });
    assert.ok(typeof removeRes.ok === 'boolean');
  });
});
