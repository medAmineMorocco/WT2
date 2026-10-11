export type MergeProbabilityResult =
  | {
      ok: true;
      sourceBranch: string;
      targetBranch: string;
      probability: 0 | 100;
      conflictFree: boolean;
      includedUncommittedChanges: boolean;
      details: string;
      conflictedFiles?: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type MergeProbabilityConfigResult =
  | {
      ok: true;
      defaultBranch: string;
      branches: string[];
    }
  | {
      ok: false;
      error: string;
    };
