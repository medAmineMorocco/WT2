import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EnvironmentSetting,
  EnvironmentSource,
  SuggestedCommand,
} from '../../../../shared/environmentIsolation';
import { EnvironmentAdapter, ScannedProjectFile } from './environmentAdapter';
import {
  resolveRepositoryFile,
  SENSITIVE_NAME,
  settingKind,
  writeFileAtomically,
} from './adapterUtils';

const yaml = require('js-yaml');
const SPRING_FILE = /^application(?:-[A-Za-z0-9_-]+)?\.(?:ya?ml|properties)$/i;

function sourceFor(file: ScannedProjectFile): EnvironmentSource {
  return {
    id: `spring-boot:${file.relativePath}`,
    adapterId: 'spring-boot',
    name: file.name,
    relativePath: file.relativePath,
    detectedType: 'Spring Boot',
  };
}

function flattenScalars(
  value: unknown,
  prefix = '',
): Array<{ key: string; value: string; path: string[] }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => {
      const settingKey = prefix ? `${prefix}.${key}` : key;
      if (
        child === null ||
        typeof child === 'string' ||
        typeof child === 'number' ||
        typeof child === 'boolean'
      ) {
        return [
          {
            key: settingKey,
            value: String(child ?? ''),
            path: settingKey.split('.'),
          },
        ];
      }
      return flattenScalars(child, settingKey);
    },
  );
}

function parseProperties(contents: string) {
  return contents.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim() || /^\s*[#!]/.test(line)) return [];
    const match = line.match(/^\s*([^:=\s]+)\s*[:=]\s*(.*)$/);
    return match ? [{ key: match[1], value: match[2], line: index }] : [];
  });
}

function setPath(
  target: Record<string, any>,
  settingPath: string[],
  value: string,
) {
  let current = target;
  settingPath.slice(0, -1).forEach((part) => {
    if (!current[part] || typeof current[part] !== 'object') current[part] = {};
    current = current[part];
  });
  current[settingPath[settingPath.length - 1]] = value;
}

async function springSuggestions(
  source: EnvironmentSource,
  generatedRelativePath: string,
  worktreePath: string,
  profile: string,
): Promise<SuggestedCommand[]> {
  const exists = async (file: string) =>
    fs
      .access(path.join(worktreePath, file))
      .then(() => true)
      .catch(() => false);
  const directories: string[] = [];
  let directory = path.posix.dirname(source.relativePath);
  while (true) {
    directories.push(directory);
    if (directory === '.') break;
    directory = path.posix.dirname(directory);
  }
  for (const candidateDirectory of directories) {
    const file = (name: string) =>
      candidateDirectory === '.'
        ? name
        : path.posix.join(candidateDirectory, name);
    const prefix =
      candidateDirectory === '.' ? '' : `cd "${candidateDirectory}" && `;
    // eslint-disable-next-line no-await-in-loop
    if (await exists(file('mvnw'))) {
      return [
        {
          id: `${source.id}:maven-run`,
          label: 'Spring Boot (Maven wrapper)',
          command: `${prefix}./mvnw spring-boot:run -Dspring-boot.run.profiles=${profile}`,
          sourceId: source.id,
          description: `Uses the generated configuration profile in ${generatedRelativePath}.`,
        },
      ];
    }
    // eslint-disable-next-line no-await-in-loop
    if (await exists(file('mvnw.cmd'))) {
      return [
        {
          id: `${source.id}:maven-run`,
          label: 'Spring Boot (Maven wrapper)',
          command: `${prefix}.\\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=${profile}`,
          sourceId: source.id,
        },
      ];
    }
    // eslint-disable-next-line no-await-in-loop
    if (await exists(file('gradlew'))) {
      return [
        {
          id: `${source.id}:gradle-run`,
          label: 'Spring Boot (Gradle wrapper)',
          command: `${prefix}./gradlew bootRun --args='--spring.profiles.active=${profile}'`,
          sourceId: source.id,
        },
      ];
    }
    // eslint-disable-next-line no-await-in-loop
    if (await exists(file('gradlew.bat'))) {
      return [
        {
          id: `${source.id}:gradle-run`,
          label: 'Spring Boot (Gradle wrapper)',
          command: `${prefix}.\\gradlew.bat bootRun --args="--spring.profiles.active=${profile}"`,
          sourceId: source.id,
        },
      ];
    }
  }
  return [];
}

