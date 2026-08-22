import { execSync, spawn } from 'child_process';
import log from '../../utils/logger';
import utils from '../../utils/utils';
import BusinessError from '../../exceptions/BusinessError';
import {
  CommitChangedFile,
  CommitChangedFilesResult,
} from '../../../shared/gitCommit';

const zlib = require('zlib');

interface LogCacheEntry {
  buffer: Buffer;
  lastChecked: number;
}

const logCache = new Map<string, LogCacheEntry>();

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

function showLogAsync(
  directory: string,
  branch: string | null,
  author: string | null,
  skip = 0,
  limit = 40,
): Promise<Buffer> {
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
        resolve(cached.buffer);
        return;
      }
    }

    const gitCmd = await gitCommand();
    const gitFormat = '%s %d <%an> [%ci] %h parents:[%p]';
    const command = branch
      ? `"${gitCmd}" log --skip=${skip} -n ${limit} ${branch} ${author ? `--author="${author}"` : ''} --oneline --decorate --abbrev-commit --no-color --date-order --format="${gitFormat}"`
      : `"${gitCmd}" log --skip=${skip} -n ${limit} --all ${author ? `--author="${author}"` : ''} --oneline --decorate --abbrev-commit --no-color --date-order --format="${gitFormat}"`;
    const git = spawn(command, {
      cwd: directory,
      shell: true,
    });

    const gzip = zlib.createGzip();

    const chunks: Buffer[] = [];

    git.stdout.pipe(gzip);

    gzip.on('data', (c: any) => chunks.push(c));

    gzip.once('end', async () => {
      const buffer = Buffer.concat(chunks);

      if (shouldUseCache) {
        try {
          logCache.set(directory, {
            buffer,
            lastChecked: Date.now(),
          });
        } catch {
          // Ignore cache update errors
        }
      }

      resolve(buffer);
    });

    git.stderr.on('data', (chunk) => {
      reject(new Error(chunk.toString()));
    });

    git.on('error', reject);
    git.on('close', (code: any) => {
      if (code !== 0) {
        reject(new Error('git log failed'));
        return;
      }

      gzip.end();
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
};
