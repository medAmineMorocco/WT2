export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
  branches: string[];
}

export interface AddRemoteParams {
  name: string;
  pullUrl: string;
  pushUrl?: string;
}

export interface EditRemoteParams {
  oldName: string;
  newName: string;
  pullUrl: string;
  pushUrl?: string;
}
