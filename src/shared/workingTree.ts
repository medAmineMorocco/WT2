export type WorkingTreeFile = {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
};

export type WorkingTreeStatus = {
  branch: string;
  files: WorkingTreeFile[];
};

export type WorkingTreeAction =
  | 'pull'
  | 'push'
  | 'stash'
  | 'pop'
  | 'stage'
  | 'unstage'
  | 'stage-all'
  | 'unstage-all';
