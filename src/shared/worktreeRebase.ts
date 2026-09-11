export type WorktreeRebaseResult =
  | {
      ok: true;
      sourceBranch: string;
      targetBranch: string;
      output: string;
    }
  | {
      ok: false;
      error: string;
    };
