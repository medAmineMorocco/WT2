import { spawn } from 'child_process';
import log from '../../utils/logger';
import {
  IntegrationProviderId,
  normalizeHostDomain,
  INTEGRATION_PROVIDERS,
  SyncGitCredentialParams,
  SyncGitCredentialResult,
  RemoveGitCredentialParams,
  RemoveGitCredentialResult,
  ListIntegrationRepositoriesParams,
  ListIntegrationRepositoriesResult,
  RemoteRepository,
} from '../../../shared/integrations';

export interface VerifyIntegrationParams {
  providerId: IntegrationProviderId;
  token: string;
  hostDomain?: string;
  username?: string;
  syncToGit?: boolean;
}

export interface VerifiedUserInfo {
  username: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  profileUrl?: string;
}

export interface VerifyIntegrationResult {
  ok: boolean;
  error?: string;
  user?: VerifiedUserInfo;
  gitCredentialSynced?: boolean;
}

function authorizationHeader(
  providerId: IntegrationProviderId,
  token: string,
  username?: string,
): string {
  if (providerId === 'azure-devops') {
    return `Basic ${Buffer.from(`:${token}`).toString('base64')}`;
  }
  if (providerId === 'bitbucket' && username?.trim()) {
    return `Basic ${Buffer.from(`${username.trim()}:${token}`).toString('base64')}`;
  }
  return `Bearer ${token}`;
}

