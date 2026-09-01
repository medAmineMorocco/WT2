import {
  AgentAttachment,
  AiAgentConfig,
  AiAgentId,
} from '../../../../shared/aiAgents';
import {
  AIAgentAdapter,
  escapePromptForShell,
  formatAttachmentPath,
  formatCommandPath,
} from './AIAgentAdapter';

export class AntigravityCliAdapter implements AIAgentAdapter {
  readonly id: AiAgentId = 'antigravity';
  readonly label = 'Antigravity CLI';

  validateAttachments(attachments: AgentAttachment[]): {
    valid: boolean;
    error?: string;
  } {
    return { valid: true };
  }

  buildCommand(
    shell: string,
    config: AiAgentConfig,
    prompt: string,
    attachments: AgentAttachment[],
  ): string {
    const formattedCmd = formatCommandPath(config.command, shell);
    const args = config.args.trim();

    let combinedPrompt = prompt.trim();
    if (attachments.length > 0) {
      const fileSection = `\n\n[Attached Files]:\n${attachments
        .map((att) => `- ${formatAttachmentPath(att.path)}`)
        .join('\n')}`;
      combinedPrompt = combinedPrompt ? `${combinedPrompt}${fileSection}` : fileSection.trim();
    }

    let promptArg = '';
    if (combinedPrompt) {
      const escaped = escapePromptForShell(combinedPrompt, shell);
      promptArg = `-i ${escaped}`;
    }

    return [formattedCmd, args, promptArg].filter(Boolean).join(' ');
  }

  getInterruptSequence(): string {
    return '\x03'; // Ctrl+C
  }

  isCompletionSignal(outputTail: string): boolean {
    return (
      /(?:^|\r?\n)(?:(?:PS )?[a-z]:\\[^\r\n]*>|[^\s@]+@[^:\r\n]+:[^\r\n]*[$#])\s*$/i.test(
        outputTail,
      ) ||
      /Antigravity finished/i.test(outputTail) ||
      /(?:^|\r?\n)agy\s*>\s*$/i.test(outputTail)
    );
  }
}
