export type AiAgentId =
  | 'claude'
  | 'codex'
  | 'cursor'
  | 'antigravity'
  | 'qwen'
  | 'kimi'
  | 'opencode';

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
  {
    id: 'qwen',
    label: 'Qwen Code',
    command: 'qwen',
    args: '',
    enabled: false,
  },
  {
    id: 'kimi',
    label: 'Kimi Code',
    command: 'kimi',
    args: '',
    enabled: false,
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    command: 'opencode',
    args: '',
    enabled: false,
  },
];

export type Platform = 'win32' | 'darwin' | 'linux';

export interface InstallationGuide {
  command?: string;
  url: string;
  requirement?: string;
}

export function detectPlatform(): Platform {
  if (typeof window !== 'undefined' && (window as any).electron?.platform) {
    const p = (window as any).electron.platform;
    if (p === 'win32') return 'win32';
    if (p === 'darwin') return 'darwin';
    return 'linux';
  }
  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform === 'win32') return 'win32';
    if (process.platform === 'darwin') return 'darwin';
    return 'linux';
  }
  if (typeof navigator !== 'undefined') {
    const ua = (navigator.userAgent || '').toLowerCase();
    const plat = (navigator.platform || '').toLowerCase();
    if (ua.includes('win') || plat.includes('win')) return 'win32';
    if (ua.includes('mac') || plat.includes('mac')) return 'darwin';
    return 'linux';
  }
  return 'linux';
}

export function getInstallationGuide(
  agentId: AiAgentId,
  platform: Platform = detectPlatform(),
): InstallationGuide {
  const guides: Record<AiAgentId, InstallationGuide> = {
    claude: {
      command: 'npm install -g @anthropic-ai/claude-code',
      url: 'https://code.claude.com/docs/en/quickstart',
      requirement: 'Requires Node.js 18 or later',
    },
    codex: {
      command: 'npm install -g @openai/codex',
      url: 'https://help.openai.com/en/articles/11096431',
    },
    cursor: {
      url: 'https://docs.cursor.com/en/cli/installation',
    },
    antigravity: {
      url: 'https://antigravity.google/docs/cli/install/',
    },
    qwen: {
      command: 'npm install -g @qwen-code/qwen-code@latest',
      url: 'https://qwenlm.github.io/qwen-code-docs/en/users/quickstart/',
      requirement: 'Requires Node.js 22 or later',
    },
    kimi: {
      command: 'npm install -g @moonshot-ai/kimi-code',
      url: 'https://www.kimi.com/code/docs/en/kimi-code-cli/guides/getting-started.html',
      requirement: 'Requires Node.js 22.19 or later',
    },
    opencode: {
      command: 'npm install -g opencode-ai',
      url: 'https://opencode.ai/docs/',
    },
  };

  return guides[agentId];
}

