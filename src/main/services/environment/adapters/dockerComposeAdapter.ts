import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EnvironmentSetting,
  EnvironmentSource,
} from '../../../../shared/environmentIsolation';
import { EnvironmentAdapter, ScannedProjectFile } from './environmentAdapter';
import {
  resolveRepositoryFile,
  SENSITIVE_NAME,
  settingKind,
  writeFileAtomically,
} from './adapterUtils';

const yaml = require('js-yaml');
const COMPOSE_FILE = /^(?:docker-)?compose(?:\.[A-Za-z0-9_-]+)*\.ya?ml$/i;

function sourceFor(file: ScannedProjectFile): EnvironmentSource {
  return {
    id: `docker-compose:${file.relativePath}`,
    adapterId: 'docker-compose',
    name: file.name,
    relativePath: file.relativePath,
    detectedType: 'Docker Compose',
  };
}

function parsePublishedPort(value: unknown) {
  if (typeof value === 'number') return null;
  if (typeof value === 'object' && value) {
    const port = value as Record<string, unknown>;
    if (port.published && port.target) {
      return {
        hostPort: String(port.published),
        containerPort: String(port.target),
        protocol: port.protocol ? String(port.protocol) : undefined,
      };
    }
    return null;
  }
  if (typeof value !== 'string') return null;
  const withoutProtocol = value.split('/')[0];
  const parts = withoutProtocol.split(':');
  if (parts.length < 2) return null;
  return {
    hostPort: parts[parts.length - 2],
    containerPort: parts[parts.length - 1],
    protocol: value.includes('/') ? value.split('/')[1] : undefined,
  };
}

