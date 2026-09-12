export type ResetMode = 'soft' | 'mixed' | 'hard';

export interface ResetCommitResult {
  commit: string;
  mode: ResetMode;
  targetBranch: string;
  output: string;
}

export interface RevertCommitResult {
  commit: string;
  targetBranch: string;
  output: string;
}
