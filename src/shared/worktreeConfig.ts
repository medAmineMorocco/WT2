export type WorktreeConfigEntry = {
  key: string;
  value: string;
};

export type GetWorktreeConfigResult =
  | {
      ok: true;
      enabled: boolean;
      entries: WorktreeConfigEntry[];
    }
  | {
      ok: false;
      error: string;
    };

export type SaveWorktreeConfigResult =
  | {
      ok: true;
      enabled: boolean;
      entries: WorktreeConfigEntry[];
    }
  | {
      ok: false;
      error: string;
    };
