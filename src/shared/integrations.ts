export type IntegrationProviderId =
  | 'github'
  | 'github-enterprise'
  | 'gitlab'
  | 'gitlab-self-managed'
  | 'bitbucket'
  | 'bitbucket-datacenter'
  | 'azure-devops';

export interface IntegrationProviderDef {
  id: IntegrationProviderId;
  name: string;
  category: 'cloud' | 'enterprise';
  isEnterprise: boolean;
  defaultHost?: string;
  placeholderHost?: string;
  tokenUrl?: string;
  tokenPath?: string;
  tokenGuidance: string;
  tokenScopes: string;
  docsUrl: string;
}

export interface IntegrationState {
  providerId: IntegrationProviderId;
  connected: boolean;
  hostDomain?: string;
  token?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  profileUrl?: string;
  lastConnectedAt?: string;
  gitCredentialSynced?: boolean;
}

export interface SyncGitCredentialParams {
  host: string;
  username: string;
  token: string;
  providerId?: IntegrationProviderId;
}

export interface SyncGitCredentialResult {
  ok: boolean;
  error?: string;
}

export interface RemoveGitCredentialParams {
  host: string;
  username?: string;
  providerId?: IntegrationProviderId;
}

export interface RemoveGitCredentialResult {
  ok: boolean;
  error?: string;
}

export const INTEGRATION_PROVIDERS: IntegrationProviderDef[] = [
  {
    id: 'github',
    name: 'GitHub',
    category: 'cloud',
    isEnterprise: false,
    defaultHost: 'github.com',
    tokenUrl: 'https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=WorktreeWise',
    tokenGuidance: 'Generate a Personal Access Token with repo and read:user scopes.',
    tokenScopes: 'repo, read:user, user:email',
    docsUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
  },
  {
    id: 'github-enterprise',
    name: 'GitHub Enterprise Server',
    category: 'enterprise',
    isEnterprise: true,
    placeholderHost: 'e.g., github.mycompany.com',
    tokenPath: '/settings/tokens/new?scopes=repo,read:user,user:email&description=WorktreeWise',
    tokenGuidance: 'Generate a token on your GitHub Enterprise Server instance.',
    tokenScopes: 'repo, read:user, user:email',
    docsUrl: 'https://docs.github.com/en/enterprise-server/authentication',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'cloud',
    isEnterprise: false,
    defaultHost: 'gitlab.com',
    tokenUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens?name=WorktreeWise&scopes=api,read_user,read_repository,write_repository',
    tokenGuidance: 'Generate a Personal Access Token with api and read_repository scopes.',
    tokenScopes: 'api, read_user, read_repository, write_repository',
    docsUrl: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
  },
  {
    id: 'gitlab-self-managed',
    name: 'GitLab Self-Managed',
    category: 'enterprise',
    isEnterprise: true,
    placeholderHost: 'e.g., gitlab.mycompany.com',
    tokenPath: '/-/user_settings/personal_access_tokens?name=WorktreeWise&scopes=api,read_user,read_repository,write_repository',
    tokenGuidance: 'Generate a token on your self-managed GitLab instance.',
    tokenScopes: 'api, read_user, read_repository, write_repository',
    docsUrl: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    category: 'cloud',
    isEnterprise: false,
    defaultHost: 'bitbucket.org',
    tokenUrl: 'https://bitbucket.org/account/settings/app-passwords/',
    tokenGuidance: 'Create an App Password with repositories and account read/write permissions.',
    tokenScopes: 'Repositories (Read, Write), Account (Read)',
    docsUrl: 'https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/',
  },
  {
    id: 'bitbucket-datacenter',
    name: 'Bitbucket Data Center',
    category: 'enterprise',
    isEnterprise: true,
    placeholderHost: 'e.g., bitbucket.mycompany.com',
    tokenPath: '/plugins/servlet/access-tokens/manage',
    tokenGuidance: 'Generate an HTTP access token on your Bitbucket Data Center server.',
    tokenScopes: 'Project read, Repository write',
    docsUrl: 'https://confluence.atlassian.com/bitbucketserver/personal-access-tokens-939515499.html',
  },
  {
    id: 'azure-devops',
    name: 'Azure DevOps',
    category: 'cloud',
    isEnterprise: false,
    defaultHost: 'dev.azure.com',
    tokenUrl: 'https://dev.azure.com/_usersSettings/tokens',
    tokenGuidance: 'Create a Personal Access Token with Code (Read & Write) access.',
    tokenScopes: 'Code (Read & Write)',
    docsUrl: 'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate',
  },
];

