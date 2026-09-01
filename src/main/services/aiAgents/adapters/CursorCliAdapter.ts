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

export class CursorCliAdapter implements AIAgentAdapter {
  readonly id: AiAgentId = 'cursor';
  readonly label = 'Cursor CLI';

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

    const promptArg = combinedPrompt
      ? escapePromptForShell(combinedPrompt, shell)
      : '';

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
      /Cursor finished/i.test(outputTail) ||
      /(?:^|\r?\n)cursor\s*>\s*$/i.test(outputTail)
    );
  }
}
