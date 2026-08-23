import { CompletionContext, CompletionItem, CompletionProvider } from '../types';
import { SerializableOption, SerializableSubcommand } from '../../../../../main/services/terminal/terminalCompletionService';

export type FigSpecLoader = (commandName: string) => Promise<SerializableSubcommand | null>;

const defaultSpecLoader: FigSpecLoader = async (commandName: string) => {
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer?.invoke) {
    try {
      return await (window as any).electron.ipcRenderer.invoke(
        'terminal:load-fig-spec',
        commandName,
      );
    } catch {
      return null;
    }
  }
  return null;
};

const COMMON_CLI_COMMANDS: { name: string; description: string }[] = [
  // Core Unix / shell commands
  { name: 'ls', description: 'List directory contents' },
  { name: 'll', description: 'List directory contents in long format' },
  { name: 'la', description: 'List all directory contents including hidden' },
  { name: 'pwd', description: 'Print name of current/working directory' },
  { name: 'cd', description: 'Change the current working directory' },
  { name: 'cat', description: 'Concatenate and print files' },
  { name: 'clear', description: 'Clear the terminal screen' },
  { name: 'cls', description: 'Clear the terminal screen' },
  { name: 'mkdir', description: 'Make directories' },
  { name: 'rm', description: 'Remove files or directories' },
  { name: 'rmdir', description: 'Remove empty directories' },
  { name: 'cp', description: 'Copy files and directories' },
  { name: 'mv', description: 'Move (rename) files' },
  { name: 'touch', description: 'Change file access and modification times / create file' },
  { name: 'echo', description: 'Write arguments to standard output' },
  { name: 'grep', description: 'Search file(s) for lines matching a pattern' },
  { name: 'find', description: 'Search for files in a directory hierarchy' },
  { name: 'curl', description: 'Transfer data from or to a server' },
  { name: 'wget', description: 'Non-interactive network downloader' },
  { name: 'ssh', description: 'OpenSSH SSH client (remote login program)' },
  { name: 'scp', description: 'Secure copy (remote file copy program)' },
  { name: 'tar', description: 'Manipulate tape archives' },
  { name: 'zip', description: 'Package and compress files' },
  { name: 'unzip', description: 'List, test and extract compressed files in a ZIP archive' },
  { name: 'head', description: 'Output the first part of files' },
  { name: 'tail', description: 'Output the last part of files' },
  { name: 'less', description: 'Opposite of more / paginated file viewer' },
  { name: 'more', description: 'File perusal filter for crt viewing' },
  { name: 'man', description: 'An interface to the system reference manuals' },
  { name: 'which', description: 'Locate a command' },
  { name: 'where', description: 'Locate files in directory search path' },
  { name: 'chmod', description: 'Change file mode bits' },
  { name: 'chown', description: 'Change file owner and group' },
  { name: 'ps', description: 'Report a snapshot of the current processes' },
  { name: 'kill', description: 'Send a signal to a process' },
  { name: 'top', description: 'Display Linux processes' },
  { name: 'htop', description: 'Interactive process viewer' },
  { name: 'df', description: 'Report file system disk space usage' },
  { name: 'du', description: 'Estimate file space usage' },
  { name: 'tree', description: 'List contents of directories in a tree-like format' },
  { name: 'diff', description: 'Compare files line by line' },
  { name: 'history', description: 'Display command history' },
  { name: 'export', description: 'Set an environment variable' },
  { name: 'source', description: 'Execute commands from a file in the current shell' },
  { name: 'alias', description: 'Define or display aliases' },
  { name: 'exit', description: 'Cause the shell to exit' },

  // Developer tools & package managers
  { name: 'git', description: 'Fast, scalable, distributed revision control system' },
  { name: 'npm', description: 'Node package manager' },
  { name: 'npx', description: 'Execute npm package binaries' },
  { name: 'pnpm', description: 'Fast, disk space efficient package manager' },
  { name: 'yarn', description: 'Fast, reliable, and secure dependency management' },
  { name: 'bun', description: 'Fast all-in-one JavaScript runtime' },
  { name: 'deno', description: 'A modern runtime for JavaScript and TypeScript' },
  { name: 'node', description: 'JavaScript runtime built on Chrome\'s V8 engine' },
  { name: 'python', description: 'Interpreted, interactive, object-oriented programming language' },
  { name: 'python3', description: 'Interpreted, interactive, object-oriented programming language' },
  { name: 'pip', description: 'A tool for installing Python packages' },
  { name: 'pip3', description: 'A tool for installing Python packages' },
  { name: 'docker', description: 'Self-sufficient runtime for containers' },
  { name: 'docker-compose', description: 'Define and run multi-container applications' },
  { name: 'cargo', description: 'The Rust package manager' },
  { name: 'rustc', description: 'The Rust compiler' },
  { name: 'go', description: 'Go programming language tool' },
  { name: 'make', description: 'GNU make utility to maintain groups of programs' },
  { name: 'code', description: 'Visual Studio Code command line' },
  { name: 'vim', description: 'Vi IMproved - programmer\'s text editor' },
  { name: 'nano', description: 'Nano\'s ANOther editor, an enhanced free Pico clone' },
  { name: 'gh', description: 'GitHub CLI tool' },
  { name: 'kubectl', description: 'Controls the Kubernetes cluster manager' },

  // Windows-specific common commands
  { name: 'dir', description: 'Display a list of files and subdirectories' },
  { name: 'type', description: 'Display the contents of a text file' },
  { name: 'copy', description: 'Copies one or more files to another location' },
  { name: 'move', description: 'Moves files and renames files and directories' },
  { name: 'del', description: 'Deletes one or more files' },
  { name: 'ipconfig', description: 'Display all current TCP/IP network configuration' },
  { name: 'powershell', description: 'Windows PowerShell' },
  { name: 'cmd', description: 'Windows Command Prompt' },
  { name: 'wsl', description: 'Windows Subsystem for Linux' },
];

