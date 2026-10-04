import fs from 'fs/promises';
import { existsSync, lstatSync } from 'fs';
import path from 'path';
import log from '../../utils/logger';

export interface WorktreeWithPythonVenv {
  path: string;
  name: string;
  isPrimary: boolean;
}

export async function hasPythonVenv(projectPath: string): Promise<boolean> {
  if (!projectPath || typeof projectPath !== 'string') return false;
  try {
    const venvPath = path.resolve(projectPath, '.venv');
    const configPath = path.resolve(venvPath, 'pyvenv.cfg');
    if (!existsSync(venvPath) || !existsSync(configPath)) return false;
    const stat = lstatSync(venvPath);
    return stat.isDirectory() || stat.isSymbolicLink();
  } catch (error: any) {
    log.debug(
      `[pythonVenvSharingService] Error checking .venv in "${projectPath}": ${error?.message}`,
    );
    return false;
  }
}

export async function getWorktreesWithPythonVenv(
  projectPath: string,
): Promise<WorktreeWithPythonVenv[]> {
  const result: WorktreeWithPythonVenv[] = [];
  try {
    const worktreeModule = await import('./worktreeMainService');
    const worktreeMainService = worktreeModule.default as unknown as {
      findAll: (directory: string) => Promise<any[]>;
    };
    const allWorktrees = await worktreeMainService.findAll(projectPath);
    for (const worktree of allWorktrees) {
      if (worktree.path && (await hasPythonVenv(worktree.path))) {
        result.push({
          path: worktree.path,
          name:
            worktree.name ||
            worktree.resolvedName ||
            path.basename(worktree.path),
          isPrimary: Boolean(worktree.isPrimary),
        });
      }
    }
  } catch (error: any) {
    log.debug(
      `[pythonVenvSharingService] Error finding worktrees with .venv for "${projectPath}": ${error?.message}`,
    );
  }

  if (result.length === 0 && (await hasPythonVenv(projectPath))) {
    result.push({
      path: projectPath,
      name: path.basename(projectPath),
      isPrimary: true,
    });
  }
  return result;
}

export async function linkPythonVenv(
  sourceProjectPath: string,
  targetWorktreePath: string,
): Promise<void> {
  const sourcePath = path.resolve(sourceProjectPath, '.venv');
  const destinationPath = path.resolve(targetWorktreePath, '.venv');

  if (!(await hasPythonVenv(sourceProjectPath))) {
    throw new Error(
      `Cannot share .venv: a valid Python virtual environment does not exist at "${sourcePath}".`,
    );
  }
  if (existsSync(destinationPath)) {
    throw new Error(
      `Cannot share .venv: destination already exists at "${destinationPath}".`,
    );
  }

  const symlinkType: 'junction' | 'dir' =
    process.platform === 'win32' ? 'junction' : 'dir';
  log.info(
    `[pythonVenvSharingService] Creating .venv ${symlinkType} from "${sourcePath}" to "${destinationPath}"`,
  );
  try {
    await fs.symlink(sourcePath, destinationPath, symlinkType);
  } catch (error: any) {
    log.error(
      `[pythonVenvSharingService] Failed to create link from "${sourcePath}" to "${destinationPath}": ${error?.message}`,
    );
    throw new Error(`Failed to create .venv link: ${error?.message || error}`);
  }
}

export default {
  hasPythonVenv,
  getWorktreesWithPythonVenv,
  linkPythonVenv,
};
