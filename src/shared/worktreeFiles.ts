export type WorktreeFileChange = 'added' | 'modified' | 'deleted';

export type WorktreeFileEntry = {
  path: string;
  change?: WorktreeFileChange;
};

export type WorktreeFilesSnapshot = {
  branch: string;
  files: WorktreeFileEntry[];
  changedCount: number;
};

export type WorktreeFilePreview = {
  path: string;
  kind: 'content' | 'diff' | 'binary';
  content: string;
  truncated: boolean;
};
