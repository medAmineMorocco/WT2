import { CompletionContext, CompletionItem } from './types';

export const STRONG_MATCH_THRESHOLD = 30;

export function scoreCompletionItem(
  item: CompletionItem,
  context: CompletionContext,
): number {
  let score = item.score || 0;
  const token = context.currentToken.toLowerCase();
  const label = item.label.toLowerCase();
  const insert = item.insertText.toLowerCase();

  if (token) {
    if (label === token || insert === token) {
      score += 120;
    } else if (label.startsWith(token) || insert.startsWith(token)) {
      score += 100;
      // Bonus for shorter match difference (closer match)
      score += Math.max(0, 10 - (label.length - token.length));
    } else if (label.includes(token)) {
      score += 30;
    } else {
      // Fuzzy match
      score += 10;
    }
  } else {
    // Empty token (e.g. after space)
    score += 50;
  }

  // Source-specific boosts
  switch (item.source) {
    case 'history':
      score += 40;
      break;
    case 'project':
      score += 45;
      break;
    case 'git':
      score += 45;
      break;
    case 'fig':
      score += 35;
      break;
    case 'filesystem':
      score += 25;
      break;
    default:
      break;
  }

  // Command context boosts
  const cmd = context.command?.toLowerCase();
  if (cmd === 'cd' || cmd === 'pushd' || cmd === 'rmdir') {
    if (item.type === 'directory') {
      score += 40;
    }
  }

  if (context.isOption && item.type === 'option') {
    score += 40;
  }

  return score;
}

export function rankAndFilterSuggestions(
  items: CompletionItem[],
  context: CompletionContext,
  maxResults = 30,
): CompletionItem[] {
  const scoredItems = items.map((item) => ({
    ...item,
    score: scoreCompletionItem(item, context),
  }));

  // Deduplicate by insertText and type
  const seen = new Set<string>();
  const deduplicated: CompletionItem[] = [];

  for (const item of scoredItems) {
    const key = `${item.insertText}::${item.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(item);
    }
  }

  deduplicated.sort((a, b) => (b.score || 0) - (a.score || 0));

  return deduplicated.slice(0, maxResults);
}

export function determineCompletionMode(
  suggestions: CompletionItem[],
  context: CompletionContext,
): { mode: 'ghost' | 'dropdown' | 'none'; ghostSuffix?: string; top?: CompletionItem } {
  if (suggestions.length === 0) {
    return { mode: 'none' };
  }

  const top = suggestions[0];
  const token = context.currentToken;

  // Calculate ghost suffix if top suggestion starts with current token
  let ghostSuffix: string | undefined;
  if (top.insertText.toLowerCase().startsWith(token.toLowerCase())) {
    ghostSuffix = top.insertText.slice(token.length);
  } else if (
    context.input &&
    top.insertText.toLowerCase().startsWith(context.input.toLowerCase())
  ) {
    ghostSuffix = top.insertText.slice(context.input.length);
  }

  if (!ghostSuffix) {
    return { mode: 'dropdown', top };
  }

  if (suggestions.length === 1) {
    return { mode: 'ghost', ghostSuffix, top };
  }

  const second = suggestions[1];
  const scoreDiff = (top.score || 0) - (second.score || 0);

  if (scoreDiff >= STRONG_MATCH_THRESHOLD) {
    return { mode: 'ghost', ghostSuffix, top };
  }

  return { mode: 'dropdown', ghostSuffix, top };
}
