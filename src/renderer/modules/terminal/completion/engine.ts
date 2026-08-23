import {
  CompletionContext,
  CompletionItem,
  CompletionProvider,
  CompletionResult,
} from './types';
import { HistoryCompletionProvider } from './providers/HistoryCompletionProvider';
import { FileSystemCompletionProvider } from './providers/FileSystemCompletionProvider';
import { FigCompletionProvider } from './providers/FigCompletionProvider';
import { GitCompletionProvider } from './providers/GitCompletionProvider';
import { PackageJsonCompletionProvider } from './providers/PackageJsonCompletionProvider';
import {
  determineCompletionMode,
  rankAndFilterSuggestions,
} from './ranking';

export class CompletionEngine {
  private providers: CompletionProvider[] = [];

  private currentVersion = 0;

  private currentAbortController: AbortController | null = null;

  public historyProvider: HistoryCompletionProvider;

  public filesystemProvider: FileSystemCompletionProvider;

  public figProvider: FigCompletionProvider;

  public gitProvider: GitCompletionProvider;

  public packageJsonProvider: PackageJsonCompletionProvider;

  constructor() {
    this.historyProvider = new HistoryCompletionProvider();
    this.filesystemProvider = new FileSystemCompletionProvider();
    this.figProvider = new FigCompletionProvider();
    this.gitProvider = new GitCompletionProvider();
    this.packageJsonProvider = new PackageJsonCompletionProvider();

    this.providers = [
      this.historyProvider,
      this.packageJsonProvider,
      this.gitProvider,
      this.figProvider,
      this.filesystemProvider,
    ];
  }

  public registerProvider(provider: CompletionProvider): void {
    this.providers.push(provider);
  }

  public async complete(
    context: CompletionContext,
  ): Promise<CompletionResult | null> {
    this.currentVersion += 1;
    const version = this.currentVersion;

    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    // Run all providers concurrently
    const providerPromises = this.providers.map(async (provider) => {
      try {
        const results = await provider.getSuggestions(
          context,
          abortController.signal,
        );
        return Array.isArray(results) ? results : [];
      } catch {
        return [];
      }
    });

    const settled = await Promise.allSettled(providerPromises);

    // If a newer request was issued or aborted, discard results
    if (version !== this.currentVersion || abortController.signal.aborted) {
      return null;
    }

    const allItems: CompletionItem[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    const ranked = rankAndFilterSuggestions(allItems, context);
    const { mode, ghostSuffix, top } = determineCompletionMode(
      ranked,
      context,
    );

    return {
      suggestions: ranked,
      mode,
      ghostSuffix,
      topSuggestion: top,
      context,
    };
  }

  public cancel(): void {
    this.currentVersion += 1;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }
}

export default CompletionEngine;