export const STORAGE_KEY_INTEGRATIONS = 'gitIntegrations';

export function normalizeHostDomain(input: string): string {
  if (!input) return '';
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getTokenGenerationUrl(
  def: IntegrationProviderDef,
  hostDomain?: string,
): string | null {
  if (!def.isEnterprise) {
    return def.tokenUrl || null;
  }
  const cleanHost = normalizeHostDomain(hostDomain || '');
  if (!cleanHost) return null;
  const tokenPath = def.tokenPath || '';
  return `https://${cleanHost}${tokenPath.startsWith('/') ? '' : '/'}${tokenPath}`;
}

export function parseTokenScopes(scopesString: string): string[] {
  if (!scopesString) return [];
  return scopesString
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadStoredIntegrations(): Record<IntegrationProviderId, IntegrationState> {
  const initial = {} as Record<IntegrationProviderId, IntegrationState>;
  for (const def of INTEGRATION_PROVIDERS) {
    initial[def.id] = {
      providerId: def.id,
      connected: false,
      hostDomain: def.defaultHost || '',
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_INTEGRATIONS);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return initial;

    for (const def of INTEGRATION_PROVIDERS) {
      if (parsed[def.id]) {
        initial[def.id] = {
          ...initial[def.id],
          ...parsed[def.id],
        };
      }
    }
    return initial;
  } catch {
    return initial;
  }
}

export function saveStoredIntegrations(
  integrations: Record<IntegrationProviderId, IntegrationState>,
): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY_INTEGRATIONS,
      JSON.stringify(integrations),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to save integrations:', err);
  }
}

export interface MatchedIntegration {
  def: IntegrationProviderDef;
  state: IntegrationState;
}

export function matchRemoteToIntegration(
  remoteUrl: string,
  integrations: Record<IntegrationProviderId, IntegrationState>,
): MatchedIntegration | null {
  if (!remoteUrl) return null;
  const lowerUrl = remoteUrl.toLowerCase();

  // Check enterprise / self-managed custom host domains first
  for (const def of INTEGRATION_PROVIDERS) {
    if (def.isEnterprise) {
      const state = integrations[def.id];
      const host = normalizeHostDomain(state?.hostDomain || '');
      if (host && lowerUrl.includes(host.toLowerCase())) {
        return { def, state };
      }
    }
  }

  // Check standard cloud domains
  if (lowerUrl.includes('github.com')) {
    return {
      def: INTEGRATION_PROVIDERS.find((p) => p.id === 'github')!,
      state: integrations['github'],
    };
  }
  if (lowerUrl.includes('gitlab.com')) {
    return {
      def: INTEGRATION_PROVIDERS.find((p) => p.id === 'gitlab')!,
      state: integrations['gitlab'],
    };
  }
  if (lowerUrl.includes('bitbucket.org')) {
    return {
      def: INTEGRATION_PROVIDERS.find((p) => p.id === 'bitbucket')!,
      state: integrations['bitbucket'],
    };
  }
  if (lowerUrl.includes('dev.azure.com') || lowerUrl.includes('visualstudio.com')) {
    return {
      def: INTEGRATION_PROVIDERS.find((p) => p.id === 'azure-devops')!,
      state: integrations['azure-devops'],
    };
  }

  return null;
}
