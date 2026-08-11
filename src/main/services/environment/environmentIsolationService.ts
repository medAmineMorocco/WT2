import fs from 'node:fs/promises';
import {
  EnvironmentIsolationConfig,
  EnvironmentIsolationResult,
  EnvironmentSetting,
  EnvironmentSource,
  IsolationStrategy,
  SuggestedCommand,
  WorktreeIsolationContext,
} from '../../../shared/environmentIsolation';
import adapters, { getEnvironmentAdapter } from './adapters/adapterRegistry';
import { ResolvedEnvironmentSetting } from './adapters/environmentAdapter';
import scanProjectFiles from './environmentScanner';
import { resolveRepositoryFile } from './adapters/adapterUtils';

const { detect } = require('detect-port');

export function sanitizeWorktreeName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'worktree'
  );
}

export async function findAvailablePort(
  preferredPort: number,
): Promise<number> {
  if (
    !Number.isInteger(preferredPort) ||
    preferredPort < 1 ||
    preferredPort > 65535
  ) {
    throw new Error(`Invalid preferred port: ${preferredPort}`);
  }
  try {
    for (let candidate = preferredPort; candidate <= 65535; candidate += 10) {
      // eslint-disable-next-line no-await-in-loop
      const availablePort = await detect(candidate);
      const windowEnd = Math.min(candidate + 9, 65535);
      if (availablePort >= candidate && availablePort <= windowEnd)
        return availablePort;
    }
  } catch (error: any) {
    throw new Error(
      `Unable to find a local TCP port at or above ${preferredPort}: ${error.message}`,
    );
  }
  throw new Error(`No available TCP port found at or above ${preferredPort}.`);
}

export async function detectEnvironmentSources(
  projectPath: string,
): Promise<EnvironmentSource[]> {
  const files = await scanProjectFiles(projectPath);
  return adapters
    .flatMap((adapter) => adapter.detect(files))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function readEnvironmentSource(
  projectPath: string,
  source: EnvironmentSource,
): Promise<EnvironmentSetting[]> {
  return getEnvironmentAdapter(source.adapterId).read(projectPath, source);
}

async function resolveSettings(
  settings: EnvironmentSetting[],
  strategies: Record<string, IsolationStrategy>,
  worktreeName: string,
  requestedPorts: Record<string, number> = {},
  allocatedPorts = new Set<number>(),
): Promise<{
  settings: ResolvedEnvironmentSetting[];
  values: Record<string, string>;
  portAllocations: Record<string, number>;
}> {
  const suffix = sanitizeWorktreeName(worktreeName);
  const values: Record<string, string> = {};
  const portAllocations: Record<string, number> = {};
  const resolved: ResolvedEnvironmentSetting[] = [];
  for (const setting of settings) {
    const strategy =
      strategies[setting.id] || setting.suggestedStrategy || 'shared';
    let generatedValue = setting.value;
    if (strategy === 'suffix') generatedValue = `${generatedValue}-${suffix}`;
    if (strategy === 'auto-port') {
      if (!/^\d+$/.test(setting.value)) {
        throw new Error(
          `${setting.key} cannot use Auto Port because its value is not numeric.`,
        );
      }
      const firstCandidate = Number(setting.value) + 1;
      if (firstCandidate > 65535) {
        throw new Error(`${setting.key} has no valid higher TCP port.`);
      }
      let port = requestedPorts[setting.id];
      if (!port || port <= Number(setting.value)) {
        // eslint-disable-next-line no-await-in-loop
        port = await findAvailablePort(firstCandidate);
      }
      while (allocatedPorts.has(port)) {
        // eslint-disable-next-line no-await-in-loop
        port = await findAvailablePort(port + 1);
      }
      allocatedPorts.add(port);
      portAllocations[setting.id] = port;
      generatedValue = String(port);
    }
    values[setting.id] = generatedValue;
    resolved.push({ ...setting, strategy, generatedValue });
  }
  return { settings: resolved, values, portAllocations };
}

export async function previewIsolationValues(
  settings: EnvironmentSetting[],
  strategies: Record<string, IsolationStrategy>,
  worktreeName: string,
): Promise<{
  values: Record<string, string>;
  portAllocations: Record<string, number>;
}> {
  const result = await resolveSettings(settings, strategies, worktreeName);
  return { values: result.values, portAllocations: result.portAllocations };
}

export async function previewSuggestedCommands(
  projectPath: string,
  worktreeName: string,
  sources: EnvironmentSource[],
) {
  const context = {
    projectPath,
    worktreePath: projectPath,
    worktreeName:
      worktreeName === '{worktree-name}'
        ? worktreeName
        : sanitizeWorktreeName(worktreeName),
  };
  const suggestions: SuggestedCommand[] = [];
  for (const source of sources) {
    const adapter = getEnvironmentAdapter(source.adapterId);
    if (adapter.getSuggestedCommands) {
      // eslint-disable-next-line no-await-in-loop
      suggestions.push(
        ...(await adapter.getSuggestedCommands(source, context)),
      );
    }
  }
  return suggestions.filter(
    (suggestion, index, all) =>
      all.findIndex((candidate) => candidate.command === suggestion.command) ===
      index,
  );
}

export async function generateIsolatedEnvironmentSources(
  context: WorktreeIsolationContext,
  config: EnvironmentIsolationConfig,
  onProgress?: (key: string, label: string) => void,
): Promise<EnvironmentIsolationResult> {
  const generatedSources = [];
  const allocatedPorts = new Set<number>();
  try {
    for (const sourceConfig of config.sources) {
      const { source } = sourceConfig;
      onProgress?.(`read:${source.id}`, `Reading ${source.relativePath}`);
      const adapter = getEnvironmentAdapter(source.adapterId);
      // Re-read after Git worktree creation so generation is based on source truth.
      // eslint-disable-next-line no-await-in-loop
      const settings = await adapter.read(context.projectPath, source);
      // eslint-disable-next-line no-await-in-loop
      const resolved = await resolveSettings(
        settings,
        sourceConfig.strategies,
        context.worktreeName,
        sourceConfig.portAllocations,
        allocatedPorts,
      );
      onProgress?.(
        `write:${source.id}`,
        `Generating isolated ${source.relativePath}`,
      );
      // eslint-disable-next-line no-await-in-loop
      const generated = await adapter.writeIsolated(
        source,
        resolved.settings,
        context,
      );
      generatedSources.push(generated);
      onProgress?.(
        `generated:${source.id}`,
        `Generated ${generated.relativePath}`,
      );
    }
  } catch (error) {
    await Promise.all(
      generatedSources.map((source) =>
        fs.rm(
          resolveRepositoryFile(context.worktreePath, source.relativePath),
          { force: true },
        ),
      ),
    );
    throw error;
  }
  const suggestedCommands = generatedSources
    .flatMap((source) => source.suggestedCommands)
    .filter(
      (suggestion, index, all) =>
        all.findIndex(
          (candidate) => candidate.command === suggestion.command,
        ) === index,
    );
  return {
    generatedSources,
    suggestedCommands,
  };
}

export default {
  sanitizeWorktreeName,
  findAvailablePort,
  detectEnvironmentSources,
  readEnvironmentSource,
  previewIsolationValues,
  previewSuggestedCommands,
  generateIsolatedEnvironmentSources,
};
