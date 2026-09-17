import { ipcMain } from 'electron';
import log from '../../utils/logger';
import gitMainService from '../../services/git/gitMainService';
import BusinessError from '../../exceptions/BusinessError';
import { WorkingTreeAction } from '../../../shared/workingTree';
import {
  CherryPickAbortResult,
  CherryPickActionResult,
  CherryPickConflictResult,
  CherryPickResolution,
  CherryPickResult,
} from '../../../shared/cherryPick';
import {
  RevertAbortResult,
  RevertActionResult,
  RevertConflictResult,
  RevertResolution,
  RevertCommitResult,
} from '../../../shared/gitResetRevert';

ipcMain.handle('get-working-tree-status', async (_event, directory: string) =>
  gitMainService.getWorkingTreeStatus(directory),
);

ipcMain.handle(
  'cherry-pick-commit',
  async (
    _event,
    destinationPath: string,
    commit: string,
  ): Promise<CherryPickResult> => {
    try {
      return await gitMainService.cherryPickCommit(destinationPath, commit);
    } catch (error: any) {
      log.error(`Failed to cherry-pick commit: ${error.message}`);
      return {
        ok: false,
        error:
          error instanceof BusinessError
            ? error.message
            : error?.message || 'Cherry-pick failed.',
      };
    }
  },
);

ipcMain.handle(
  'resolve-cherry-pick-conflict',
  async (
    _event,
    destinationPath: string,
    filePath: string,
    resolution: CherryPickResolution,
  ): Promise<CherryPickConflictResult> => {
    try {
      if (!['source', 'target', 'staged'].includes(resolution)) {
        throw new BusinessError('Choose a valid conflict resolution.');
      }
      const conflictedFiles = await gitMainService.resolveCherryPickConflict(
        destinationPath,
        filePath,
        resolution,
      );
      return { ok: true, conflictedFiles };
    } catch (error: any) {
      log.error(`Failed to resolve cherry-pick conflict: ${error.message}`);
      return {
        ok: false,
        error: error?.message || 'The file was not resolved.',
      };
    }
  },
);

ipcMain.handle(
  'continue-cherry-pick',
  async (
    _event,
    destinationPath: string,
    commit: string,
    targetBranch: string,
  ): Promise<CherryPickActionResult> => {
    try {
      return await gitMainService.continueCherryPick(
        destinationPath,
        commit,
        targetBranch,
      );
    } catch (error: any) {
      log.error(`Failed to continue cherry-pick: ${error.message}`);
      return {
        ok: false,
        error: error?.message || 'The cherry-pick could not continue.',
      };
    }
  },
);

ipcMain.handle(
  'abort-cherry-pick',
  async (_event, destinationPath: string): Promise<CherryPickAbortResult> => {
    try {
      await gitMainService.abortCherryPick(destinationPath);
      return { ok: true };
    } catch (error: any) {
      log.error(`Failed to abort cherry-pick: ${error.message}`);
      return {
        ok: false,
        error: error?.message || 'The cherry-pick was not aborted.',
      };
    }
  },
);

ipcMain.handle(
  'reset-commit',
  async (_event, directory: string, commit: string, mode: any) =>
    gitMainService.resetCommit(directory, commit, mode),
);

ipcMain.handle(
  'revert-commit',
  async (
    _event,
    directory: string,
    commit: string,
  ): Promise<RevertCommitResult> => {
    try {
      return await gitMainService.revertCommit(directory, commit);
    } catch (error: any) {
      log.error(`Failed to revert commit: ${error.message}`);
      return {
        ok: false,
        error:
          error instanceof BusinessError
            ? error.message
            : error?.message || 'Revert failed.',
      };
    }
  },
);

ipcMain.handle(
  'resolve-revert-conflict',
  async (
    _event,
    directory: string,
    filePath: string,
    resolution: RevertResolution,
  ): Promise<RevertConflictResult> => {
    try {
      if (!['source', 'target', 'staged'].includes(resolution)) {
        throw new BusinessError('Choose a valid conflict resolution.');
      }
      const conflictedFiles = await gitMainService.resolveRevertConflict(
        directory,
        filePath,
        resolution,
      );
      return { ok: true, conflictedFiles };
    } catch (error: any) {
      log.error(`Failed to resolve revert conflict: ${error.message}`);
      return {
        ok: false,
        error: error?.message || 'The file was not resolved.',
      };
    }
  },
);

ipcMain.handle(
  'continue-revert',
  async (
    _event,
    directory: string,
    commit: string,
    targetBranch: string,
  ): Promise<RevertActionResult> => {
    try {
      return await gitMainService.continueRevert(
        directory,
        commit,
        targetBranch,
      );
    } catch (error: any) {
      log.error(`Failed to continue revert: ${error.message}`);
      return {
        ok: false,
        error: error?.message || 'The revert could not continue.',
      };
    }
  },
);

ipcMain.handle(
  'abort-revert',
  async (_event, directory: string): Promise<RevertAbortResult> => {
    try {
      await gitMainService.abortRevert(directory);
      return { ok: true };
    } catch (error: any) {
      log.error(`Failed to abort revert: ${error.message}`);
      return {
        ok: false,
        error: error?.message || 'The revert was not aborted.',
      };
    }
  },
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
    fullContext?: boolean,
  ) =>
    gitMainService.getWorkingTreeFileDiff(
      directory,
      filePath,
      staged,
      untracked,
      fullContext,
    ),
);

ipcMain.handle(
  'get-working-tree-file-content',
  async (
    _event,
    directory: string,
    filePath: string,
    version: 'before' | 'after',
    staged: boolean,
    untracked: boolean,
  ) =>
    gitMainService.getWorkingTreeFileContent(
      directory,
      filePath,
      version,
      staged,
      untracked,
    ),
);

ipcMain.handle(
  'get-commit-file-content',
  async (
    _event,
    directory: string,
    commit: string,
    filePath: string,
    version: 'before' | 'after',
  ) =>
    gitMainService.getCommitFileContent(
      directory,
      commit,
      filePath,
      version,
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
    branch?: string | null,
    author?: string | null,
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
    fullContext?: boolean,
  ) {
    try {
      const result = await gitMainService.getCommitFileDiff(
        commit,
        filePath,
        directory,
        fullContext,
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

ipcMain.handle('get-remotes', async (_event, directory: string) =>
  gitMainService.getRemotes(directory),
);

ipcMain.handle(
  'add-remote',
  async (
    _event,
    directory: string,
    name: string,
    pullUrl: string,
    pushUrl?: string,
  ) => gitMainService.addRemote(directory, name, pullUrl, pushUrl),
);

ipcMain.handle(
  'edit-remote',
  async (
    _event,
    directory: string,
    oldName: string,
    newName: string,
    pullUrl: string,
    pushUrl?: string,
  ) => gitMainService.editRemote(directory, oldName, newName, pullUrl, pushUrl),
);

ipcMain.handle('remove-remote', async (_event, directory: string, name: string) =>
  gitMainService.removeRemote(directory, name),
);

ipcMain.handle(
  'fetch-remote',
  async (_event, directory: string, name?: string) =>
    gitMainService.fetchRemote(directory, name),
);

ipcMain.handle(
  'set-upstream',
  async (
    _event,
    params: {
      directory: string;
      localBranch: string;
      remote: string;
      remoteBranch: string;
      push?: boolean;
    },
  ) => gitMainService.setUpstream(params),
);

ipcMain.handle('get-upstream', async (_event, directory: string) =>
  gitMainService.getUpstream(directory),
);

