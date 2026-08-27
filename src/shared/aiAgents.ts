export type AiAgentId = 'claude' | 'codex' | 'cursor' | 'antigravity';

export type AgentExecutionState =
  | 'starting'
  | 'idle'
  | 'working'
  | 'stopping'
  | 'error'
  | 'exited';

export type AgentAttachment = {
  id: string;
  name: string;
  path: string;
  size?: number;
  type?: string;
  previewUrl?: string;
};

export type AgentStartOptions = {
  sessionId: string;
  agentId: AiAgentId;
  prompt: string;
  attachments?: AgentAttachment[];
};

export type AgentStateChangeEvent = {
  sessionId: string;
  agentId: AiAgentId;
  state: AgentExecutionState;
  message?: string;
};

export type AiAgentConfig = {
  id: AiAgentId;
  label: string;
  command: string;
  args: string;
  enabled: boolean;
};

export const aiAgentsDefault: AiAgentConfig[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    command: 'claude',
    args: '',
    enabled: false,
  },
  {
    id: 'codex',
    label: 'Codex',
    command: 'codex',
    args: '',
    enabled: false,
  },
  {
    id: 'cursor',
    label: 'Cursor CLI',
    command: 'cursor-agent',
    args: '',
    enabled: false,
  },
  {
    id: 'antigravity',
    label: 'Antigravity CLI',
    command: 'agy',
    args: '',
    enabled: false,
  },
];
