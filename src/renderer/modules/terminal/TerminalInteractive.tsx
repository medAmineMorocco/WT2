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
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Empty,
  Modal,
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
import './TerminalInteractive.css';

type WorktreeOption = {
  name: string;
  path: string;
};

type TerminalDescriptor = WorktreeOption & {
  id: string;
};

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
}: {
  terminal: TerminalDescriptor;
  isDarkMode: boolean;
  isActive: boolean;
  onClose: (id: string) => void;
  onActivate: (id: string) => void;
  registerFocus: (id: string, focus: (() => void) | null) => void;
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
  const [suggestions, setSuggestions] = useState<TerminalSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [status, setStatus] = useState<
    'starting' | 'ready' | 'exited' | 'error'
  >('starting');

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = terminalTheme(isDarkMode);
    }
  }, [isDarkMode]);

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
      const erase = '\x7f'.repeat(inputRef.current.length);
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
          '\x7f'.repeat(inputRef.current.length),
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
        '\x7f'.repeat(deleteCount),
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
        }
      },
    );
    const removeReady = window.electron.ipcRenderer.on(
      'terminal-ready',
      (id: string) => {
        if (id !== terminal.id) return;
        setStatus('ready');
        window.setTimeout(() => xterm.focus(), 300);
      },
    );
    const removeExit = window.electron.ipcRenderer.on(
      'terminal-exit',
      (id: string, exitCode: number) => {
        if (id !== terminal.id) return;
        setStatus('exited');
        xterm.writeln(`\r\n[Process exited with code ${exitCode}]`);
      },
    );
    const removeError = window.electron.ipcRenderer.on(
      'terminal-error',
      (id: string, message: string) => {
        if (id !== terminal.id) return;
        setStatus('error');
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
      removeSuggestions();
      removeCommandIndex();
      window.electron.ipcRenderer.send('terminal-close', terminal.id);
      registerFocus(terminal.id, null);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [registerFocus, terminal.id, terminal.path]);

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

  const statusPresentation = {
    starting: { label: 'Opening shell', color: 'default' },
    ready: { label: 'Shell running', color: 'processing' },
    exited: { label: 'Shell exited', color: 'default' },
    error: { label: 'Shell error', color: 'error' },
  }[status];

  return (
    <section
      className={`terminal-pane${isDarkMode ? ' is-dark' : ''}${
        isActive ? ' is-active' : ''
      }`}
      aria-label={`${terminal.name} terminal`}
      onMouseDown={() => onActivate(terminal.id)}
    >
      <header className="terminal-pane-header">
        <div className="terminal-pane-title">
          <Typography.Text strong ellipsis title={terminal.path}>
            {terminal.name}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis title={terminal.path}>
            {terminal.path}
          </Typography.Text>
        </div>
        <Space size={4}>
          <Tooltip
            title={
              status === 'ready'
                ? 'The shell process is active and can receive keyboard input.'
                : statusPresentation.label
            }
          >
            <Tag bordered={false} color={statusPresentation.color}>
              {statusPresentation.label}
            </Tag>
          </Tooltip>
          <Button
            type="text"
            size="small"
            aria-label={`Close ${terminal.name} terminal`}
            icon={<CloseOutlined />}
            onClick={() => onClose(terminal.id)}
          />
        </Space>
      </header>
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
}: {
  isModalOpen: boolean;
  initialRepository: string | null;
  worktrees: WorktreeOption[];
  handleCancel: () => void;
  isDarkMode: boolean;
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
    },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(
    () => terminals[0]?.id || null,
  );
  const terminalFocusersRef = useRef(new Map<string, () => void>());
  const [columns, setColumns] = useState<'Auto' | '1' | '2' | '3'>('Auto');

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
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
