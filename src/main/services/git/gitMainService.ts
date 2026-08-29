import { execSync, spawn } from 'child_process';
import log from '../../utils/logger';
import utils from '../../utils/utils';
import BusinessError from '../../exceptions/BusinessError';
import {
  CommitChangedFile,
  CommitChangedFilesResult,
} from '../../../shared/gitCommit';
import {
  WorkingTreeAction,
  WorkingTreeStatus,
} from '../../../shared/workingTree';

const zlib = require('zlib');

interface LogCacheEntry {
  buffer: Buffer;
  hasMore: boolean;
  lastChecked: number;
}

const MAX_LOG_CACHE_ENTRIES = 10;
const logCache = new Map<string, LogCacheEntry>();

function setLogCache(key: string, entry: LogCacheEntry) {
  if (logCache.has(key)) {
    logCache.delete(key);
  } else if (logCache.size >= MAX_LOG_CACHE_ENTRIES) {
    const oldestKey = logCache.keys().next().value;
    if (oldestKey) logCache.delete(oldestKey);
  }
  logCache.set(key, entry);
}

async function gitCommand() {
  const storedGitExecutable = await utils.getStorageItem('gitExecutablePath');
  const gitExecutable = storedGitExecutable || 'git';

  let output;
  try {
    output = execSync(`"${gitExecutable}" --version`, { stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    throw new BusinessError(
      `Git is not installed, not accessible, or the path "${gitExecutable}" is invalid. Please check your settings.`,
    );
  }

  if (!output.toLowerCase().includes('git version')) {
    throw new BusinessError(
      `"${gitExecutable}" is not a valid Git executable. Please configure a correct path in the settings.`,
    );
  }

  return gitExecutable;
}

function getShell() {
  return utils.getStorageItem('shellPath');
}

function getStashes(
  gitCmd: string,
  directory: string,
): { hash: string; shortHash: string; ref: string }[] {
  try {
    const output = execSync(`"${gitCmd}" stash list --format="%H %h %gd"`, {
      cwd: directory,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (!output) return [];
    return output
      .split('\n')
      .map((line) => {
        const [fullHash, shortHash, ...refParts] = line.trim().split(' ');
        return {
          hash: fullHash?.trim(),
          shortHash: shortHash?.trim(),
          ref: refParts.join(' ').trim(),
        };
      })
      .filter((item) => Boolean(item.hash && item.ref));
  } catch {
    return [];
  }
}

function decorateStashLines(
  text: string,
  stashHashMap: Map<string, string>,
): string {
  return text
    .split('\n')
    .filter((line) => {
      if (!line || !line.trim()) return false;
      // Filter out internal Git stash index/untracked commits
      if (/^(?:[*|/\\ ]*)?(?:index|untracked files) on [^:]+:\s/i.test(line)) {
        return false;
      }
      return true;
    })
    .map((line) => {
      const match = line.match(
        /^(.*?)(?: \(([^)]+)\))? <([^>]+)> \[([^\]]+)\]\s+([a-f0-9]{7,40})(?:\s+parents:\[(.*?)\])?$/,
      );
      if (!match) return line;

      const [, subject, existingRefs, author, date, hash, parentsStr = ''] =
        match;
      const stashRef = stashHashMap.get(hash);
      const isStash =
        Boolean(stashRef) ||
        Boolean(
          existingRefs &&
          (existingRefs.includes('stash') ||
            existingRefs.includes('refs/stash')),
        );

      if (!isStash) return line;

      // Keep only first parent (the base branch commit) for clean single-node stash
      const firstParent = parentsStr.trim().split(/\s+/)[0] || '';
      const parentSegment = firstParent ? ` parents:[${firstParent}]` : '';

      const targetRef =
        stashRef ||
        (existingRefs
          ? existingRefs.replace(/^refs\/stash/, 'stash@{0}')
          : 'stash@{0}');

      let refsGroup = targetRef;
      if (existingRefs) {
        if (existingRefs.includes('stash')) {
          refsGroup = existingRefs.replace(/^refs\/stash/, 'stash@{0}');
        } else {
          refsGroup = `${existingRefs}, ${targetRef}`;
        }
      }

      return `${subject} (${refsGroup}) <${author}> [${date}] ${hash}${parentSegment}`;
    })
    .join('\n');
}

function showLogAsync(
  directory: string,
  branch: string | null,
  author: string | null,
  skip = 0,
  limit = 40,
): Promise<{ buffer: Buffer; hasMore: boolean }> {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    // Cache only the default Git Log
    const shouldUseCache =
      branch === undefined &&
      author === undefined &&
      skip === 0 &&
      limit === 40;

    if (shouldUseCache) {
      const cached = logCache.get(directory);
      const now = Date.now();
      if (cached && now - cached.lastChecked < 60000) {
        resolve({ buffer: cached.buffer, hasMore: cached.hasMore });
        return;
      }
    }

    const gitCmd = await gitCommand();
    const stashes = getStashes(gitCmd, directory);
    const stashHashMap = new Map<string, string>();
    stashes.forEach((s) => {
      stashHashMap.set(s.hash, s.ref);
      stashHashMap.set(s.shortHash, s.ref);
    });

    const stashArgs =
      stashes.length > 0
        ? `--glob=refs/stash ${stashes.map((s) => s.hash).join(' ')}`
        : '--glob=refs/stash';

    const branchOrAll = branch || '--all';
    const gitFormat = '%s %d <%an> [%ci] %h parents:[%p]';
    const command = `"${gitCmd}" log --skip=${skip} -n ${limit} ${branchOrAll} ${stashArgs} ${author ? `--author="${author}"` : ''} --oneline --decorate --abbrev-commit --no-color --date-order --format="${gitFormat}"`;

    const git = spawn(command, {
      cwd: directory,
      shell: true,
    });

    const rawChunks: Buffer[] = [];

    git.stdout.on('data', (c: any) => rawChunks.push(c));

    git.stderr.on('data', (chunk) => {
      reject(new Error(chunk.toString()));
    });

    git.on('error', reject);
    git.on('close', (code: any) => {
      if (code !== 0) {
        reject(new Error('git log failed'));
        return;
      }

      const rawText = Buffer.concat(rawChunks).toString('utf-8');
      const rawLines = rawText.split('\n').filter((l) => l.trim().length > 0);
      const hasMore = rawLines.length >= limit;
      const decoratedText = decorateStashLines(rawText, stashHashMap);
      zlib.gzip(
        Buffer.from(decoratedText, 'utf-8'),
        (err: any, buffer: Buffer) => {
          if (err) {
            reject(err);
            return;
          }

          if (shouldUseCache) {
            try {
              setLogCache(directory, {
                buffer,
                hasMore,
                lastChecked: Date.now(),
              });
            } catch {
              // Ignore cache update errors
            }
          }

          resolve({ buffer, hasMore });
        },
      );
    });
  });
}

