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

type TerminalSuggestion = {
  id: string;
  label: string;
  value: string;
  type: 'command' | 'directory' | 'file';
  description?: string;
};

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
  const inputRef = useRef('');
  const acceptingCommandRef = useRef(true);
  const isFocusedRef = useRef(false);
  const outputTailRef = useRef('');
  const suggestionsRef = useRef<TerminalSuggestion[]>([]);
  const commandIndexRef = useRef<TerminalSuggestion[]>([]);
  const selectedSuggestionRef = useRef(0);
  const requestRef = useRef(0);
  const suggestionTimerRef = useRef<number | null>(null);
  const agentFinishedRef = useRef(false);
  const agentStartedRef = useRef(false);
  const pendingAgentRef = useRef<AiAgent | undefined>();
  const isAgentModeRef = useRef(terminal.mode === 'agent');
  const activeAgentRef = useRef<AiAgent | undefined>(terminal.agent);
  const [suggestions, setSuggestions] = useState<TerminalSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
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

    const hideSuggestions = () => {
      requestRef.current += 1;
      if (suggestionTimerRef.current !== null) {
        window.clearTimeout(suggestionTimerRef.current);
        suggestionTimerRef.current = null;
      }
      suggestionsRef.current = [];
      selectedSuggestionRef.current = 0;
      setSuggestions([]);
      setSelectedSuggestion(0);
    };

    const requestSuggestions = () => {
      if (!acceptingCommandRef.current || !isFocusedRef.current) return;
      const normalizedInput = inputRef.current.trimStart().toLowerCase();
      const immediateCommands = commandIndexRef.current
        .filter((suggestion) =>
          suggestion.value.toLowerCase().startsWith(normalizedInput),
        )
        .slice(0, 8);
      suggestionsRef.current = immediateCommands;
      selectedSuggestionRef.current = 0;
      setSuggestions(immediateCommands);
      setSelectedSuggestion(0);
      if (suggestionTimerRef.current !== null) {
        window.clearTimeout(suggestionTimerRef.current);
      }
      suggestionTimerRef.current = window.setTimeout(() => {
        requestRef.current += 1;
        window.electron.ipcRenderer.send(
          'terminal-suggestions',
          terminal.id,
          requestRef.current,
          terminal.path,
          inputRef.current,
        );
      }, 20);
    };

    const acceptSuggestion = () => {
      const suggestion = suggestionsRef.current[selectedSuggestionRef.current];
      if (!suggestion) return;
      // Windows' cmd.exe expects backspace (0x08), not DEL (0x7f), when
      // editing its current command line through the pseudo terminal.
      const erase = '\b'.repeat(inputRef.current.length);
      window.electron.ipcRenderer.send(
        'terminal-input',
        terminal.id,
        `${erase}${suggestion.value}`,
      );
      inputRef.current = suggestion.value;
      hideSuggestions();
    };

    const moveSuggestion = (direction: -1 | 1) => {
      const availableSuggestions = suggestionsRef.current;
      if (availableSuggestions.length === 0) return;
      const nextIndex =
        (selectedSuggestionRef.current +
          direction +
          availableSuggestions.length) %
        availableSuggestions.length;
      selectedSuggestionRef.current = nextIndex;
      setSelectedSuggestion(nextIndex);
    };

    const clearInput = () => {
      if (inputRef.current.length > 0) {
        window.electron.ipcRenderer.send(
          'terminal-input',
          terminal.id,
          '\b'.repeat(inputRef.current.length),
        );
      }
      inputRef.current = '';
      hideSuggestions();
    };

    const clearWord = () => {
      if (inputRef.current.length === 0) {
        hideSuggestions();
        return;
      }
      const remainingInput = inputRef.current.replace(/\s*\S+\s*$/, '');
      const deleteCount = inputRef.current.length - remainingInput.length;
      window.electron.ipcRenderer.send(
        'terminal-input',
        terminal.id,
        '\b'.repeat(deleteCount),
      );
      inputRef.current = remainingInput;
      requestSuggestions();
    };

    xterm.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown' || (!event.ctrlKey && !event.metaKey))
        return true;
      if (event.key.toLowerCase() === 'u') {
        clearInput();
        return false;
      }
      if (event.key === 'Backspace') {
        clearWord();
        return false;
      }
      if (suggestionsRef.current.length > 0 && event.key === 'ArrowUp') {
        moveSuggestion(-1);
        return false;
      }
      if (suggestionsRef.current.length > 0 && event.key === 'ArrowDown') {
        moveSuggestion(1);
        return false;
      }
      return true;
    });

    const inputDisposable = xterm.onData((data) => {
      isFocusedRef.current = true;
      // The AI transcript is intentionally read-only. Agent prompts are sent
      // through the dedicated prompt box, while the terminal still receives
      // the agent's output through the IPC listener below.
      if (isAgentModeRef.current) return;
      if (data === '\x0c') {
        xterm.clear();
        hideSuggestions();
        return;
      }
      if (data === '\x15') {
        clearInput();
        return;
      }
      if (data === '\x17' || data === '\x08') {
        clearWord();
        return;
      }
      if (suggestionsRef.current.length > 0) {
        if (data === '\t') {
          acceptSuggestion();
          return;
        }
        if (data === '\x1b[A' || data === '\x1b[B') {
          hideSuggestions();
        }
        if (data === '\x1b') {
          hideSuggestions();
          return;
        }
      }

      window.electron.ipcRenderer.send('terminal-input', terminal.id, data);
      if (data === '\r' || data === '\n' || data === '\x03') {
        inputRef.current = '';
        acceptingCommandRef.current = false;
        hideSuggestions();
      } else if (data === '\x7f') {
        inputRef.current = inputRef.current.slice(0, -1);
        requestSuggestions();
      } else if (data === '\x15') {
        inputRef.current = '';
        hideSuggestions();
      } else if (/^[\x20-\x7e]+$/.test(data)) {
        inputRef.current += data;
        requestSuggestions();
      }
    });

    const removeData = window.electron.ipcRenderer.on(
      'terminal-data',
      (id: string, data: string) => {
        if (id !== terminal.id) return;
        // AI mode starts with a clean transcript instead of exposing the shell
        // banner and working-directory prompt behind the agent experience.
        if (isAgentModeRef.current && !agentStartedRef.current) return;
        xterm.write(data);
        outputTailRef.current = `${outputTailRef.current}${data}`
          .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
          .slice(-500);
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
        window.setTimeout(() => xterm.focus(), 300);
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
    const removeSuggestions = window.electron.ipcRenderer.on(
      'terminal-suggestions-result',
      (id: string, requestId: number, results: TerminalSuggestion[]) => {
        if (
          id !== terminal.id ||
          requestId !== requestRef.current ||
          !isFocusedRef.current
        )
          return;
        suggestionsRef.current = results;
        selectedSuggestionRef.current = 0;
        setSuggestions(results);
        setSelectedSuggestion(0);
      },
    );
    const removeCommandIndex = window.electron.ipcRenderer.on(
      'terminal-command-index',
      (id: string, commands: TerminalSuggestion[]) => {
        if (id !== terminal.id) return;
        commandIndexRef.current = commands;
        if (isFocusedRef.current && inputRef.current) requestSuggestions();
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
      requestRef.current += 1;
      if (suggestionTimerRef.current !== null) {
        window.clearTimeout(suggestionTimerRef.current);
        suggestionTimerRef.current = null;
      }
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
    window.electron.ipcRenderer.send(
      'terminal-create',
      terminal.id,
      terminal.path,
      xterm.cols,
      xterm.rows,
    );
    xterm.focus();

    return () => {
      if (suggestionTimerRef.current !== null) {
        window.clearTimeout(suggestionTimerRef.current);
      }
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
      removeSuggestions();
      removeCommandIndex();
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
    onAgentActivity,
    registerFocus,
    terminal.id,
    terminal.path,
  ]);

  const chooseSuggestion = (index: number) => {
    const suggestion = suggestionsRef.current[index];
    if (!suggestion) return;
    selectedSuggestionRef.current = index;
    setSelectedSuggestion(index);
    const erase = '\x7f'.repeat(inputRef.current.length);
    window.electron.ipcRenderer.send(
      'terminal-input',
      terminal.id,
      `${erase}${suggestion.value}`,
    );
    inputRef.current = suggestion.value;
    requestRef.current += 1;
    if (suggestionTimerRef.current !== null) {
      window.clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
    suggestionsRef.current = [];
    setSuggestions([]);
    xtermRef.current?.focus();
  };

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
                status === 'ready'
                  ? 'The shell process is active and can receive keyboard input.'
                  : status === 'agent-running'
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
        className="terminal-xterm-host"
        ref={hostRef}
        role="presentation"
        onMouseDown={() => xtermRef.current?.focus()}
      />
      {suggestions.length > 0 && (
        <div
          className="terminal-suggestions"
          role="listbox"
          aria-label="Command suggestions"
        >
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === selectedSuggestion}
              className={index === selectedSuggestion ? 'is-selected' : ''}
              key={suggestion.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseSuggestion(index)}
            >
              <span>{suggestion.label}</span>
              <small>{suggestion.description || suggestion.type}</small>
            </button>
          ))}
          <div className="terminal-suggestion-help">
            Ctrl/Cmd + ↑↓ to choose · Tab to accept · ↑↓ for history
          </div>
        </div>
      )}
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
