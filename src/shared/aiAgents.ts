export type AiAgentId =
  'claude' | 'codex' | 'cursor' | 'antigravity' | 'qwen' | 'kimi' | 'opencode';

export type AgentExecutionState =
  'starting' | 'idle' | 'working' | 'stopping' | 'error' | 'exited';

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

export type AiAgentLaunchOption = {
  id: string;
  category: string;
  label: string;
  description: string;
  args: string[];
  exclusiveGroup?: string;
};

/**
 * Curated interactive flags only. Values from the renderer are resolved through
 * this allow-list in the main process; arbitrary command fragments are never
 * accepted over IPC.
 */
export const AI_AGENT_LAUNCH_OPTIONS: Record<AiAgentId, AiAgentLaunchOption[]> =
  {
    claude: [
      {
        id: 'continue',
        category: 'Session',
        label: 'Continue latest session',
        description: 'Resume the most recent conversation.',
        args: ['--continue'],
      },
      {
        id: 'verbose',
        category: 'Diagnostics',
        label: 'Verbose output',
        description: 'Show additional diagnostic output.',
        args: ['--verbose'],
      },
      {
        id: 'plan',
        category: 'Permissions',
        label: 'Plan mode',
        description: 'Start read-only and propose a plan before editing.',
        args: ['--permission-mode', 'plan'],
        exclusiveGroup: 'permission-mode',
      },
      {
        id: 'accept-edits',
        category: 'Permissions',
        label: 'Accept edits',
        description:
          'Automatically accept file edits while keeping other permission prompts.',
        args: ['--permission-mode', 'acceptEdits'],
        exclusiveGroup: 'permission-mode',
      },
    ],
    codex: [
      {
        id: 'search',
        category: 'Capabilities',
        label: 'Web search',
        description: 'Enable the native web-search tool.',
        args: ['--search'],
      },
      {
        id: 'no-alt-screen',
        category: 'Terminal',
        label: 'Preserve scrollback',
        description: 'Run without the alternate terminal screen.',
        args: ['--no-alt-screen'],
      },
      {
        id: 'sandbox-read-only',
        category: 'Sandbox',
        label: 'Read-only',
        description: 'Allow reads but prevent workspace writes.',
        args: ['--sandbox', 'read-only'],
        exclusiveGroup: 'sandbox',
      },
      {
        id: 'sandbox-workspace-write',
        category: 'Sandbox',
        label: 'Workspace write',
        description: 'Allow writes inside the selected workspace.',
        args: ['--sandbox', 'workspace-write'],
        exclusiveGroup: 'sandbox',
      },
      {
        id: 'approval-on-request',
        category: 'Approvals',
        label: 'Ask on request',
        description: 'Let the agent request approval when needed.',
        args: ['--ask-for-approval', 'on-request'],
        exclusiveGroup: 'approval',
      },
      {
        id: 'approval-never',
        category: 'Approvals',
        label: 'Never ask',
        description: 'Return denied operations to the agent without asking.',
        args: ['--ask-for-approval', 'never'],
        exclusiveGroup: 'approval',
      },
      {
        id: 'approve-for-me',
        category: 'Approvals',
        label: 'Automatic review',
        description: 'Route approval requests through automatic review.',
        args: ['--approve-for-me'],
        exclusiveGroup: 'approval',
      },
    ],
    cursor: [
      {
        id: 'continue',
        category: 'Session',
        label: 'Continue latest session',
        description: 'Continue the previous Cursor session.',
        args: ['--continue'],
      },
      {
        id: 'plan',
        category: 'Mode',
        label: 'Plan mode',
        description: 'Start in read-only planning mode.',
        args: ['--mode', 'plan'],
        exclusiveGroup: 'mode',
      },
      {
        id: 'ask',
        category: 'Mode',
        label: 'Ask mode',
        description: 'Start in read-only question-and-answer mode.',
        args: ['--mode', 'ask'],
        exclusiveGroup: 'mode',
      },
      {
        id: 'auto-review',
        category: 'Approvals',
        label: 'Smart auto-review',
        description:
          'Automatically run safe tool calls and prompt for the rest.',
        args: ['--auto-review'],
      },
      {
        id: 'sandbox',
        category: 'Safety',
        label: 'Enable sandbox',
        description: 'Run tool calls inside Cursor sandbox mode.',
        args: ['--sandbox', 'enabled'],
      },
      {
        id: 'approve-mcps',
        category: 'Integrations',
        label: 'Approve MCP servers',
        description: 'Automatically approve configured MCP servers.',
        args: ['--approve-mcps'],
      },
    ],
    antigravity: [
      {
        id: 'continue',
        category: 'Session',
        label: 'Continue latest session',
        description: 'Continue the most recent conversation.',
        args: ['--continue'],
      },
      {
        id: 'plan',
        category: 'Mode',
        label: 'Plan mode',
        description: 'Start in planning mode.',
        args: ['--mode', 'plan'],
        exclusiveGroup: 'mode',
      },
      {
        id: 'accept-edits',
        category: 'Mode',
        label: 'Accept edits',
        description: 'Allow edits without individual edit prompts.',
        args: ['--mode', 'accept-edits'],
        exclusiveGroup: 'mode',
      },
      {
        id: 'sandbox',
        category: 'Safety',
        label: 'Enable sandbox',
        description: 'Run terminal operations with sandbox restrictions.',
        args: ['--sandbox'],
      },
    ],
    qwen: [
      {
        id: 'continue',
        category: 'Session',
        label: 'Continue latest session',
        description: 'Resume the most recent project session.',
        args: ['--continue'],
      },
      {
        id: 'sandbox',
        category: 'Safety',
        label: 'Enable sandbox',
        description: 'Run tools in sandbox mode.',
        args: ['--sandbox'],
      },
      {
        id: 'safe-mode',
        category: 'Troubleshooting',
        label: 'Safe mode',
        description:
          'Disable custom context, hooks, extensions, skills, and MCP servers.',
        args: ['--safe-mode'],
      },
    ],
    kimi: [
      {
        id: 'continue',
        category: 'Session',
        label: 'Continue latest session',
        description: 'Continue the previous session for this worktree.',
        args: ['--continue'],
      },
      {
        id: 'plan',
        category: 'Mode',
        label: 'Plan mode',
        description: 'Start in read-only planning mode.',
        args: ['--plan'],
        exclusiveGroup: 'mode',
      },
      {
        id: 'yolo',
        category: 'Approvals',
        label: 'Ask when needed',
        description: 'Auto-run routine work and ask for risky actions.',
        args: ['--yolo'],
        exclusiveGroup: 'approval',
      },
      {
        id: 'auto',
        category: 'Approvals',
        label: 'Never ask',
        description: 'Run without interactive approval prompts.',
        args: ['--auto'],
        exclusiveGroup: 'approval',
      },
    ],
    opencode: [
      {
        id: 'continue',
        category: 'Session',
        label: 'Continue latest session',
        description: 'Continue the latest OpenCode session.',
        args: ['--continue'],
      },
      {
        id: 'fork',
        category: 'Session',
        label: 'Fork session',
        description: 'Fork the selected or latest session when continuing.',
        args: ['--fork'],
      },
    ],
  };

