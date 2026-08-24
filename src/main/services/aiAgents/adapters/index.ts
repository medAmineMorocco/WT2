import { AiAgentId } from '../../../../shared/aiAgents';
import { AIAgentAdapter } from './AIAgentAdapter';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter';
import { CodexAdapter } from './CodexAdapter';
import { CursorCliAdapter } from './CursorCliAdapter';
import { AntigravityCliAdapter } from './AntigravityCliAdapter';

export * from './AIAgentAdapter';
export * from './ClaudeCodeAdapter';
export * from './CodexAdapter';
export * from './CursorCliAdapter';
export * from './AntigravityCliAdapter';

const adapters: Record<AiAgentId, AIAgentAdapter> = {
  claude: new ClaudeCodeAdapter(),
  codex: new CodexAdapter(),
  cursor: new CursorCliAdapter(),
  antigravity: new AntigravityCliAdapter(),
};

export function getAgentAdapter(agentId: AiAgentId): AIAgentAdapter {
  const adapter = adapters[agentId];
  if (!adapter) {
    throw new Error(`Unsupported AI agent identifier: ${agentId}`);
  }
  return adapter;
}
