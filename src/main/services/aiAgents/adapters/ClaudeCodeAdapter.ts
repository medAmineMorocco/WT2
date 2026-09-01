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

export class ClaudeCodeAdapter implements AIAgentAdapter {
  readonly id: AiAgentId = 'claude';
  readonly label = 'Claude Code';

  validateAttachments(attachments: AgentAttachment[]): {
    valid: boolean;
    error?: string;
  } {
    // Claude Code supports text files, markdown, code, and images (PNG, JPG, JPEG, WebP, GIF)
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
      const fileRefs = attachments
        .map((att) => {
          const cleanPath = formatAttachmentPath(att.path);
          return `@${cleanPath}`;
        })
        .join(' ');

      if (combinedPrompt) {
        combinedPrompt = `${combinedPrompt} ${fileRefs}`;
      } else {
        combinedPrompt = fileRefs;
      }
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
    // Check for shell prompt or Claude Code idle prompt
    return (
      /(?:^|\r?\n)(?:(?:PS )?[a-z]:\\[^\r\n]*>|[^\s@]+@[^:\r\n]+:[^\r\n]*[$#])\s*$/i.test(
        outputTail,
      ) ||
      /(?:^|\r?\n)>\s*$/i.test(outputTail) ||
      /Claude finished/i.test(outputTail)
    );
  }
}