const dockerComposeAdapter: EnvironmentAdapter = {
  id: 'docker-compose',
  name: 'Docker Compose',
  detect(files) {
    return files.filter((file) => COMPOSE_FILE.test(file.name)).map(sourceFor);
  },
  async read(projectPath, source) {
    const contents = await fs.readFile(
      resolveRepositoryFile(projectPath, source.relativePath),
      'utf8',
    );
    const document = yaml.load(contents) || {};
    const settings: EnvironmentSetting[] = [];
    Object.entries(document.services || {}).forEach(
      ([serviceName, serviceValue]: [string, any]) => {
        (serviceValue.ports || []).forEach(
          (portValue: unknown, index: number) => {
            const parsed = parsePublishedPort(portValue);
            if (!parsed || !/^\d+$/.test(parsed.hostPort)) return;
            settings.push({
              id: `${source.id}:service:${serviceName}:port:${index}`,
              key: `${serviceName}.ports.${index}`,
              value: parsed.hostPort,
              sourceId: source.id,
              suggestedStrategy: 'auto-port',
              kind: 'port',
              sensitive: false,
              metadata: {
                type: 'port',
                serviceName,
                index,
                containerPort: parsed.containerPort,
                protocol: parsed.protocol,
              },
            });
          },
        );
        const environment = serviceValue.environment;
        if (Array.isArray(environment)) {
          environment.forEach((entry: unknown, index: number) => {
            if (typeof entry !== 'string' || !entry.includes('=')) return;
            const separator = entry.indexOf('=');
            const key = entry.slice(0, separator);
            const value = entry.slice(separator + 1);
            const kind = settingKind(key, value);
            settings.push({
              id: `${source.id}:service:${serviceName}:environment:${key}`,
              key: `${serviceName}.environment.${key}`,
              value,
              sourceId: source.id,
              suggestedStrategy: kind === 'port' ? 'auto-port' : 'shared',
              kind,
              sensitive: SENSITIVE_NAME.test(key),
              metadata: {
                type: 'environment',
                serviceName,
                environmentKey: key,
                index,
              },
            });
          });
        } else if (environment && typeof environment === 'object') {
          Object.entries(environment).forEach(([key, rawValue]) => {
            const value = String(rawValue ?? '');
            const kind = settingKind(key, value);
            settings.push({
              id: `${source.id}:service:${serviceName}:environment:${key}`,
              key: `${serviceName}.environment.${key}`,
              value,
              sourceId: source.id,
              suggestedStrategy: kind === 'port' ? 'auto-port' : 'shared',
              kind,
              sensitive: SENSITIVE_NAME.test(key),
              metadata: {
                type: 'environment',
                serviceName,
                environmentKey: key,
              },
            });
          });
        }
      },
    );
    return settings;
  },
  async getSuggestedCommands(source, context) {
    const directory = path.posix.dirname(source.relativePath);
    const generatedName = `docker-compose.worktreewise.${context.worktreeName}.yml`;
    const generatedRelativePath =
      directory === '.'
        ? generatedName
        : path.posix.join(directory, generatedName);
    const quote = (value: string) =>
      value.includes(' ') ? `"${value}"` : value;
    const baseCommand = `docker compose -p worktreewise-${context.worktreeName} -f ${quote(source.relativePath)} -f ${quote(generatedRelativePath)}`;
    return [
      {
        id: `${source.id}:compose-up`,
        label: 'Docker Compose up',
        command: `${baseCommand} up`,
        sourceId: source.id,
        description: 'Review this suggestion before running it.',
      },
      {
        id: `${source.id}:compose-down`,
        label: 'Docker Compose down',
        command: `${baseCommand} down`,
        sourceId: source.id,
      },
    ];
  },
  async writeIsolated(source, settings, context) {
    const override: Record<string, any> = {
      name: `worktreewise-${context.worktreeName}`,
      services: {},
    };
    const maskedOverride: Record<string, any> = {
      name: `worktreewise-${context.worktreeName}`,
      services: {},
    };
    settings
      .filter((setting) => setting.strategy !== 'shared')
      .forEach((setting) => {
        const serviceName = String(setting.metadata?.serviceName);
        override.services[serviceName] ||= {};
        maskedOverride.services[serviceName] ||= {};
        if (setting.metadata?.type === 'port') {
          const protocol = setting.metadata.protocol
            ? `/${setting.metadata.protocol}`
            : '';
          const port = `${setting.generatedValue}:${setting.metadata.containerPort}${protocol}`;
          override.services[serviceName].ports ||= [];
          maskedOverride.services[serviceName].ports ||= [];
          override.services[serviceName].ports.push(port);
          maskedOverride.services[serviceName].ports.push(port);
        } else {
          const key = String(setting.metadata?.environmentKey);
          override.services[serviceName].environment ||= {};
          maskedOverride.services[serviceName].environment ||= {};
          override.services[serviceName].environment[key] =
            setting.generatedValue;
          maskedOverride.services[serviceName].environment[key] =
            setting.sensitive ? '********' : setting.generatedValue;
        }
      });
    const directory = path.posix.dirname(source.relativePath);
    const generatedName = `docker-compose.worktreewise.${context.worktreeName}.yml`;
    const generatedRelativePath =
      directory === '.'
        ? generatedName
        : path.posix.join(directory, generatedName);
    const contents = yaml.dump(override, { noRefs: true, lineWidth: -1 });
    await writeFileAtomically(
      resolveRepositoryFile(context.worktreePath, generatedRelativePath),
      contents,
    );
    const sourceArgument = source.relativePath.includes(' ')
      ? `"${source.relativePath}"`
      : source.relativePath;
    const generatedArgument = generatedRelativePath.includes(' ')
      ? `"${generatedRelativePath}"`
      : generatedRelativePath;
    const baseCommand = `docker compose -p worktreewise-${context.worktreeName} -f ${sourceArgument} -f ${generatedArgument}`;
    return {
      sourceId: source.id,
      relativePath: generatedRelativePath,
      displayContents: yaml.dump(maskedOverride, {
        noRefs: true,
        lineWidth: -1,
      }),
      suggestedCommands: [
        {
          id: `${source.id}:compose-up`,
          label: 'Docker Compose up',
          command: `${baseCommand} up`,
          sourceId: source.id,
          description:
            'Starts the isolated Compose project. Review before running.',
        },
        {
          id: `${source.id}:compose-down`,
          label: 'Docker Compose down',
          command: `${baseCommand} down`,
          sourceId: source.id,
          description: 'Stops the isolated Compose project.',
        },
      ],
    };
  },
};

export default dockerComposeAdapter;
