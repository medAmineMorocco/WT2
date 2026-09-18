export interface SshSettings {
  useLocalAgent: boolean;
  privateKeyPath: string;
  publicKeyPath: string;
  useGitCredentialManager: boolean;
}

export interface SshKeyInfo {
  privateKeyPath: string;
  publicKeyPath: string;
  publicKeyContent?: string;
  exists: boolean;
}

export interface GenerateSshKeyParams {
  keyType: 'ed25519' | 'rsa';
  comment?: string;
  passphrase?: string;
}

export interface GenerateSshKeyResult {
  ok: boolean;
  error?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
  publicKeyContent?: string;
}

export interface SshConnectionTestResult {
  ok: boolean;
  host: string;
  message: string;
}

export const STORAGE_KEY_SSH = 'sshSettings';

export const DEFAULT_SSH_SETTINGS: SshSettings = {
  useLocalAgent: false,
  privateKeyPath: '',
  publicKeyPath: '',
  useGitCredentialManager: true,
};

export function loadStoredSshSettings(): SshSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SSH);
    if (!raw) return { ...DEFAULT_SSH_SETTINGS };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_SSH_SETTINGS };
    }
    return {
      useLocalAgent: Boolean(parsed.useLocalAgent),
      privateKeyPath: typeof parsed.privateKeyPath === 'string' ? parsed.privateKeyPath : '',
      publicKeyPath: typeof parsed.publicKeyPath === 'string' ? parsed.publicKeyPath : '',
      useGitCredentialManager: parsed.useGitCredentialManager !== false,
    };
  } catch {
    return { ...DEFAULT_SSH_SETTINGS };
  }
}

export function saveStoredSshSettings(settings: SshSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_SSH, JSON.stringify(settings));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to save SSH settings:', err);
  }
}
