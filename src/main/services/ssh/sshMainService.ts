import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { dialog, BrowserWindow } from 'electron';
import {
  GenerateSshKeyParams,
  GenerateSshKeyResult,
  SshConnectionTestResult,
  SshKeyInfo,
} from '../../../shared/ssh';
import log from '../../utils/logger';

const STANDARD_KEY_NAMES = [
  'id_ed25519',
  'id_rsa',
  'id_ecdsa',
];

export class SshMainService {
  getSshDir(): string {
    return path.join(os.homedir(), '.ssh');
  }

  async detectDefaultSshKeys(): Promise<SshKeyInfo> {
    const sshDir = this.getSshDir();
    if (fs.existsSync(sshDir)) {
      for (const keyName of STANDARD_KEY_NAMES) {
        const priv = path.join(sshDir, keyName);
        const pub = `${priv}.pub`;
        if (fs.existsSync(priv) || fs.existsSync(pub)) {
          let publicKeyContent: string | undefined;
          if (fs.existsSync(pub)) {
            try {
              publicKeyContent = fs.readFileSync(pub, 'utf8').trim();
            } catch {
              // ignore
            }
          }
          return {
            privateKeyPath: priv,
            publicKeyPath: pub,
            publicKeyContent,
            exists: true,
          };
        }
      }
    }

    const defaultPriv = path.join(sshDir, 'id_ed25519');
    const defaultPub = path.join(sshDir, 'id_ed25519.pub');
    return {
      privateKeyPath: defaultPriv,
      publicKeyPath: defaultPub,
      exists: false,
    };
  }

  async readPublicKeyContent(filePath: string): Promise<string> {
    if (!filePath || !fs.existsSync(filePath)) {
      return '';
    }
    return fs.readFileSync(filePath, 'utf8').trim();
  }

  async generateSshKeyPair(
    params: GenerateSshKeyParams,
  ): Promise<GenerateSshKeyResult> {
    const sshDir = this.getSshDir();
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
    }

    const keyType = params.keyType || 'ed25519';
    const baseName = keyType === 'ed25519' ? 'id_ed25519' : 'id_rsa';
    let targetPrivate = path.join(sshDir, baseName);
    let targetPublic = `${targetPrivate}.pub`;

    if (fs.existsSync(targetPrivate)) {
      let counter = 1;
      while (fs.existsSync(path.join(sshDir, `${baseName}_${counter}`))) {
        counter++;
      }
      targetPrivate = path.join(sshDir, `${baseName}_${counter}`);
      targetPublic = `${targetPrivate}.pub`;
    }

    const args: string[] = ['-t', keyType];
    if (keyType === 'rsa') {
      args.push('-b', '4096');
    }
    args.push('-C', params.comment || 'worktreewise');
    args.push('-f', targetPrivate);
    args.push('-N', params.passphrase || '');

    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('ssh-keygen', args, {
          windowsHide: true,
          shell: false,
        });

        let stderr = '';
        child.stderr?.on('data', (d) => {
          stderr += d.toString();
        });
        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(stderr || `ssh-keygen exited with code ${code}`));
          }
        });
      });

      let publicKeyContent = '';
      if (fs.existsSync(targetPublic)) {
        publicKeyContent = fs.readFileSync(targetPublic, 'utf8').trim();
      }

      return {
        ok: true,
        privateKeyPath: targetPrivate,
        publicKeyPath: targetPublic,
        publicKeyContent,
      };
    } catch (err: any) {
      log.error('Failed to generate SSH key:', err);
      return {
        ok: false,
        error: err.message || 'Failed to generate SSH key.',
      };
    }
  }

  async browseSshKeyFile(type: 'private' | 'public'): Promise<string | null> {
    const window =
      BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const defaultPath = this.getSshDir();

    const result = await dialog.showOpenDialog(window, {
      title: type === 'public' ? 'Select SSH Public Key' : 'Select SSH Private Key',
      defaultPath: fs.existsSync(defaultPath) ? defaultPath : undefined,
      properties: ['openFile', 'showHiddenFiles'],
      filters:
        type === 'public'
          ? [
              { name: 'SSH Public Key (*.pub)', extensions: ['pub'] },
              { name: 'All Files', extensions: ['*'] },
            ]
          : [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    return result.filePaths[0];
  }

  async testSshConnection(
    host: string,
    keyPath?: string,
  ): Promise<SshConnectionTestResult> {
    const cleanHost = host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanHost) {
      return { ok: false, host: '', message: 'Invalid host.' };
    }

    const args = [
      '-T',
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
      '-o', 'ConnectTimeout=10',
    ];

    if (keyPath && fs.existsSync(keyPath)) {
      args.push('-i', keyPath, '-o', 'IdentitiesOnly=yes');
    }

    args.push(`git@${cleanHost}`);

    return new Promise((resolve) => {
      const child = spawn('ssh', args, {
        windowsHide: true,
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('error', (err) => {
        resolve({
          ok: false,
          host: cleanHost,
          message: `Could not execute ssh command: ${err.message}`,
        });
      });

      child.on('close', (code) => {
        const output = (stdout + '\n' + stderr).trim();
        const lower = output.toLowerCase();

        const isSuccess =
          lower.includes('successfully authenticated') ||
          lower.includes('welcome to gitlab') ||
          lower.includes('authenticated via') ||
          lower.includes('logged in as') ||
          lower.includes('you have successfully') ||
          lower.includes('shell request failed') ||
          code === 0;

        resolve({
          ok: isSuccess,
          host: cleanHost,
          message: output || (isSuccess ? 'Successfully authenticated via SSH.' : `SSH exited with code ${code}`),
        });
      });
    });
  }
}

export default new SshMainService();