async function showDiff(
  val1: string,
  val2: string,
  diffFilters: string,
  isAll: boolean,
  directory: string,
) {
  const gitCmd = await gitCommand();

  const args = [
    'diff',
    '--no-ext-diff',
    '--no-renames',
    '--no-color',
    '--no-ext-diff',
    '--diff-algorithm=histogram',
    '-U1',
    val1,
    val2,
  ];

  if (!isAll) {
    let filter = '';
    if (diffFilters.includes('added')) filter += 'A';
    if (diffFilters.includes('deleted')) filter += 'D';
    if (diffFilters.includes('modified')) filter += 'M';

    if (filter) {
      args.push(`--diff-filter=${filter}`);
    }
  }

  return new Promise<Buffer>((resolve, reject) => {
    const git = spawn(gitCmd, args, {
      cwd: directory,
      shell: false,
    });

    const gzip = zlib.createGzip();
    const chunks: Buffer[] = [];

    git.stdout.pipe(gzip);

    gzip.on('data', (c: any) => chunks.push(c));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));

    git.on('error', reject);

    git.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('git diff failed'));
      }
    });
  });
}

async function runGit(directory: string, args: string[]): Promise<Buffer> {
  const gitCmd = await gitCommand();
  return new Promise((resolve, reject) => {
    const child = spawn(gitCmd, args, {
      cwd: directory,
      shell: false,
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
      } else {
        reject(
          new Error(
            Buffer.concat(stderr).toString().trim() ||
              `Git exited with code ${code}.`,
          ),
        );
      }
    });
  });
}

