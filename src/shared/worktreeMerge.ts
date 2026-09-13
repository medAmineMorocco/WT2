export type WorktreeMergeStrategy = 'default' | 'no-ff' | 'ff-only' | 'squash';

export interface WorktreeMergeOptions {
  strategy?: WorktreeMergeStrategy;
  message?: string;
}

export type WorktreeMergeResult =
  | {
      ok: true;
      status: 'completed';
      sourceBranch: string;
      targetBranch: string;
      output: string;
    }
  | {
      ok: true;
      status: 'conflicts';
      sourceBranch: string;
      targetBranch: string;
      targetWorktreePath: string;
      conflictedFiles: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type WorktreeMergeActionResult = WorktreeMergeResult;

export type WorktreeMergeResolution = 'source' | 'target' | 'staged';

export type WorktreeMergeConflictResult =
  | { ok: true; conflictedFiles: string[] }
  | { ok: false; error: string };

export type WorktreeMergeAbortResult =
  | { ok: true }
  | { ok: false; error: string };
