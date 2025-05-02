import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import BusinessError from '../exceptions/BusinessError';

export function assertWorktreeExists(repoPath: string, worktreeName: string) {
  const output = execSync('git worktree list --porcelain', {
    cwd: repoPath,
    encoding: 'utf-8',
  });

  const regex = /worktree (.+)\n/g;
  const matches = [...output.matchAll(regex)];

  const found = matches.some(([, worktreePath]) => {
    return (
      worktreePath.endsWith(`/${worktreeName}`) || worktreePath === worktreeName
    );
  });

  if (!found) {
    throw new BusinessError(`Worktree "${worktreeName}" does not exist.`);
  }
}

export function assertWorktreeNotExists(
  repoPath: string,
  worktreeName: string,
) {
  const output = execSync('git worktree list --porcelain', {
    cwd: repoPath,
    encoding: 'utf-8',
  });

  const regex = /worktree (.+)\n/g;
  const matches = [...output.matchAll(regex)];

  const exists = matches.some(([, worktreePath]) => {
    return (
      worktreePath.endsWith(`/${worktreeName}`) || worktreePath === worktreeName
    );
  });

  if (exists) {
    throw new BusinessError(`Worktree "${worktreeName}" already exists.`);
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

export async function assertWorktreeCleanBeforeDelete(
  worktreePath: string,
  gitCommand: string,
) {
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

export function assertBranchIsNotInUseInOtherWorktrees(
  repoPath: string,
  branchName: string,
  currentWorktreePath: string,
) {
  const output = execSync('git worktree list --porcelain', {
    cwd: repoPath,
    encoding: 'utf-8',
  });

  const entries = output.split('\n').reduce((acc: any[], line) => {
    if (line.startsWith('worktree ')) {
      acc.push({ worktree: line.replace('worktree ', '') });
    } else if (line.startsWith('branch ')) {
      acc[acc.length - 1].branch = line.replace('branch refs/heads/', '');
    }
    return acc;
  }, []);

  const branchInUseElsewhere = entries.some(
    (entry) =>
      entry.branch === branchName &&
      path.resolve(entry.worktree) !== path.resolve(currentWorktreePath),
  );
  if (branchInUseElsewhere) {
    throw new BusinessError(
      `Cannot delete branch "${branchName}" because it is checked out in another worktree.`,
    );
  }
}

export function assertBranchExists(repoPath: string, branchName: string): void {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, {
      cwd: repoPath,
    });
  } catch {
    throw new BusinessError(`Branch "${branchName}" does not exist.`);
  }
}

export function assertBranchNotExists(repoPath: string, branchName: string) {
  let branchExists: boolean;

  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, {
      cwd: repoPath,
    });
    branchExists = true;
  } catch (error: any) {
    branchExists = false;
  }

  if (branchExists) {
    throw new BusinessError(`Branch "${branchName}" already exists.`);
  }
}

export function assertTagExists(repoPath: string, tagName: string): void {
  try {
    execSync(`git show-ref --tags --verify --quiet refs/tags/${tagName}`, {
      cwd: repoPath,
    });
  } catch {
    throw new BusinessError(`Tag "${tagName}" does not exist.`);
  }
}

export function assertWriteAccess(dirPath: string): void {
  try {
    fs.accessSync(dirPath, fs.constants.W_OK);
  } catch {
    throw new BusinessError(`No write access to directory "${dirPath}".`);
  }
}