async function runGitWithAllowedCodes(
  directory: string,
  args: string[],
  allowedCodes: number[],
): Promise<Buffer> {
  const gitCmd = await gitCommand();
  return new Promise((resolve, reject) => {
    const child = spawn(gitCmd, args, {
      cwd: directory,
      shell: false,
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== null && allowedCodes.includes(code)) {
        resolve(Buffer.concat(stdout));
      } else {
        reject(new Error(Buffer.concat(stderr).toString().trim()));
      }
    });
  });
}

async function runGitWithInput(
  directory: string,
  args: string[],
  input: string,
) {
  const gitCmd = await gitCommand();
  return new Promise<void>((resolve, reject) => {
    const child = spawn(gitCmd, args, {
      cwd: directory,
      shell: false,
      windowsHide: true,
    });
    const stderr: Buffer[] = [];
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(Buffer.concat(stderr).toString().trim()));
    });
    child.stdin.end(input);
  });
}

async function getWorkingTreeStatus(
  directory: string,
): Promise<WorkingTreeStatus> {
  const [statusOutput, branchOutput] = await Promise.all([
    runGit(directory, [
      'status',
      '--porcelain=v1',
      '-z',
      '--no-renames',
      '--untracked-files=all',
    ]),
    runGit(directory, ['branch', '--show-current']),
  ]);
  const entries = statusOutput.toString('utf8').split('\0').filter(Boolean);
  const files = [] as WorkingTreeStatus['files'];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const indexStatus = entry[0] || ' ';
    const worktreeStatus = entry[1] || ' ';
    let filePath = entry.slice(3);
    if ((indexStatus === 'R' || indexStatus === 'C') && entries[index + 1]) {
      filePath = `${entries[index + 1]} → ${filePath}`;
      index += 1;
    }
    files.push({
      path: filePath,
      indexStatus,
      worktreeStatus,
      staged: indexStatus !== ' ' && indexStatus !== '?',
      unstaged: worktreeStatus !== ' ' || indexStatus === '?',
      untracked: indexStatus === '?' && worktreeStatus === '?',
    });
  }
  return { branch: branchOutput.toString('utf8').trim(), files };
}

async function runWorkingTreeAction(
  directory: string,
  action: WorkingTreeAction,
  paths: string[] = [],
) {
  const actionArgs: Record<WorkingTreeAction, string[]> = {
    pull: ['pull'],
    push: ['push'],
    stash: ['stash', 'push', '--include-untracked'],
    pop: ['stash', 'pop'],
    stage: ['add', '--', ...paths],
    unstage: ['restore', '--staged', '--', ...paths],
    'stage-all': ['add', '--all'],
    'unstage-all': ['reset', '--mixed', 'HEAD'],
  };
  const output = await runGit(directory, actionArgs[action]);
  logCache.delete(directory);
  return output.toString('utf8').trim();
}

async function commitWorkingTree(
  directory: string,
  summary: string,
  description: string,
  amend: boolean,
) {
  const message = description.trim()
    ? `${summary.trim()}\n\n${description.trim()}`
    : summary.trim();
  const args = ['commit'];
  if (amend) args.push('--amend');
  args.push('-m', message);
  const output = await runGit(directory, args);
  logCache.delete(directory);
  return output.toString('utf8').trim();
}

async function getWorkingTreeFileDiff(
  directory: string,
  filePath: string,
  staged: boolean,
  untracked: boolean,
) {
  let output: Buffer;
  if (untracked) {
    output = await runGitWithAllowedCodes(
      directory,
      ['diff', '--no-index', '--no-color', '--', '/dev/null', filePath],
      [0, 1],
    );
  } else {
    const args = ['diff', '--no-ext-diff', '--no-color', '-U3'];
    if (staged) args.push('--cached');
    args.push('--', filePath);
    output = await runGit(directory, args);
  }
  return output.toString('utf8');
}