const springBootAdapter: EnvironmentAdapter = {
  id: 'spring-boot',
  name: 'Spring Boot',
  detect(files) {
    return files.filter((file) => SPRING_FILE.test(file.name)).map(sourceFor);
  },
  async read(projectPath, source) {
    const contents = await fs.readFile(
      resolveRepositoryFile(projectPath, source.relativePath),
      'utf8',
    );
    const rawSettings = source.name.endsWith('.properties')
      ? parseProperties(contents).map((setting) => ({
          ...setting,
          path: setting.key.split('.'),
        }))
      : flattenScalars(yaml.load(contents) || {});
    return rawSettings.map((setting, index) => {
      const kind = settingKind(setting.key, setting.value);
      return {
        id: `${source.id}:${setting.key}:${index}`,
        key: setting.key,
        value: setting.value,
        sourceId: source.id,
        suggestedStrategy: kind === 'port' ? 'auto-port' : 'shared',
        kind,
        sensitive: SENSITIVE_NAME.test(setting.key),
        metadata: { path: setting.path, line: (setting as any).line },
      } as EnvironmentSetting;
    });
  },
  async getSuggestedCommands(source, context) {
    const extension = path.posix.extname(source.relativePath);
    const stem = source.relativePath.slice(0, -extension.length);
    return springSuggestions(
      source,
      `${stem}-${context.worktreeName}${extension}`,
      context.projectPath,
      context.worktreeName,
    );
  },
  async writeIsolated(source, settings, context) {
    const originalPath = resolveRepositoryFile(
      context.projectPath,
      source.relativePath,
    );
    const original = await fs.readFile(originalPath, 'utf8');
    const extension = path.posix.extname(source.relativePath);
    const stem = source.relativePath.slice(0, -extension.length);
    const generatedRelativePath = `${stem}-${context.worktreeName}${extension}`;
    let contents: string;
    let displayContents: string;
    if (extension === '.properties') {
      const values = new Map(settings.map((setting) => [setting.key, setting]));
      const transform = (mask: boolean) =>
        original
          .split(/(\r?\n)/)
          .map((line) => {
            if (/^\r?\n$/.test(line)) return line;
            const match = line.match(/^(\s*)([^:=\s]+)(\s*[:=]\s*)(.*)$/);
            if (!match || !values.has(match[2])) return line;
            const setting = values.get(match[2])!;
            const value =
              mask && setting.sensitive ? '********' : setting.generatedValue;
            return `${match[1]}${match[2]}${match[3]}${value}`;
          })
          .join('');
      contents = transform(false);
      displayContents = transform(true);
    } else {
      const document = yaml.load(original) || {};
      const maskedDocument = yaml.load(original) || {};
      settings.forEach((setting) => {
        const settingPath = setting.metadata?.path as string[];
        setPath(document, settingPath, setting.generatedValue);
        setPath(
          maskedDocument,
          settingPath,
          setting.sensitive ? '********' : setting.generatedValue,
        );
      });
      contents = yaml.dump(document, { noRefs: true, lineWidth: -1 });
      displayContents = yaml.dump(maskedDocument, {
        noRefs: true,
        lineWidth: -1,
      });
    }
    await writeFileAtomically(
      resolveRepositoryFile(context.worktreePath, generatedRelativePath),
      contents,
    );
    return {
      sourceId: source.id,
      relativePath: generatedRelativePath,
      displayContents,
      suggestedCommands: await springSuggestions(
        source,
        generatedRelativePath,
        context.worktreePath,
        context.worktreeName,
      ),
    };
  },
};

export default springBootAdapter;
