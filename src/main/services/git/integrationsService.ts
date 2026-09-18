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
            stderr.trim() || `git credential ${action} failed with code ${code}`,
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
      else reject(new Error(stderr.trim() || `git ${args[0]} exited with code ${code}`));
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
        await execGit(gitCmd, ['config', '--global', `credential.https://${cleanHost}.provider`, 'github']);
        await execGit(gitCmd, ['config', '--global', `credential.https://${cleanHost}.authMode`, 'token']);
      } catch (cfgErr: any) {
        log.warn(`Failed to set git credential config for ${cleanHost}: ${cfgErr.message}`);
      }
    } else if (providerId === 'gitlab-self-managed') {
      try {
        await execGit(gitCmd, ['config', '--global', `credential.https://${cleanHost}.provider`, 'gitlab']);
      } catch (cfgErr: any) {
        log.warn(`Failed to set gitlab credential config for ${cleanHost}: ${cfgErr.message}`);
      }
    } else if (providerId === 'bitbucket-datacenter') {
      try {
        await execGit(gitCmd, ['config', '--global', `credential.https://${cleanHost}.provider`, 'bitbucket']);
      } catch (cfgErr: any) {
        log.warn(`Failed to set bitbucket credential config for ${cleanHost}: ${cfgErr.message}`);
      }
    }

    const payload = `protocol=https\nhost=${cleanHost}\nusername=${cleanUser}\npassword=${cleanToken}\n\n`;
    await pipeToGitCredential(gitCmd, 'approve', payload);

    return { ok: true };
  } catch (err: any) {
    log.error(`syncGitCredential error for ${cleanHost}: ${err.message}`);
    return { ok: false, error: err.message || 'Failed to sync Git credential.' };
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
    return { ok: false, error: err.message || 'Failed to remove Git credential.' };
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
          profileUrl: data.html_url || (data.login ? `https://github.com/${data.login}` : undefined),
        };
        break;
      }

      case 'github-enterprise': {
        if (!domain) {
          return { ok: false, error: 'Host domain is required for GitHub Enterprise Server.' };
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
          profileUrl: data.html_url || (data.login ? `https://${domain}/${data.login}` : undefined),
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
          profileUrl: data.web_url || (data.username ? `https://gitlab.com/${data.username}` : undefined),
        };
        break;
      }

      case 'gitlab-self-managed': {
        if (!domain) {
          return { ok: false, error: 'Host domain is required for GitLab Self-Managed.' };
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
          displayName: data.name || data.username || username || 'Self-Managed User',
          avatarUrl: data.avatar_url || undefined,
          email: data.email || undefined,
          profileUrl: data.web_url || (data.username ? `https://${domain}/${data.username}` : undefined),
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
          profileUrl: data.links?.html?.href || (uname ? `https://bitbucket.org/${uname}` : undefined),
        };
        break;
      }

      case 'bitbucket-datacenter': {
        if (!domain) {
          return { ok: false, error: 'Host domain is required for Bitbucket Data Center.' };
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