export function getAgentLaunchOptions(
  agentId: AiAgentId,
): AiAgentLaunchOption[] {
  return AI_AGENT_LAUNCH_OPTIONS[agentId] || [];
}

export function normalizeAgentLaunchOptionIds(
  agentId: AiAgentId,
  optionIds: unknown,
): string[] {
  if (!Array.isArray(optionIds)) return [];
  const available = getAgentLaunchOptions(agentId);
  const byId = new Map(available.map((option) => [option.id, option]));
  const normalized: string[] = [];
  for (const value of optionIds) {
    if (typeof value !== 'string' || !byId.has(value)) continue;
    const option = byId.get(value)!;
    if (option.exclusiveGroup) {
      const existingIndex = normalized.findIndex(
        (id) => byId.get(id)?.exclusiveGroup === option.exclusiveGroup,
      );
      if (existingIndex !== -1) normalized.splice(existingIndex, 1);
    }
    if (!normalized.includes(value)) normalized.push(value);
  }
  return normalized;
}

export function resolveAgentLaunchArgs(
  agentId: AiAgentId,
  optionIds: unknown,
): string[] {
  const byId = new Map(
    getAgentLaunchOptions(agentId).map((option) => [option.id, option]),
  );
  return normalizeAgentLaunchOptionIds(agentId, optionIds).flatMap(
    (id) => byId.get(id)?.args || [],
  );
}

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

export interface AiAgentModel {
  id: string;
  label: string;
  description?: string;
  releaseDate?: string;
  lastUpdated?: string;
}

