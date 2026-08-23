import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppstoreOutlined,
  CloseOutlined,
  CompressOutlined,
  ExpandOutlined,
  PaperClipOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  Button,
  Empty,
  Input,
  Modal,
  Radio,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  AiAgentConfig,
  AiAgentId,
  aiAgentsDefault,
} from '../../../shared/aiAgents';
import './TerminalInteractive.css';
import { CompletionEngine } from './completion/engine';
import {
  calculateAcceptanceDelta,
  createCommandLineState,
  extractCompletionContext,
  handleBackspace,
  handleClearLine,
  handleClearWord,
  handleEnd,
  handleHome,
  handleMoveLeft,
  handleMoveRight,
  updateLineWithChar,
} from './completion/commandLineState';
import { CommandLineState, CompletionItem, CompletionResult } from './completion/types';
import {
  CellDimensions,
  CursorPosition,
  GhostCompletionOverlay,
} from './completion/ui/GhostCompletionOverlay';
import { CompletionDropdown } from './completion/ui/CompletionDropdown';

type WorktreeOption = {
  name: string;
  path: string;
};

type TerminalDescriptor = WorktreeOption & {
  id: string;
  agent?: AiAgent;
  mode?: 'terminal' | 'agent';
};

type AiAgent = AiAgentConfig;

export type TerminalAgentActivity = {
  terminalId: string;
  worktreePath: string;
  agent: AiAgent;
  active: boolean;
};

function AgentIcon({ agent, size = 18 }: { agent: AiAgent; size?: number }) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const;

  if (agent.id === 'claude') {
    return (
      <svg {...commonProps} className="ai-agent-icon ai-agent-icon-claude">
        <path
          fill="currentColor"
          d="M12 2.3c1.2 0 1.6 2.26 2.57 2.77 1.01.54 2.92-.72 3.77.13.85.85-.41 2.76.13 3.77.51.97 2.77 1.37 2.77 2.57s-2.26 1.6-2.77 2.57c-.54 1.01.72 2.92-.13 3.77-.85.85-2.76-.41-3.77.13C13.6 19.44 13.2 21.7 12 21.7s-1.6-2.26-2.57-2.77c-1.01-.54-2.92.72-3.77-.13-.85-.85.41-2.76-.13-3.77C5.02 14.06 2.76 13.66 2.76 12s2.26-1.6 2.77-2.57c.54-1.01-.72-2.92.13-3.77.85-.85 2.76.41 3.77-.13C10.4 4.56 10.8 2.3 12 2.3Zm0 6.2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        />
      </svg>
    );
  }

  if (agent.id === 'codex') {
    return (
      <svg {...commonProps} className="ai-agent-icon ai-agent-icon-codex">
        <path
          fill="currentColor"
          d="M12 2.2 16.1 4v4.15L19.7 10v4L16.1 16v4.1L12 21.8 7.9 20.1V16L4.3 14v-4l3.6-1.85V4L12 2.2Zm0 3.05-1.55.68v3.05l-2.8 1.44v3.17l2.8 1.45v3.03L12 18.75l1.55-.68v-3.03l2.8-1.45v-3.17l-2.8-1.44V5.93L12 5.25Z"
        />
      </svg>
    );
  }

  if (agent.id === 'cursor') {
    return (
      <svg {...commonProps} className="ai-agent-icon ai-agent-icon-cursor">
        <path
          fill="currentColor"
          d="m12 2.3 8.4 4.85v9.7L12 21.7l-8.4-4.85v-9.7L12 2.3Z"
        />
        <path
          fill="var(--cursor-cutout)"
          d="m12 6.5 4.7 2.72v5.56L12 17.5l-4.7-2.72V9.22L12 6.5Z"
        />
      </svg>
    );
  }

  return (
    <svg {...commonProps} className="ai-agent-icon ai-agent-icon-antigravity">
      <path
        fill="currentColor"
        d="M12 2.5 22 19H2L12 2.5Zm0 4.45L6.37 16h11.26L12 6.95Z"
      />
      <path fill="currentColor" d="M9.5 12.2h5l-2.5 4.3-2.5-4.3Z" />
    </svg>
  );
}

