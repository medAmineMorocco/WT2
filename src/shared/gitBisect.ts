export type BisectMark = 'good' | 'bad' | 'skip';

export interface GitBisectState {
  active: boolean;
  currentCommit: string | null;
  originalBranch: string | null;
  completed: boolean;
  culpritCommit: string | null;
  message?: string;
}

export interface GitBisectResult {
  ok: boolean;
  state: GitBisectState;
  output?: string;
  error?: string;
  verificationOutput?: string;
  iterations?: number;
}
