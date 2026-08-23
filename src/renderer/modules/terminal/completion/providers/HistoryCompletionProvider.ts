import { CompletionContext, CompletionItem, CompletionProvider } from '../types';

export class HistoryCompletionProvider implements CompletionProvider {
  public id = 'history';

  private history: string[] = [];

  private maxEntries = 200;

  constructor(initialHistory: string[] = []) {
    this.history = [...new Set(initialHistory.map((s) => s.trim()).filter(Boolean))];
  }

  public recordCommand(command: string): void {
    const trimmed = command.trim();
    if (!trimmed) return;
    this.history = [trimmed, ...this.history.filter((c) => c !== trimmed)].slice(
      0,
      this.maxEntries,
    );
  }

  public getHistory(): string[] {
    return [...this.history];
  }

  public getSuggestions(context: CompletionContext): CompletionItem[] {
    const input = context.input.trimStart();
    const token = context.currentToken;
    if (!input && !token) return [];

    const effectiveHistory = context.history && context.history.length > 0
      ? context.history
      : this.history;

    const normalizedInput = input.toLowerCase();
    const normalizedToken = token.toLowerCase();
    const results: CompletionItem[] = [];

    effectiveHistory.forEach((commandLine, index) => {
      const normalizedCmd = commandLine.toLowerCase();
      // Whole command prefix match (e.g. typing "npm run pa" matches "npm run package:linux")
      if (normalizedInput && normalizedCmd.startsWith(normalizedInput) && normalizedCmd !== normalizedInput) {
        results.push({
          label: commandLine,
          insertText: commandLine,
          type: 'history',
          source: 'history',
          description: 'Recent history',
          score: 80 - Math.min(index, 30),
        });
      } else if (
        context.tokenIndex === 0 &&
        normalizedToken &&
        normalizedCmd.startsWith(normalizedToken) &&
        normalizedCmd !== normalizedToken
      ) {
        results.push({
          label: commandLine,
          insertText: commandLine,
          type: 'history',
          source: 'history',
          description: 'Recent history',
          score: 60 - Math.min(index, 30),
        });
      }
    });

    return results;
  }
}

export default HistoryCompletionProvider;
