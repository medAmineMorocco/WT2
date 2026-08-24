export type AiAgentId = 'claude' | 'codex' | 'cursor' | 'antigravity';

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
  { id: 'codex', label: 'Codex', command: 'codex', args: '', enabled: false },
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
