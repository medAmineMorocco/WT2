import { AiAgentId } from '../../../../shared/aiAgents';
import { AIAgentAdapter } from './AIAgentAdapter';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter';
import { CodexAdapter } from './CodexAdapter';
import { CursorCliAdapter } from './CursorCliAdapter';
import { AntigravityCliAdapter } from './AntigravityCliAdapter';
import { QwenCodeAdapter } from './QwenCodeAdapter';
import { KimiCodeAdapter } from './KimiCodeAdapter';
import { OpenCodeAdapter } from './OpenCodeAdapter';

export * from './AIAgentAdapter';
export * from './ClaudeCodeAdapter';
export * from './CodexAdapter';
export * from './CursorCliAdapter';
export * from './AntigravityCliAdapter';
export * from './QwenCodeAdapter';
export * from './KimiCodeAdapter';
export * from './OpenCodeAdapter';

const adapters: Record<AiAgentId, AIAgentAdapter> = {
  claude: new ClaudeCodeAdapter(),
  codex: new CodexAdapter(),
  cursor: new CursorCliAdapter(),
  antigravity: new AntigravityCliAdapter(),
  qwen: new QwenCodeAdapter(),
  kimi: new KimiCodeAdapter(),
  opencode: new OpenCodeAdapter(),
};

export function getAgentAdapter(agentId: AiAgentId): AIAgentAdapter {
  const adapter = adapters[agentId];
  if (!adapter) {
    throw new Error(`Unsupported AI agent identifier: ${agentId}`);
  }
  return adapter;
}