const BUILTIN_SPECS: Record<string, SerializableSubcommand> = {
  git: {
    name: 'git',
    description: 'Fast, scalable, distributed revision control system',
    subcommands: [
      { name: 'status', description: 'Show the working tree status' },
      {
        name: 'commit',
        description: 'Record changes to the repository',
        options: [
          { name: ['-m', '--message'], description: 'Commit message' },
          { name: ['-a', '--all'], description: 'Automatically stage modified and deleted files' },
          { name: '--amend', description: 'Amend the previous commit' },
          { name: '--no-verify', description: 'Bypass pre-commit and commit-msg hooks' },
          { name: ['-v', '--verbose'], description: 'Show unified diff of commit in commit message' },
        ],
      },
      {
        name: 'checkout',
        description: 'Switch branches or restore working tree files',
        options: [
          { name: ['-b', '-B'], description: 'Create and checkout a new branch' },
          { name: '--track', description: 'Set upstream tracking' },
        ],
      },
      {
        name: 'switch',
        description: 'Switch branches',
        options: [
          { name: ['-c', '--create'], description: 'Create and switch to a new branch' },
        ],
      },
      {
        name: 'branch',
        description: 'List, create, or delete branches',
        options: [
          { name: ['-a', '--all'], description: 'List both remote-tracking and local branches' },
          { name: ['-r', '--remotes'], description: 'List remote-tracking branches' },
          { name: ['-d', '--delete'], description: 'Delete fully merged branch' },
          { name: '-D', description: 'Force delete branch' },
          { name: ['-m', '--move'], description: 'Move/rename a branch' },
        ],
      },
      {
        name: 'pull',
        description: 'Fetch from and integrate with another repository or branch',
        options: [
          { name: '--rebase', description: 'Rebase local commits on top of fetched branch' },
          { name: '--autostash', description: 'Automatically stash and unstash local changes' },
        ],
      },
      {
        name: 'push',
        description: 'Update remote refs along with associated objects',
        options: [
          { name: ['-u', '--set-upstream'], description: 'Set upstream tracking for future git pull/push' },
          { name: ['-f', '--force'], description: 'Force push updates' },
          { name: '--force-with-lease', description: 'Force push only if upstream has not changed' },
          { name: '--tags', description: 'Push all tags' },
        ],
      },
      {
        name: 'fetch',
        description: 'Download objects and refs from another repository',
        options: [
          { name: '--all', description: 'Fetch all remotes' },
          { name: ['-p', '--prune'], description: 'Before fetching, remove stale remote-tracking branches' },
          { name: '--tags', description: 'Fetch all tags from remote' },
        ],
      },
      {
        name: 'merge',
        description: 'Join two or more development histories together',
        options: [
          { name: '--no-ff', description: 'Create a merge commit even if fast-forward is possible' },
          { name: '--squash', description: 'Squash commits into a single commit' },
          { name: '--abort', description: 'Abort current conflict resolution and return to pre-merge state' },
        ],
      },
      {
        name: 'rebase',
        description: 'Reapply commits on top of another base tip',
        options: [
          { name: ['-i', '--interactive'], description: 'Make a list of commits to be moved and allow user to edit' },
          { name: '--continue', description: 'Restart rebasing process after resolving a merge conflict' },
          { name: '--abort', description: 'Abort rebase operation and reset HEAD to original branch' },
          { name: '--skip', description: 'Restart rebasing process by skipping current patch' },
        ],
      },
      {
        name: 'diff',
        description: 'Show changes between commits, commit and working tree, etc',
        options: [
          { name: '--staged', description: 'View changes staged for commit' },
          { name: '--cached', description: 'Synonym for --staged' },
          { name: '--stat', description: 'Generate diffstat' },
        ],
      },
      {
        name: 'log',
        description: 'Show commit logs',
        options: [
          { name: '--oneline', description: 'Shorthand for --pretty=oneline --abbrev-commit' },
          { name: '--graph', description: 'Draw graphical representation of commit history' },
          { name: ['-n', '--max-count'], description: 'Limit number of commits' },
        ],
      },
      {
        name: 'add',
        description: 'Add file contents to the index',
        options: [
          { name: ['-A', '--all'], description: 'Add, modify, and remove index entries for all paths' },
          { name: ['-p', '--patch'], description: 'Interactively choose hunks of patch between index and work tree' },
          { name: ['-u', '--update'], description: 'Update index entries only for existing files' },
        ],
      },
      {
        name: 'reset',
        description: 'Reset current HEAD to the specified state',
        options: [
          { name: '--hard', description: 'Resets index and working tree. Any changes since <commit> are discarded' },
          { name: '--soft', description: 'Does not touch index file or working tree at all' },
          { name: '--mixed', description: 'Resets index but not working tree' },
        ],
      },
      {
        name: 'restore',
        description: 'Restore working tree files',
        options: [
          { name: '--staged', description: 'Restore index state' },
          { name: '--worktree', description: 'Restore working tree state' },
        ],
      },
      {
        name: 'stash',
        description: 'Stash the changes in a dirty working directory away',
        subcommands: [
          { name: 'push', description: 'Save your local modifications to a new stash entry' },
          { name: 'pop', description: 'Remove a single stashed state from stash list and apply on top' },
          { name: 'apply', description: 'Like pop, but do not remove state from stash list' },
          { name: 'list', description: 'List stashed states' },
          { name: 'drop', description: 'Remove a single stashed state from stash list' },
          { name: 'clear', description: 'Remove all stashed states' },
        ],
      },
      {
        name: 'clone',
        description: 'Clone a repository into a new directory',
        options: [
          { name: '--depth', description: 'Create shallow clone with history truncated to specified number of commits' },
          { name: ['-b', '--branch'], description: 'Point HEAD to <name> branch instead of default branch' },
        ],
      },
      {
        name: 'remote',
        description: 'Manage set of tracked repositories',
        subcommands: [
          { name: 'add', description: 'Add a remote named <name> for repository at <url>' },
          { name: 'remove', description: 'Remove remote <name>' },
          { name: ['-v', '--verbose'], description: 'Be a little more verbose and show remote url after name' },
        ],
      },
      {
        name: 'cherry-pick',
        description: 'Apply the changes introduced by some existing commits',
        options: [
          { name: '--continue', description: 'Continue operation in progress using information in .git/sequencer' },
          { name: '--abort', description: 'Cancel operation and return to pre-sequence state' },
        ],
      },
    ],
  },
  npm: {
    name: 'npm',
    description: 'JavaScript package manager',
    subcommands: [
      {
        name: 'install',
        description: 'Install dependencies or a package',
        options: [
          { name: ['-D', '--save-dev'], description: 'Save installed packages to devDependencies' },
          { name: ['-E', '--save-exact'], description: 'Saved dependencies will be configured with exact version' },
          { name: ['-g', '--global'], description: 'Install package globally' },
        ],
      },
      { name: 'i', description: 'Alias for install' },
      { name: 'run', description: 'Run arbitrary package scripts' },
      { name: 'run-script', description: 'Run arbitrary package scripts' },
      { name: 'start', description: 'Start the package' },
      { name: 'test', description: 'Test a package' },
      { name: 't', description: 'Alias for test' },
      { name: 'build', description: 'Build the package' },
      { name: 'init', description: 'Create a package.json file' },
      { name: 'publish', description: 'Publish a package to the npm registry' },
      { name: 'version', description: 'Bump a package version' },
      { name: 'outdated', description: 'Check for outdated packages' },
      { name: 'audit', description: 'Run a security audit on your dependencies' },
      { name: 'uninstall', description: 'Remove a package' },
      { name: 'update', description: 'Update packages' },
      { name: 'list', description: 'List installed packages' },
      { name: 'ci', description: 'Install a project with a clean slate' },
      { name: 'link', description: 'Symlink a package folder' },
    ],
  },
  pnpm: {
    name: 'pnpm',
    description: 'Fast, disk space efficient package manager',
    subcommands: [
      { name: 'add', description: 'Installs a package and any packages that it depends on' },
      { name: 'install', description: 'Install all dependencies for a project' },
      { name: 'i', description: 'Alias for install' },
      { name: 'run', description: 'Runs a defined package script' },
      { name: 'start', description: 'Runs an arbitrary command specified in the package\'s "start" property' },
      { name: 'test', description: 'Runs a package\'s "test" script' },
      { name: 'build', description: 'Runs a package\'s "build" script' },
      { name: 'dev', description: 'Runs a package\'s "dev" script' },
      { name: 'remove', description: 'Removes packages from node_modules and from project\'s package.json' },
      { name: 'update', description: 'Updates packages to their latest version based on specified range' },
      { name: 'outdated', description: 'Check for outdated packages' },
      { name: 'audit', description: 'Checks for known security issues with the installed packages' },
    ],
  },
  yarn: {
    name: 'yarn',
    description: 'Fast, reliable, and secure dependency management',
    subcommands: [
      { name: 'add', description: 'Installs a package and any packages that it depends on' },
      { name: 'install', description: 'Install all dependencies for a project' },
      { name: 'run', description: 'Runs a defined package script' },
      { name: 'start', description: 'Runs the start script defined in package.json' },
      { name: 'test', description: 'Runs the test script defined in package.json' },
      { name: 'build', description: 'Runs the build script defined in package.json' },
      { name: 'remove', description: 'Remove a package from your direct dependencies' },
      { name: 'upgrade', description: 'Upgrades packages to their latest version based on specified range' },
      { name: 'outdated', description: 'Checks for outdated package dependencies' },
      { name: 'audit', description: 'Perform a vulnerability audit against installed packages' },
    ],
  },
  docker: {
    name: 'docker',
    description: 'Self-sufficient runtime for containers',
    subcommands: [
      { name: 'run', description: 'Run a command in a new container' },
      { name: 'exec', description: 'Run a command in a running container' },
      { name: 'ps', description: 'List containers' },
      { name: 'build', description: 'Build an image from a Dockerfile' },
      { name: 'images', description: 'List images' },
      { name: 'stop', description: 'Stop one or more running containers' },
      { name: 'start', description: 'Start one or more stopped containers' },
      { name: 'restart', description: 'Restart one or more containers' },
      { name: 'rm', description: 'Remove one or more containers' },
      { name: 'rmi', description: 'Remove one or more images' },
      { name: 'logs', description: 'Fetch the logs of a container' },
      { name: 'pull', description: 'Pull an image or a repository from a registry' },
      { name: 'push', description: 'Push an image or a repository to a registry' },
      { name: 'compose', description: 'Docker Compose' },
    ],
  },
  cargo: {
    name: 'cargo',
    description: 'The Rust package manager',
    subcommands: [
      { name: 'build', description: 'Compile the current package' },
      { name: 'check', description: 'Analyze the current package and report errors, but don\'t build object files' },
      { name: 'run', description: 'Run a binary or example of the local package' },
      { name: 'test', description: 'Execute all unit and integration tests' },
      { name: 'clippy', description: 'Checks a package to catch common mistakes and improve your Rust code' },
      { name: 'fmt', description: 'Formats all bin and lib files of the current crate using rustfmt' },
      { name: 'add', description: 'Add dependencies to a Cargo.toml manifest file' },
      { name: 'remove', description: 'Remove dependencies from a Cargo.toml manifest file' },
      { name: 'update', description: 'Update dependencies listed in Cargo.lock' },
      { name: 'clean', description: 'Remove artifacts that cargo has generated in the past' },
    ],
  },
};

