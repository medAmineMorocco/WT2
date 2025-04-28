import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import BusinessError from '../exceptions/BusinessError';
import gitMainService from '../services/git/gitMainService';

const GIT_WORKTREES_DIR = (repoPath: string) =>
  path.join(repoPath, '.git', 'worktrees');

export function assertWorktreeExists(
  repoPath: string,
  worktreeName: string,
): void {
  const worktreePath = path.join(GIT_WORKTREES_DIR(repoPath), worktreeName);
  if (!fs.existsSync(worktreePath)) {
    throw new BusinessError(`Worktree "${worktreeName}" does not exist.`);
  }
}

export function assertWorktreePathIsAvailable(
  worktreeName: string,
  worktreePath: string,
): void {
  if (fs.existsSync(worktreePath)) {
    throw new BusinessError(
      `Directory for worktree "${worktreeName}" already exists.`,
    );
  }
}

export async function assertWorktreeCleanBeforeDelete(worktreePath: string) {
  const gitCommand = await gitMainService.gitCommand();
  const output = execSync(`"${gitCommand}" status --porcelain`, {
    cwd: worktreePath,
    encoding: 'utf-8',
  }).trim();

  if (output.length > 0) {
    throw new BusinessError(
      `Cannot delete worktree: it has uncommitted changes. use --force to delete it.`,
    );
  }
}

export function assertWorktreeNameValid(name: string): void {
  const isValid = /^[a-zA-Z0-9._-]+$/.test(name);
  if (!isValid) {
    throw new BusinessError(
      `Invalid worktree name "${name}". Only letters, numbers, '.', '-', and '_' are allowed.`,
    );
  }
}

export function assertWorktreePathValid(worktreePath: string): void {
  if (
    fs.existsSync(worktreePath) &&
    !fs.lstatSync(worktreePath).isDirectory()
  ) {
    throw new BusinessError(
      `Worktree path "${worktreePath}" exists but is not a directory.`,
    );
  }
}

export function assertPathWithinAllowedRoot(
  targetPath: string,
  allowedRoot: string,
): void {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(allowedRoot);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new BusinessError(
      `Path "${resolvedTarget}" is outside the allowed root "${resolvedRoot}".`,
    );
  }
}

export function assertWorktreeIsNotLocked(
  repoPath: string,
  worktreeName: string,
): void {
  const lockFile = path.join(
    GIT_WORKTREES_DIR(repoPath),
    worktreeName,
    'locked',
  );
  if (fs.existsSync(lockFile)) {
    throw new BusinessError(`Worktree "${worktreeName}" is locked.`);
  }
}

export async function assertWorktreeIsPrunable(
  repoPath: string,
  worktreeName: string,
): Promise<void> {
  try {
    const gitCmd = await gitMainService.gitCommand();
    const result = execSync(`${gitCmd} worktree list --porcelain`, {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    const isListed = result.includes(`worktrees/${worktreeName}`);
    if (isListed) {
      throw new BusinessError(
        `Worktree "${worktreeName}" is still listed by Git and is not prunable.`,
      );
    }
  } catch (err: any) {
    throw new BusinessError(
      `BusinessError checking prunable state for worktree "${worktreeName}": ${err.message}`,
    );
  }
}