async function fetchJson(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<any> {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.message ||
      body?.error?.message ||
      body?.errors?.[0]?.message ||
      `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return response.json();
}

function sortRepositories(repositories: RemoteRepository[]) {
  return repositories.sort((left, right) => {
    const updatedDifference =
      Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || '');
    return updatedDifference || left.fullName.localeCompare(right.fullName);
  });
}

export async function listIntegrationRepositories(
  params: ListIntegrationRepositoriesParams,
): Promise<ListIntegrationRepositoriesResult> {
  const token = params.token?.trim();
  if (!token) return { ok: false, error: 'The provider token is missing.' };

  const domain = normalizeHostDomain(params.hostDomain || '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  const headers = {
    Authorization: authorizationHeader(
      params.providerId,
      token,
      params.username,
    ),
    'User-Agent': 'WorktreeWise-Desktop',
    Accept: 'application/json',
  };

  try {
    let repositories: RemoteRepository[] = [];
    switch (params.providerId) {
      case 'github':
      case 'github-enterprise': {
        if (params.providerId === 'github-enterprise' && !domain) {
          return { ok: false, error: 'The enterprise host is missing.' };
        }
        const apiBase =
          params.providerId === 'github'
            ? 'https://api.github.com'
            : `https://${domain}/api/v3`;
        const data = await fetchJson(
          `${apiBase}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
          { ...headers, Accept: 'application/vnd.github+json' },
          controller.signal,
        );
        repositories = data.map((repository: any) => ({
          id: String(repository.id),
          name: repository.name,
          fullName: repository.full_name,
          cloneUrl: repository.clone_url,
          webUrl: repository.html_url,
          description: repository.description || undefined,
          isPrivate: Boolean(repository.private),
          updatedAt: repository.updated_at,
        }));
        break;
      }
      case 'gitlab':
      case 'gitlab-self-managed': {
        if (params.providerId === 'gitlab-self-managed' && !domain) {
          return { ok: false, error: 'The self-managed host is missing.' };
        }
        const apiBase =
          params.providerId === 'gitlab'
            ? 'https://gitlab.com/api/v4'
            : `https://${domain}/api/v4`;
        const data = await fetchJson(
          `${apiBase}/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at&sort=desc`,
          headers,
          controller.signal,
        );
        repositories = data.map((repository: any) => ({
          id: String(repository.id),
          name: repository.name,
          fullName: repository.path_with_namespace,
          cloneUrl: repository.http_url_to_repo,
          webUrl: repository.web_url,
          description: repository.description || undefined,
          isPrivate: repository.visibility === 'private',
          updatedAt: repository.last_activity_at,
        }));
        break;
      }
      case 'bitbucket': {
        const username = params.username?.trim();
        if (!username) {
          return { ok: false, error: 'The Bitbucket username is missing.' };
        }
        const data = await fetchJson(
          `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(username)}?pagelen=100&sort=-updated_on&role=member`,
          headers,
          controller.signal,
        );
        repositories = (data.values || []).map((repository: any) => ({
          id: repository.uuid || repository.full_name,
          name: repository.name,
          fullName: repository.full_name,
          cloneUrl:
            repository.links?.clone?.find((link: any) => link.name === 'https')
              ?.href || '',
          webUrl: repository.links?.html?.href,
          description: repository.description || undefined,
          isPrivate: Boolean(repository.is_private),
          updatedAt: repository.updated_on,
        }));
        break;
      }
      case 'bitbucket-datacenter': {
        if (!domain) {
          return { ok: false, error: 'The data center host is missing.' };
        }
        const data = await fetchJson(
          `https://${domain}/rest/api/1.0/repos?limit=100`,
          headers,
          controller.signal,
        );
        repositories = (data.values || []).map((repository: any) => ({
          id: String(repository.id || repository.slug),
          name: repository.name,
          fullName: `${repository.project?.key || 'project'}/${repository.slug}`,
          cloneUrl:
            repository.links?.clone?.find((link: any) => link.name === 'http')
              ?.href || '',
          webUrl: repository.links?.self?.[0]?.href,
          isPrivate: !repository.public,
        }));
        break;
      }
      case 'azure-devops': {
        const profile = await fetchJson(
          'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
          headers,
          controller.signal,
        );
        const accounts = await fetchJson(
          `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${encodeURIComponent(profile.id)}&api-version=7.1`,
          headers,
          controller.signal,
        );
        const accountNames = (accounts.value || []).map(
          (account: any) => account.accountName,
        );
        const repositoryGroups = await Promise.all(
          accountNames.map(async (accountName: string) => {
            const data = await fetchJson(
              `https://dev.azure.com/${encodeURIComponent(accountName)}/_apis/git/repositories?api-version=7.1`,
              headers,
              controller.signal,
            );
            return (data.value || []).map((repository: any) => ({
              id: repository.id,
              name: repository.name,
              fullName: `${accountName}/${repository.project?.name || 'project'}/${repository.name}`,
              cloneUrl: repository.remoteUrl,
              webUrl: repository.webUrl,
              isPrivate: true,
            }));
          }),
        );
        repositories = repositoryGroups.flat();
        break;
      }
      default:
        return { ok: false, error: 'This provider is not supported.' };
    }

    return {
      ok: true,
      repositories: sortRepositories(
        repositories.filter((repository) => repository.cloneUrl),
      ),
    };
  } catch (error: any) {
    return {
      ok: false,
      error:
        error?.name === 'AbortError'
          ? 'The provider took too long to respond.'
          : error?.message || 'Could not load repositories.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveGitCommand(): Promise<string> {
  try {
    const mod = (await import('./gitMainService')) as any;
    const service = mod.default || mod;
    if (typeof service?.gitCommand === 'function') {
      return await service.gitCommand();
    }
  } catch {
    // Fallback when gitMainService cannot be loaded (e.g., unit test environments)
  }
  return 'git';
}

function pipeToGitCredential(
  gitCmd: string,
  action: 'approve' | 'reject',
  input: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(gitCmd, ['credential', action], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            stderr.trim() ||
              `git credential ${action} failed with code ${code}`,
          ),
        );
      }
    });

    child.stdin?.write(input);
    child.stdin?.end();
  });
}

function execGit(gitCmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(gitCmd, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(stderr.trim() || `git ${args[0]} exited with code ${code}`),
        );
    });
  });
}