export class FigCompletionProvider implements CompletionProvider {
  public id = 'fig';

  private specCache = new Map<string, SerializableSubcommand | null>();

  private loader: FigSpecLoader;

  constructor(loader: FigSpecLoader = defaultSpecLoader) {
    this.loader = loader;
  }

  public setSpec(command: string, spec: SerializableSubcommand | null): void {
    this.specCache.set(command.toLowerCase(), spec);
  }

  private async getSpec(command: string): Promise<SerializableSubcommand | null> {
    const key = command.toLowerCase();
    if (this.specCache.has(key)) {
      return this.specCache.get(key) || null;
    }
    if (BUILTIN_SPECS[key]) {
      this.specCache.set(key, BUILTIN_SPECS[key]);
      return BUILTIN_SPECS[key];
    }
    const spec = await this.loader(key);
    this.specCache.set(key, spec);
    return spec;
  }

  private resolveActiveSubcommand(
    rootSpec: SerializableSubcommand,
    tokens: string[],
    targetTokenIndex: number,
  ): SerializableSubcommand {
    let current: SerializableSubcommand = rootSpec;

    for (let i = 1; i < targetTokenIndex; i += 1) {
      const token = tokens[i];
      if (!token || token.startsWith('-')) continue;

      if (current.subcommands && Array.isArray(current.subcommands)) {
        const found = current.subcommands.find((sub) => {
          if (Array.isArray(sub.name)) {
            return sub.name.includes(token);
          }
          return sub.name === token;
        });
        if (found) {
          current = found;
        }
      }
    }

    return current;
  }

