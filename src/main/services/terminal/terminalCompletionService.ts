import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import log from '../../utils/logger';
import branchesMainService from '../branches/branchesMainService';

export interface SerializableArg {
  name?: string;
  description?: string;
  isOptional?: boolean;
  isVariadic?: boolean;
  template?: string | string[];
}

export interface SerializableOption {
  name: string | string[];
  description?: string;
  isRequired?: boolean;
  isRepeatable?: boolean;
  isDangerous?: boolean;
  isHidden?: boolean;
  args?: SerializableArg | SerializableArg[];
}

export interface SerializableSubcommand {
  name: string | string[];
  displayName?: string;
  description?: string;
  icon?: string;
  subcommands?: SerializableSubcommand[];
  options?: SerializableOption[];
  args?: SerializableArg | SerializableArg[];
}

const figSpecCache = new Map<string, SerializableSubcommand | null>();
const packageJsonCache = new Map<
  string,
  { timestamp: number; scripts: Record<string, string> }
>();

function sanitizeArgs(
  args: any,
): SerializableArg | SerializableArg[] | undefined {
  if (!args) return undefined;
  if (Array.isArray(args)) {
    return args.map((arg) => ({
      name: arg?.name,
      description: arg?.description,
      isOptional: Boolean(arg?.isOptional),
      isVariadic: Boolean(arg?.isVariadic),
      template: Array.isArray(arg?.template)
        ? arg.template.map(String)
        : typeof arg?.template === 'string'
          ? arg.template
          : undefined,
    }));
  }
  return {
    name: args.name,
    description: args.description,
    isOptional: Boolean(args.isOptional),
    isVariadic: Boolean(args.isVariadic),
    template: Array.isArray(args.template)
      ? args.template.map(String)
      : typeof args.template === 'string'
        ? args.template
        : undefined,
  };
}

function sanitizeSubcommand(cmd: any): SerializableSubcommand {
  return {
    name: cmd.name,
    displayName: cmd.displayName,
    description: cmd.description,
    icon: typeof cmd.icon === 'string' ? cmd.icon : undefined,
    subcommands: Array.isArray(cmd.subcommands)
      ? cmd.subcommands.map(sanitizeSubcommand)
      : undefined,
    options: Array.isArray(cmd.options)
      ? cmd.options.map((opt: any) => ({
          name: opt.name,
          description: opt.description,
          isRequired: Boolean(opt.isRequired),
          isRepeatable: Boolean(opt.isRepeatable),
          isDangerous: Boolean(opt.isDangerous),
          isHidden: Boolean(opt.isHidden),
          args: sanitizeArgs(opt.args),
        }))
      : undefined,
    args: sanitizeArgs(cmd.args),
  };
}

import os from 'os';

export async function readDirectory(
  dirPath: string,
): Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]> {
  try {
    let target = dirPath ? dirPath.trim() : '';
    if (target === '~' || target.startsWith('~/') || target.startsWith('~\\')) {
      const home = os.homedir();
      target = target === '~' ? home : path.join(home, target.slice(2));
    }
    const resolvedPath = path.resolve(target || process.cwd());
    const entries = await fs.promises.readdir(resolvedPath, {
      withFileTypes: true,
    });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch (error: any) {
    log.debug?.(`readDirectory failed for ${dirPath}: ${error?.message}`);
    return [];
  }
}

export async function readPackageJson(
  dirPath: string,
): Promise<{ scripts: Record<string, string>; rootPath: string } | null> {
  let target = dirPath ? dirPath.trim() : '';
  if (target === '~' || target.startsWith('~/') || target.startsWith('~\\')) {
    const home = os.homedir();
    target = target === '~' ? home : path.join(home, target.slice(2));
  }
  let currentDir = path.resolve(target || process.cwd());
  const cacheKey = currentDir;
  const cached = packageJsonCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10000) {
    return { scripts: cached.scripts, rootPath: cacheKey };
  }

  while (currentDir) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      if (fs.existsSync(packageJsonPath)) {
        const content = await fs.promises.readFile(packageJsonPath, 'utf8');
        const parsed = JSON.parse(content);
        const scripts: Record<string, string> =
          parsed && typeof parsed.scripts === 'object' && parsed.scripts !== null
            ? parsed.scripts
            : {};
        packageJsonCache.set(cacheKey, { timestamp: Date.now(), scripts });
        return { scripts, rootPath: currentDir };
      }
    } catch {
      // continue searching upward
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return null;
}

export async function getGitBranches(directory: string): Promise<string[]> {
  try {
    const branches = (await branchesMainService.findAll(directory)) as string[];
    if (!Array.isArray(branches)) return [];
    return branches.map((branch) => branch.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function loadFigSpec(
  commandName: string,
): Promise<SerializableSubcommand | null> {
  const normalized = commandName.trim().toLowerCase();
  if (!normalized || !/^[a-z0-9_@/-]+$/.test(normalized)) {
    return null;
  }

  if (figSpecCache.has(normalized)) {
    return figSpecCache.get(normalized) || null;
  }

  const specFileName = `${normalized}.js`;
  const candidates = [
    path.join(
      process.cwd(),
      'node_modules',
      '@withfig',
      'autocomplete',
      'build',
      specFileName,
    ),
    path.join(
      __dirname,
      'node_modules/@withfig/autocomplete/build',
      specFileName,
    ),
    path.join(
      __dirname,
      '../../node_modules/@withfig/autocomplete/build',
      specFileName,
    ),
    path.join(
      __dirname,
      '../../../../node_modules/@withfig/autocomplete/build',
      specFileName,
    ),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const dynamicRequire =
          typeof (global as any).__non_webpack_require__ !== 'undefined'
            ? (global as any).__non_webpack_require__
            : eval('require');
        const rawSpecModule = dynamicRequire(candidate);
        const rawSpec = rawSpecModule?.default || rawSpecModule;
        if (rawSpec) {
          const sanitized = sanitizeSubcommand(rawSpec);
          figSpecCache.set(normalized, sanitized);
          return sanitized;
        }
      }
    } catch (error: any) {
      log.warn(`Failed loading Fig spec for ${normalized}: ${error?.message}`);
    }
  }

  figSpecCache.set(normalized, null);
  return null;
}

export default {
  readDirectory,
  readPackageJson,
  getGitBranches,
  loadFigSpec,
};
