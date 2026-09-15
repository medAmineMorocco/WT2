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
  LayoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Empty,
  message,
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
  AiAgentModel,
  aiAgentsDefault,
  formatVersionBadge,
  getAgentModels,
  normalizeAgentModel,
  getReasoningEffortOptions,
  normalizeReasoningEffort,
} from '../../../shared/aiAgents';
import { getAiAgentIcon } from '../../components/aiAgents/AiAgentIcons';
import WorktreeFileExplorer from './WorktreeFileExplorer';
import EmbeddedBrowser from './EmbeddedBrowser';
import './TerminalInteractive.css';

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
type FourSectionName = 'files' | 'terminal' | 'agent' | 'browser';

export type TerminalAgentActivity = {
  terminalId: string;
  worktreePath: string;
  agent: AiAgent;
  active: boolean;
};

function sessionId() {
  return `terminal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function terminalTheme(isDarkMode: boolean) {
  return isDarkMode
    ? {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#2f81f7',
        selectionBackground: 'rgba(56, 139, 253, 0.35)',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      }
    : {
        background: '#ffffff',
        foreground: '#1f2328',
        cursor: '#0969da',
        selectionBackground: 'rgba(9, 105, 218, 0.2)',
        black: '#24292f',
        red: '#cf222e',
        green: '#1a7f37',
        yellow: '#9a6700',
        blue: '#0969da',
        magenta: '#8250df',
        cyan: '#1b7c83',
        white: '#ffffff',
        brightBlack: '#57606a',
        brightRed: '#a40e26',
        brightGreen: '#116329',
        brightYellow: '#633c01',
        brightBlue: '#0550ae',
        brightMagenta: '#5a32a3',
        brightCyan: '#005f63',
        brightWhite: '#ffffff',
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
  embeddedAgent = false,
  embeddedAgentCollapsed = false,
  onToggleEmbeddedAgent,
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
  embeddedAgent?: boolean;
  embeddedAgentCollapsed?: boolean;
  onToggleEmbeddedAgent?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const initialDarkModeRef = useRef(isDarkMode);
  const isFocusedRef = useRef(false);

  const [selectedAgentId, setSelectedAgentId] = useState<AiAgentId>(
    terminal.agent?.id || 'claude',
  );
  const [configuredAgents, setConfiguredAgents] =
    useState<AiAgent[]>(aiAgentsDefault);
  const [mode, setMode] = useState<'terminal' | 'agent'>(
    embeddedAgent ? 'agent' : terminal.mode || 'terminal',
  );
  const [viewMode, setViewMode] = useState<'terminal' | 'agent' | 'browser'>(
    embeddedAgent ? 'agent' : terminal.mode || 'terminal',
  );
  const [isFourSectionView, setIsFourSectionView] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Set<FourSectionName>
  >(new Set());
  const [smartContextEnabled, setSmartContextEnabled] = useState(false);
  const smartContextEnabledRef = useRef(false);
  smartContextEnabledRef.current = smartContextEnabled;

  const activeAgent = useMemo(() => {
    return (
      configuredAgents.find((item) => item.id === selectedAgentId) ||
      configuredAgents[0]
    );
  }, [configuredAgents, selectedAgentId]);

  const activeAgentRef = useRef(activeAgent);
  activeAgentRef.current = activeAgent;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const selectedAgentIdRef = useRef(selectedAgentId);
  selectedAgentIdRef.current = selectedAgentId;

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      const initialAgentId = terminal.agent?.id || 'claude';
      return normalizeAgentModel(
        initialAgentId,
        window.localStorage.getItem(`aiAgent_model_${initialAgentId}`) || '',
      );
    } catch {
      return '';
    }
  });
  const [agentVersions, setAgentVersions] = useState<
    Record<string, string | null>
  >({});
  const [dynamicModels, setDynamicModels] = useState<
    Partial<Record<AiAgentId, AiAgentModel[]>>
  >({});

  const availableModels = useMemo(() => {
    return dynamicModels[selectedAgentId] || getAgentModels(selectedAgentId);
  }, [dynamicModels, selectedAgentId]);
  const reasoningEffortOptions = useMemo(
    () => getReasoningEffortOptions(selectedAgentId),
    [selectedAgentId],
  );

  useEffect(() => {
    let active = true;
    const loadDynamicModels = async () => {
      try {
        const fetched: AiAgentModel[] =
          await window.electron.ipcRenderer.invoke(
            'ai-agents:get-models',
            selectedAgentId,
            activeAgent?.command,
          );
        if (active && Array.isArray(fetched) && fetched.length > 0) {
          setDynamicModels((prev) => ({
            ...prev,
            [selectedAgentId]: fetched,
          }));
        }
      } catch {
        // Fall back gracefully to base models
      }
    };
    loadDynamicModels();
    return () => {
      active = false;
    };
  }, [activeAgent?.command, selectedAgentId]);

  useEffect(() => {
    try {
      const saved = normalizeAgentModel(
        selectedAgentId,
        window.localStorage.getItem(`aiAgent_model_${selectedAgentId}`) || '',
      );
      window.localStorage.setItem(`aiAgent_model_${selectedAgentId}`, saved);
      setSelectedModel(saved);
    } catch {
      setSelectedModel('');
    }
  }, [selectedAgentId]);

  useEffect(() => {
    let active = true;
    const fetchVersion = async () => {
      if (agentVersions[selectedAgentId] !== undefined) return;
      try {
        const det = await window.electron.ipcRenderer.invoke(
          'ai-agents:detect-one',
          selectedAgentId,
          activeAgent?.command,
        );
        if (active && det) {
          setAgentVersions((prev) => ({
            ...prev,
            [selectedAgentId]: det.found ? det.version : null,
          }));
        }
      } catch {
        if (active) {
          setAgentVersions((prev) => ({ ...prev, [selectedAgentId]: null }));
        }
      }
    };
    fetchVersion();
    return () => {
      active = false;
    };
  }, [activeAgent?.command, agentVersions, selectedAgentId]);

  const currentRawVersion = agentVersions[selectedAgentId];
  const formattedVersion = useMemo(
    () => formatVersionBadge(currentRawVersion),
    [currentRawVersion],
  );

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const [selectedReasoningEffort, setSelectedReasoningEffort] =
    useState<string>(() => {
      try {
        const agentId = terminal.agent?.id || 'claude';
        return normalizeReasoningEffort(
          agentId,
          window.localStorage.getItem(
            `aiAgent_effort_${agentId}`,
          ) || '',
          window.localStorage.getItem(`aiAgent_model_${agentId}`) || '',
        );
      } catch {
        return '';
      }
    });

  const selectedReasoningEffortRef = useRef(selectedReasoningEffort);
  selectedReasoningEffortRef.current = selectedReasoningEffort;

  useEffect(() => {
    try {
      const savedEffort = normalizeReasoningEffort(
        selectedAgentId,
        window.localStorage.getItem(`aiAgent_effort_${selectedAgentId}`) || '',
        selectedModelRef.current,
      );
      selectedReasoningEffortRef.current = savedEffort;
      setSelectedReasoningEffort(savedEffort);
    } catch {
      setSelectedReasoningEffort('');
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = terminalTheme(isDarkMode);
      xtermRef.current.options.minimumContrastRatio = 4.5;
    }
  }, [isDarkMode]);

  useEffect(() => {
    const refreshConfiguredAgents = () => {
      try {
        const stored = window.localStorage.getItem('aiAgents');
        const saved = stored ? (JSON.parse(stored) as AiAgent[]) : [];
        setConfiguredAgents(
          aiAgentsDefault.map((defaultAgent) => {
            const match = saved.find((agent) => agent.id === defaultAgent.id);
            let cmd = match?.command ?? defaultAgent.command;
            const lower = cmd.toLowerCase().trim();
            if (
              defaultAgent.id === 'cursor' &&
              (lower.includes('resources\\app\\bin\\cursor') ||
                lower.includes('resources/app/bin/cursor') ||
                lower === 'cursor' ||
                lower === 'cursor.exe' ||
                lower === 'cursor.cmd')
            ) {
              const lastSlash = Math.max(
                cmd.lastIndexOf('\\'),
                cmd.lastIndexOf('/'),
              );
              if (lastSlash !== -1) {
                const dir = cmd.slice(0, lastSlash + 1);
                const file = cmd.slice(lastSlash + 1).toLowerCase();
                if (file.endsWith('.exe')) cmd = `${dir}cursor-agent.exe`;
                else if (file.endsWith('.cmd')) cmd = `${dir}cursor-agent.cmd`;
                else cmd = `${dir}cursor-agent`;
              } else {
                cmd = 'cursor-agent';
              }
            }
            if (
              defaultAgent.id === 'antigravity' &&
              (lower.includes('programs\\antigravity ide') ||
                lower.includes('programs/antigravity ide') ||
                lower === 'antigravity' ||
                lower === 'antigravity.exe' ||
                lower === 'antigravity.cmd' ||
                lower === 'antigravity-ide' ||
                lower === 'antigravity-ide.exe' ||
                lower === 'antigravity-ide.cmd')
            ) {
              const lastSlash = Math.max(
                cmd.lastIndexOf('\\'),
                cmd.lastIndexOf('/'),
              );
              if (lastSlash !== -1) {
                const dir = cmd.slice(0, lastSlash + 1);
                const file = cmd.slice(lastSlash + 1).toLowerCase();
                if (file.endsWith('.exe')) cmd = `${dir}agy.exe`;
                else if (file.endsWith('.cmd')) cmd = `${dir}agy.cmd`;
                else cmd = `${dir}agy`;
              } else {
                cmd = 'agy';
              }
            }
            return {
              ...defaultAgent,
              ...match,
              command: cmd,
            };
          }),
        );
      } catch {
        setConfiguredAgents(aiAgentsDefault);
      }
    };
    refreshConfiguredAgents();
    window.addEventListener('focus', refreshConfiguredAgents);
    return () => window.removeEventListener('focus', refreshConfiguredAgents);
  }, []);

  const enabledAgents = useMemo(
    () => configuredAgents.filter((agent) => agent.enabled),
    [configuredAgents],
  );

  useEffect(() => {
    if (enabledAgents.some((agent) => agent.id === selectedAgentId)) return;
    if (enabledAgents[0]) setSelectedAgentId(enabledAgents[0].id);
  }, [enabledAgents, selectedAgentId]);

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      allowTransparency: true,
      minimumContrastRatio: 4.5,
      theme: terminalTheme(initialDarkModeRef.current),
      convertEol: true,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(hostRef.current);
    xtermRef.current = xterm;

    registerFocus(terminal.id, () => {
      xterm.focus();
    });

    const isWindows = navigator.userAgent.includes('Windows');

    xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Allow browser shortcuts: F12 (DevTools), Ctrl+Shift+I / Cmd+Option+I
      if (
        event.key === 'F12' ||
        (event.key === 'I' &&
          event.shiftKey &&
          (event.ctrlKey || event.metaKey))
      ) {
        return false;
      }

      if (event.type !== 'keydown') return true;

      // Copy: Ctrl+Shift+C (all platforms), Cmd+C (macOS)
      const isCopy =
        (event.ctrlKey && event.shiftKey && event.key === 'C') ||
        (!isWindows && event.metaKey && !event.ctrlKey && event.key === 'c');
      if (isCopy && xterm.hasSelection()) {
        const selected = xterm.getSelection();
        navigator.clipboard.writeText(selected);
        return false;
      }

      // Windows copy: Ctrl+C with text selected
      if (
        isWindows &&
        event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        event.key === 'c' &&
        xterm.hasSelection()
      ) {
        const selected = xterm.getSelection();
        navigator.clipboard.writeText(selected);
        return false;
      }

      // Paste: Ctrl+Shift+V (all), Cmd+V (macOS), Ctrl+V (Windows if configured)
      const isPaste =
        (event.ctrlKey && event.shiftKey && event.key === 'V') ||
        (!isWindows && event.metaKey && !event.ctrlKey && event.key === 'v') ||
        (isWindows && event.ctrlKey && !event.shiftKey && event.key === 'v');
      if (isPaste) {
        event.preventDefault();
        event.stopPropagation();
        navigator.clipboard
          .readText()
          .then((text) => {
            if (text) {
              window.electron.ipcRenderer.send(
                'terminal-input',
                terminal.id,
                text,
              );
            }
          })
          .catch(() => {});
        return false;
      }

      // Shift+Insert: classic paste
      if (event.shiftKey && event.key === 'Insert') {
        event.preventDefault();
        event.stopPropagation();
        navigator.clipboard
          .readText()
          .then((text) => {
            if (text) {
              window.electron.ipcRenderer.send(
                'terminal-input',
                terminal.id,
                text,
              );
            }
          })
          .catch(() => {});
        return false;
      }

      // Enter key focus insurance
      if (event.key === 'Enter') {
        window.requestAnimationFrame(() => {
          const textarea = hostRef.current?.querySelector(
            '.xterm-helper-textarea',
          ) as HTMLTextAreaElement | null;
          textarea?.focus();
        });
        return false;
      }

      // Ctrl+Backspace: erase word before cursor
      if ((event.ctrlKey || event.metaKey) && event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        window.electron.ipcRenderer.send('terminal-input', terminal.id, '\x17');
        return false;
      }

      return true;
    });

    const inputDisposable = xterm.onData((data) => {
      isFocusedRef.current = true;
      window.electron.ipcRenderer.send(
        'terminal-input',
        terminal.id,
        data,
        smartContextEnabledRef.current,
      );
    });

    const removeData = window.electron.ipcRenderer.on(
      'terminal-data',
      (id: string, data: string) => {
        if (id !== terminal.id) return;
        const isAtBottom =
          !xterm.buffer.active ||
          xterm.buffer.active.viewportY >= xterm.buffer.active.baseY - 2;
        xterm.write(data);
        if (isAtBottom) {
          xterm.scrollToBottom();
        }
      },
    );

    const removeRehydrate = window.electron.ipcRenderer.on(
      'terminal-ai-agent-rehydrate',
      (id: string, outputBuffer: string) => {
        if (id !== terminal.id) return;
        xterm.reset();
        xterm.write(outputBuffer);
        xterm.scrollToBottom();
      },
    );

    const removeShellRehydrate = window.electron.ipcRenderer.on(
      'terminal-shell-rehydrate',
      (id: string, outputBuffer: string) => {
        if (id !== terminal.id) return;
        xterm.reset();
        if (outputBuffer) xterm.write(outputBuffer);
        xterm.scrollToBottom();
        xterm.focus();
      },
    );

    const removeShellNeedsCreate = window.electron.ipcRenderer.on(
      'terminal-shell-needs-create',
      (id: string) => {
        if (id !== terminal.id) return;
        window.electron.ipcRenderer.send(
          'terminal-create',
          terminal.id,
          terminal.path,
          xterm.cols,
          xterm.rows,
          initialDarkModeRef.current,
        );
      },
    );

    const removeReady = window.electron.ipcRenderer.on(
      'terminal-ready',
      (id: string) => {
        if (id !== terminal.id) return;
        window.setTimeout(() => {
          xterm.focus();
        }, 300);
      },
    );

    const removeAgentError = window.electron.ipcRenderer.on(
      'terminal-ai-agent-error',
      (id: string, message: string) => {
        if (id !== terminal.id) return;
        xterm.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      },
    );

    const removeSmartContextInjected = window.electron.ipcRenderer.on(
      'terminal-smart-context-injected',
      (id: string, context: string) => {
        if (id !== terminal.id) return;
        const visibleContext = context.replace(/\n/g, '\r\n');
        xterm.writeln(
          `\r\n\x1b[36m[WorktreeWise Smart Context injected]\x1b[0m\r\n${visibleContext}\r\n\x1b[36m[End Smart Context]\x1b[0m`,
        );
      },
    );

    const removeSmartContextUnavailable = window.electron.ipcRenderer.on(
      'terminal-smart-context-unavailable',
      (id: string, detail: string) => {
        if (id !== terminal.id) return;
        xterm.writeln(`\r\n\x1b[33m[WorktreeWise] ${detail}\x1b[0m`);
      },
    );

    const removeExit = window.electron.ipcRenderer.on(
      'terminal-exit',
      (id: string, exitCode: number) => {
        if (id !== terminal.id) return;
        xterm.writeln(`\r\n[Process exited with code ${exitCode}]`);
      },
    );

    const removeError = window.electron.ipcRenderer.on(
      'terminal-error',
      (id: string, message: string) => {
        if (id !== terminal.id) return;
        xterm.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      },
    );

    const terminalInput = hostRef.current.querySelector(
      '.xterm-helper-textarea',
    ) as HTMLTextAreaElement | null;
    const handleFocus = () => {
      isFocusedRef.current = true;
    };
    const handleBlur = () => {
      isFocusedRef.current = false;
    };
    terminalInput?.addEventListener('focus', handleFocus);
    terminalInput?.addEventListener('blur', handleBlur);

    let animationFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        try {
          fitAddon.fit();
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

    if (mode === 'agent') {
      const initModel = normalizeAgentModel(
        selectedAgentId,
        window.localStorage.getItem(`aiAgent_model_${selectedAgentId}`) || '',
      );
      const initEffort =
        window.localStorage.getItem(`aiAgent_effort_${selectedAgentId}`) || '';
      const modelDef = getAgentModels(selectedAgentId).find(
        (m) => m.id === initModel,
      );
      const modelDesc =
        modelDef?.label && modelDef.id ? ` [${modelDef.label}]` : '';
      const effortDesc = initEffort ? ` (effort: ${initEffort})` : '';
      xterm.writeln(
        `\x1b[90m➜ Starting ${activeAgent?.label || 'AI agent'}${modelDesc}${effortDesc}... (initializing interactive session)\x1b[0m\r\n`,
      );
      window.electron.ipcRenderer.send(
        'terminal-switch-mode',
        terminal.id,
        'agent',
        selectedAgentId,
        terminal.path,
        xterm.cols,
        xterm.rows,
        initialDarkModeRef.current,
        initModel,
        initEffort,
      );
    } else {
      window.electron.ipcRenderer.send(
        'terminal-create',
        terminal.id,
        terminal.path,
        xterm.cols,
        xterm.rows,
        initialDarkModeRef.current,
      );
    }
    xterm.focus();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      terminalInput?.removeEventListener('focus', handleFocus);
      terminalInput?.removeEventListener('blur', handleBlur);
      removeData();
      removeRehydrate();
      removeShellRehydrate();
      removeShellNeedsCreate();
      removeReady();
      removeExit();
      removeError();
      removeAgentError();
      removeSmartContextInjected();
      removeSmartContextUnavailable();
      window.electron.ipcRenderer.send('terminal-close', terminal.id);
      registerFocus(terminal.id, null);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [onAgentActivity, registerFocus, terminal.id, terminal.path]);

  useEffect(() => {
    if (!onAgentActivity || !activeAgent) return undefined;

    onAgentActivity({
      terminalId: terminal.id,
      worktreePath: terminal.path,
      agent: activeAgent,
      active: mode === 'agent',
    });

    return () => {
      if (mode !== 'agent') return;
      onAgentActivity({
        terminalId: terminal.id,
        worktreePath: terminal.path,
        agent: activeAgent,
        active: false,
      });
    };
  }, [activeAgent, mode, onAgentActivity, terminal.id, terminal.path]);

  const handleAgentSelectChange = (newAgentId: AiAgentId) => {
    selectedAgentIdRef.current = newAgentId;
    setSelectedAgentId(newAgentId);
    let targetModel = '';
    let targetEffort = '';
    try {
      targetModel = normalizeAgentModel(
        newAgentId,
        window.localStorage.getItem(`aiAgent_model_${newAgentId}`) || '',
      );
      targetEffort = normalizeReasoningEffort(
        newAgentId,
        window.localStorage.getItem(`aiAgent_effort_${newAgentId}`) || '',
        targetModel,
      );
      selectedModelRef.current = targetModel;
      selectedReasoningEffortRef.current = targetEffort;
      setSelectedModel(targetModel);
      setSelectedReasoningEffort(targetEffort);
    } catch {}
    const targetAgent =
      configuredAgents.find((item) => item.id === newAgentId) || activeAgent;
    const modelDef = getAgentModels(newAgentId).find(
      (m) => m.id === targetModel,
    );
    const modelDesc =
      modelDef?.label && modelDef.id ? ` [${modelDef.label}]` : '';
    const effortDesc = targetEffort ? ` (effort: ${targetEffort})` : '';

    if (xtermRef.current) {
      xtermRef.current.reset();
      xtermRef.current.writeln(
        `\x1b[90m➜ Starting ${targetAgent?.label || 'AI agent'}${modelDesc}${effortDesc}... (initializing interactive session)\x1b[0m\r\n`,
      );
      window.electron.ipcRenderer.send(
        'terminal-switch-ai-agent',
        terminal.id,
        newAgentId,
        terminal.path,
        xtermRef.current.cols,
        xtermRef.current.rows,
        isDarkMode,
        targetModel,
        targetEffort,
      );
      xtermRef.current.focus();
    }
  };

  const handleModelSelectChange = (newModel: string) => {
    const effectiveEffort = normalizeReasoningEffort(
      selectedAgentId,
      selectedReasoningEffortRef.current,
      newModel,
    );
    selectedModelRef.current = newModel;
    setSelectedModel(newModel);
    selectedReasoningEffortRef.current = effectiveEffort;
    setSelectedReasoningEffort(effectiveEffort);
    try {
      window.localStorage.setItem(`aiAgent_model_${selectedAgentId}`, newModel);
      window.localStorage.setItem(
        `aiAgent_effort_${selectedAgentId}`,
        effectiveEffort,
      );
    } catch {}

    const modelDef = availableModels.find((m) => m.id === newModel);
    const modelDesc =
      modelDef?.label && modelDef.id ? ` [${modelDef.label}]` : '';
    const effortDesc = effectiveEffort
      ? ` (effort: ${effectiveEffort})`
      : '';

    if (xtermRef.current) {
      xtermRef.current.reset();
      xtermRef.current.writeln(
        `\x1b[90m➜ Starting ${activeAgent?.label || 'AI agent'}${modelDesc}${effortDesc}... (initializing interactive session)\x1b[0m\r\n`,
      );
      window.electron.ipcRenderer.send(
        'terminal-switch-ai-agent-model',
        terminal.id,
        selectedAgentId,
        newModel,
        terminal.path,
        xtermRef.current.cols,
        xtermRef.current.rows,
        isDarkMode,
        effectiveEffort,
      );
      xtermRef.current.focus();
    }
  };

  const handleReasoningEffortChange = (newEffort: string) => {
    selectedReasoningEffortRef.current = newEffort;
    setSelectedReasoningEffort(newEffort);
    try {
      window.localStorage.setItem(
        `aiAgent_effort_${selectedAgentId}`,
        newEffort,
      );
    } catch {}

    const modelDef = availableModels.find(
      (m) => m.id === selectedModelRef.current,
    );
    const modelDesc =
      modelDef?.label && modelDef.id ? ` [${modelDef.label}]` : '';
    const effortDesc = newEffort ? ` (effort: ${newEffort})` : '';

    if (xtermRef.current) {
      xtermRef.current.reset();
      xtermRef.current.writeln(
        `\x1b[90m➜ Starting ${activeAgent?.label || 'AI agent'}${modelDesc}${effortDesc}... (initializing interactive session)\x1b[0m\r\n`,
      );
      window.electron.ipcRenderer.send(
        'terminal-switch-ai-agent-model',
        terminal.id,
        selectedAgentId,
        selectedModelRef.current,
        terminal.path,
        xtermRef.current.cols,
        xtermRef.current.rows,
        isDarkMode,
        newEffort,
      );
      xtermRef.current.focus();
    }
  };

  const handleModeChange = (nextMode: 'terminal' | 'agent') => {
    setMode(nextMode);
    setViewMode(nextMode);
    if (xtermRef.current) {
      xtermRef.current.reset();
      if (nextMode === 'agent') {
        const modelDef = availableModels.find(
          (m) => m.id === selectedModelRef.current,
        );
        const modelDesc =
          modelDef?.label && modelDef.id ? ` [${modelDef.label}]` : '';
        const effortDesc = selectedReasoningEffortRef.current
          ? ` (effort: ${selectedReasoningEffortRef.current})`
          : '';
        xtermRef.current.writeln(
          `\x1b[90m➜ Starting ${activeAgent?.label || 'AI agent'}${modelDesc}${effortDesc}... (initializing interactive session)\x1b[0m\r\n`,
        );
      }
      window.electron.ipcRenderer.send(
        'terminal-switch-mode',
        terminal.id,
        nextMode,
        selectedAgentId,
        terminal.path,
        xtermRef.current.cols,
        xtermRef.current.rows,
        isDarkMode,
        selectedModelRef.current,
        selectedReasoningEffortRef.current,
      );
      xtermRef.current.focus();
    }
  };

  const handleSmartContextChange = (smartContext: boolean) => {
    setSmartContextEnabled(smartContext);
    window.electron.ipcRenderer.send(
      'terminal-set-smart-context',
      terminal.id,
      smartContext,
    );
    xtermRef.current?.focus();
  };

  const handleClose = () => {
    if (mode === 'agent') {
      window.electron.ipcRenderer.send(
        'terminal-stop-ai-agent',
        terminal.id,
        terminal.path,
        selectedAgentId,
      );
    }
    onClose(terminal.id);
  };

  const handleTerminalContextMenu = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const selection = xtermRef.current?.getSelection();
    if (!selection) return;
    event.preventDefault();
    navigator.clipboard
      .writeText(selection)
      .then(() => message.success('Selection copied'))
      .catch(() => message.error('Failed to copy selection'));
  };

  const toggleCollapsedSection = (section: FourSectionName) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  if (embeddedAgent) {
    return (
      <section
        className={`terminal-four-section-cell terminal-four-section-agent${
          embeddedAgentCollapsed ? ' is-collapsed' : ''
        }`}
        aria-label={`${terminal.name} AI agent`}
        onMouseDown={() => onActivate(terminal.id)}
      >
        <header className="terminal-four-section-header">
          <Typography.Text strong>AI Agent</Typography.Text>
          <div className="terminal-four-section-agent-controls">
            <Select
              size="small"
              value={selectedAgentId}
              aria-label="AI agent for this worktree section"
              disabled={enabledAgents.length === 0}
              placeholder="Select AI Agent"
              className="terminal-agent-select"
              options={enabledAgents.map((agent) => ({
                value: agent.id,
                label: (
                  <span className="terminal-agent-option">
                    <span className="terminal-agent-option-icon">
                      {getAiAgentIcon(agent.id, 18)}
                    </span>
                    <span>{agent.label}</span>
                  </span>
                ),
              }))}
              onChange={handleAgentSelectChange}
            />
            {formattedVersion && (
              <Tooltip
                title={`${activeAgent?.label || 'Agent'} CLI version: ${currentRawVersion}`}
              >
                <Tag className="terminal-agent-version-tag" bordered={false}>
                  {formattedVersion}
                </Tag>
              </Tooltip>
            )}
            <Select
              size="small"
              value={selectedModel}
              aria-label="Select model for this AI agent"
              disabled={enabledAgents.length === 0}
              placeholder="Model"
              className="terminal-agent-model-select"
              showSearch
              filterOption={(input, option) =>
                ((option?.label as string) || '')
                  .toLowerCase()
                  .includes(input.toLowerCase()) ||
                ((option?.value as string) || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={availableModels.map((m) => ({
                value: m.id,
                label: m.label,
                description: m.description,
              }))}
              optionRender={(option) => (
                <div className="terminal-agent-model-option">
                  <span>{option.label}</span>
                  {option.data.description && (
                    <Typography.Text type="secondary" ellipsis>
                      {option.data.description}
                    </Typography.Text>
                  )}
                </div>
              )}
              onChange={handleModelSelectChange}
            />
            {reasoningEffortOptions.length > 0 && (
              <Select
                size="small"
                value={selectedReasoningEffort}
                aria-label="Select reasoning effort for this AI agent"
                disabled={enabledAgents.length === 0}
                placeholder="Effort"
                className="terminal-agent-effort-select"
                options={reasoningEffortOptions.map((e) => ({
                  value: e.id,
                  label: e.label,
                }))}
                onChange={handleReasoningEffortChange}
              />
            )}
            <Tooltip title="Enrich submitted prompts with relevant repository code using Graft">
              <Checkbox
                checked={smartContextEnabled}
                aria-label="Enable smart context for this AI agent"
                onChange={(event) =>
                  handleSmartContextChange(event.target.checked)
                }
              >
                Smart context
              </Checkbox>
            </Tooltip>
            <Tooltip
              title={
                embeddedAgentCollapsed
                  ? 'Restore AI Agent'
                  : 'Collapse AI Agent'
              }
            >
              <Button
                type="text"
                size="small"
                icon={
                  embeddedAgentCollapsed ? (
                    <MenuUnfoldOutlined />
                  ) : (
                    <MenuFoldOutlined />
                  )
                }
                aria-label={
                  embeddedAgentCollapsed
                    ? 'Restore AI Agent section'
                    : 'Collapse AI Agent section'
                }
                onClick={onToggleEmbeddedAgent}
              />
            </Tooltip>
          </div>
        </header>
        <div
          className="terminal-xterm-host terminal-four-section-content"
          ref={hostRef}
          role="presentation"
          onMouseDown={() => xtermRef.current?.focus()}
          onContextMenu={handleTerminalContextMenu}
        />
      </section>
    );
  }

  return (
    <section
      className={`terminal-pane${isDarkMode ? ' is-dark' : ''}${
        isActive ? ' is-active' : ''
      }${isFocusedMode ? ' is-focused-mode' : ''}${
        mode === 'agent' ? ' is-agent-mode' : ''
      }${isFourSectionView ? ' is-four-section-view' : ''}${
        collapsedSections.has('files') ? ' is-four-section-files-collapsed' : ''
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
        <Space className="terminal-pane-actions" size={6}>
          {viewMode === 'agent' && (
            <>
              <Select
                size="small"
                value={selectedAgentId}
                aria-label="AI agent for this terminal"
                disabled={enabledAgents.length === 0}
                placeholder="Select AI Agent"
                className="terminal-agent-select"
                options={enabledAgents.map((agent) => ({
                  value: agent.id,
                  label: (
                    <span className="terminal-agent-option">
                      <span className="terminal-agent-option-icon">
                        {getAiAgentIcon(agent.id, 18)}
                      </span>
                      <span>{agent.label}</span>
                    </span>
                  ),
                }))}
                onChange={handleAgentSelectChange}
              />
              {formattedVersion && (
                <Tooltip
                  title={`${activeAgent?.label || 'Agent'} CLI version: ${currentRawVersion}`}
                >
                  <Tag className="terminal-agent-version-tag" bordered={false}>
                    {formattedVersion}
                  </Tag>
                </Tooltip>
              )}
              <Select
                size="small"
                value={selectedModel}
                aria-label="Select model for this AI agent"
                disabled={enabledAgents.length === 0}
                placeholder="Model"
                className="terminal-agent-model-select"
                showSearch
                filterOption={(input, option) =>
                  ((option?.label as string) || '')
                    .toLowerCase()
                    .includes(input.toLowerCase()) ||
                  ((option?.value as string) || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={availableModels.map((m) => ({
                  value: m.id,
                  label: m.label,
                  description: m.description,
                }))}
                optionRender={(option) => (
                  <div className="terminal-agent-model-option">
                    <span>{option.label}</span>
                    {option.data.description && (
                      <Typography.Text type="secondary" ellipsis>
                        {option.data.description}
                      </Typography.Text>
                    )}
                  </div>
                )}
                onChange={handleModelSelectChange}
              />
              {reasoningEffortOptions.length > 0 && (
                <Select
                  size="small"
                  value={selectedReasoningEffort}
                  aria-label="Select reasoning effort for this AI agent"
                  disabled={enabledAgents.length === 0}
                  placeholder="Effort"
                  className="terminal-agent-effort-select"
                  options={reasoningEffortOptions.map((e) => ({
                    value: e.id,
                    label: e.label,
                  }))}
                  onChange={handleReasoningEffortChange}
                />
              )}
            </>
          )}
          {viewMode === 'agent' && (
            <Tooltip title="Enrich submitted prompts with relevant repository code using Graft">
              <Checkbox
                checked={smartContextEnabled}
                aria-label="Enable smart context for this AI agent"
                onChange={(event) =>
                  handleSmartContextChange(event.target.checked)
                }
              >
                Smart context
              </Checkbox>
            </Tooltip>
          )}
          {!isFourSectionView && (
            <Radio.Group
              size="small"
              optionType="button"
              buttonStyle="solid"
              value={viewMode}
              aria-label="Switch between terminal, AI agent, and browser"
              options={[
                { label: 'Terminal', value: 'terminal' },
                { label: 'AI Agent', value: 'agent' },
                { label: 'Browser', value: 'browser' },
              ]}
              onChange={(event) => {
                const nextView = event.target.value as typeof viewMode;
                if (nextView === 'browser') setViewMode('browser');
                else handleModeChange(nextView);
              }}
            />
          )}
          <Tooltip
            title={
              isFourSectionView
                ? 'Return to single view'
                : 'Show Files, Terminal, AI Agent, and Browser together'
            }
          >
            <Button
              type={isFourSectionView ? 'primary' : 'text'}
              size="small"
              aria-label={
                isFourSectionView
                  ? 'Return to single worktree view'
                  : 'Show four-section worktree view'
              }
              icon={<LayoutOutlined />}
              onClick={() => {
                if (!isFourSectionView && mode !== 'terminal') {
                  handleModeChange('terminal');
                }
                setCollapsedSections(new Set());
                setIsFourSectionView((current) => !current);
              }}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            aria-label={`Close ${terminal.name} terminal`}
            icon={<CloseOutlined />}
            onClick={handleClose}
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

      <div
        className="terminal-host-wrapper"
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: mode === 'agent' ? 'row' : 'column',
        }}
      >
        <WorktreeFileExplorer
          worktreePath={terminal.path}
          active={isActive}
          isDarkMode={isDarkMode}
          headerAction={
            isFourSectionView ? (
              <Tooltip
                title={
                  collapsedSections.has('files')
                    ? 'Restore Files'
                    : 'Collapse Files'
                }
              >
                <Button
                  type="text"
                  size="small"
                  icon={
                    collapsedSections.has('files') ? (
                      <MenuUnfoldOutlined />
                    ) : (
                      <MenuFoldOutlined />
                    )
                  }
                  aria-label={
                    collapsedSections.has('files')
                      ? 'Restore Files section'
                      : 'Collapse Files section'
                  }
                  onClick={() => toggleCollapsedSection('files')}
                />
              </Tooltip>
            ) : null
          }
        >
          <div
            className={`terminal-runtime-stage${
              isFourSectionView ? ' is-four-section' : ''
            }`}
            style={
              isFourSectionView
                ? {
                    gridTemplateColumns: (
                      ['terminal', 'agent', 'browser'] as FourSectionName[]
                    )
                      .map((section) =>
                        collapsedSections.has(section)
                          ? '42px'
                          : 'minmax(0, 1fr)',
                      )
                      .join(' '),
                  }
                : undefined
            }
          >
            <section
              className={`terminal-four-section-cell terminal-four-section-terminal${
                collapsedSections.has('terminal') ? ' is-collapsed' : ''
              }`}
            >
              {isFourSectionView && (
                <header className="terminal-four-section-header">
                  <Typography.Text strong>Terminal</Typography.Text>
                  <Tooltip
                    title={
                      collapsedSections.has('terminal')
                        ? 'Restore Terminal'
                        : 'Collapse Terminal'
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={
                        collapsedSections.has('terminal') ? (
                          <MenuUnfoldOutlined />
                        ) : (
                          <MenuFoldOutlined />
                        )
                      }
                      aria-label={
                        collapsedSections.has('terminal')
                          ? 'Restore Terminal section'
                          : 'Collapse Terminal section'
                      }
                      onClick={() => toggleCollapsedSection('terminal')}
                    />
                  </Tooltip>
                </header>
              )}
              <div
                className="terminal-xterm-host terminal-four-section-content"
                ref={hostRef}
                role="presentation"
                onMouseDown={() => xtermRef.current?.focus()}
                onContextMenu={handleTerminalContextMenu}
              />
            </section>
            {isFourSectionView && (
              <TerminalPane
                terminal={{
                  ...terminal,
                  id: `${terminal.id}:four-section-agent`,
                  mode: 'agent',
                }}
                isDarkMode={isDarkMode}
                isActive={isActive}
                onClose={() => undefined}
                onActivate={() => onActivate(terminal.id)}
                registerFocus={registerFocus}
                onAgentActivity={onAgentActivity}
                isFocusedMode={false}
                canFocus={false}
                onToggleFocusedMode={() => undefined}
                embeddedAgent
                embeddedAgentCollapsed={collapsedSections.has('agent')}
                onToggleEmbeddedAgent={() => toggleCollapsedSection('agent')}
              />
            )}
            {(viewMode === 'browser' || isFourSectionView) && (
              <section
                className={`terminal-four-section-cell terminal-four-section-browser${
                  collapsedSections.has('browser') ? ' is-collapsed' : ''
                }`}
              >
                {isFourSectionView && (
                  <header className="terminal-four-section-header">
                    <Typography.Text strong>Browser</Typography.Text>
                    <Tooltip
                      title={
                        collapsedSections.has('browser')
                          ? 'Restore Browser'
                          : 'Collapse Browser'
                      }
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={
                          collapsedSections.has('browser') ? (
                            <MenuUnfoldOutlined />
                          ) : (
                            <MenuFoldOutlined />
                          )
                        }
                        aria-label={
                          collapsedSections.has('browser')
                            ? 'Restore Browser section'
                            : 'Collapse Browser section'
                        }
                        onClick={() => toggleCollapsedSection('browser')}
                      />
                    </Tooltip>
                  </header>
                )}
                <div className="terminal-four-section-content">
                  <EmbeddedBrowser worktreePath={terminal.path} />
                </div>
              </section>
            )}
          </div>
        </WorktreeFileExplorer>
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
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);

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
    const terminal = { ...worktree, id: sessionId(), mode: initialMode };
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
        if (!open) {
          setIsWorkspaceExpanded(false);
          return;
        }
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
      className={`terminal-workspace-modal${
        isWorkspaceExpanded ? ' is-expanded' : ''
      }`}
      rootClassName={isDarkMode ? 'terminal-workspace-theme-dark' : ''}
      width={isWorkspaceExpanded ? '100vw' : 'calc(100% - 216px)'}
      style={{
        position: 'absolute',
        right: isWorkspaceExpanded ? 0 : 8,
        top: isWorkspaceExpanded ? 0 : 48,
        maxWidth: isWorkspaceExpanded ? 'none' : undefined,
        margin: isWorkspaceExpanded ? 0 : undefined,
        paddingBottom: 0,
      }}
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
          <Tooltip
            title={
              isWorkspaceExpanded
                ? 'Restore terminal workspace size'
                : 'Expand terminal workspace'
            }
          >
            <Button
              type="text"
              aria-label={
                isWorkspaceExpanded
                  ? 'Restore terminal workspace size'
                  : 'Expand terminal workspace'
              }
              icon={
                isWorkspaceExpanded ? <CompressOutlined /> : <ExpandOutlined />
              }
              onClick={() => setIsWorkspaceExpanded((expanded) => !expanded)}
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
