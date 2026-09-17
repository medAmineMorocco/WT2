export interface CherryPickRequest {
  commit: string;
  destinationPath: string;
}

export type CherryPickResolution = 'source' | 'target' | 'staged';

export type CherryPickResult =
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
      destinationPath: string;
      conflictedFiles: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type CherryPickActionResult = CherryPickResult;

export type CherryPickConflictResult =
  | { ok: true; conflictedFiles: string[] }
  | { ok: false; error: string };

export type CherryPickAbortResult =
  | { ok: true }
  | { ok: false; error: string };