export async function syncGitCredential(
  params: SyncGitCredentialParams,
): Promise<SyncGitCredentialResult> {
  const { host, username, token, providerId } = params;
  if (!host || !host.trim()) {
    return { ok: false, error: 'Host is required for Git credential sync.' };
  }
  if (!token || !token.trim()) {
    return { ok: false, error: 'Token is required for Git credential sync.' };
  }

  const cleanHost = normalizeHostDomain(host);
  const cleanUser = (username || '').trim();
  const cleanToken = token.trim();

  try {
    const gitCmd = await resolveGitCommand();

    // Configure Git Credential Manager for self-hosted / enterprise instances
    if (providerId === 'github-enterprise') {
      try {
        await execGit(gitCmd, [
          'config',
          '--global',
          `credential.https://${cleanHost}.provider`,
          'github',
        ]);
        await execGit(gitCmd, [
          'config',
          '--global',
          `credential.https://${cleanHost}.authMode`,
          'token',
        ]);
      } catch (cfgErr: any) {
        log.warn(
          `Failed to set git credential config for ${cleanHost}: ${cfgErr.message}`,
        );
      }
    } else if (providerId === 'gitlab-self-managed') {
      try {
        await execGit(gitCmd, [
          'config',
          '--global',
          `credential.https://${cleanHost}.provider`,
          'gitlab',
        ]);
      } catch (cfgErr: any) {
        log.warn(
          `Failed to set gitlab credential config for ${cleanHost}: ${cfgErr.message}`,
        );
      }
    } else if (providerId === 'bitbucket-datacenter') {
      try {
        await execGit(gitCmd, [
          'config',
          '--global',
          `credential.https://${cleanHost}.provider`,
          'bitbucket',
        ]);
      } catch (cfgErr: any) {
        log.warn(
          `Failed to set bitbucket credential config for ${cleanHost}: ${cfgErr.message}`,
        );
      }
    }

    const payload = `protocol=https\nhost=${cleanHost}\nusername=${cleanUser}\npassword=${cleanToken}\n\n`;
    await pipeToGitCredential(gitCmd, 'approve', payload);

    return { ok: true };
  } catch (err: any) {
    log.error(`syncGitCredential error for ${cleanHost}: ${err.message}`);
    return {
      ok: false,
      error: err.message || 'Failed to sync Git credential.',
    };
  }
}

export async function removeGitCredential(
  params: RemoveGitCredentialParams,
): Promise<RemoveGitCredentialResult> {
  const { host, username } = params;
  if (!host || !host.trim()) {
    return { ok: false, error: 'Host is required.' };
  }

  const cleanHost = normalizeHostDomain(host);
  const cleanUser = (username || '').trim();

  try {
    const gitCmd = await resolveGitCommand();
    const payload = `protocol=https\nhost=${cleanHost}\nusername=${cleanUser}\n\n`;
    await pipeToGitCredential(gitCmd, 'reject', payload);

    return { ok: true };
  } catch (err: any) {
    log.error(`removeGitCredential error for ${cleanHost}: ${err.message}`);
    return {
      ok: false,
      error: err.message || 'Failed to remove Git credential.',
    };
  }
}