export const AI_AGENT_MODELS: Record<AiAgentId, AiAgentModel[]> = {
  claude: [
    { id: '', label: 'Default' },
    { id: 'opus', label: 'Opus (latest)' },
    { id: 'sonnet', label: 'Sonnet (latest)' },
    { id: 'haiku', label: 'Haiku (latest)' },
  ],
  codex: [
    { id: '', label: 'Default' },
    { id: 'o3-mini', label: 'o3-mini' },
    { id: 'o1', label: 'o1' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4.5-preview', label: 'GPT-4.5 Preview' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
  cursor: [
    { id: '', label: 'Default' },
    { id: 'auto', label: 'Auto' },
    { id: 'gpt-5.6-sol-high', label: 'GPT-5.6 Sol (High)' },
    { id: 'gpt-5.6-terra-high', label: 'GPT-5.6 Terra (High)' },
    { id: 'claude-opus-5-thinking-high', label: 'Claude Opus 5 (High)' },
    { id: 'claude-sonnet-5-thinking-high', label: 'Claude Sonnet 5 (High)' },
    { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)' },
  ],
  antigravity: [
    { id: '', label: 'Default' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  ],
  qwen: [
    { id: '', label: 'Default' },
    { id: 'qwen-2.5-coder-32b', label: 'Qwen 2.5 Coder 32B' },
    { id: 'qwen-2.5-coder-7b', label: 'Qwen 2.5 Coder 7B' },
    { id: 'qwen-plus', label: 'Qwen Plus' },
    { id: 'qwen-max', label: 'Qwen Max' },
    { id: 'qwen-turbo', label: 'Qwen Turbo' },
  ],
  kimi: [
    { id: '', label: 'Default' },
    { id: 'moonshot-v1-128k', label: 'Kimi 128k' },
    { id: 'moonshot-v1-32k', label: 'Kimi 32k' },
    { id: 'moonshot-v1-8k', label: 'Kimi 8k' },
    { id: 'kimi-latest', label: 'Kimi Latest' },
  ],
  opencode: [{ id: '', label: 'Default' }],
};

export function getAgentModels(agentId: AiAgentId): AiAgentModel[] {
  return AI_AGENT_MODELS[agentId] || [{ id: '', label: 'Default' }];
}

const LEGACY_CLAUDE_MODEL_ALIASES: Record<string, string> = {
  'claude-3-7-sonnet-latest': 'sonnet',
  'claude-3-5-sonnet-latest': 'sonnet',
  'claude-3-5-haiku-latest': 'haiku',
  'claude-3-opus-latest': 'opus',
};

export function normalizeAgentModel(agentId: AiAgentId, model: string): string {
  const normalized = (model || '').trim();
  if (agentId === 'claude') {
    return LEGACY_CLAUDE_MODEL_ALIASES[normalized] || normalized;
  }
  if (
    agentId === 'cursor' &&
    [
      'claude-3.7-sonnet',
      'claude-3.5-sonnet',
      'gpt-4o',
      'o3-mini',
      'cursor-small',
    ].includes(normalized)
  ) {
    return 'auto';
  }
  if (agentId === 'opencode' && normalized && !normalized.includes('/')) {
    const provider = normalized.startsWith('claude')
      ? 'anthropic'
      : normalized.startsWith('deepseek')
        ? 'deepseek'
        : normalized.startsWith('gpt') || normalized.startsWith('o')
          ? 'openai'
          : '';
    return provider ? `${provider}/${normalized}` : '';
  }
  return normalized;
}

export function formatVersionBadge(rawVersion?: string | null): string | null {
  if (!rawVersion) return null;
  const trimmed = rawVersion.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/v?(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?)/);
  if (match && match[1]) {
    return `v${match[1]}`;
  }

  if (/^v?\d+/i.test(trimmed)) {
    return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
  }

  return trimmed;
}

export type ReasoningEffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ReasoningEffortOption {
  id: string;
  label: string;
}

export const REASONING_EFFORT_OPTIONS: ReasoningEffortOption[] = [
  { id: '', label: 'Effort: Default' },
  { id: 'low', label: 'Low Effort' },
  { id: 'medium', label: 'Medium Effort' },
  { id: 'high', label: 'High Effort' },
  { id: 'xhigh', label: 'Extra High' },
  { id: 'max', label: 'Max Effort' },
];

const ANTIGRAVITY_EFFORT_OPTIONS = REASONING_EFFORT_OPTIONS.filter(
  ({ id }) => id === 'low' || id === 'medium' || id === 'high',
);

export function getReasoningEffortOptions(
  agentId: AiAgentId,
): ReasoningEffortOption[] {
  if (agentId === 'antigravity') return ANTIGRAVITY_EFFORT_OPTIONS;
  if (agentId === 'claude' || agentId === 'codex') {
    return REASONING_EFFORT_OPTIONS;
  }
  return [];
}

export function normalizeReasoningEffort(
  agentId: AiAgentId,
  effort: string,
  model = '',
): string {
  const supported = getReasoningEffortOptions(agentId);
  if (supported.length === 0) return '';
  const normalized = (effort || '').trim().toLowerCase();
  if (supported.some((option) => option.id === normalized)) return normalized;
  // Antigravity requires an explicit effort for an explicitly selected model.
  if (agentId === 'antigravity' && model.trim()) return 'high';
  return '';
}

export function getReasoningEffortFlag(
  agentId: AiAgentId,
  effort: string,
): { flag: string; value: string } | null {
  const normalized = (effort || '').trim().toLowerCase();
  if (!normalized) return null;

  if (getReasoningEffortOptions(agentId).length === 0) return null;

  if (agentId === 'claude' || agentId === 'antigravity') {
    return { flag: '--effort', value: normalized };
  }

  let value = normalized;
  if (agentId === 'codex' && (normalized === 'xhigh' || normalized === 'max')) {
    value = 'high';
  }
  if (agentId === 'codex') {
    return { flag: '-c', value: `model_reasoning_effort=${value}` };
  }
  return { flag: '--reasoning-effort', value };
}