async function getHeadCommitMessage(directory: string) {
  const output = await runGit(directory, ['log', '-1', '--format=%B']);
  const message = output.toString('utf8').trimEnd();
  const [summary = '', ...descriptionLines] = message.split(/\r?\n/);
  return {
    summary,
    description: descriptionLines.join('\n').trim(),
  };
}

async function applyWorkingTreeLine(
  directory: string,
  patch: string,
  staged: boolean,
) {
  const args = ['apply', '--cached', '--unidiff-zero', '--whitespace=nowarn'];
  if (staged) args.push('--reverse');
  await runGitWithInput(directory, args, patch);
}

async function discardWorkingTreeLine(directory: string, patch: string) {
  await runGitWithInput(
    directory,
    ['apply', '--reverse', '--unidiff-zero', '--whitespace=nowarn'],
    patch,
  );
}

async function discardWorkingTreeFile(
  directory: string,
  filePath: string,
  untracked: boolean,
) {
  if (untracked) {
    await runGit(directory, ['clean', '-fd', '--', filePath]);
  } else {
    await runGit(directory, ['restore', '--worktree', '--', filePath]);
  }
}

async function getCommitChangedFiles(
  commit: string,
  directory: string,
): Promise<CommitChangedFilesResult> {
  const [numstatOutput, statusOutput] = await Promise.all([
    runGit(directory, [
      'show',
      '--format=',
      '--first-parent',
      '--no-renames',
      '--numstat',
      '-z',
      commit,
    ]),
    runGit(directory, [
      'show',
      '--format=',
      '--first-parent',
      '--no-renames',
      '--name-status',
      '-z',
      commit,
    ]),
  ]);
  const statuses = new Map<string, string>();
  const statusParts = statusOutput.toString('utf8').split('\0').filter(Boolean);
  for (let index = 0; index + 1 < statusParts.length; index += 2) {
    statuses.set(statusParts[index + 1], statusParts[index]);
  }
  const files: CommitChangedFile[] = numstatOutput
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .flatMap((entry) => {
      const firstTab = entry.indexOf('\t');
      const secondTab = entry.indexOf('\t', firstTab + 1);
      if (firstTab < 0 || secondTab < 0) return [];
      const additionsText = entry.slice(0, firstTab);
      const deletionsText = entry.slice(firstTab + 1, secondTab);
      const filePath = entry.slice(secondTab + 1);
      const binary = additionsText === '-' || deletionsText === '-';
      return [
        {
          path: filePath,
          status: statuses.get(filePath) || 'M',
          additions: binary ? null : Number(additionsText),
          deletions: binary ? null : Number(deletionsText),
          binary,
        },
      ];
    });
  return {
    files,
    additions: files.reduce((total, file) => total + (file.additions || 0), 0),
    deletions: files.reduce((total, file) => total + (file.deletions || 0), 0),
  };
}

async function getCommitFileDiff(
  commit: string,
  filePath: string,
  directory: string,
): Promise<Buffer> {
  const patch = await runGit(directory, [
    'show',
    '--format=',
    '--first-parent',
    '--no-ext-diff',
    '--no-renames',
    '--no-color',
    '--diff-algorithm=histogram',
    '-U3',
    commit,
    '--',
    filePath,
  ]);
  return new Promise((resolve, reject) => {
    zlib.gzip(patch, (error: Error | null, compressed: Buffer) => {
      if (error) reject(error);
      else resolve(compressed);
    });
  });
}

function executeCommand(command: string, directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const shell = await getShell();
    const options = {
      cwd: directory,
      shell: shell || true,
    } as any;
    try {
      const stdout = execSync(command, options);
      resolve(stdout);
    } catch (error) {
      reject(error);
    }
  });
}

