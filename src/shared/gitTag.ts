export type CreateGitTagResult =
  | {
      ok: true;
      tagName: string;
      commit: string;
      annotated: boolean;
    }
  | { ok: false; error: string };

export type DeleteGitTagResult =
  | {
      ok: true;
      tagName: string;
      target: 'local' | 'remote' | 'both';
      remote?: string;
    }
  | { ok: false; error: string };

export type PushGitTagResult =
  | {
      ok: true;
      tagName: string;
      remote: string;
    }
  | { ok: false; error: string };

export interface GitTagStatus {
  name: string;
  commit: string;
  isLocal: boolean;
  isRemote: boolean;
  remotes: string[];
  remoteUrl?: string;
}
