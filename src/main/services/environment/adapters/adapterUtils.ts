import fs from 'node:fs/promises';
import path from 'node:path';
import { EnvironmentSettingKind } from '../../../../shared/environmentIsolation';

export const SENSITIVE_NAME =
  /(SECRET|TOKEN|PASSWORD|PASS|API_KEY|PRIVATE_KEY|CREDENTIAL)/i;

export function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

export function resolveRepositoryFile(
  rootPath: string,
  relativePath: string,
): string {
  const root = path.resolve(rootPath);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Environment source path is outside the repository.');
  }
  return resolved;
}

export function settingKind(
  key: string,
  value: string,
): EnvironmentSettingKind {
  if (key.toUpperCase().includes('PORT') && /^\d+$/.test(value)) return 'port';
  if (/^https?:\/\//i.test(value)) return 'url';
  if (/^\d+$/.test(value)) return 'number';
  if (value) return 'string';
  return 'unknown';
}

export async function writeFileAtomically(
  targetPath: string,
  contents: string,
): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.writeFile(temporaryPath, contents, { flag: 'wx' });
    await fs.link(temporaryPath, targetPath);
    await fs.rm(temporaryPath);
  } catch (error: any) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    if (error?.code === 'EEXIST') {
      throw new Error(
        `${path.basename(targetPath)} already exists; it was not overwritten.`,
      );
    }
    throw error;
  }
}
