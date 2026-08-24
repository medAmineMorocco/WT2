import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppstoreOutlined,
  CloseCircleFilled,
  CloseOutlined,
  CompressOutlined,
  ExpandOutlined,
  EyeOutlined,
  FileOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
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
import type { InputRef } from 'antd';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  AgentAttachment,
  AgentExecutionState,
  AgentStateChangeEvent,
  AiAgentConfig,
  AiAgentId,
  aiAgentsDefault,
} from '../../../shared/aiAgents';
import { getAiAgentIcon } from '../../components/aiAgents/AiAgentIcons';
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
        white: '#6e7781',
        brightBlack: '#57606a',
        brightRed: '#a40e26',
        brightGreen: '#116329',
        brightYellow: '#633c01',
        brightBlue: '#0550ae',
        brightMagenta: '#5a32a3',
        brightCyan: '#005f63',
        brightWhite: '#24292f',
      };
}

function isImageFile(nameOrPath: string, mimeType?: string): boolean {
  if (mimeType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(nameOrPath);
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
  const isFocusedRef = useRef(false);
  const promptInputRef = useRef<InputRef>(null);

  const [agentState, setAgentState] = useState<AgentExecutionState>('idle');
  const [selectedAgentId, setSelectedAgentId] = useState<AiAgentId>(
    terminal.agent?.id || 'claude',
  );
  const [configuredAgents, setConfiguredAgents] = useState<AiAgent[]>(
    aiAgentsDefault,
  );
  const [agentPrompt, setAgentPrompt] = useState('');
  const [mode, setMode] = useState<'terminal' | 'agent'>(
    terminal.mode || 'terminal',
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] =
    useState<AgentAttachment | null>(null);

  const activeAgent = useMemo(() => {
    return (
      configuredAgents.find((item) => item.id === selectedAgentId) ||
      configuredAgents[0]
    );
  }, [configuredAgents, selectedAgentId]);

  const activeAgentRef = useRef(activeAgent);
  activeAgentRef.current = activeAgent;

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = terminalTheme(isDarkMode);
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

  // Clean up object URLs when attachments are modified or unmounted
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((att) => {
        if (att.previewUrl) {
          try {
            URL.revokeObjectURL(att.previewUrl);
          } catch {}
        }
      });
    };
  }, []);

  const handleRemoveAttachment = (idToRemove: string) => {
    setAttachments((prev) => {
      const match = prev.find((a) => a.id === idToRemove);
      if (match?.previewUrl) {
        try {
          URL.revokeObjectURL(match.previewUrl);
        } catch {}
      }
      if (previewAttachment?.id === idToRemove) {
        setPreviewAttachment(null);
      }
      return prev.filter((a) => a.id !== idToRemove);
    });
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newAttachments: AgentAttachment[] = files.map((file) => {
      const isImg = isImageFile(file.name, file.type);
      let previewUrl: string | undefined;
      if (isImg) {
        try {
          previewUrl = URL.createObjectURL(file);
        } catch {}
      }
      const rawPath = (file as File & { path?: string }).path || file.name;
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        path: rawPath,
        size: file.size,
        type: file.type,
        previewUrl,
      };
    });

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const xterm = new XTerm({
      cursorBlink: true,
      convertEol: false,
      fontFamily: 'Cascadia Mono, Consolas, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.15,
      scrollback: 10000,
      theme: terminalTheme(initialDarkModeRef.current),
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(hostRef.current);
    xtermRef.current = xterm;
    registerFocus(terminal.id, () => xterm.focus());

    xterm.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      // Prevent Tab from moving browser DOM focus away from the terminal
      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        window.electron.ipcRenderer.send('terminal-input', terminal.id, '\t');
        requestAnimationFrame(() => {
          xtermRef.current?.focus();
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
      window.electron.ipcRenderer.send('terminal-input', terminal.id, data);
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

    const removeReady = window.electron.ipcRenderer.on(
      'terminal-ready',
      (id: string) => {
        if (id !== terminal.id) return;
        window.setTimeout(() => {
          xterm.focus();
        }, 300);
      },
    );

    const removeStateChange = window.electron.ipcRenderer.on(
      'terminal-ai-agent-state-changed',
      (eventPayload: AgentStateChangeEvent) => {
        if (eventPayload.sessionId !== terminal.id) return;
        setAgentState(eventPayload.state);

        const currentAgent = activeAgentRef.current;
        if (eventPayload.state === 'working') {
          if (currentAgent) {
            onAgentActivity?.({
              terminalId: terminal.id,
              worktreePath: terminal.path,
              agent: currentAgent,
              active: true,
            });
          }
        } else if (
          eventPayload.state === 'idle' ||
          eventPayload.state === 'error' ||
          eventPayload.state === 'exited'
        ) {
          if (currentAgent) {
            onAgentActivity?.({
              terminalId: terminal.id,
              worktreePath: terminal.path,
              agent: currentAgent,
              active: false,
            });
          }
          if (eventPayload.state === 'idle') {
            window.setTimeout(() => {
              promptInputRef.current?.focus();
            }, 50);
          }
        }
      },
    );

    const removeAgentError = window.electron.ipcRenderer.on(
      'terminal-ai-agent-error',
      (id: string, message: string) => {
        if (id !== terminal.id) return;
        setAgentState('error');
        xterm.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      },
    );

    const removeExit = window.electron.ipcRenderer.on(
      'terminal-exit',
      (id: string, exitCode: number) => {
        if (id !== terminal.id) return;
        setAgentState('exited');
        xterm.writeln(`\r\n[Process exited with code ${exitCode}]`);
      },
    );

    const removeError = window.electron.ipcRenderer.on(
      'terminal-error',
      (id: string, message: string) => {
        if (id !== terminal.id) return;
        setAgentState('error');
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
      removeAgentError();
      removeStateChange();
      window.electron.ipcRenderer.send('terminal-close', terminal.id);
      registerFocus(terminal.id, null);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [onAgentActivity, registerFocus, terminal.id, terminal.path]);

  const canChangeAgent =
    agentState === 'idle' ||
    agentState === 'error' ||
    agentState === 'exited';

  const isWorkingOrStarting =
    agentState === 'working' || agentState === 'starting';
  const isStopping = agentState === 'stopping';

  const handleAgentSelectChange = (newAgentId: AiAgentId) => {
    if (!canChangeAgent) return;
    setSelectedAgentId(newAgentId);
    window.electron.ipcRenderer.send(
      'terminal-switch-ai-agent',
      terminal.id,
      newAgentId,
    );
  };

  const handleStartAgent = () => {
    const agent = enabledAgents.find((item) => item.id === selectedAgentId);
    if (!agent || isWorkingOrStarting || isStopping) return;

    const currentPrompt = agentPrompt;
    const currentAttachments = [...attachments];

    setAgentState('starting');
    window.electron.ipcRenderer.send(
      'terminal-start-ai-agent',
      terminal.id,
      agent.id,
      currentPrompt,
      currentAttachments,
    );

    // Clear prompt and attachments only upon sending
    setAgentPrompt('');
    setAttachments([]);
  };

  const handleStop = () => {
    if (isStopping) return;
    setAgentState('stopping');
    window.electron.ipcRenderer.send('terminal-stop-ai-agent', terminal.id);
  };

  const statusPresentation = {
    starting: { label: `Starting ${activeAgent?.label || 'AI agent'}...`, color: 'processing' },
    idle: { label: `${activeAgent?.label || 'AI agent'} ready`, color: 'success' },
    working: { label: `${activeAgent?.label || 'AI agent'} working...`, color: 'purple' },
    stopping: { label: `Stopping ${activeAgent?.label || 'AI agent'}...`, color: 'warning' },
    error: { label: 'Error', color: 'error' },
    exited: { label: 'Shell exited', color: 'default' },
  }[agentState];

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
        <Space className="terminal-pane-actions" size={6}>
          {mode === 'agent' && (
            <Select
              size="small"
              value={selectedAgentId}
              aria-label="AI agent for this terminal"
              disabled={!canChangeAgent || enabledAgents.length === 0}
              placeholder="Select AI Agent"
              className="terminal-agent-select"
              options={enabledAgents.map((agent) => ({
                value: agent.id,
                label: (
                  <Space size={6}>
                    {getAiAgentIcon(agent.id, 18)}
                    {agent.label}
                  </Space>
                ),
              }))}
              onChange={handleAgentSelectChange}
            />
          )}
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={mode}
            aria-label="Switch between terminal and AI agent"
            disabled={isWorkingOrStarting || isStopping}
            options={[
              { label: 'Terminal', value: 'terminal' },
              { label: 'AI Agent', value: 'agent' },
            ]}
            onChange={(event) => {
              const nextMode = event.target.value as 'terminal' | 'agent';
              setMode(nextMode);
            }}
          />
          {mode === 'agent' && (
            <Tooltip title={statusPresentation.label}>
              <Tag
                bordered={false}
                color={statusPresentation.color}
                className="terminal-status-tag"
              >
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

      {mode === 'agent' && (
        <div className="terminal-agent-composer">
          {enabledAgents.length === 0 ? (
            <Typography.Text type="secondary" className="terminal-agent-empty-hint">
              Enable and configure an AI agent in Settings &gt; AI Agents before starting one.
            </Typography.Text>
          ) : (
            <>
              <div className="terminal-composer-input-row">
                <Input.TextArea
                  ref={promptInputRef}
                  size="small"
                  className="terminal-composer-textarea"
                  value={agentPrompt}
                  onChange={(event) => setAgentPrompt(event.target.value)}
                  onFocus={() => {
                    if (!isFocusedMode && canFocus) onToggleFocusedMode(terminal.id);
                  }}
                  onPressEnter={(event) => {
                    if (event.shiftKey) return;
                    event.preventDefault();
                    if (!isWorkingOrStarting && !isStopping) {
                      handleStartAgent();
                    }
                  }}
                  placeholder={
                    isWorkingOrStarting
                      ? `${activeAgent?.label || 'Agent'} is working... Prompt disabled`
                      : isStopping
                      ? 'Stopping agent...'
                      : `Prompt for ${activeAgent?.label || 'AI agent'}...`
                  }
                  disabled={isWorkingOrStarting || isStopping}
                  autoSize={{ minRows: 2, maxRows: 5 }}
                />

                <div className="terminal-composer-actions">
                  <input
                    ref={fileInputRef}
                    className="terminal-agent-file-input"
                    type="file"
                    multiple
                    accept="image/*,text/*,.txt,.log,.json,.md,.ts,.tsx,.js,.jsx,.py,.go,.rs,.c,.cpp,.h,.java,.html,.css,.yml,.yaml,.toml,.env,*"
                    onChange={handleFilesSelected}
                  />

                  <Tooltip title="Add files or images to prompt">
                    <Button
                      size="middle"
                      type="text"
                      className="terminal-attach-btn"
                      icon={<PaperClipOutlined />}
                      aria-label="Add files or images"
                      disabled={isWorkingOrStarting || isStopping}
                      onClick={() => fileInputRef.current?.click()}
                    />
                  </Tooltip>

                  {isWorkingOrStarting || isStopping ? (
                    <Tooltip title="Stop AI agent immediately">
                      <Button
                        size="middle"
                        danger
                        type="primary"
                        className="terminal-stop-button"
                        icon={<StopOutlined />}
                        loading={isStopping}
                        disabled={isStopping}
                        onClick={handleStop}
                      >
                        {isStopping ? 'Stopping' : 'Stop'}
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip title={`Send prompt to ${activeAgent?.label || 'AI agent'}`}>
                      <Button
                        size="middle"
                        type="primary"
                        className="terminal-send-button"
                        icon={<SendOutlined />}
                        aria-label="Send to AI agent"
                        disabled={
                          enabledAgents.length === 0 ||
                          (!agentPrompt.trim() && attachments.length === 0)
                        }
                        onClick={handleStartAgent}
                      />
                    </Tooltip>
                  )}
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="terminal-attachments-strip">
                  {attachments.map((att) => {
                    const isImg = isImageFile(att.name, att.type);
                    return (
                      <div
                        key={att.id}
                        className="terminal-attachment-chip"
                        title={att.path}
                      >
                        <div
                          className="terminal-attachment-content"
                          onClick={() => {
                            if (isImg) setPreviewAttachment(att);
                          }}
                          role={isImg ? 'button' : undefined}
                          tabIndex={isImg ? 0 : undefined}
                        >
                          {isImg && att.previewUrl ? (
                            <img
                              src={att.previewUrl}
                              alt={att.name}
                              className="terminal-attachment-thumb"
                            />
                          ) : isImg ? (
                            <PictureOutlined className="terminal-attachment-icon" />
                          ) : (
                            <FileTextOutlined className="terminal-attachment-icon" />
                          )}
                          <span className="terminal-attachment-name">
                            {att.name}
                          </span>
                          {isImg && (
                            <EyeOutlined className="terminal-attachment-preview-hint" />
                          )}
                        </div>
                        <button
                          type="button"
                          className="terminal-attachment-remove-btn"
                          aria-label={`Remove ${att.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAttachment(att.id);
                          }}
                        >
                          <CloseCircleFilled />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Large Image Preview Modal */}
      <Modal
        open={previewAttachment !== null}
        title={
          <div className="terminal-image-modal-title">
            <PictureOutlined />
            <span>{previewAttachment?.name}</span>
          </div>
        }
        footer={null}
        destroyOnClose
        centered
        maskClosable={true}
        className="terminal-image-preview-modal"
        rootClassName={isDarkMode ? 'terminal-workspace-theme-dark' : ''}
        onCancel={() => setPreviewAttachment(null)}
      >
        {previewAttachment && (
          <div className="terminal-image-modal-body">
            <img
              src={previewAttachment.previewUrl || previewAttachment.path}
              alt={previewAttachment.name}
              className="terminal-image-modal-img"
            />
          </div>
        )}
      </Modal>

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
