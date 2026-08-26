import fs from 'fs/promises';
import { existsSync, lstatSync } from 'fs';
import path from 'path';
import log from '../../utils/logger';
import worktreeMainService from './worktreeMainService';

export interface WorktreeWithNodeModules {
  path: string;
  name: string;
  isPrimary: boolean;
}

/**
 * Checks if a `node_modules` directory exists in the given project path.
 */
export async function hasNodeModules(projectPath: string): Promise<boolean> {
  if (!projectPath || typeof projectPath !== 'string') {
    return false;
  }
  try {
    const nodeModulesPath = path.resolve(projectPath, 'node_modules');
    if (!existsSync(nodeModulesPath)) {
      return false;
    }
    const stat = lstatSync(nodeModulesPath);
    return stat.isDirectory() || stat.isSymbolicLink();
  } catch (error: any) {
    log.debug(
      `[nodeModulesSharingService] Error checking node_modules in "${projectPath}": ${error?.message}`,
    );
    return false;
  }
}

/**
 * Retrieves all worktrees of the project that contain a valid node_modules directory.
 */
export async function getWorktreesWithNodeModules(
  projectPath: string,
): Promise<WorktreeWithNodeModules[]> {
  const result: WorktreeWithNodeModules[] = [];
  try {
    const allWorktrees = (await worktreeMainService.findAll(projectPath)) as any[];
    for (const wt of allWorktrees) {
      if (wt.path && (await hasNodeModules(wt.path))) {
        result.push({
          path: wt.path,
          name: wt.name || wt.resolvedName || path.basename(wt.path),
          isPrimary: Boolean(wt.isPrimary),
        });
      }
    }
  } catch (error: any) {
    log.debug(
      `[nodeModulesSharingService] Error finding worktrees with node_modules for "${projectPath}": ${error?.message}`,
    );
  }

  // If no worktrees were discovered via git list but the main path has node_modules, include it
  if (result.length === 0 && (await hasNodeModules(projectPath))) {
    result.push({
      path: projectPath,
      name: path.basename(projectPath),
      isPrimary: true,
    });
  }

  return result;
}

/**
 * Creates a native link (Windows junction or macOS/Linux symlink) from main project's node_modules
 * to the target worktree's node_modules.
 */
export async function linkNodeModules(
  mainProjectPath: string,
  targetWorktreePath: string,
): Promise<void> {
  const sourcePath = path.resolve(mainProjectPath, 'node_modules');
  const destinationPath = path.resolve(targetWorktreePath, 'node_modules');

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Cannot share node_modules: source directory does not exist at "${sourcePath}".`,
    );
  }

  if (existsSync(destinationPath)) {
    throw new Error(
      `Cannot share node_modules: destination already exists at "${destinationPath}".`,
    );
  }

  const symlinkType: 'junction' | 'dir' =
    process.platform === 'win32' ? 'junction' : 'dir';

  log.info(
    `[nodeModulesSharingService] Creating node_modules ${symlinkType} from "${sourcePath}" to "${destinationPath}"`,
  );

  try {
    await fs.symlink(sourcePath, destinationPath, symlinkType);
  } catch (error: any) {
    log.error(
      `[nodeModulesSharingService] Failed to create symlink from "${sourcePath}" to "${destinationPath}": ${error?.message}`,
    );
    throw new Error(
      `Failed to create node_modules link: ${error?.message || error}`,
    );
  }
}

export default {
  hasNodeModules,
  getWorktreesWithNodeModules,
  linkNodeModules,
};
