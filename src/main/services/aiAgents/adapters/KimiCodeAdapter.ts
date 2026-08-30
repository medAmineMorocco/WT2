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

export class KimiCodeAdapter implements AIAgentAdapter {
  readonly id: AiAgentId = 'kimi';

  readonly label = 'Kimi Code';

  validateAttachments(): { valid: boolean; error?: string } {
    return { valid: true };
  }

  buildCommand(
    shell: string,
    config: AiAgentConfig,
    prompt: string,
    attachments: AgentAttachment[],
  ): string {
    const fileContext = attachments
      .map((attachment) => `- ${formatAttachmentPath(attachment.path)}`)
      .join('\n');
    const combinedPrompt = [
      prompt.trim(),
      fileContext ? `[Attached Files]:\n${fileContext}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const promptArg = combinedPrompt
      ? `--prompt ${escapePromptForShell(combinedPrompt, shell)}`
      : '';
    return [formatCommandPath(config.command, shell), config.args.trim(), promptArg]
      .filter(Boolean)
      .join(' ');
  }

  getInterruptSequence(): string {
    return '\x03';
  }

  isCompletionSignal(outputTail: string): boolean {
    return (
      /(?:^|\r?\n)(?:(?:PS )?[a-z]:\\[^\r\n]*>|[^\s@]+@[^:\r\n]+:[^\r\n]*[$#])\s*$/i.test(
        outputTail,
      ) || /Kimi (?:Code )?finished/i.test(outputTail)
    );
  }
}
