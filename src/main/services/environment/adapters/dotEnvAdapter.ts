import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EnvironmentSetting,
  EnvironmentSource,
  SuggestedCommand,
} from '../../../../shared/environmentIsolation';
import {
  EnvironmentAdapter,
  ResolvedEnvironmentSetting,
  ScannedProjectFile,
} from './environmentAdapter';
import {
  resolveRepositoryFile,
  SENSITIVE_NAME,
  settingKind,
  writeFileAtomically,
} from './adapterUtils';

const ENV_FILE_NAME = /^\.env(?:\.[A-Za-z0-9_-]+)*$/;
const ASSIGNMENT = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;

function parseValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  const quoted = trimmed.match(/^(["'])(.*?)\1(?:\s+#.*)?$/);
  if (quoted) return quoted[2];
  return trimmed.replace(/\s+#.*$/, '').trim();
}

function replaceValue(rawValue: string, newValue: string): string {
  const leading = rawValue.match(/^\s*/)?.[0] || '';
  const trimmed = rawValue.trim();
  const quoted = trimmed.match(/^(["'])(.*?)\1(\s+#.*)?$/);
  if (quoted) {
    return `${leading}${quoted[1]}${newValue}${quoted[1]}${quoted[3] || ''}`;
  }
  const comment = rawValue.match(/(\s+#.*)$/)?.[1] || '';
  return `${leading}${newValue}${comment}`;
}

function sourceFor(file: ScannedProjectFile): EnvironmentSource {
  return {
    id: `dotenv:${file.relativePath}`,
    adapterId: 'dotenv',
    name: file.name,
    relativePath: file.relativePath,
    detectedType: '.env',
  };
}

async function dotEnvSuggestions(
  source: EnvironmentSource,
  generatedRelativePath: string,
  evidencePath: string,
): Promise<SuggestedCommand[]> {
  let metadataDirectory = path.posix.dirname(source.relativePath);
  while (true) {
    const packageRelativePath =
      metadataDirectory === '.'
        ? 'package.json'
        : path.posix.join(metadataDirectory, 'package.json');
    try {
      const packageJson = JSON.parse(
        await fs.readFile(
          resolveRepositoryFile(evidencePath, packageRelativePath),
          'utf8',
        ),
      );
      const script = packageJson.scripts?.dev
        ? 'dev'
        : packageJson.scripts?.start
          ? 'start'
          : null;
      if (!script) return [];
      const relativeGeneratedPath = path.posix.relative(
        metadataDirectory,
        generatedRelativePath,
      );
      const prefix =
        metadataDirectory === '.' ? '' : `cd "${metadataDirectory}" && `;
      return [
        {
          id: `${source.id}:dotenv-${script}`,
          label: `Node.js ${script} script with generated env`,
          command: `${prefix}npx dotenv-cli -e ${relativeGeneratedPath} -- npm run ${script}`,
          sourceId: source.id,
          description:
            'Suggested from nearby package scripts. dotenv-cli may need to be installed.',
        },
      ];
    } catch (error: any) {
      if (error?.code !== 'ENOENT') return [];
    }
    if (metadataDirectory === '.') return [];
    metadataDirectory = path.posix.dirname(metadataDirectory);
  }
}

const dotEnvAdapter: EnvironmentAdapter = {
  id: 'dotenv',
  name: '.env',
  detect(files) {
    return files.filter((file) => ENV_FILE_NAME.test(file.name)).map(sourceFor);
  },
  async read(projectPath, source) {
    const contents = await fs.readFile(
      resolveRepositoryFile(projectPath, source.relativePath),
      'utf8',
    );
    return contents.split(/\r?\n/).flatMap((line, index) => {
      const match = line.match(ASSIGNMENT);
      if (!match) return [];
      const key = match[2];
      const value = parseValue(match[4]);
      const kind = settingKind(key, value);
      return [
        {
          id: `${source.id}:${key}:${index}`,
          key,
          value,
          sourceId: source.id,
          suggestedStrategy: kind === 'port' ? 'auto-port' : 'shared',
          kind,
          sensitive: SENSITIVE_NAME.test(key),
        } as EnvironmentSetting,
      ];
    });
  },
  async getSuggestedCommands(source, context) {
    const directory = path.posix.dirname(source.relativePath);
    const generatedName = `${source.name}.${context.worktreeName}`;
    const generatedRelativePath =
      directory === '.'
        ? generatedName
        : path.posix.join(directory, generatedName);
    return dotEnvSuggestions(
      source,
      generatedRelativePath,
      context.projectPath,
    );
  },
  async writeIsolated(source, settings, context) {
    const sourcePath = resolveRepositoryFile(
      context.projectPath,
      source.relativePath,
    );
    const original = await fs.readFile(sourcePath, 'utf8');
    const values = new Map(
      settings.map((setting) => [setting.key, setting.generatedValue]),
    );
    const sensitive = new Set(
      settings
        .filter((setting) => setting.sensitive)
        .map((setting) => setting.key),
    );
    const transform = (mask: boolean) =>
      original
        .split(/(\r?\n)/)
        .map((line) => {
          if (/^\r?\n$/.test(line)) return line;
          const match = line.match(ASSIGNMENT);
          if (!match || !values.has(match[2])) return line;
          const [, prefix, key, separator, rawValue] = match;
          const value =
            mask && sensitive.has(key) ? '********' : values.get(key)!;
          return `${prefix}${key}${separator}${replaceValue(rawValue, value)}`;
        })
        .join('');
    const relativeDirectory = path.posix.dirname(source.relativePath);
    const generatedName = `${source.name}.${context.worktreeName}`;
    const generatedRelativePath =
      relativeDirectory === '.'
        ? generatedName
        : path.posix.join(relativeDirectory, generatedName);
    await writeFileAtomically(
      resolveRepositoryFile(context.worktreePath, generatedRelativePath),
      transform(false),
    );
    const suggestedCommands = await dotEnvSuggestions(
      source,
      generatedRelativePath,
      context.worktreePath,
    );
    return {
      sourceId: source.id,
      relativePath: generatedRelativePath,
      displayContents: transform(true),
      suggestedCommands,
    };
  },
};

export default dotEnvAdapter;
