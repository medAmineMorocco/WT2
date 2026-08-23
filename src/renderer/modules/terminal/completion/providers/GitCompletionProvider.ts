import { CompletionContext, CompletionItem, CompletionProvider } from '../types';

export type BranchFetcher = (cwd: string) => Promise<string[]>;

const defaultBranchFetcher: BranchFetcher = async (cwd: string) => {
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer?.invoke) {
    try {
      const branches = await (window as any).electron.ipcRenderer.invoke(
        'terminal:get-git-branches',
        cwd,
      );
      if (Array.isArray(branches)) return branches;
    } catch {
      return [];
    }
  }
  return [];
};

const GIT_BRANCH_COMMANDS = new Set([
  'checkout',
  'switch',
  'merge',
  'rebase',
  'branch',
  'log',
  'diff',
  'pull',
  'push',
]);

export class GitCompletionProvider implements CompletionProvider {
  public id = 'git';

  private cache = new Map<string, { branches: string[]; timestamp: number }>();

  private cacheTTL = 10000;

  private fetcher: BranchFetcher;

  constructor(fetcher: BranchFetcher = defaultBranchFetcher) {
    this.fetcher = fetcher;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public async getSuggestions(
    context: CompletionContext,
    signal?: AbortSignal,
  ): Promise<CompletionItem[]> {
    if (context.command?.toLowerCase() !== 'git') {
      return [];
    }

    if (context.isOption) {
      return [];
    }

    const rawTokens = context.rawTokens || [];
    const subcommand = rawTokens[1]?.toLowerCase();
    if (!subcommand || !GIT_BRANCH_COMMANDS.has(subcommand)) {
      return [];
    }

    // Only complete branch names after subcommand or after flags
    if (context.tokenIndex !== undefined && context.tokenIndex < 2) {
      return [];
    }

    let branches = context.activeBranches || [];

    if (branches.length === 0) {
      const cached = this.cache.get(context.cwd);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        branches = cached.branches;
      } else {
        try {
          branches = await this.fetcher(context.cwd);
          if (signal?.aborted) return [];
          this.cache.set(context.cwd, { branches, timestamp: Date.now() });
        } catch {
          return [];
        }
      }
    }

    const token = context.currentToken.toLowerCase();
    const matching = branches.filter((branch) =>
      branch.toLowerCase().startsWith(token),
    );

    return matching.map((branch) => ({
      label: branch,
      insertText: branch,
      type: 'branch',
      source: 'git',
      description: 'Git branch',
      score: 85,
    }));
  }
}

export default GitCompletionProvider;
