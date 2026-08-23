import { CommandLineState, CompletionContext, CompletionItem } from './types';

export function createCommandLineState(text = '', cursor?: number): CommandLineState {
  return {
    text,
    cursor: cursor !== undefined ? Math.min(Math.max(0, cursor), text.length) : text.length,
  };
}

export function updateLineWithChar(
  state: CommandLineState,
  char: string,
): CommandLineState {
  const nextText =
    state.text.slice(0, state.cursor) + char + state.text.slice(state.cursor);
  return {
    text: nextText,
    cursor: state.cursor + char.length,
  };
}

export function handleBackspace(state: CommandLineState): CommandLineState {
  if (state.cursor <= 0) return state;
  const nextText =
    state.text.slice(0, state.cursor - 1) + state.text.slice(state.cursor);
  return {
    text: nextText,
    cursor: state.cursor - 1,
  };
}

export function handleDelete(state: CommandLineState): CommandLineState {
  if (state.cursor >= state.text.length) return state;
  const nextText =
    state.text.slice(0, state.cursor) + state.text.slice(state.cursor + 1);
  return {
    text: nextText,
    cursor: state.cursor,
  };
}

export function handleMoveLeft(state: CommandLineState): CommandLineState {
  return {
    text: state.text,
    cursor: Math.max(0, state.cursor - 1),
  };
}

export function handleMoveRight(state: CommandLineState): CommandLineState {
  return {
    text: state.text,
    cursor: Math.min(state.text.length, state.cursor + 1),
  };
}

export function handleHome(state: CommandLineState): CommandLineState {
  return {
    text: state.text,
    cursor: 0,
  };
}

export function handleEnd(state: CommandLineState): CommandLineState {
  return {
    text: state.text,
    cursor: state.text.length,
  };
}

export function handleClearWord(state: CommandLineState): CommandLineState {
  if (state.cursor <= 0) return state;
  const beforeCursor = state.text.slice(0, state.cursor);
  let deleteCount = 1;
  if (/\s+$/.test(beforeCursor)) {
    const matched = beforeCursor.match(/(\S*\s+)$/);
    deleteCount = matched ? matched[0].length : 1;
  } else {
    const matched = beforeCursor.match(/(\S+)$/);
    deleteCount = matched ? matched[0].length : 1;
  }
  const newCursor = Math.max(0, state.cursor - deleteCount);
  const nextText =
    state.text.slice(0, newCursor) + state.text.slice(state.cursor);
  return {
    text: nextText,
    cursor: newCursor,
  };
}

export function handleClearLineToCursor(state: CommandLineState): CommandLineState {
  return {
    text: state.text.slice(state.cursor),
    cursor: 0,
  };
}

export function handleClearLine(state: CommandLineState): CommandLineState {
  return {
    text: '',
    cursor: 0,
  };
}

export interface ParsedToken {
  value: string;
  raw: string;
  start: number;
  end: number;
  isQuoted: boolean;
  quoteChar?: string;
}

export function tokenizeCommandLine(input: string): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  let i = 0;

  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) {
      i += 1;
    }
    if (i >= input.length) break;

    const start = i;
    let value = '';
    let isQuoted = false;
    let quoteChar: string | undefined;

    while (i < input.length && !/\s/.test(input[i])) {
      const char = input[i];
      if ((char === '"' || char === "'") && !isQuoted) {
        isQuoted = true;
        quoteChar = char;
        i += 1;
        while (i < input.length && input[i] !== quoteChar) {
          if (input[i] === '\\' && i + 1 < input.length) {
            value += input[i + 1];
            i += 2;
          } else {
            value += input[i];
            i += 1;
          }
        }
        if (i < input.length && input[i] === quoteChar) {
          i += 1;
        }
      } else {
        value += char;
        i += 1;
      }
    }

    const raw = input.slice(start, i);
    tokens.push({
      value,
      raw,
      start,
      end: i,
      isQuoted,
      quoteChar,
    });
  }

  return tokens;
}

export function extractCompletionContext(
  state: CommandLineState,
  cwd: string,
  extra?: Partial<CompletionContext>,
): CompletionContext {
  const { text, cursor } = state;
  const tokens = tokenizeCommandLine(text);

  let targetToken: ParsedToken | undefined;
  let tokenIndex = -1;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (cursor >= token.start && cursor <= token.end) {
      targetToken = token;
      tokenIndex = i;
      break;
    }
  }

  let currentToken = '';
  let tokenStart = cursor;
  let tokenEnd = cursor;

  if (targetToken) {
    tokenStart = targetToken.start;
    tokenEnd = targetToken.end;
    currentToken = text.slice(tokenStart, cursor);
  } else {
    // Cursor is in whitespace
    let lastTokenBeforeCursor = -1;
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i].end <= cursor) {
        lastTokenBeforeCursor = i;
      }
    }
    tokenIndex = lastTokenBeforeCursor + 1;
    tokenStart = cursor;
    tokenEnd = cursor;
    currentToken = '';
  }

  const rawTokens = tokens.map((t) => t.value);
  const command = rawTokens[0] || undefined;
  const isOption = currentToken.startsWith('-');

  return {
    input: text,
    cursor,
    cwd,
    command,
    currentToken,
    tokenStart,
    tokenEnd,
    rawTokens,
    tokenIndex,
    isOption,
    ...extra,
  };
}

export function calculateAcceptanceDelta(
  context: CompletionContext,
  item: CompletionItem,
  fullState: CommandLineState,
): { ptyInput: string; nextState: CommandLineState } {
  const insert = item.insertText;
  const typedSoFar = context.currentToken;

  if (insert.startsWith(typedSoFar)) {
    const missingSuffix = insert.slice(typedSoFar.length);
    const textBefore = fullState.text.slice(0, context.cursor);
    const textAfter = fullState.text.slice(context.tokenEnd);
    const nextText = textBefore + missingSuffix + textAfter;
    const nextCursor = context.cursor + missingSuffix.length;

    return {
      ptyInput: missingSuffix,
      nextState: {
        text: nextText,
        cursor: nextCursor,
      },
    };
  }

  // Token replacement (e.g. complete replace or different casing)
  const backspacesNeeded = context.cursor - context.tokenStart;
  const erase = '\b'.repeat(Math.max(0, backspacesNeeded));
  const ptyInput = `${erase}${insert}`;
  const textBefore = fullState.text.slice(0, context.tokenStart);
  const textAfter = fullState.text.slice(context.tokenEnd);
  const nextText = textBefore + insert + textAfter;
  const nextCursor = context.tokenStart + insert.length;

  return {
    ptyInput,
    nextState: {
      text: nextText,
      cursor: nextCursor,
    },
  };
}
