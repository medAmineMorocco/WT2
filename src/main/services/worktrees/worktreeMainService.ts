import path from 'path';
import * as os from 'os';
import { existsSync, lstatSync } from 'node:fs';
import fs from 'node:fs/promises';
import gitMainService from '../git/gitMainService';
import {
  WorktreeDashboardDiskUsage,
  WorktreeDashboardItem,
} from '../../../shared/worktreeDashboard';
import {
  assertBranchExists,
  assertBranchIsNotInUseInOtherWorktrees,
  assertBranchNotExists,
  assertTagExists,
  assertWorktreeCleanBeforeDelete,
  assertWorktreeExists,
  assertWorktreeNotExists,
  assertWorktreePathIsAvailable,
  assertWriteAccess,
} from '../../validators/worktreeValidators';

const { exec, execSync, spawn } = require('child_process');

function runGit(gitExecutable: string, cwd: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(gitExecutable, args, {
      cwd,
      shell: false,
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', (code: number) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error(Buffer.concat(stderr).toString('utf8').trim()));
    });
  });
}

async function optionalGit(gitExecutable: string, cwd: string, args: string[]) {
  try {
    return await runGit(gitExecutable, cwd, args);
  } catch {
    return '';
  }
}

function parseChanges(statusOutput: string) {
  const counts = {
    modified: 0,
    added: 0,
    deleted: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicted: 0,
  };
  const changedFiles = statusOutput
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const status = entry.slice(0, 2);
      const filePath = entry.slice(3);
      if (status === '??') counts.untracked += 1;
      else {
        const [indexStatus, worktreeStatus] = status;
        if (indexStatus !== ' ') counts.staged += 1;
        if (worktreeStatus !== ' ') counts.unstaged += 1;
        if (/U|AA|DD/.test(status)) counts.conflicted += 1;
        if (status.includes('A')) counts.added += 1;
        else if (status.includes('D')) counts.deleted += 1;
        else counts.modified += 1;
      }
      return { path: filePath, status };
    });
  return { counts, changedFiles };
}

type DiskCategory = Exclude<keyof WorktreeDashboardDiskUsage, 'total'>;

const dependencyDirectories = new Set([
  'node_modules',
  'vendor',
  '.venv',
  'venv',
  '__pypackages__',
]);
const buildAndCacheDirectories = new Set([
  'dist',
  'build',
  'target',
  'out',
  '.next',
  'coverage',
  'release',
  '.cache',
  '.gradle',
  '__pycache__',
]);
const diskUsageCache = new Map<
  string,
  { measuredAt: number; usage: WorktreeDashboardDiskUsage }
>();
const diskUsageCacheDuration = 2 * 60 * 1000;

function emptyDiskUsage(): WorktreeDashboardDiskUsage {
  return {
    projectFiles: 0,
    dependencies: 0,
    buildAndCache: 0,
    git: 0,
    total: 0,
  };
}

function cachedDiskUsage(directory: string) {
  const cached = diskUsageCache.get(directory);
  return cached && Date.now() - cached.measuredAt < diskUsageCacheDuration
    ? cached.usage
    : null;
}

function diskCategory(name: string, inherited: DiskCategory): DiskCategory {
  if (inherited !== 'projectFiles') return inherited;
  const normalized = name.toLowerCase();
  if (normalized === '.git') return 'git';
  if (dependencyDirectories.has(normalized)) return 'dependencies';
  if (buildAndCacheDirectories.has(normalized)) return 'buildAndCache';
  return 'projectFiles';
}

async function directorySize(directory: string) {
  const cached = diskUsageCache.get(directory);
  if (cached && Date.now() - cached.measuredAt < diskUsageCacheDuration) {
    return cached.usage;
  }
  const usage = emptyDiskUsage();
  let pending: Array<{ directory: string; category: DiskCategory }> = [
    { directory, category: 'projectFiles' },
  ];
  while (pending.length > 0) {
    const batch = pending.splice(0, 32);
    const discovered = await Promise.all(
      batch.map(async (current) => {
        let entries;
        try {
          entries = await fs.readdir(current.directory, {
            withFileTypes: true,
          });
        } catch {
          return [];
        }
        const directories: Array<{
          directory: string;
          category: DiskCategory;
        }> = [];
        await Promise.all(
          entries.map(async (entry) => {
            const entryPath = path.join(current.directory, entry.name);
            const category = diskCategory(entry.name, current.category);
            if (entry.isDirectory()) {
              directories.push({ directory: entryPath, category });
            } else if (entry.isFile()) {
              try {
                const size = (await fs.stat(entryPath)).size;
                usage[category] += size;
                usage.total += size;
              } catch {
                // Files can disappear while the read-only scan is running.
              }
            }
          }),
        );
        return directories;
      }),
    );
    pending = pending.concat(discovered.flat());
  }
  diskUsageCache.set(directory, { measuredAt: Date.now(), usage });
  return usage;
}