export async function verifyIntegration(
  params: VerifyIntegrationParams,
): Promise<VerifyIntegrationResult> {
  const { providerId, token, hostDomain, username } = params;

  if (!token || !token.trim()) {
    return { ok: false, error: 'Personal Access Token is required.' };
  }

  const cleanToken = token.trim();
  const domain = hostDomain ? normalizeHostDomain(hostDomain) : '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    let verifiedUser: VerifiedUserInfo;

    switch (providerId) {
      case 'github': {
        const res = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'User-Agent': 'WorktreeWise-Desktop',
            Accept: 'application/vnd.github.v3+json',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          return {
            ok: false,
            error:
              errBody?.message ||
              `GitHub returned status ${res.status}: ${res.statusText}`,
          };
        }

        const data = (await res.json()) as any;
        verifiedUser = {
          username: data.login || username || 'User',
          displayName: data.name || data.login || username || 'User',
          avatarUrl: data.avatar_url || undefined,
          email: data.email || undefined,
          profileUrl:
            data.html_url ||
            (data.login ? `https://github.com/${data.login}` : undefined),
        };
        break;
      }

      case 'github-enterprise': {
        if (!domain) {
          return {
            ok: false,
            error: 'Host domain is required for GitHub Enterprise Server.',
          };
        }
        const res = await fetch(`https://${domain}/api/v3/user`, {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'User-Agent': 'WorktreeWise-Desktop',
            Accept: 'application/vnd.github.v3+json',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          return {
            ok: false,
            error:
              errBody?.message ||
              `Enterprise server returned status ${res.status}: ${res.statusText}`,
          };
        }

        const data = (await res.json()) as any;
        verifiedUser = {
          username: data.login || username || 'Enterprise User',
          displayName: data.name || data.login || username || 'Enterprise User',
          avatarUrl: data.avatar_url || undefined,
          email: data.email || undefined,
          profileUrl:
            data.html_url ||
            (data.login ? `https://${domain}/${data.login}` : undefined),
        };
        break;
      }

      case 'gitlab': {
        const res = await fetch('https://gitlab.com/api/v4/user', {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'User-Agent': 'WorktreeWise-Desktop',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          return {
            ok: false,
            error:
              errBody?.message ||
              `GitLab returned status ${res.status}: ${res.statusText}`,
          };
        }

        const data = (await res.json()) as any;
        verifiedUser = {
          username: data.username || username || 'User',
          displayName: data.name || data.username || username || 'User',
          avatarUrl: data.avatar_url || undefined,
          email: data.email || undefined,
          profileUrl:
            data.web_url ||
            (data.username ? `https://gitlab.com/${data.username}` : undefined),
        };
        break;
      }

      case 'gitlab-self-managed': {
        if (!domain) {
          return {
            ok: false,
            error: 'Host domain is required for GitLab Self-Managed.',
          };
        }
        const res = await fetch(`https://${domain}/api/v4/user`, {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'User-Agent': 'WorktreeWise-Desktop',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          return {
            ok: false,
            error:
              errBody?.message ||
              `GitLab server returned status ${res.status}: ${res.statusText}`,
          };
        }

        const data = (await res.json()) as any;
        verifiedUser = {
          username: data.username || username || 'Self-Managed User',
          displayName:
            data.name || data.username || username || 'Self-Managed User',
          avatarUrl: data.avatar_url || undefined,
          email: data.email || undefined,
          profileUrl:
            data.web_url ||
            (data.username ? `https://${domain}/${data.username}` : undefined),
        };
        break;
      }

      case 'bitbucket': {
        let authHeader = `Bearer ${cleanToken}`;
        if (username?.trim()) {
          authHeader = `Basic ${Buffer.from(`${username.trim()}:${cleanToken}`).toString('base64')}`;
        } else if (cleanToken.includes(':')) {
          authHeader = `Basic ${Buffer.from(cleanToken).toString('base64')}`;
        }

        const res = await fetch('https://api.bitbucket.org/2.0/user', {
          headers: {
            Authorization: authHeader,
            'User-Agent': 'WorktreeWise-Desktop',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          return {
            ok: false,
            error:
              errBody?.error?.message ||
              `Bitbucket returned status ${res.status}: ${res.statusText}`,
          };
        }

        const data = (await res.json()) as any;
        const uname = data.username || data.nickname || username || 'User';
        verifiedUser = {
          username: uname,
          displayName: data.display_name || uname,
          avatarUrl: data.links?.avatar?.href || undefined,
          profileUrl:
            data.links?.html?.href ||
            (uname ? `https://bitbucket.org/${uname}` : undefined),
        };
        break;
      }

      case 'bitbucket-datacenter': {
        if (!domain) {
          return {
            ok: false,
            error: 'Host domain is required for Bitbucket Data Center.',
          };
        }
        const res = await fetch(`https://${domain}/rest/api/1.0/current-user`, {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'User-Agent': 'WorktreeWise-Desktop',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          return {
            ok: false,
            error:
              errBody?.errors?.[0]?.message ||
              `Bitbucket Data Center returned status ${res.status}: ${res.statusText}`,
          };
        }

        const data = (await res.json()) as any;
        verifiedUser = {
          username: data.name || data.slug || username || 'User',
          displayName: data.displayName || data.name || username || 'User',
          avatarUrl: data.avatarUrl || undefined,
          email: data.emailAddress || undefined,
        };
        break;
      }

      case 'azure-devops': {
        const res = await fetch(
          'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`:${cleanToken}`).toString('base64')}`,
              'User-Agent': 'WorktreeWise-Desktop',
            },
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          return {
            ok: false,
            error: `Azure DevOps returned status ${res.status}: ${res.statusText}`,
          };
        }

        const data = (await res.json()) as any;
        verifiedUser = {
          username: data.publicAlias || username || data.displayName || 'User',
          displayName: data.displayName || username || 'User',
          email: data.emailAddress || undefined,
        };
        break;
      }

      default:
        verifiedUser = {
          username: username || 'User',
          displayName: username || 'User',
        };
        break;
    }

    let gitCredentialSynced = false;
    if (params.syncToGit !== false) {
      const syncHost =
        domain ||
        INTEGRATION_PROVIDERS.find((p) => p.id === providerId)?.defaultHost ||
        '';
      if (syncHost) {
        const syncRes = await syncGitCredential({
          host: syncHost,
          username: verifiedUser.username || username || '',
          token: cleanToken,
          providerId,
        });
        gitCredentialSynced = syncRes.ok;
      }
    }

    return {
      ok: true,
      user: verifiedUser,
      gitCredentialSynced,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out after 10 seconds.' };
    }
    return { ok: false, error: `Connection error: ${err.message || err}` };
  } finally {
    clearTimeout(timeoutId);
  }
}