  public async getSuggestions(
    context: CompletionContext,
    signal?: AbortSignal,
  ): Promise<CompletionItem[]> {
    const token = context.currentToken;
    const lowerToken = token.toLowerCase();

    // 1. Root command completion (e.g. typing "gi" -> "git")
    if (context.tokenIndex === 0 || !context.command) {
      const results: CompletionItem[] = [];
      for (const cli of COMMON_CLI_COMMANDS) {
        if (!token || cli.name.toLowerCase().startsWith(lowerToken)) {
          results.push({
            label: cli.name,
            insertText: cli.name,
            type: 'command',
            source: 'fig',
            description: cli.description,
            score: 75,
          });
        }
      }
      return results;
    }

    if (signal?.aborted) return [];

    const rootSpec = await this.getSpec(context.command);
    if (!rootSpec || signal?.aborted) return [];

    const rawTokens = context.rawTokens || [];
    const activeSubcommand = this.resolveActiveSubcommand(
      rootSpec,
      rawTokens,
      context.tokenIndex ?? rawTokens.length - 1,
    );

    const suggestions: CompletionItem[] = [];

    // 2. Option / Flag completion (e.g. "--amend", "-m")
    if (context.isOption || token.startsWith('-')) {
      const options = activeSubcommand.options || [];
      for (const opt of options) {
        const optNames = Array.isArray(opt.name) ? opt.name : [opt.name];
        for (const name of optNames) {
          if (!token || name.toLowerCase().startsWith(lowerToken)) {
            suggestions.push({
              label: name,
              insertText: name,
              type: 'option',
              source: 'fig',
              description: opt.description,
              score: 80,
            });
          }
        }
      }
      return suggestions;
    }

    // 3. Subcommand completion (e.g. "git ch" -> "checkout", "cherry-pick")
    if (activeSubcommand.subcommands && Array.isArray(activeSubcommand.subcommands)) {
      for (const sub of activeSubcommand.subcommands) {
        const subNames = Array.isArray(sub.name) ? sub.name : [sub.name];
        for (const name of subNames) {
          if (!token || name.toLowerCase().startsWith(lowerToken)) {
            suggestions.push({
              label: name,
              insertText: name,
              type: 'subcommand',
              source: 'fig',
              description: sub.description,
              score: 75,
            });
          }
        }
      }
    }

    return suggestions;
  }
}

export default FigCompletionProvider;
