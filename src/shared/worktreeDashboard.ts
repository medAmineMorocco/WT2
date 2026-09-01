import { EnvironmentSource } from './environmentIsolation';

export type WorktreeDashboardChangeCounts = {
  modified: number;
  added: number;
  deleted: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
};

export type WorktreeDashboardCommit = {
  hash: string;
  author: string;
  date: string;
  subject: string;
};

export type WorktreeDashboardDiskUsage = {
  projectFiles: number;
  dependencies: number;
  buildAndCache: number;
  git: number;
  total: number;
};

export type WorktreeDashboardItem = {
  name: string;
  resolvedName: string;
  path: string;
  head: string;
  isPrimary: boolean;
  isLocked: boolean;
  prunable: boolean;
  isDetached: boolean;
  directoryExists: boolean;
  isStale: boolean;
  needsPrune: boolean;
  diskUsageBytes: number;
  diskUsage: WorktreeDashboardDiskUsage;
  diskUsagePending: boolean;
  changes: WorktreeDashboardChangeCounts;
  changedFiles: Array<{ path: string; status: string }>;
  upstream: string | null;
  ahead: number;
  behind: number;
  baseBranch: string | null;
  baseAhead: number;
  baseBehind: number;
  latestCommit: WorktreeDashboardCommit | null;
  lastActivity: string | null;
  lastFetch: string | null;
  lastFetchMessage: string | null;
  lastPull: string | null;
  lastPullMessage: string | null;
  largeUntrackedFiles: Array<{ path: string; sizeBytes: number }>;
  environmentSources: EnvironmentSource[];
  ports: Array<{ key: string; value: string; sourcePath: string }>;
  warning: string | null;
  nudges: string[];
};
