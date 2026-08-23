import { CompletionContext, CompletionItem, CompletionProvider } from '../types';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export type DirectoryReader = (dirPath: string) => Promise<FileEntry[]>;

const defaultReader: DirectoryReader = async (dirPath: string) => {
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer?.invoke) {
    try {
      const res = await (window as any).electron.ipcRenderer.invoke(
        'terminal:read-dir',
        dirPath,
      );
      if (Array.isArray(res)) return res;
    } catch {
      return [];
    }
  }
  return [];
};

const SUBCOMMAND_CLI_TOOLS = new Set([
  'git',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'deno',
  'docker',
  'docker-compose',
  'cargo',
  'rustup',
  'go',
  'gh',
  'kubectl',
  'systemctl',
  'apt',
  'brew',
  'pip',
  'pip3',
  'composer',
]);

export class FileSystemCompletionProvider implements CompletionProvider {
  public id = 'filesystem';

  private cache = new Map<string, { entries: FileEntry[]; timestamp: number }>();

  private cacheTTL = 5000;

  private reader: DirectoryReader;

  constructor(reader: DirectoryReader = defaultReader) {
    this.reader = reader;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  private splitPathToken(token: string): {
    dirToken: string;
    namePrefix: string;
    separator: string;
  } {
    const lastSlash = Math.max(token.lastIndexOf('/'), token.lastIndexOf('\\'));
    if (lastSlash === -1) {
      return { dirToken: '', namePrefix: token, separator: '/' };
    }
    const separator = token[lastSlash];
    const dirToken = token.slice(0, lastSlash + 1);
    const namePrefix = token.slice(lastSlash + 1);
    return { dirToken, namePrefix, separator };
  }

  private resolveDirectory(cwd: string, dirToken: string): string {
    if (!dirToken) return cwd;
    const cleanDir = dirToken.replace(/\\/g, '/');

    // Handle home directory
    if (cleanDir.startsWith('~/') || cleanDir === '~') {
      const home =
        (typeof process !== 'undefined' && (process.env.HOME || process.env.USERPROFILE)) ||
        '';
      if (cleanDir === '~') return home;
      return `${home}/${cleanDir.slice(2)}`;
    }

    // Windows absolute path e.g. C:/ or C:\
    if (/^[a-zA-Z]:[/\\]/.test(dirToken)) {
      return dirToken;
    }

    // Unix absolute path
    if (cleanDir.startsWith('/')) {
      return dirToken;
    }

    // Relative to cwd
    const cleanCwd = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
    return `${cleanCwd}/${cleanDir}`;
  }

  public async getSuggestions(
    context: CompletionContext,
    signal?: AbortSignal,
  ): Promise<CompletionItem[]> {
    const token = context.currentToken;
    const isOption = context.isOption;
    if (isOption) return [];

    const hasExplicitPathPrefix =
      token.startsWith('./') ||
      token.startsWith('.\\') ||
      token.startsWith('../') ||
      token.startsWith('..\\') ||
      token.startsWith('/') ||
      token.startsWith('\\') ||
      token.startsWith('~/') ||
      token.startsWith('~\\') ||
      token.includes('/') ||
      token.includes('\\');

    // If typing root command (tokenIndex === 0), only complete files if explicit path given (e.g. ./script.sh)
    if ((context.tokenIndex === 0 || !context.command) && !hasExplicitPathPrefix) {
      return [];
    }

    // If typing subcommand for CLI tools (tokenIndex === 1), don't complete files unless explicit path given
    const cmd = context.command?.toLowerCase();
    if (
      cmd &&
      SUBCOMMAND_CLI_TOOLS.has(cmd) &&
      context.tokenIndex === 1 &&
      !hasExplicitPathPrefix
    ) {
      return [];
    }

    // If typing script name for npm/pnpm/yarn/bun run (tokenIndex === 2), don't complete files unless explicit path given
    const prevToken = context.rawTokens?.[1]?.toLowerCase();
    if (
      cmd &&
      (cmd === 'npm' || cmd === 'pnpm' || cmd === 'yarn' || cmd === 'bun') &&
      prevToken === 'run' &&
      context.tokenIndex === 2 &&
      !hasExplicitPathPrefix
    ) {
      return [];
    }

    const { dirToken, namePrefix } = this.splitPathToken(token);
    const targetDir = this.resolveDirectory(context.cwd, dirToken);

    if (signal?.aborted) return [];

    let entries: FileEntry[] = [];
    const cached = this.cache.get(targetDir);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      entries = cached.entries;
    } else {
      try {
        entries = await this.reader(targetDir);
        if (signal?.aborted) return [];
        this.cache.set(targetDir, { entries, timestamp: Date.now() });
      } catch {
        return [];
      }
    }

    const lowerPrefix = namePrefix.toLowerCase();
    const showHidden = namePrefix.startsWith('.');
    const directoriesOnly = cmd === 'cd' || cmd === 'rmdir' || cmd === 'pushd';

    const matching = entries.filter((entry) => {
      if (!showHidden && entry.name.startsWith('.')) return false;
      if (directoriesOnly && !entry.isDirectory) return false;
      return entry.name.toLowerCase().startsWith(lowerPrefix);
    });

    return matching.map((entry) => {
      const isDir = entry.isDirectory;
      const suffix = isDir ? '/' : '';
      const fullInsertText = `${dirToken}${entry.name}${suffix}`;
      const displayLabel = `${entry.name}${suffix}`;

      return {
        label: displayLabel,
        insertText: fullInsertText,
        type: isDir ? 'directory' : 'file',
        icon: isDir ? '📂' : '📄', // Presentation only! Never in insertText.
        source: 'filesystem',
        description: isDir ? 'Directory' : 'File',
        score: isDir && directoriesOnly ? 70 : 40,
      };
    });
  }
}

export default FileSystemCompletionProvider;
