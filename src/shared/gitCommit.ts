export interface CommitChangedFile {
  path: string;
  status: string;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

export interface CommitChangedFilesResult {
  files: CommitChangedFile[];
  additions: number;
  deletions: number;
}

export interface FileContentResult {
  exists: boolean;
  reason?: 'added' | 'deleted' | 'untracked' | 'error';
  content?: string;
  isBinary?: boolean;
  truncated?: boolean;
  lineCount?: number;
  error?: string;
}


