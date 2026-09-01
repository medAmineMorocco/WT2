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
