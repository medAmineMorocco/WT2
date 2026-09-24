import { AiAgentId } from './aiAgents';

export type WorktreeOpenAction =
  | { type: 'terminal' }
  | { type: 'editor'; editor: string }
  | { type: 'agent'; agentId: AiAgentId };

export type CreatedWorktreeTarget = {
  name: string;
  path: string;
};
