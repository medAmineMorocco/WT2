import { ipcMain } from 'electron';
import log from '../../utils/logger';
import gitMainService from '../../services/git/gitMainService';
import { WorkingTreeAction } from '../../../shared/workingTree';

ipcMain.handle('get-working-tree-status', async (_event, directory: string) =>
  gitMainService.getWorkingTreeStatus(directory),
);

ipcMain.handle(
  'cherry-pick-commit',
  async (_event, destinationPath: string, commit: string) =>
    gitMainService.cherryPickCommit(destinationPath, commit),
);

ipcMain.handle('get-worktree-files', async (_event, directory: string) =>
  gitMainService.getWorktreeFiles(directory),
);

ipcMain.handle(
  'get-worktree-file-preview',
  async (_event, directory: string, filePath: string) =>
    gitMainService.getWorktreeFilePreview(directory, filePath),
);

ipcMain.handle(
  'run-working-tree-action',
  async (
    _event,
    directory: string,
    action: WorkingTreeAction,
    paths: string[],
  ) => gitMainService.runWorkingTreeAction(directory, action, paths),
);

ipcMain.handle(
  'commit-working-tree',
  async (
    _event,
    directory: string,
    summary: string,
    description: string,
    amend: boolean,
  ) => gitMainService.commitWorkingTree(directory, summary, description, amend),
);

ipcMain.handle(
  'get-working-tree-file-diff',
  async (
    _event,
    directory: string,
    filePath: string,
    staged: boolean,
    untracked: boolean,
  ) =>
    gitMainService.getWorkingTreeFileDiff(
      directory,
      filePath,
      staged,
      untracked,
    ),
);

ipcMain.handle('get-head-commit-message', async (_event, directory: string) =>
  gitMainService.getHeadCommitMessage(directory),
);

ipcMain.handle(
  'apply-working-tree-line',
  async (_event, directory: string, patch: string, staged: boolean) =>
    gitMainService.applyWorkingTreeLine(directory, patch, staged),
);

ipcMain.handle(
  'discard-working-tree-line',
  async (_event, directory: string, patch: string) =>
    gitMainService.discardWorkingTreeLine(directory, patch),
);

ipcMain.handle(
  'discard-working-tree-file',
  async (_event, directory: string, filePath: string, untracked: boolean) =>
    gitMainService.discardWorkingTreeFile(directory, filePath, untracked),
);

ipcMain.on(
  'show-git-log',
  async function (
    event,
    directory: string,
    branch: string,
    author: string,
    skip = 0,
    limit = 40,
  ) {
    try {
      log.info('Getting git log');
      const { buffer, hasMore } = await gitMainService.showLogAsync(
        directory,
        branch,
        author,
        skip,
        limit,
      );
      event.sender.send('receive-git-log', 0, buffer, skip, hasMore);
    } catch (err: any) {
      log.error(`Failed to get git log: ${err.message}`);
      event.sender.send('receive-git-log', -1, 'Failed to load Git log.');
    }
  },
);

ipcMain.on(
  'show-git-diff',
  async function (
    event,
    val1: string,
    val2: string,
    diffFilters: string,
    isAll: boolean,
    directory: string,
  ) {
    try {
      log.info('Getting git diff');
      const gitDiffCompressed = await gitMainService.showDiff(
        val1,
        val2,
        diffFilters,
        isAll,
        directory,
      );
      event.sender.send('receive-git-diff', 0, gitDiffCompressed);
    } catch (err: any) {
      log.error(`Failed to get git diff: ${err.message}`);
      event.sender.send(
        'receive-git-diff',
        -1,
        'Failed to display Git diff. Please verify your selections and try again.',
      );
    }
  },
);

ipcMain.on(
  'get-commit-changed-files',
  async function (event, requestId: number, commit: string, directory: string) {
    try {
      const result = await gitMainService.getCommitChangedFiles(
        commit,
        directory,
      );
      event.sender.send('receive-commit-changed-files', 0, result, requestId);
    } catch (err: any) {
      log.error(`Failed to get changed files for ${commit}: ${err.message}`);
      event.sender.send(
        'receive-commit-changed-files',
        -1,
        'Failed to load the files changed by this commit.',
        requestId,
      );
    }
  },
);

ipcMain.on(
  'get-commit-file-diff',
  async function (
    event,
    requestId: number,
    commit: string,
    filePath: string,
    directory: string,
  ) {
    try {
      const result = await gitMainService.getCommitFileDiff(
        commit,
        filePath,
        directory,
      );
      event.sender.send('receive-commit-file-diff', 0, result, requestId);
    } catch (err: any) {
      log.error(`Failed to get ${filePath} diff for ${commit}: ${err.message}`);
      event.sender.send(
        'receive-commit-file-diff',
        -1,
        'Failed to load the selected file diff.',
        requestId,
      );
    }
  },
);

ipcMain.on(
  'list-branches',
  async function (event, directory: string, remote = false) {
    try {
      log.info('Getting branches');
      const branches = await gitMainService.listBranches(directory, remote);
      event.sender.send('receive-branches', 0, JSON.stringify(branches));
    } catch (err: any) {
      log.error(`Failed to get branches: ${err.message}`);
      event.sender.send('receive-branches', -1, 'Failed to list branches.');
    }
  },
);

ipcMain.on('list-tags', async function (event, directory: string) {
  try {
    log.info('Getting tags');
    const tags = await gitMainService.listTags(directory);
    event.sender.send('receive-tags', 0, tags);
  } catch (err: any) {
    log.error(`Failed to get tags: ${err.message}`);
    event.sender.send('receive-tags', -1, 'Failed to list tags.');
  }
});

ipcMain.on('list-worktrees', async function (event, directory: string) {
  try {
    log.info('Getting worktrees');
    const worktrees = await gitMainService.listWorktrees(directory);
    event.sender.send('receive-worktrees', 0, worktrees);
  } catch (err: any) {
    log.error(`Failed to get worktrees: ${err.message}`);
    event.sender.send('receive-worktrees', -1, 'Failed to list worktrees.');
  }
});

ipcMain.on('list-authors', async function (event, directory: string) {
  try {
    log.info('Getting authors');
    const authors = await gitMainService.listAuthors(directory);
    event.sender.send('receive-authors', 0, authors);
  } catch (err: any) {
    log.error(`Failed to get authors: ${err.message}`);
    event.sender.send('receive-authors', -1, 'Failed to list authors.');
  }
});

ipcMain.on('list-refs', async function (event, directory: string) {
  try {
    log.info('Getting refs');
    const refs = await gitMainService.listRefs(directory);
    event.sender.send('receive-refs', 0, refs);
  } catch (err: any) {
    log.error(`Failed to get refs: ${err.message}`);
    event.sender.send('receive-refs', -1, 'Failed to list git references.');
  }
});
