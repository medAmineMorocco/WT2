import {
  AgentAttachment,
  AiAgentConfig,
  AiAgentId,
} from '../../../../shared/aiAgents';
import {
  AIAgentAdapter,
  escapePromptForShell,
  formatCommandPath,
} from './AIAgentAdapter';

export class OpenCodeAdapter implements AIAgentAdapter {
  readonly id: AiAgentId = 'opencode';

  readonly label = 'OpenCode';

  validateAttachments(): { valid: boolean; error?: string } {
    return { valid: true };
  }

  buildCommand(
    shell: string,
    config: AiAgentConfig,
    prompt: string,
    attachments: AgentAttachment[],
  ): string {
    const fileArgs = attachments.flatMap((attachment) => [
      '--file',
      escapePromptForShell(attachment.path, shell),
    ]);
    const promptArg = prompt.trim()
      ? escapePromptForShell(prompt, shell)
      : '';
    return [
      formatCommandPath(config.command, shell),
      config.args.trim(),
      'run',
      ...fileArgs,
      promptArg,
    ]
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
      ) || /OpenCode finished/i.test(outputTail)
    );
  }
}