function listBranches(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
    } as any;
    try {
      const gitCmd = await gitCommand();
      log.debug(`** gitCmd: ${gitCmd}`);

      const allBranches = execSync(
        `"${gitCmd}" branch --format="%(refname:short)"`,
        options,
      )
        .toString()
        .trim()
        .split('\n');
      log.debug(`** allBranches: ${allBranches}`);

      const worktreeOutput = execSync(
        `"${gitCmd}" worktree list --porcelain`,
        options,
      );

      const worktreeBranches = worktreeOutput
        .toString()
        .trim()
        .split('\n')
        .filter((line) => line.startsWith('branch '))
        .map((line) => line.split(' ')[1].replace('refs/heads/', ''));
      log.debug(`** worktreeBranches: ${worktreeBranches}`);

      const branchesNotInWorktrees = allBranches.filter(
        (branch) => !worktreeBranches.includes(branch),
      );
      log.debug(`** branchesNotInWorktrees: ${branchesNotInWorktrees}`);

      resolve(branchesNotInWorktrees);
    } catch (error) {
      reject(error);
    }
  });
}

function listTags(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const gitCmd = await gitCommand();
      log.debug(`** gitCmd: ${gitCmd}`);

      const allTags = execSync(`"${gitCmd}" tag`, options)
        .toString()
        .trim()
        .split('\n')
        .filter((value) => value !== '');
      log.debug(`** allTags: ${allTags}`);

      const worktreeOutput = execSync(
        `"${gitCmd}" worktree list --porcelain`,
        options,
      );

      const worktreeBranches = worktreeOutput
        .toString()
        .trim()
        .split('\n')
        .filter((line) => line.startsWith('branch '))
        .map((line) => line.split(' ')[1].replace('refs/heads/', ''));
      log.debug(`** worktreeBranches: ${worktreeBranches}`);

      const tagsNotInWorktrees = allTags.filter(
        (tag) => !worktreeBranches.includes(tag.replaceAll('.', '-')),
      );
      log.debug(`** tagsNotInWorktrees: ${tagsNotInWorktrees}`);

      resolve(tagsNotInWorktrees);
    } catch (error) {
      reject(error);
    }
  });
}

function listWorktrees(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const gitCmd = await gitCommand();
      const worktreesOutput = execSync(
        `"${gitCmd}" worktree list --porcelain`,
        options,
      );
      const worktreeBranches = worktreesOutput
        .toString()
        .trim()
        .split('\n')
        .filter((line) => line.startsWith('branch '))
        .map((line) => line.split(' ')[1].replace('refs/heads/', ''));
      resolve(worktreeBranches);
    } catch (error) {
      reject(error);
    }
  });
}

async function listRefs(directory: string) {
  // eslint-disable-next-line no-useless-catch
  try {
    const refs = {} as any;
    refs.branches = await listBranches(directory);
    refs.tags = await listTags(directory);
    refs.worktrees = await listWorktrees(directory);
    return refs;
  } catch (err) {
    throw err;
  }
}

async function listAuthors(directory: string) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const options = {
      cwd: directory,
      shell: true,
    } as any;
    try {
      const gitCmd = await gitCommand();
      const output = execSync(
        `"${gitCmd}" shortlog -s -n --all --no-merges`,
        options,
      );
      const authors = output
        .toString()
        .trim()
        .split('\n')
        .map((line) => line.trim().replace(/^\d+\s+/, '')) // Remove commit counts
        .filter(Boolean); // Remove any empty lines
      resolve(authors);
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  showLogAsync,
  showDiff,
  executeCommand,
  listBranches,
  listTags,
  listWorktrees,
  listAuthors,
  listRefs,
  gitCommand,
  getShell,
  getCommitChangedFiles,
  getCommitFileDiff,
  getWorkingTreeStatus,
  runWorkingTreeAction,
  commitWorkingTree,
  getWorkingTreeFileDiff,
  getHeadCommitMessage,
  applyWorkingTreeLine,
  discardWorkingTreeLine,
  discardWorkingTreeFile,
};