function sessionId() {
  return `terminal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function terminalTheme(isDarkMode: boolean) {
  return isDarkMode
    ? {
        background: '#0f0f0f',
        foreground: '#f0f0f0',
        cursor: '#1677ff',
        selectionBackground: '#1668dc66',
      }
    : {
        background: '#ffffff',
        foreground: '#1f1f1f',
        cursor: '#1677ff',
        selectionBackground: '#1677ff33',
      };
}

function TerminalPane({
  terminal,
  isDarkMode,
  isActive,
  onClose,
  onActivate,
  registerFocus,
  onAgentActivity,
  isFocusedMode,
  canFocus,
  onToggleFocusedMode,
}: {
  terminal: TerminalDescriptor;
  isDarkMode: boolean;
  isActive: boolean;
  onClose: (id: string) => void;
  onActivate: (id: string) => void;
  registerFocus: (id: string, focus: (() => void) | null) => void;
  onAgentActivity?: (activity: TerminalAgentActivity) => void;
  isFocusedMode: boolean;
  canFocus: boolean;
  onToggleFocusedMode: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const initialDarkModeRef = useRef(isDarkMode);
  const acceptingCommandRef = useRef(true);
  const isFocusedRef = useRef(false);
  const outputTailRef = useRef('');

  const completionEngineRef = useRef<CompletionEngine>(new CompletionEngine());
  const lineStateRef = useRef<CommandLineState>(createCommandLineState(''));
  const completionResultRef = useRef<CompletionResult | null>(null);
  const selectedDropdownIndexRef = useRef(0);

  const [currentCwd, setCurrentCwd] = useState(terminal.path);
  const currentCwdRef = useRef(terminal.path);

  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0);
  const [cursorScreenPos, setCursorScreenPos] = useState<CursorPosition>({ x: 0, y: 0 });
  const [cellDimensions, setCellDimensions] = useState<CellDimensions>({
    width: 7.8,
    height: 17,
  });
  const [hostDimensions, setHostDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 400,
  });

  const setCompletionResultSync = useCallback((res: CompletionResult | null) => {
    completionResultRef.current = res;
    setCompletionResult(res);
  }, []);

  const setSelectedDropdownIndexSync = useCallback((idx: number) => {
    selectedDropdownIndexRef.current = idx;
    setSelectedDropdownIndex(idx);
  }, []);

  const agentFinishedRef = useRef(false);
  const agentStartedRef = useRef(false);
  const pendingAgentRef = useRef<AiAgent | undefined>(undefined);
  const isAgentModeRef = useRef(terminal.mode === 'agent');
  const activeAgentRef = useRef<AiAgent | undefined>(terminal.agent);
  const [status, setStatus] = useState<
    'starting' | 'ready' | 'agent-running' | 'exited' | 'error'
  >('starting');
  const [selectedAgentId, setSelectedAgentId] = useState<AiAgentId>('claude');
  const [configuredAgents, setConfiguredAgents] = useState<AiAgent[]>(
    aiAgentsDefault,
  );
  const [agentPrompt, setAgentPrompt] = useState('');
  const [activeAgent, setActiveAgent] = useState<AiAgent | undefined>(
    terminal.agent,
  );
  const [mode, setMode] = useState<'terminal' | 'agent'>(
    terminal.mode || 'terminal',
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [promptFiles, setPromptFiles] = useState<
    { name: string; path?: string }[]
  >([]);

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = terminalTheme(isDarkMode);
    }
  }, [isDarkMode]);

  useEffect(() => {
    isAgentModeRef.current = mode === 'agent';
    if (mode === 'agent' && !agentStartedRef.current) {
      xtermRef.current?.reset();
    }
  }, [mode]);

  useEffect(() => {
    const refreshConfiguredAgents = () => {
      try {
        const stored = window.localStorage.getItem('aiAgents');
        const saved = stored ? (JSON.parse(stored) as AiAgent[]) : [];
        setConfiguredAgents(
          aiAgentsDefault.map((defaultAgent) => ({
            ...defaultAgent,
            ...saved.find((agent) => agent.id === defaultAgent.id),
          })),
        );
      } catch {
        setConfiguredAgents(aiAgentsDefault);
      }
    };
    refreshConfiguredAgents();
    window.addEventListener('focus', refreshConfiguredAgents);
    return () => window.removeEventListener('focus', refreshConfiguredAgents);
  }, []);

  const enabledAgents = configuredAgents.filter((agent) => agent.enabled);

  useEffect(() => {
    if (enabledAgents.some((agent) => agent.id === selectedAgentId)) return;
    if (enabledAgents[0]) setSelectedAgentId(enabledAgents[0].id);
  }, [enabledAgents, selectedAgentId]);

  const updateCursorDimensions = useCallback(() => {
    if (xtermRef.current) {
      setCursorScreenPos({
        x: xtermRef.current.buffer.active.cursorX,
        y: xtermRef.current.buffer.active.cursorY,
      });
    }
    if (hostRef.current && xtermRef.current) {
      const host = hostRef.current;
      const screenEl = host.querySelector('.xterm-screen') as HTMLElement | null;
      const cols = xtermRef.current.cols || 80;
      const rows = xtermRef.current.rows || 24;
      const w =
        screenEl && screenEl.clientWidth > 0
          ? screenEl.clientWidth / cols
          : (xtermRef.current as any)._core?._renderService?.dimensions?.css?.cell?.width || 7.8;
      const h =
        screenEl && screenEl.clientHeight > 0
          ? screenEl.clientHeight / rows
          : (xtermRef.current as any)._core?._renderService?.dimensions?.css?.cell?.height || 17;
      setCellDimensions({ width: Math.max(w, 6), height: Math.max(h, 12) });
      setHostDimensions({ width: host.clientWidth, height: host.clientHeight });
    }
  }, []);

  const hideSuggestions = useCallback(() => {
    completionEngineRef.current.cancel();
    setCompletionResultSync(null);
    setSelectedDropdownIndexSync(0);
  }, [setCompletionResultSync, setSelectedDropdownIndexSync]);

  const triggerCompletion = useCallback(async () => {
    if (isAgentModeRef.current) {
      hideSuggestions();
      return;
    }
    const context = extractCompletionContext(lineStateRef.current, currentCwdRef.current, {
      worktreePath: terminal.path,
      history: completionEngineRef.current.historyProvider.getHistory(),
    });
    updateCursorDimensions();
    const result = await completionEngineRef.current.complete(context);
    if (result) {
      setCompletionResultSync(result);
      setSelectedDropdownIndexSync(0);
      updateCursorDimensions();
    }
  }, [hideSuggestions, setCompletionResultSync, setSelectedDropdownIndexSync, terminal.path, updateCursorDimensions]);

  const acceptSuggestion = useCallback(
    (item?: CompletionItem) => {
      const currentRes = completionResultRef.current;
      const currentIdx = selectedDropdownIndexRef.current;
      const targetItem =
        item ||
        (currentRes?.mode === 'dropdown'
          ? currentRes.suggestions[currentIdx]
          : currentRes?.topSuggestion);
      if (!targetItem) return;

      const context = extractCompletionContext(lineStateRef.current, currentCwdRef.current, {
        worktreePath: terminal.path,
        history: completionEngineRef.current.historyProvider.getHistory(),
      });
      const { ptyInput, nextState } = calculateAcceptanceDelta(
        context,
        targetItem,
        lineStateRef.current,
      );
      lineStateRef.current = nextState;
      if (ptyInput) {
        window.electron.ipcRenderer.send('terminal-input', terminal.id, ptyInput);
      }
      hideSuggestions();

      // Ensure focus is strictly kept on xterm
      requestAnimationFrame(() => {
        xtermRef.current?.focus();
        const textarea = hostRef.current?.querySelector(
          '.xterm-helper-textarea',
        ) as HTMLTextAreaElement | null;
        textarea?.focus();
      });
    },
    [hideSuggestions, terminal.id, terminal.path],
  );

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const xterm = new XTerm({
      cursorBlink: true,
      convertEol: false,
      fontFamily: 'Cascadia Mono, Consolas, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.15,
      scrollback: 5000,
      theme: terminalTheme(initialDarkModeRef.current),
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(hostRef.current);
    xtermRef.current = xterm;
    registerFocus(terminal.id, () => xterm.focus());

    xterm.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      const currentRes = completionResultRef.current;
      const currentIdx = selectedDropdownIndexRef.current;

      // Prevent Tab from moving browser DOM focus away from the terminal
      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();

        if (currentRes?.mode === 'dropdown' && currentRes.suggestions.length > 0) {
          acceptSuggestion(currentRes.suggestions[currentIdx]);
        } else if (currentRes?.mode === 'ghost' && currentRes.topSuggestion) {
          acceptSuggestion(currentRes.topSuggestion);
        } else {
          window.electron.ipcRenderer.send('terminal-input', terminal.id, '\t');
        }

        requestAnimationFrame(() => {
          xtermRef.current?.focus();
          const textarea = hostRef.current?.querySelector(
            '.xterm-helper-textarea',
          ) as HTMLTextAreaElement | null;
          textarea?.focus();
        });

        return false;
      }

      // Autocomplete navigation when dropdown is visible
      if (currentRes?.mode === 'dropdown' && currentRes.suggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          setSelectedDropdownIndexSync(
            (currentIdx + 1) % currentRes.suggestions.length,
          );
          return false;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopPropagation();
          setSelectedDropdownIndexSync(
            (currentIdx - 1 + currentRes.suggestions.length) %
              currentRes.suggestions.length,
          );
          return false;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          hideSuggestions();
          xtermRef.current?.focus();
          return false;
        }
      } else if (currentRes?.mode === 'ghost' && currentRes.ghostSuffix) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          hideSuggestions();
          xtermRef.current?.focus();
          return false;
        }
      }

      // Ctrl+Backspace: erase word before cursor
      if ((event.ctrlKey || event.metaKey) && event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        window.electron.ipcRenderer.send('terminal-input', terminal.id, '\x17');
        lineStateRef.current = handleClearWord(lineStateRef.current);
        triggerCompletion();
        return false;
      }

      return true;
    });

    const inputDisposable = xterm.onData((data) => {
      isFocusedRef.current = true;
      if (isAgentModeRef.current) return;

      // Forward native terminal keystroke data directly to the PTY process
      window.electron.ipcRenderer.send('terminal-input', terminal.id, data);

      if (data === '\x0c') {
        // Ctrl+L (Clear screen)
        xterm.clear();
        hideSuggestions();
      } else if (data === '\x15') {
        // Ctrl+U (Clear line before cursor in shell)
        lineStateRef.current = createCommandLineState('');
        hideSuggestions();
      } else if (data === '\x17' || data === '\x08') {
        // Ctrl+W / Ctrl+Backspace (Delete word)
        lineStateRef.current = handleClearWord(lineStateRef.current);
        triggerCompletion();
      } else if (data === '\x03') {
        // Ctrl+C (Interrupt/Cancel line)
        lineStateRef.current = createCommandLineState('');
        hideSuggestions();
      } else if (data === '\x1b') {
        // Escape
        hideSuggestions();
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        lineStateRef.current = handleBackspace(lineStateRef.current);
        triggerCompletion();
      } else if (data === '\x1b[3~') {
        // Delete key
        const { text, cursor } = lineStateRef.current;
        if (cursor < text.length) {
          lineStateRef.current = {
            text: text.slice(0, cursor) + text.slice(cursor + 1),
            cursor,
          };
          triggerCompletion();
        }
      } else if (data === '\x1b[3;5~') {
        // Ctrl+Delete (Delete forward word)
        const { text, cursor } = lineStateRef.current;
        const afterCursor = text.slice(cursor);
        const match = afterCursor.match(/^(\s*\S+|\s+)/);
        if (match) {
          lineStateRef.current = {
            text: text.slice(0, cursor) + text.slice(cursor + match[0].length),
            cursor,
          };
          triggerCompletion();
        }
      } else if (data === '\x1b[D') {
        // Left arrow
        lineStateRef.current = handleMoveLeft(lineStateRef.current);
        triggerCompletion();
      } else if (data === '\x1b[C') {
        // Right arrow
        lineStateRef.current = handleMoveRight(lineStateRef.current);
        triggerCompletion();
      } else if (data === '\x01' || data === '\x1b[H' || data === '\x1b[1~') {
        // Home / Ctrl+A
        lineStateRef.current = handleHome(lineStateRef.current);
        triggerCompletion();
      } else if (data === '\x05' || data === '\x1b[F' || data === '\x1b[4~') {
        // End / Ctrl+E
        lineStateRef.current = handleEnd(lineStateRef.current);
        triggerCompletion();
      } else if (data === '\x0b') {
        // Ctrl+K (Kill to end of line)
        lineStateRef.current = {
          text: lineStateRef.current.text.slice(0, lineStateRef.current.cursor),
          cursor: lineStateRef.current.cursor,
        };
        triggerCompletion();
      } else if (data === '\r' || data === '\n') {
        const lineText = lineStateRef.current.text.trim();
        if (lineText) {
          completionEngineRef.current.historyProvider.recordCommand(lineText);
          const match = lineText.match(/^(?:cd|pushd)\s*(.*)$/i);
          if (match) {
            const rawTarget = match[1].trim().replace(/^['"]|['"]$/g, '');
            if (!rawTarget || rawTarget === '~') {
              currentCwdRef.current = terminal.path;
              setCurrentCwd(terminal.path);
            } else if (rawTarget === '..') {
              const clean = currentCwdRef.current.replace(/[/\\]+$/, '');
              const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
              if (lastSlash > 0) {
                const parent = clean.slice(0, lastSlash);
                currentCwdRef.current = parent;
                setCurrentCwd(parent);
              }
            } else {
              const isAbsolute = /^[a-zA-Z]:[/\\]/.test(rawTarget) || rawTarget.startsWith('/');
              if (isAbsolute) {
                currentCwdRef.current = rawTarget;
                setCurrentCwd(rawTarget);
              } else {
                const cleanBase = currentCwdRef.current.replace(/[/\\]+$/, '');
                const cleanRel = rawTarget.replace(/^[./\\]+/, '');
                const nextPath = `${cleanBase}/${cleanRel}`;
                currentCwdRef.current = nextPath;
                setCurrentCwd(nextPath);
              }
            }
          }
        }
        lineStateRef.current = createCommandLineState('');
        acceptingCommandRef.current = false;
        hideSuggestions();
      } else if (/^[\x20-\x7e\u00a0-\uffff]+$/.test(data)) {
        lineStateRef.current = updateLineWithChar(lineStateRef.current, data);
        triggerCompletion();
      }
    });

    const removeData = window.electron.ipcRenderer.on(
      'terminal-data',
      (id: string, data: string) => {
        if (id !== terminal.id) return;
        if (isAgentModeRef.current && !agentStartedRef.current) return;
        xterm.write(data);
        outputTailRef.current = `${outputTailRef.current}${data}`
          .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
          .slice(-500);

        // Detect shell current working directory from prompt patterns
        const promptMatch = outputTailRef.current.match(
          /(?:^|\r?\n)(?:(?:PS )?([a-zA-Z]:\\[^\r\n<>|"]*)|(?:PS )?([a-zA-Z]:\/[^\r\n<>|"]*)|(?:[^\s@\r\n]+@[^:\r\n]+:([^\r\n$#]+)))\s*[$#>]\s*$/i,
        );
        if (promptMatch) {
          const matchedDir = (promptMatch[1] || promptMatch[2] || promptMatch[3] || '').trim();
          if (matchedDir && matchedDir !== currentCwdRef.current) {
            currentCwdRef.current = matchedDir;
            setCurrentCwd(matchedDir);
          }
        }

        if (
          /(?:^|\r?\n)(?:(?:PS )?[a-z]:\\[^\r\n]*>|[^\s@]+@[^:\r\n]+:[^\r\n]*[$#])\s*$/i.test(
            outputTailRef.current,
          )
        ) {
          acceptingCommandRef.current = true;
          if (
            activeAgentRef.current &&
            agentStartedRef.current &&
            !agentFinishedRef.current
          ) {
            agentFinishedRef.current = true;
            setStatus('ready');
            setActiveAgent(undefined);
            onAgentActivity?.({
              terminalId: terminal.id,
              worktreePath: terminal.path,
              agent: activeAgentRef.current,
              active: false,
            });
          }
        }
      },
    );
    const removeReady = window.electron.ipcRenderer.on(
      'terminal-ready',
      (id: string) => {
        if (id !== terminal.id) return;
        setStatus('ready');
        if (terminal.mode === 'agent') {
          window.setTimeout(() => xterm.reset(), 350);
        }
        window.setTimeout(() => {
          xterm.focus();
          updateCursorDimensions();
        }, 300);
      },
    );
    const removeAgentStarted = window.electron.ipcRenderer.on(
      'terminal-ai-agent-started',
      (id: string, agentId: AiAgentId) => {
        if (id !== terminal.id || pendingAgentRef.current?.id !== agentId) return;
        const agent = pendingAgentRef.current;
        if (!agent) return;
        pendingAgentRef.current = undefined;
        activeAgentRef.current = agent;
        agentStartedRef.current = true;
        agentFinishedRef.current = false;
        setActiveAgent(agent);
        setStatus('agent-running');
        setAgentPrompt('');
        onAgentActivity?.({
          terminalId: terminal.id,
          worktreePath: terminal.path,
          agent,
          active: true,
        });
      },
    );
    const removeAgentError = window.electron.ipcRenderer.on(
      'terminal-ai-agent-error',
      (id: string, message: string) => {
        if (id !== terminal.id) return;
        pendingAgentRef.current = undefined;
        setStatus('ready');
        xterm.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      },
    );
    const removeExit = window.electron.ipcRenderer.on(
      'terminal-exit',
      (id: string, exitCode: number) => {
        if (id !== terminal.id) return;
        setStatus('exited');
        if (activeAgentRef.current && !agentFinishedRef.current) {
          agentFinishedRef.current = true;
          onAgentActivity?.({
            terminalId: terminal.id,
            worktreePath: terminal.path,
            agent: activeAgentRef.current,
            active: false,
          });
        }
        xterm.writeln(`\r\n[Process exited with code ${exitCode}]`);
      },
    );
    const removeError = window.electron.ipcRenderer.on(
      'terminal-error',
      (id: string, message: string) => {
        if (id !== terminal.id) return;
        setStatus('error');
        if (activeAgentRef.current && !agentFinishedRef.current) {
          agentFinishedRef.current = true;
          onAgentActivity?.({
            terminalId: terminal.id,
            worktreePath: terminal.path,
            agent: activeAgentRef.current,
            active: false,
          });
        }
        xterm.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      },
    );

    const terminalInput = hostRef.current.querySelector(
      '.xterm-helper-textarea',
    ) as HTMLTextAreaElement | null;
    const handleFocus = () => {
      isFocusedRef.current = true;
      updateCursorDimensions();
    };
    const handleBlur = () => {
      isFocusedRef.current = false;
      hideSuggestions();
    };
    terminalInput?.addEventListener('focus', handleFocus);
    terminalInput?.addEventListener('blur', handleBlur);

    let animationFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          updateCursorDimensions();
          window.electron.ipcRenderer.send(
            'terminal-resize',
            terminal.id,
            xterm.cols,
            xterm.rows,
          );
        } catch {
          // The host can be momentarily hidden while the grid is changing.
        }
      });
    });
    resizeObserver.observe(hostRef.current);
    fitAddon.fit();
    updateCursorDimensions();
    window.electron.ipcRenderer.send(
      'terminal-create',
      terminal.id,
      terminal.path,
      xterm.cols,
      xterm.rows,
    );
    xterm.focus();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      terminalInput?.removeEventListener('focus', handleFocus);
      terminalInput?.removeEventListener('blur', handleBlur);
      removeData();
      removeReady();
      removeExit();
      removeError();
      removeAgentStarted();
      removeAgentError();
      window.electron.ipcRenderer.send('terminal-close', terminal.id);
      if (activeAgentRef.current && !agentFinishedRef.current) {
        agentFinishedRef.current = true;
        onAgentActivity?.({
          terminalId: terminal.id,
          worktreePath: terminal.path,
          agent: activeAgentRef.current,
          active: false,
        });
      }
      registerFocus(terminal.id, null);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [
    acceptSuggestion,
    hideSuggestions,
    onAgentActivity,
    registerFocus,
    setSelectedDropdownIndexSync,
    terminal.id,
    terminal.path,
    triggerCompletion,
    updateCursorDimensions,
  ]);

  const startAgent = () => {
    const agent = enabledAgents.find((item) => item.id === selectedAgentId);
    if (!agent || status === 'starting' || status === 'agent-running') return;

    const attachedFiles = promptFiles
      .map((file) => file.path || file.name)
      .join(', ');
    const prompt = [
      agentPrompt.trim(),
      attachedFiles && `Files: ${attachedFiles}`,
    ]
      .filter(Boolean)
      .join('\n');
    pendingAgentRef.current = agent;
    setStatus('starting');
    window.electron.ipcRenderer.send(
      'terminal-start-ai-agent',
      terminal.id,
      agent.id,
      prompt,
    );
  };

  const statusPresentation = {
    starting: { label: 'Opening shell', color: 'default' },
    ready: { label: 'Shell running', color: 'processing' },
    'agent-running': {
      label: `${activeAgent?.label || 'AI agent'} running`,
      color: 'purple',
    },
    exited: { label: 'Shell exited', color: 'default' },
    error: { label: 'Shell error', color: 'error' },
  }[status];

  return (
    <section
      className={`terminal-pane${isDarkMode ? ' is-dark' : ''}${
        isActive ? ' is-active' : ''
      }${isFocusedMode ? ' is-focused-mode' : ''}${
        mode === 'agent' ? ' is-agent-mode' : ''
      }`}
      aria-label={`${terminal.name} terminal`}
      onMouseDown={() => onActivate(terminal.id)}
    >
      <header className="terminal-pane-header">
        <div className="terminal-pane-title">
          <Typography.Text strong ellipsis title={terminal.name}>
            {terminal.name}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis title={terminal.path}>
            {terminal.path}
          </Typography.Text>
        </div>
        <Space className="terminal-pane-actions" size={4}>
          {mode === 'agent' && (
            <Select
              size="small"
              value={selectedAgentId}
              aria-label="AI agent for this terminal"
              disabled={enabledAgents.length === 0}
              placeholder="Configure an AI agent"
              options={enabledAgents.map((agent) => ({
                value: agent.id,
                label: (
                  <Space size={6}>
                    <AgentIcon agent={agent} />
                    {agent.label}
                  </Space>
                ),
              }))}
              onChange={(value) => setSelectedAgentId(value)}
            />
          )}
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={mode}
            aria-label="Switch between terminal and AI agent"
            disabled={status === 'agent-running'}
            options={[
              { label: 'Terminal', value: 'terminal' },
              { label: 'AI Agent', value: 'agent' },
            ]}
            onChange={(event) => {
              const nextMode = event.target.value as 'terminal' | 'agent';
              setMode(nextMode);
              isAgentModeRef.current = nextMode === 'agent';
              if (nextMode === 'agent') xtermRef.current?.reset();
            }}
          />
          {mode === 'agent' && status !== 'ready' && (
            <Tooltip
              title={
                status === 'agent-running'
                  ? `${activeAgent?.label} is running in this terminal. Its output is shown below.`
                  : statusPresentation.label
              }
            >
              <Tag bordered={false} color={statusPresentation.color}>
                {statusPresentation.label}
              </Tag>
            </Tooltip>
          )}
          <Button
            type="text"
            size="small"
            aria-label={`Close ${terminal.name} terminal`}
            icon={<CloseOutlined />}
            onClick={() => onClose(terminal.id)}
          />
          {canFocus && (
            <Button
              type="text"
              size="small"
              aria-label={isFocusedMode ? 'Restore pane size' : 'Focus pane'}
              icon={isFocusedMode ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={() => onToggleFocusedMode(terminal.id)}
            />
          )}
        </Space>
      </header>
      {mode === 'terminal' ? null : (
        <div className="terminal-agent-toolbar">
          {enabledAgents.length === 0 && (
            <Typography.Text type="secondary">
              Enable and configure an AI agent in Settings before starting one.
            </Typography.Text>
          )}
          <Input.TextArea
            size="small"
            value={agentPrompt}
            onChange={(event) => setAgentPrompt(event.target.value)}
            onFocus={() => {
              if (!isFocusedMode) onToggleFocusedMode(terminal.id);
            }}
            onPressEnter={(event) => {
              if (event.shiftKey) return;
              event.preventDefault();
              startAgent();
            }}
            placeholder="Prompt for AI agent"
            disabled={status === 'agent-running'}
            autoSize={{ minRows: 2, maxRows: 5 }}
          />
          <input
            ref={fileInputRef}
            className="terminal-agent-file-input"
            type="file"
            multiple
            accept="image/*,*"
            onChange={(event) => {
              setPromptFiles(
                Array.from(event.target.files || []).map((file) => ({
                  name: file.name,
                  path: (file as File & { path?: string }).path,
                })),
              );
            }}
          />
          <Tooltip title="Add files or images to the prompt">
            <Button
              size="small"
              type="text"
              icon={<PaperClipOutlined />}
              aria-label="Add files or images"
              onClick={() => fileInputRef.current?.click()}
            />
          </Tooltip>
          <Tooltip title="Start selected AI agent in this terminal">
            <Button
              size="small"
              type="text"
              icon={<SendOutlined />}
              aria-label="Start AI agent"
              disabled={
                enabledAgents.length === 0 ||
                status === 'starting' ||
                status === 'agent-running'
              }
              onClick={startAgent}
            />
          </Tooltip>
          {promptFiles.length > 0 && (
            <Typography.Text
              className="terminal-agent-files"
              type="secondary"
              ellipsis
            >
              {promptFiles.map((file) => file.name).join(', ')}
            </Typography.Text>
          )}
        </div>
      )}
      <div
        className="terminal-host-wrapper"
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="terminal-xterm-host"
          ref={hostRef}
          role="presentation"
          onMouseDown={() => xtermRef.current?.focus()}
        />
        {completionResult?.mode === 'ghost' && completionResult.ghostSuffix && (
          <GhostCompletionOverlay
            ghostSuffix={completionResult.ghostSuffix}
            cursor={cursorScreenPos}
            cellDimensions={cellDimensions}
            isDarkMode={isDarkMode}
          />
        )}
        {completionResult?.mode === 'dropdown' &&
          completionResult.suggestions.length > 0 && (
            <CompletionDropdown
              suggestions={completionResult.suggestions}
              selectedIndex={selectedDropdownIndex}
              cursor={cursorScreenPos}
              cellDimensions={cellDimensions}
              containerDimensions={hostDimensions}
              isDarkMode={isDarkMode}
              onSelect={(item) => acceptSuggestion(item)}
              onHover={(index) => setSelectedDropdownIndex(index)}
            />
          )}
      </div>
    </section>
  );
}

export default function TerminalInteractive({
  isModalOpen,
  initialRepository,
  worktrees,
  handleCancel,
  isDarkMode,
  onAgentActivity,
  initialMode = 'terminal',
}: {
  isModalOpen: boolean;
  initialRepository: string | null;
  worktrees: WorktreeOption[];
  handleCancel: () => void;
  isDarkMode: boolean;
  onAgentActivity?: (activity: TerminalAgentActivity) => void;
  initialMode?: 'terminal' | 'agent';
}) {
  const initialWorktree = useMemo(
    () => worktrees.find((worktree) => worktree.path === initialRepository),
    [initialRepository, worktrees],
  );
  const [terminals, setTerminals] = useState<TerminalDescriptor[]>(() => [
    {
      id: sessionId(),
      path: initialRepository || '',
      name: initialWorktree?.name || 'Terminal',
      mode: initialMode,
    },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(
    () => terminals[0]?.id || null,
  );
  const terminalFocusersRef = useRef(new Map<string, () => void>());
  const [columns, setColumns] = useState<'Auto' | '1' | '2' | '3'>('Auto');
  const [focusedTerminalId, setFocusedTerminalId] = useState<string | null>(
    null,
  );

  const registerTerminalFocus = useCallback(
    (id: string, focus: (() => void) | null) => {
      if (focus) terminalFocusersRef.current.set(id, focus);
      else terminalFocusersRef.current.delete(id);
    },
    [],
  );

  useEffect(() => {
    if (!isModalOpen || terminals.length < 2) return undefined;
    const navigateTerminals = (event: KeyboardEvent) => {
      if (
        (!event.ctrlKey && !event.metaKey) ||
        (event.key !== 'PageUp' && event.key !== 'PageDown')
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const currentIndex = Math.max(
        0,
        terminals.findIndex((terminal) => terminal.id === activeTerminalId),
      );
      const direction = event.key === 'PageDown' ? 1 : -1;
      const nextTerminal =
        terminals[
          (currentIndex + direction + terminals.length) % terminals.length
        ];
      setActiveTerminalId(nextTerminal.id);
      terminalFocusersRef.current.get(nextTerminal.id)?.();
    };
    window.addEventListener('keydown', navigateTerminals, true);
    return () => window.removeEventListener('keydown', navigateTerminals, true);
  }, [activeTerminalId, isModalOpen, terminals]);

  const addTerminal = (worktreePath: string) => {
    const worktree = worktrees.find((item) => item.path === worktreePath);
    if (!worktree) return;
    const terminal = { ...worktree, id: sessionId() };
    setTerminals((current) => [...current, terminal]);
    setActiveTerminalId(terminal.id);
    window.setTimeout(
      () => terminalFocusersRef.current.get(terminal.id)?.(),
      0,
    );
  };

  const closeTerminal = (id: string) => {
    setTerminals((current) => current.filter((item) => item.id !== id));
    setFocusedTerminalId((current) => (current === id ? null : current));
  };

  const gridColumns =
    columns === 'Auto'
      ? Math.min(3, Math.max(1, Math.ceil(Math.sqrt(terminals.length))))
      : Number(columns);

  return (
    <Modal
      open={isModalOpen}
      onCancel={handleCancel}
      keyboard={false}
      afterOpenChange={(open) => {
        if (!open) return;
        window.setTimeout(() => {
          const input = document.querySelector(
            '.terminal-workspace-modal .xterm-helper-textarea',
          ) as HTMLTextAreaElement | null;
          input?.focus();
        }, 0);
      }}
      footer={null}
      destroyOnClose
      closable={false}
      className="terminal-workspace-modal"
      rootClassName={isDarkMode ? 'terminal-workspace-theme-dark' : ''}
      width="calc(100% - 216px)"
      style={{ position: 'absolute', right: 8, top: 48, paddingBottom: 0 }}
    >
      <div className="terminal-workspace-toolbar">
        <Space>
          <AppstoreOutlined />
          <Typography.Text strong>Terminal workspace</Typography.Text>
          <Typography.Text type="secondary">
            {terminals.length} open
          </Typography.Text>
        </Space>
        <Space wrap>
          <Segmented
            size="small"
            value={columns}
            options={['Auto', '1', '2', '3']}
            onChange={(value) => setColumns(value as typeof columns)}
          />
          <Select
            className="terminal-add-select"
            value={null}
            placeholder="New terminal in worktree"
            suffixIcon={<PlusOutlined />}
            options={worktrees.map((worktree) => ({
              label: worktree.name,
              value: worktree.path,
            }))}
            onChange={addTerminal}
          />
          <Tooltip title="Close terminal workspace">
            <Button
              type="text"
              aria-label="Close terminal workspace"
              icon={<CloseOutlined />}
              onClick={handleCancel}
            />
          </Tooltip>
        </Space>
      </div>
      {terminals.length === 0 ? (
        <div className="terminal-workspace-empty">
          <Empty description="Choose a worktree to open a terminal" />
        </div>
      ) : (
        <div
          className="terminal-grid"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          }}
        >
          {terminals.map((terminal) => (
            <TerminalPane
              key={terminal.id}
              terminal={terminal}
              isDarkMode={isDarkMode}
              isActive={terminal.id === activeTerminalId}
              onClose={closeTerminal}
              onActivate={setActiveTerminalId}
              registerFocus={registerTerminalFocus}
              onAgentActivity={onAgentActivity}
              isFocusedMode={terminal.id === focusedTerminalId}
              canFocus={terminals.length > 1}
              onToggleFocusedMode={(id) => {
                if (terminals.length <= 1) return;
                if (focusedTerminalId !== id) {
                  setFocusedTerminalId(id);
                  return;
                }
                setFocusedTerminalId(null);
              }}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