function parseReflog(output: string) {
  const [date = '', message = ''] = output.trim().split('\0');
  return { date: date || null, message: message || null };
}

async function getLargeUntrackedFiles(
  worktreePath: string,
  changedFiles: Array<{ path: string; status: string }>,
) {
  const candidates = changedFiles.filter((file) => file.status === '??');
  const sizes = await Promise.all(
    candidates.map(async (file) => {
      try {
        const stats = await fs.stat(path.join(worktreePath, file.path));
        return stats.isFile() && stats.size >= 50 * 1024 * 1024
          ? { path: file.path, sizeBytes: stats.size }
          : null;
      } catch {
        return null;
      }
    }),
  );
  return sizes.filter(
    (item): item is { path: string; sizeBytes: number } => item !== null,
  );
}

function parseDivergence(output: string) {
  const [ahead = 0, behind = 0] = output.trim().split(/\s+/).map(Number);
  return { ahead, behind };
}

async function getDashboard(
  directory: string,
): Promise<WorktreeDashboardItem[]> {
  const [worktrees, gitExecutable] = await Promise.all([
    findAll(directory) as Promise<any[]>,
    gitMainService.gitCommand(),
  ]);
  const baseBranch = (
    await optionalGit(gitExecutable, directory, [
      'symbolic-ref',
      '--quiet',
      '--short',
      'refs/remotes/origin/HEAD',
    ])
  )
    .trim()
    .replace(/^origin\//, '');
  const localMain = await optionalGit(gitExecutable, directory, [
    'rev-parse',
    '--verify',
    'refs/heads/main',
  ]);
  const localMaster = await optionalGit(gitExecutable, directory, [
    'rev-parse',
    '--verify',
    'refs/heads/master',
  ]);
  const fallbackBase =
    baseBranch ||
    (localMain.trim() ? 'main' : localMaster.trim() ? 'master' : '');

  const dashboard = await Promise.all(
    worktrees.map(async (worktree): Promise<WorktreeDashboardItem> => {
      const directoryExists = existsSync(worktree.path);
      const [
        statusOutput,
        upstreamOutput,
        commitOutput,
        branchOutput,
        activityOutput,
        fetchOutput,
        pullOutput,
      ] = await Promise.all([
        optionalGit(gitExecutable, worktree.path, [
          'status',
          '--porcelain=v1',
          '--no-renames',
          '-z',
          '--untracked-files=normal',
        ]),
        optionalGit(gitExecutable, worktree.path, [
          'rev-parse',
          '--abbrev-ref',
          '--symbolic-full-name',
          '@{upstream}',
        ]),
        optionalGit(gitExecutable, worktree.path, [
          'log',
          '-1',
          '--format=%H%x00%an%x00%aI%x00%s',
        ]),
        optionalGit(gitExecutable, worktree.path, [
          'symbolic-ref',
          '--quiet',
          '--short',
          'HEAD',
        ]),
        optionalGit(gitExecutable, worktree.path, [
          'reflog',
          '-1',
          '--date=iso-strict',
          '--format=%cI%x00%gs',
        ]),
        optionalGit(gitExecutable, worktree.path, [
          'reflog',
          '--all',
          '-1',
          '--grep-reflog=fetch',
          '--date=iso-strict',
          '--format=%cI%x00%gs',
        ]),
        optionalGit(gitExecutable, worktree.path, [
          'reflog',
          '--all',
          '-1',
          '--grep-reflog=pull',
          '--date=iso-strict',
          '--format=%cI%x00%gs',
        ]),
      ]);
      const cachedUsage = directoryExists
        ? cachedDiskUsage(worktree.path)
        : emptyDiskUsage();
      const diskUsage = cachedUsage || emptyDiskUsage();
      const upstream = upstreamOutput.trim() || null;
      const upstreamDivergence = upstream
        ? parseDivergence(
            await optionalGit(gitExecutable, worktree.path, [
              'rev-list',
              '--left-right',
              '--count',
              `HEAD...${upstream}`,
            ]),
          )
        : { ahead: 0, behind: 0 };
      const effectiveBase = fallbackBase || null;
      const baseDivergence = effectiveBase
        ? parseDivergence(
            await optionalGit(gitExecutable, worktree.path, [
              'rev-list',
              '--left-right',
              '--count',
              `HEAD...${effectiveBase}`,
            ]),
          )
        : { ahead: 0, behind: 0 };
      const parsedChanges = parseChanges(statusOutput);
      const branchName = branchOutput.trim();
      const isDetached = !branchName;
      const activity = parseReflog(activityOutput);
      const fetch = parseReflog(fetchOutput);
      const pull = parseReflog(pullOutput);
      const commitParts = commitOutput.trim().split('\0');
      const latestCommit = commitParts[0]
        ? {
            hash: commitParts[0],
            author: commitParts[1] || '',
            date: commitParts[2] || '',
            subject: commitParts[3] || '',
          }
        : null;
      const largeUntrackedFiles = await getLargeUntrackedFiles(
        worktree.path,
        parsedChanges.changedFiles,
      );
      const needsPrune = Boolean(worktree.prunable || !directoryExists);
      const nudges = [
        ...(needsPrune ? ['This worktree should be pruned.'] : []),
        ...(upstreamDivergence.behind > 0
          ? [`Fetch or pull ${upstreamDivergence.behind} incoming commits.`]
          : []),
        ...(upstreamDivergence.ahead > 0
          ? [`Push ${upstreamDivergence.ahead} local commits.`]
          : []),
        ...(parsedChanges.changedFiles.length >= 50
          ? [`Review ${parsedChanges.changedFiles.length} local file changes.`]
          : []),
        ...(largeUntrackedFiles.length > 0
          ? [`Review ${largeUntrackedFiles.length} large untracked files.`]
          : []),
      ];
      const warning = worktree.prunable
        ? 'Worktree is marked as prunable.'
        : parsedChanges.counts.conflicted > 0
          ? `${parsedChanges.counts.conflicted} conflicted files.`
          : upstreamDivergence.behind > 0
            ? `${upstreamDivergence.behind} commits behind upstream.`
            : null;
      return {
        ...worktree,
        name: isDetached ? 'DETACHED HEAD' : branchName || worktree.name,
        isDetached,
        directoryExists,
        isStale: !directoryExists,
        needsPrune,
        diskUsageBytes: diskUsage.total,
        diskUsage,
        diskUsagePending: directoryExists && cachedUsage === null,
        changes: parsedChanges.counts,
        changedFiles: parsedChanges.changedFiles,
        upstream,
        ahead: upstreamDivergence.ahead,
        behind: upstreamDivergence.behind,
        baseBranch: effectiveBase,
        baseAhead: baseDivergence.ahead,
        baseBehind: baseDivergence.behind,
        latestCommit,
        lastActivity: activity.date,
        lastFetch: fetch.date,
        lastFetchMessage: fetch.message,
        lastPull: pull.date,
        lastPullMessage: pull.message,
        largeUntrackedFiles,
        environmentSources: [],
        ports: [],
        warning,
        nudges,
      };
    }),
  );
  return dashboard;
}

function isPrimaryWorktree(directory: string) {
  return (
    existsSync(path.join(directory, '.git')) &&
    lstatSync(path.join(directory, '.git')).isDirectory()
  );
}

function sanitizeWorktreeName(worktreeName: string) {
  return worktreeName.replace(/\//g, '-').replace(/[:*?"<>|\\]/g, '-');
}

function resolveWorktreeNamePattern(
  pattern: string | null,
  repo: string,
  branch: string,
): string {
  if (!pattern || (pattern && pattern.trim() === '')) {
    return branch;
  }
  return pattern.replaceAll(/{repo}/g, repo).replaceAll(/{branch}/g, branch);
}

function getPathPreviewOfPattern(
  name: string,
  worktreePath: string,
  pattern: string,
  dir: string,
) {
  return new Promise((resolve, reject) => {
    try {
      const sanitizedWorktreeName = sanitizeWorktreeName(name);

      const resolvedWorktreeName = resolveWorktreeNamePattern(
        pattern,
        path.basename(dir),
        sanitizedWorktreeName,
      );
      const pathPreview = path.normalize(
        path.join(worktreePath, '..', resolvedWorktreeName),
      );
      resolve(pathPreview);
    } catch (err: any) {
      reject(err.toString());
    }
  });
}

function findAll(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      exec(
        `"${gitCommand}" worktree list`,
        {
          cwd: directory,
        },
        (error: any, stdout: any) => {
          if (error) {
            reject(error);
          }
          const lines = stdout.trim().split('\n');

          const worktrees = lines.map((line: string) => {
            const lineBySpace = line.split(/\s+/g);
            const pathRep = lineBySpace[0];
            const head = lineBySpace[1];
            let name = '';
            if (lineBySpace[2]) {
              name = lineBySpace[2].replace('[', '').replace(']', '');
            }
            const isLocked = lineBySpace[3] === 'locked';
            const prunable = lineBySpace[3] === 'prunable';

            return {
              isPrimary: isPrimaryWorktree(pathRep),
              path: pathRep,
              name,
              resolvedName: path.basename(pathRep),
              head,
              isLocked,
              prunable,
            };
          });
          resolve(worktrees);
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

async function branchExists(branchName: string, dir: string) {
  try {
    const gitCommand = await gitMainService.gitCommand();
    execSync(`"${gitCommand}" rev-parse --verify refs/heads/${branchName}`, {
      stdio: 'ignore',
      cwd: dir,
    });
    return true;
  } catch (error) {
    return false;
  }
}

function getWorktreesSeparator() {
  return new Promise((resolve, reject) => {
    try {
      const separator = os.platform() === 'win32' ? '\\' : '/';
      resolve(separator);
    } catch (err: any) {
      reject(err.toString());
    }
  });
}

function add(
  name: string,
  worktreePath: string,
  createWorktreeMode: string,
  dir: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      assertWorktreeNotExists(dir, name);
      assertWorktreePathIsAvailable(name, worktreePath);
      const parentDir = path.dirname(worktreePath);
      assertWriteAccess(parentDir);
      let command: string;
      if (createWorktreeMode === 'existing-branch') {
        assertBranchExists(dir, name);
        command = `"${gitCommand}" worktree add ${worktreePath} ${name}`;
      } else if (createWorktreeMode === 'existing-tag') {
        assertTagExists(dir, name);
        const branchNameForTag = name.replaceAll('.', '-');
        const branchExist = await branchExists(branchNameForTag, dir);
        if (!branchExist) {
          try {
            execSync(`"${gitCommand}" branch ${branchNameForTag} ${name}`, {
              cwd: dir,
            });
          } catch (e) {
            reject(e);
          }
        }
        command = `"${gitCommand}" worktree add ${worktreePath} ${branchNameForTag}`;
      } else {
        assertBranchNotExists(dir, name);
        command = `"${gitCommand}" worktree add -b ${name} ${worktreePath}`;
      }
      execSync(command, {
        cwd: dir,
      });
      resolve('created');
    } catch (e) {
      reject(e);
    }
  });
}

function addFromCommit(
  hash: string,
  worktreesPath: string,
  dir: string,
  pattern: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const branchNameForCommit = `temp-${hash}`;
      const separator = await getWorktreesSeparator();
      let worktreePath;

      if (worktreesPath) {
        worktreePath = worktreesPath + separator + branchNameForCommit;
      } else {
        worktreePath = path.join(dir, '..', branchNameForCommit);
      }
      const worktreePathPreview = (await getPathPreviewOfPattern(
        branchNameForCommit,
        worktreePath,
        pattern,
        dir,
      )) as string;
      const gitCommand = await gitMainService.gitCommand();
      assertBranchNotExists(dir, branchNameForCommit);
      assertWorktreeNotExists(dir, branchNameForCommit);
      assertWorktreePathIsAvailable(branchNameForCommit, worktreePathPreview);
      const parentDir = path.dirname(worktreePathPreview);
      assertWriteAccess(parentDir);
      try {
        execSync(`"${gitCommand}" branch ${branchNameForCommit} ${hash}`, {
          cwd: dir,
        });
      } catch (e) {
        reject(e);
      }
      const command = `"${gitCommand}" worktree add ${worktreePathPreview} ${branchNameForCommit}`;
      execSync(command, {
        cwd: dir,
      });
      resolve('created');
    } catch (e) {
      reject(e);
    }
  });
}

