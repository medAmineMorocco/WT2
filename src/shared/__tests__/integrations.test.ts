import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  INTEGRATION_PROVIDERS,
  IntegrationProviderId,
  normalizeHostDomain,
  matchRemoteToIntegration,
  getTokenGenerationUrl,
  parseTokenScopes,
} from '../integrations';

describe('Integrations Shared Definitions', () => {
  test('includes exactly the 7 requested git hosting providers', () => {
    const expectedIds: IntegrationProviderId[] = [
      'github',
      'github-enterprise',
      'gitlab',
      'gitlab-self-managed',
      'bitbucket',
      'bitbucket-datacenter',
      'azure-devops',
    ];

    assert.strictEqual(INTEGRATION_PROVIDERS.length, 7);
    for (const expected of expectedIds) {
      assert.ok(
        INTEGRATION_PROVIDERS.some((p) => p.id === expected),
        `Missing provider: ${expected}`,
      );
    }
  });

  test('does not contain Jira or Trello', () => {
    const providerIds = INTEGRATION_PROVIDERS.map((p) => p.id);
    const providerNames = INTEGRATION_PROVIDERS.map((p) => p.name.toLowerCase());

    assert.strictEqual(providerIds.includes('jira' as any), false);
    assert.strictEqual(providerIds.includes('trello' as any), false);
    assert.strictEqual(providerNames.some((n) => n.includes('jira')), false);
    assert.strictEqual(providerNames.some((n) => n.includes('trello')), false);
  });

  test('differentiates cloud vs enterprise / self-managed providers', () => {
    const enterprise = INTEGRATION_PROVIDERS.filter((p) => p.isEnterprise);
    const cloud = INTEGRATION_PROVIDERS.filter((p) => !p.isEnterprise);

    assert.strictEqual(enterprise.length, 3);
    assert.strictEqual(cloud.length, 4);

    assert.deepStrictEqual(
      enterprise.map((p) => p.id).sort(),
      ['bitbucket-datacenter', 'github-enterprise', 'gitlab-self-managed'].sort(),
    );
  });

  describe('normalizeHostDomain', () => {
    test('strips protocol and trailing slashes', () => {
      assert.strictEqual(
        normalizeHostDomain('https://github.mycompany.com/'),
        'github.mycompany.com',
      );
      assert.strictEqual(
        normalizeHostDomain('http://gitlab.internal.corp///'),
        'gitlab.internal.corp',
      );
      assert.strictEqual(
        normalizeHostDomain('   bitbucket.org   '),
        'bitbucket.org',
      );
    });

    test('handles empty input safely', () => {
      assert.strictEqual(normalizeHostDomain(''), '');
      assert.strictEqual(normalizeHostDomain('   '), '');
    });
  });

  describe('matchRemoteToIntegration', () => {
    const mockIntegrations: any = {
      github: { providerId: 'github', connected: true, username: 'octocat' },
      'github-enterprise': {
        providerId: 'github-enterprise',
        connected: true,
        hostDomain: 'github.mycompany.com',
      },
      gitlab: { providerId: 'gitlab', connected: false },
      'gitlab-self-managed': { providerId: 'gitlab-self-managed', connected: false },
      bitbucket: { providerId: 'bitbucket', connected: true },
      'bitbucket-datacenter': { providerId: 'bitbucket-datacenter', connected: false },
      'azure-devops': { providerId: 'azure-devops', connected: false },
    };

    test('matches github.com URLs to github integration', () => {
      const match = matchRemoteToIntegration(
        'https://github.com/org/repo.git',
        mockIntegrations,
      );
      assert.ok(match);
      assert.strictEqual(match.def.id, 'github');
      assert.strictEqual(match.state.connected, true);
    });

    test('matches enterprise custom domain URLs to enterprise integration', () => {
      const match = matchRemoteToIntegration(
        'https://github.mycompany.com/team/project.git',
        mockIntegrations,
      );
      assert.ok(match);
      assert.strictEqual(match.def.id, 'github-enterprise');
      assert.strictEqual(match.state.connected, true);
    });

    test('returns null for unknown URLs or empty string', () => {
      assert.strictEqual(
        matchRemoteToIntegration('https://custom-git.example.com/repo.git', mockIntegrations),
        null,
      );
      assert.strictEqual(matchRemoteToIntegration('', mockIntegrations), null);
    });
  });

  describe('getTokenGenerationUrl & parseTokenScopes', () => {
    test('returns direct tokenUrl for cloud providers', () => {
      const gh = INTEGRATION_PROVIDERS.find((p) => p.id === 'github')!;
      const url = getTokenGenerationUrl(gh);
      assert.ok(url);
      assert.ok(url.includes('github.com/settings/tokens/new'));
      assert.ok(url.includes('scopes=repo,read:user,user:email'));
    });

    test('constructs enterprise URL when host domain is provided', () => {
      const ghe = INTEGRATION_PROVIDERS.find((p) => p.id === 'github-enterprise')!;
      const url = getTokenGenerationUrl(ghe, 'github.axa.com');
      assert.strictEqual(
        url,
        'https://github.axa.com/settings/tokens/new?scopes=repo,read:user,user:email&description=WorktreeWise',
      );
    });

    test('returns null for enterprise provider when host domain is empty', () => {
      const ghe = INTEGRATION_PROVIDERS.find((p) => p.id === 'github-enterprise')!;
      assert.strictEqual(getTokenGenerationUrl(ghe, ''), null);
      assert.strictEqual(getTokenGenerationUrl(ghe), null);
    });

    test('parses comma-separated scopes into trimmed array', () => {
      const scopes = parseTokenScopes('repo, read:user, user:email');
      assert.deepStrictEqual(scopes, ['repo', 'read:user', 'user:email']);
      assert.deepStrictEqual(parseTokenScopes(''), []);
    });
  });
});

