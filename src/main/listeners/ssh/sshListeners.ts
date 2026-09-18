import { ipcMain } from 'electron';
import sshMainService from '../../services/ssh/sshMainService';
import { GenerateSshKeyParams } from '../../../shared/ssh';
import log from '../../utils/logger';

ipcMain.handle('detect-ssh-keys', async () => {
  try {
    return await sshMainService.detectDefaultSshKeys();
  } catch (err: any) {
    log.error('IPC detect-ssh-keys error:', err);
    return {
      privateKeyPath: '',
      publicKeyPath: '',
      exists: false,
    };
  }
});

ipcMain.handle('read-ssh-public-key', async (_event, filePath: string) => {
  try {
    return await sshMainService.readPublicKeyContent(filePath);
  } catch (err: any) {
    log.error('IPC read-ssh-public-key error:', err);
    return '';
  }
});

ipcMain.handle(
  'generate-ssh-key',
  async (_event, params: GenerateSshKeyParams) => {
    return sshMainService.generateSshKeyPair(params);
  },
);

ipcMain.handle(
  'browse-ssh-key',
  async (_event, type: 'private' | 'public') => {
    return sshMainService.browseSshKeyFile(type);
  },
);

ipcMain.handle(
  'test-ssh-connection',
  async (_event, host: string, keyPath?: string) => {
    return sshMainService.testSshConnection(host, keyPath);
  },
);