function remove(
  worktreeName: string,
  worktreePath: string,
  dir: string,
  force: boolean,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      const sanitizedWorktreeName = sanitizeWorktreeName(worktreeName);
      assertWorktreeExists(dir, sanitizedWorktreeName);
      if (!force) {
        await assertWorktreeCleanBeforeDelete(worktreePath, gitCommand);
      }
      assertWriteAccess(worktreePath);
      const command = force
        ? `"${gitCommand}" worktree remove ${worktreePath} --force`
        : `"${gitCommand}" worktree remove ${worktreePath}`;
      exec(
        command,
        {
          cwd: dir,
        },
        (error: any, stdout: any) => {
          if (error) {
            reject(error);
          }
          resolve(stdout);
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

function removeWithLocalBranch(
  name: string,
  worktreePath: string,
  dir: string,
  force: boolean,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      const sanitizedWorktreeName = sanitizeWorktreeName(name);
      assertWorktreeExists(dir, sanitizedWorktreeName);
      if (!force) {
        await assertWorktreeCleanBeforeDelete(worktreePath, gitCommand);
      }
      assertBranchIsNotInUseInOtherWorktrees(dir, name, worktreePath);
      assertWriteAccess(worktreePath);

      const command = force
        ? `"${gitCommand}" worktree remove ${worktreePath} --force`
        : `"${gitCommand}" worktree remove ${worktreePath}`;
      exec(
        command,
        {
          cwd: dir,
        },
        (error: any) => {
          if (error) {
            reject(error);
          }
          exec(
            `"${gitCommand}" branch -D ${name}`,
            {
              cwd: dir,
            },
            (error2: any) => {
              if (error2) {
                reject(error2);
              }
              resolve('ok');
            },
          );
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

function rename(
  oldName: string,
  newName: string,
  oldWorktreePath: string,
  dir: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      assertWorktreeNotExists(dir, newName);
      const sanitizedNewWorktreeName = sanitizeWorktreeName(newName);
      const sanitizedOldWorktreeName = sanitizeWorktreeName(oldName);
      const resolvedOldWorktreeName = path.basename(oldWorktreePath);

      const resolvedNewWorktreeName = resolvedOldWorktreeName.replace(
        sanitizedOldWorktreeName,
        sanitizedNewWorktreeName,
      );
      const newWorktreePath = path.normalize(
        path.join(oldWorktreePath, '..', resolvedNewWorktreeName),
      );
      assertWorktreePathIsAvailable(newName, newWorktreePath);
      assertWriteAccess(oldWorktreePath);
      exec(
        `"${gitCommand}" worktree move ${resolvedOldWorktreeName} ${newWorktreePath} && "${gitCommand}" branch -m ${oldName} ${newName}`,
        {
          cwd: dir,
        },
        (error: any, stdout: any) => {
          if (error) {
            reject(error);
          }
          resolve(stdout);
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

function prune(dir: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      exec(
        `"${gitCommand}" worktree prune`,
        {
          cwd: dir,
        },
        (error: any, stdout: any) => {
          if (error) {
            reject(error);
          }
          resolve(stdout);
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

function changeLock(toLock: boolean, worktreePath: string, dir: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      const resolvedWorktreeName = path.basename(worktreePath);
      assertWorktreeExists(dir, resolvedWorktreeName);
      const command = toLock
        ? `"${gitCommand}" worktree lock ${resolvedWorktreeName}`
        : `"${gitCommand}" worktree unlock ${resolvedWorktreeName}`;
      exec(
        command,
        {
          cwd: dir,
        },
        (error: any, stdout: any) => {
          if (error) {
            reject(error);
          }
          resolve(stdout);
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

function getWorktreesFolder(dir: string) {
  return new Promise((resolve, reject) => {
    try {
      const folder = path.normalize(path.join(dir, '..'));
      const separator = os.platform() === 'win32' ? '\\' : '/';
      resolve({
        folder,
        separator,
      });
    } catch (err: any) {
      reject(err.toString());
    }
  });
}

function moveWorktreeToFolder(
  name: string,
  newWorktreePath: string,
  worktreePath: string,
  dir: string,
) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const gitCommand = await gitMainService.gitCommand();
      assertWorktreePathIsAvailable(name, newWorktreePath);
      const parentDir = path.dirname(newWorktreePath);
      assertWriteAccess(parentDir);
      const resolvedWorktreeName = path.basename(worktreePath);
      exec(
        `"${gitCommand}" worktree move ${resolvedWorktreeName} ${newWorktreePath}`,
        {
          cwd: dir,
        },
        (error: any, stdout: any) => {
          if (error) {
            reject(error);
          }
          resolve(stdout);
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

export default {
  findAll,
  getDashboard,
  getDashboardDiskUsage: directorySize,
  add,
  addFromCommit,
  remove,
  removeWithLocalBranch,
  rename,
  prune,
  changeLock,
  getWorktreesFolder,
  getWorktreesSeparator,
  moveWorktreeToFolder,
  branchExists,
  getPathPreviewOfPattern,
};
