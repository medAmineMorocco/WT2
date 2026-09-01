export type ShellId =
  | 'pwsh'
  | 'powershell'
  | 'cmd'
  | 'git-bash'
  | 'wsl'
  | 'fish'
  | 'zsh'
  | 'bash'
  | 'nu'
  | 'sh'
  | 'custom';

export interface ShellInfo {
  id: ShellId;
  name: string;
  description: string;
  path: string;
  found: boolean;
  version: string | null;
  isActive: boolean;
  icon: string;
}

export interface ShellDetectionResult {
  id: ShellId;
  name: string;
  description: string;
  path: string;
  found: boolean;
  version: string | null;
  icon: string;
}
