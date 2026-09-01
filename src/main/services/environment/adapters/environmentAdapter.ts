import {
  EnvironmentSetting,
  EnvironmentSource,
  GeneratedEnvironmentSource,
  IsolationStrategy,
  SuggestedCommand,
  WorktreeIsolationContext,
} from '../../../../shared/environmentIsolation';

export type ScannedProjectFile = {
  absolutePath: string;
  relativePath: string;
  name: string;
};

export type ResolvedEnvironmentSetting = EnvironmentSetting & {
  strategy: IsolationStrategy;
  generatedValue: string;
};

export interface EnvironmentAdapter {
  id: string;
  name: string;
  detect(files: ScannedProjectFile[]): EnvironmentSource[];
  read(
    projectPath: string,
    source: EnvironmentSource,
  ): Promise<EnvironmentSetting[]>;
  writeIsolated(
    source: EnvironmentSource,
    settings: ResolvedEnvironmentSetting[],
    context: WorktreeIsolationContext,
  ): Promise<GeneratedEnvironmentSource>;
  getSuggestedCommands?(
    source: EnvironmentSource,
    context: WorktreeIsolationContext,
  ): Promise<SuggestedCommand[]>;
}
