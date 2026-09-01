import fs from 'fs';
import {
  AgentAttachment,
  AiAgentConfig,
  AiAgentId,
} from '../../../../shared/aiAgents';

export interface AIAgentAdapter {
  readonly id: AiAgentId;
  readonly label: string;

  /**
   * Builds the command string to be executed in the interactive PTY shell.
   */
  buildCommand(
    shell: string,
    config: AiAgentConfig,
    prompt: string,
    attachments: AgentAttachment[],
  ): string;

  /**
   * Validates whether all provided attachments are supported by this agent.
   */
  validateAttachments(attachments: AgentAttachment[]): {
    valid: boolean;
    error?: string;
  };

  /**
   * Character sequence sent to PTY for graceful interruption (typically '\x03' for Ctrl+C).
   */
  getInterruptSequence(): string;

  /**
   * Checks if the recent output tail indicates that the agent has finished its task.
   */
  isCompletionSignal(outputTail: string): boolean;
}

export function isPowerShell(shell: string): boolean {
  return /powershell|pwsh/i.test(shell);
}

export function isCmd(shell: string): boolean {
  return /cmd(\.exe)?$/i.test(shell.trim());
}

export function isPosixShell(shell: string): boolean {
  if (isPowerShell(shell) || isCmd(shell)) return false;
  return /bash|zsh|wsl|\bsh\b/i.test(shell) || process.platform !== 'win32';
}

export function formatCommandPath(commandPath: string, shell: string): string {
  let normalizedPath = commandPath.trim().replace(/\\/g, '/');

  if (isPosixShell(shell) && normalizedPath.toLowerCase().endsWith('.cmd')) {
    const withoutCmd = normalizedPath.slice(0, -4);
    if (fs.existsSync(withoutCmd)) {
      normalizedPath = withoutCmd;
    }
  }

  if (isPowerShell(shell)) {
    return normalizedPath.includes(' ')
      ? `& '${normalizedPath}'`
      : normalizedPath;
  }
  if (isPosixShell(shell)) {
    return normalizedPath.includes(' ')
      ? `'${normalizedPath}'`
      : normalizedPath;
  }
  // CMD.exe
  return normalizedPath.includes(' ') ? `"${normalizedPath}"` : normalizedPath;
}

export function escapePromptForShell(prompt: string, shell: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return '';

  if (isPowerShell(shell)) {
    const escaped = trimmed.replace(/'/g, "''");
    return `'${escaped}'`;
  }
  if (isPosixShell(shell)) {
    const escaped = trimmed.replace(/'/g, "'\\''");
    return `'${escaped}'`;
  }
  // CMD.exe
  const escaped = trimmed.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function formatAttachmentPath(filePath: string): string {
  return filePath.trim().replace(/\\/g, '/');
}
