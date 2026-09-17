export type ResetMode = 'soft' | 'mixed' | 'hard';

export interface ResetCommitResult {
  commit: string;
  mode: ResetMode;
  targetBranch: string;
  output: string;
}

export type RevertResolution = 'source' | 'target' | 'staged';

export type RevertCommitResult =
  | {
      ok: true;
      status: 'completed';
      commit: string;
      targetBranch: string;
      output: string;
    }
  | {
      ok: true;
      status: 'conflicts';
      commit: string;
      targetBranch: string;
      worktreePath: string;
      conflictedFiles: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type RevertActionResult = RevertCommitResult;

export type RevertConflictResult =
  | { ok: true; conflictedFiles: string[] }
  | { ok: false; error: string };

export type RevertAbortResult =
  | { ok: true }
  | { ok: false; error: string };

