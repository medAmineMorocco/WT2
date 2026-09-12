export type WorktreeRebaseResult =
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
      sourceWorktreePath: string;
      conflictedFiles: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type WorktreeRebaseActionResult = WorktreeRebaseResult;

export type WorktreeRebaseResolution = 'source' | 'target' | 'staged';

export type WorktreeRebaseConflictResult =
  { ok: true; conflictedFiles: string[] } | { ok: false; error: string };

export type WorktreeRebaseAbortResult =
  { ok: true } | { ok: false; error: string };
