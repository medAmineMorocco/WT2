import { CompletionContext, CompletionItem, CompletionProvider } from '../types';

export interface PackageJsonData {
  scripts: Record<string, string>;
  rootPath?: string;
}

export type PackageJsonReader = (dirPath: string) => Promise<PackageJsonData | null>;

const defaultReader: PackageJsonReader = async (dirPath: string) => {
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer?.invoke) {
    try {
      return await (window as any).electron.ipcRenderer.invoke(
        'terminal:read-package-json',
        dirPath,
      );
    } catch {
      return null;
    }
  }
  return null;
};

const PKG_COMMANDS = new Set(['npm', 'pnpm', 'yarn', 'bun']);

export class PackageJsonCompletionProvider implements CompletionProvider {
  public id = 'package.json';

  private cache = new Map<string, { data: PackageJsonData | null; timestamp: number }>();

  private cacheTTL = 15000;

  private reader: PackageJsonReader;

  constructor(reader: PackageJsonReader = defaultReader) {
    this.reader = reader;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public async getSuggestions(
    context: CompletionContext,
    signal?: AbortSignal,
  ): Promise<CompletionItem[]> {
    const cmd = context.command?.toLowerCase();
    if (!cmd || !PKG_COMMANDS.has(cmd)) {
      return [];
    }

    if (context.isOption) {
      return [];
    }

    const rawTokens = context.rawTokens || [];
    const isRunCmd =
      rawTokens[1]?.toLowerCase() === 'run' ||
      (cmd === 'yarn' && rawTokens.length >= 1) ||
      (cmd === 'pnpm' && rawTokens.length >= 1);

    if (!isRunCmd) {
      return [];
    }

    // Ensure we are completing the script name token
    const tokenIndex = context.tokenIndex ?? rawTokens.length - 1;
    const isScriptPosition =
      (rawTokens[1]?.toLowerCase() === 'run' && tokenIndex >= 2) ||
      (rawTokens[1]?.toLowerCase() !== 'run' && tokenIndex >= 1);

    if (!isScriptPosition) {
      return [];
    }

    let pkgData: PackageJsonData | null = null;
    const cached = this.cache.get(context.cwd);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      pkgData = cached.data;
    } else {
      try {
        pkgData = await this.reader(context.cwd);
        if (!pkgData && context.worktreePath && context.worktreePath !== context.cwd) {
          pkgData = await this.reader(context.worktreePath);
        }
        if (signal?.aborted) return [];
        this.cache.set(context.cwd, { data: pkgData, timestamp: Date.now() });
      } catch {
        return [];
      }
    }

    if (!pkgData || !pkgData.scripts) {
      return [];
    }

    const token = context.currentToken.toLowerCase();
    const suggestions: CompletionItem[] = [];

    for (const [scriptName, scriptCmd] of Object.entries(pkgData.scripts)) {
      if (!token || scriptName.toLowerCase().startsWith(token)) {
        suggestions.push({
          label: scriptName,
          insertText: scriptName,
          type: 'script',
          source: 'project',
          description: `script: ${scriptCmd}`,
          score: 85,
        });
      }
    }

    return suggestions;
  }
}

export default PackageJsonCompletionProvider;
