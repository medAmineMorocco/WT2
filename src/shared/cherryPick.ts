export interface CherryPickRequest {
  commit: string;
  destinationPath: string;
}

export interface CherryPickResult {
  commit: string;
  targetBranch: string;
  output: string;
}
