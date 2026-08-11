export type IsolationStrategy = 'shared' | 'suffix' | 'auto-port';

export type EnvironmentSettingKind =
  'port' | 'url' | 'string' | 'number' | 'unknown';

export type EnvironmentSource = {
  id: string;
  adapterId: string;
  name: string;
  relativePath: string;
  detectedType: string;
};

export type EnvironmentSetting = {
  id: string;
  key: string;
  value: string;
  sourceId: string;
  suggestedStrategy: IsolationStrategy;
  kind?: EnvironmentSettingKind;
  sensitive?: boolean;
  metadata?: Record<string, unknown>;
};

export type EnvironmentSourceIsolationConfig = {
  source: EnvironmentSource;
  strategies: Record<string, IsolationStrategy>;
  portAllocations?: Record<string, number>;
};

export type EnvironmentIsolationConfig = {
  sources: EnvironmentSourceIsolationConfig[];
};

export type SuggestedCommand = {
  id: string;
  label: string;
  command: string;
  sourceId: string;
  description?: string;
};

export type GeneratedEnvironmentSource = {
  sourceId: string;
  relativePath: string;
  displayContents: string;
  suggestedCommands: SuggestedCommand[];
};

export type EnvironmentIsolationResult = {
  generatedSources: GeneratedEnvironmentSource[];
  suggestedCommands: SuggestedCommand[];
};

export type WorktreeIsolationContext = {
  projectPath: string;
  worktreePath: string;
  worktreeName: string;
};

// Kept as an alias while renderer call sites migrate to normalized settings.
export type EnvironmentVariable = EnvironmentSetting;

export type EnvironmentIsolationProgress = {
  key: string;
  label: string;
};
