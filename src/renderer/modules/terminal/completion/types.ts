export type CompletionItemType =
  | 'history'
  | 'command'
  | 'subcommand'
  | 'option'
  | 'file'
  | 'directory'
  | 'branch'
  | 'script';

export interface CompletionItem {
  label: string;
  insertText: string;
  type: CompletionItemType;
  description?: string;
  icon?: string; // UI presentation only! Never sent to PTY input.
  score?: number;
  source?: 'fig' | 'history' | 'filesystem' | 'git' | 'project';
  filterText?: string;
  replacementRange?: {
    start: number;
    end: number;
  };
}

export interface CompletionContext {
  input: string;
  cursor: number;
  cwd: string;
  command?: string;
  currentToken: string;
  tokenStart: number;
  tokenEnd: number;
  shell?: string;
  worktreePath?: string;
  activeBranches?: string[];
  history?: string[];
  rawTokens?: string[];
  tokenIndex?: number;
  isOption?: boolean;
}

export interface CompletionProvider {
  id: string;
  getSuggestions(
    context: CompletionContext,
    signal?: AbortSignal,
  ): Promise<CompletionItem[]> | CompletionItem[];
}

export interface CommandLineState {
  text: string;
  cursor: number;
}

export interface CompletionResult {
  suggestions: CompletionItem[];
  mode: 'ghost' | 'dropdown' | 'none';
  ghostSuffix?: string;
  topSuggestion?: CompletionItem;
  context: CompletionContext;
}
