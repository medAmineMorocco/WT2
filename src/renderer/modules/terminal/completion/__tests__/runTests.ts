import {
  calculateAcceptanceDelta,
  createCommandLineState,
  extractCompletionContext,
  handleBackspace,
  handleClearLine,
  handleClearWord,
  handleEnd,
  handleHome,
  handleMoveLeft,
  handleMoveRight,
  tokenizeCommandLine,
  updateLineWithChar,
} from '../commandLineState';
import {
  determineCompletionMode,
  scoreCompletionItem,
} from '../ranking';
import { HistoryCompletionProvider } from '../providers/HistoryCompletionProvider';
import { FileSystemCompletionProvider } from '../providers/FileSystemCompletionProvider';
import { FigCompletionProvider } from '../providers/FigCompletionProvider';
import { GitCompletionProvider } from '../providers/GitCompletionProvider';
import { PackageJsonCompletionProvider } from '../providers/PackageJsonCompletionProvider';
import { CompletionEngine } from '../engine';
import { CompletionItem } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function run() {
  console.log('Running Terminal Autocomplete Test Suite...\n');

  // 1. CommandLineState & Token Extraction
  console.log('1. CommandLineState & Token Extraction');
  {
    const tokens = tokenizeCommandLine('git commit -m "init"');
    assert(tokens.length === 4, 'Tokenizes 4 items in git commit -m "init"');
    assert(tokens[0].value === 'git', 'First token is git');
    assert(tokens[1].value === 'commit', 'Second token is commit');
    assert(tokens[2].value === '-m', 'Third token is -m');
    assert(tokens[3].value === 'init', 'Fourth token is init');

    const state = createCommandLineState('git sta', 7);
    const context = extractCompletionContext(state, '/workspace');
    assert(context.command === 'git', 'Extracts command "git"');
    assert(context.currentToken === 'sta', 'Extracts current token "sta"');
    assert(context.tokenStart === 4, 'Extracts tokenStart 4');
    assert(context.tokenEnd === 7, 'Extracts tokenEnd 7');
    assert(context.tokenIndex === 1, 'Extracts tokenIndex 1');

    // Cursor in middle: "cat ./src/serv --verbose" with cursor at 14 (right after "serv")
    const midState = createCommandLineState('cat ./src/serv --verbose', 14);
    const midCtx = extractCompletionContext(midState, '/workspace');
    assert(midCtx.command === 'cat', 'Cursor in middle: command is cat');
    assert(midCtx.currentToken === './src/serv', 'Cursor in middle: token is ./src/serv');
    assert(midCtx.tokenStart === 4 && midCtx.tokenEnd === 14, 'Cursor in middle: bounds are 4..14');

    // State mutations
    let s = createCommandLineState('git commit', 10);
    s = handleBackspace(s);
    assert(s.text === 'git commi' && s.cursor === 9, 'handleBackspace removes last char');
    s = updateLineWithChar(s, 't');
    assert(s.text === 'git commit' && s.cursor === 10, 'updateLineWithChar adds char');
    s = handleMoveLeft(s);
    assert(s.cursor === 9, 'handleMoveLeft moves cursor left');
    s = handleMoveRight(s);
    assert(s.cursor === 10, 'handleMoveRight moves cursor right');
    s = handleHome(s);
    assert(s.cursor === 0, 'handleHome moves cursor to 0');
    s = handleEnd(s);
    assert(s.cursor === 10, 'handleEnd moves cursor to end');
    s = handleClearWord(s);
    assert(s.text === 'git ' && s.cursor === 4, 'handleClearWord clears last word');
    s = handleClearLine(s);
    assert(s.text === '' && s.cursor === 0, 'handleClearLine resets line');
  }

  // 2. Completion Acceptance & Delta Calculation
  console.log('\n2. Completion Acceptance & Delta Calculation');
  {
    const state = createCommandLineState('git sta', 7);
    const context = extractCompletionContext(state, '/workspace');
    const item: CompletionItem = {
      label: 'status',
      insertText: 'status',
      type: 'subcommand',
    };
    const { ptyInput, nextState } = calculateAcceptanceDelta(context, item, state);
    assert(ptyInput === 'tus', 'Ghost completion delta for "git sta" -> "status" is only "tus"');
    assert(nextState.text === 'git status', 'Next state text is "git status"');
    assert(nextState.cursor === 10, 'Next state cursor is 10');

    // Filesystem delta without icon in insertText
    const fsState = createCommandLineState('cd src/com', 10);
    const fsCtx = extractCompletionContext(fsState, '/workspace');
    const fsItem: CompletionItem = {
      label: 'components/',
      insertText: 'src/components/',
      type: 'directory',
      icon: '📂',
    };
    const fsDelta = calculateAcceptanceDelta(fsCtx, fsItem, fsState);
    assert(fsDelta.ptyInput === 'ponents/', 'Filesystem delta for "cd src/com" is only "ponents/"');
    assert(fsDelta.nextState.text === 'cd src/components/', 'Next state is "cd src/components/"');
    assert(!fsDelta.ptyInput.includes('📂'), 'PTY input never contains emoji icons');

    // Middle of line insertion
    const midState = createCommandLineState('git ch --verbose', 6);
    const midCtx = extractCompletionContext(midState, '/workspace');
    const midItem: CompletionItem = {
      label: 'checkout',
      insertText: 'checkout',
      type: 'subcommand',
    };
    const midDelta = calculateAcceptanceDelta(midCtx, midItem, midState);
    assert(midDelta.ptyInput === 'eckout', 'Middle of line delta is "eckout"');
    assert(midDelta.nextState.text === 'git checkout --verbose', 'Middle of line text is preserved');
  }

  // 3. HistoryCompletionProvider
  console.log('\n3. HistoryCompletionProvider');
  {
    const history = new HistoryCompletionProvider();
    history.recordCommand('git checkout main');
    history.recordCommand('npm run package:linux');
    history.recordCommand('git checkout main'); // duplicate

    const list = history.getHistory();
    assert(list.length === 2, 'History is deduplicated');
    assert(list[0] === 'git checkout main', 'Recent command is at top of history');

    const state = createCommandLineState('npm run pa', 10);
    const context = extractCompletionContext(state, '/workspace');
    const suggestions = history.getSuggestions(context);
    assert(suggestions.length === 1, 'Matches history command prefix');
    assert(suggestions[0].insertText === 'npm run package:linux', 'Matches npm run package:linux');
  }

  // 4. FileSystemCompletionProvider
  console.log('\n4. FileSystemCompletionProvider');
  {
    const mockReader = async () => [
      { name: 'components', isDirectory: true, isFile: false },
      { name: 'config', isDirectory: true, isFile: false },
      { name: 'index.ts', isDirectory: false, isFile: true },
      { name: 'package.json', isDirectory: false, isFile: true },
    ];
    const fsProvider = new FileSystemCompletionProvider(mockReader);

    const state = createCommandLineState('cat src/co', 9);
    const ctx = extractCompletionContext(state, '/workspace');
    const results = await fsProvider.getSuggestions(ctx);
    assert(results.length === 2, 'Finds 2 matching directory entries');
    assert(results[0].icon === '📂', 'Directory has 📂 icon');
    assert(results[0].type === 'directory', 'Directory type is directory');
    assert(results[0].insertText === 'src/components/', 'Insert text includes full token path');

    // cd directories only
    const cdState = createCommandLineState('cd ', 3);
    const cdCtx = extractCompletionContext(cdState, '/workspace');
    const cdResults = await fsProvider.getSuggestions(cdCtx);
    assert(cdResults.length === 2, 'cd filters to only directories');
    assert(cdResults.every((r) => r.type === 'directory'), 'All cd results are directories');

    // npm subcommand position (tokenIndex 1) does NOT return directory files
    const npmState = createCommandLineState('npm ', 4);
    const npmCtx = extractCompletionContext(npmState, '/workspace');
    const npmResults = await fsProvider.getSuggestions(npmCtx);
    assert(npmResults.length === 0, 'npm subcommand position does not suggest directory files');
  }

  // 5. FigCompletionProvider
  console.log('\n5. FigCompletionProvider');
  {
    const mockLoader = async (cmd: string) => {
      if (cmd === 'git') {
        return {
          name: 'git',
          description: 'Git revision control',
          subcommands: [
            {
              name: 'commit',
              description: 'Record changes',
              options: [
                { name: '--amend', description: 'Amend previous commit' },
                { name: ['-m', '--message'], description: 'Commit message' },
              ],
            },
            {
              name: 'checkout',
              description: 'Switch branches',
            },
          ],
        };
      }
      return null;
    };
    const fig = new FigCompletionProvider(mockLoader);

    // Root command: "l" -> "ls"
    const lState = createCommandLineState('l', 1);
    const lCtx = extractCompletionContext(lState, '/workspace');
    const lResults = await fig.getSuggestions(lCtx);
    assert(lResults.some((r) => r.label === 'ls'), 'Suggests "ls" when typing "l"');

    // Root command: "pw" -> "pwd"
    const pwState = createCommandLineState('pw', 2);
    const pwCtx = extractCompletionContext(pwState, '/workspace');
    const pwResults = await fig.getSuggestions(pwCtx);
    assert(pwResults.some((r) => r.label === 'pwd'), 'Suggests "pwd" when typing "pw"');

    // Root command: "gi" -> "git"
    const rootState = createCommandLineState('gi', 2);
    const rootCtx = extractCompletionContext(rootState, '/workspace');
    const rootResults = await fig.getSuggestions(rootCtx);
    assert(rootResults.some((r) => r.label === 'git'), 'Suggests root command "git"');

    // Subcommand: "git ch"
    const subState = createCommandLineState('git ch', 6);
    const subCtx = extractCompletionContext(subState, '/workspace');
    const subResults = await fig.getSuggestions(subCtx);
    assert(subResults.some((r) => r.label === 'checkout'), 'Suggests subcommand "checkout"');

    // Options: "git commit --"
    const optState = createCommandLineState('git commit --', 13);
    const optCtx = extractCompletionContext(optState, '/workspace');
    const optResults = await fig.getSuggestions(optCtx);
    assert(optResults.some((r) => r.label === '--amend'), 'Suggests option "--amend"');
    assert(optResults.some((r) => r.label === '--message'), 'Suggests option "--message"');
  }

  // 6. Git & PackageJson Providers
  console.log('\n6. Git & PackageJson Providers');
  {
    const mockBranches = async () => ['main', 'feature/auth', 'develop'];
    const git = new GitCompletionProvider(mockBranches);
    const gitState = createCommandLineState('git checkout fea', 16);
    const gitCtx = extractCompletionContext(gitState, '/workspace');
    const gitResults = await git.getSuggestions(gitCtx);
    assert(gitResults.length === 1 && gitResults[0].label === 'feature/auth', 'Git suggests branch feature/auth');

    const mockPkg = async () => ({
      scripts: {
        dev: 'vite',
        build: 'vite build',
        test: 'jest',
      },
    });
    const pkg = new PackageJsonCompletionProvider(mockPkg);
    const pkgState = createCommandLineState('npm run bu', 10);
    const pkgCtx = extractCompletionContext(pkgState, '/workspace');
    const pkgResults = await pkg.getSuggestions(pkgCtx);
    assert(pkgResults.length === 1 && pkgResults[0].label === 'build', 'PackageJson suggests npm script "build"');
  }

  // 7. Ranking, Mode & Cancellation
  console.log('\n7. Ranking, Mode & Cancellation');
  {
    const ctx = extractCompletionContext(createCommandLineState('git status', 10), '/workspace');
    const exact = scoreCompletionItem({ label: 'status', insertText: 'status', type: 'subcommand' }, ctx);
    const prefix = scoreCompletionItem({ label: 'status-all', insertText: 'status-all', type: 'subcommand' }, ctx);
    assert(exact > prefix, 'Exact match scores higher than prefix match');

    // Ghost mode determination
    const ghostCtx = extractCompletionContext(createCommandLineState('git sta', 7), '/workspace');
    const ghostRes = determineCompletionMode(
      [{ label: 'status', insertText: 'status', type: 'subcommand', score: 150 }],
      ghostCtx,
    );
    assert(ghostRes.mode === 'ghost', 'Single strong match yields ghost mode');
    assert(ghostRes.ghostSuffix === 'tus', 'Ghost suffix is "tus"');

    // Dropdown mode determination
    const dropCtx = extractCompletionContext(createCommandLineState('git ch', 6), '/workspace');
    const dropRes = determineCompletionMode(
      [
        { label: 'checkout', insertText: 'checkout', type: 'subcommand', score: 100 },
        { label: 'cherry-pick', insertText: 'cherry-pick', type: 'subcommand', score: 95 },
      ],
      dropCtx,
    );
    assert(dropRes.mode === 'dropdown', 'Multiple competitive matches yield dropdown mode');

    // CompletionEngine versioning & cancellation
    const engine = new CompletionEngine();
    const c1 = extractCompletionContext(createCommandLineState('git s', 5), '/workspace');
    const c2 = extractCompletionContext(createCommandLineState('git st', 6), '/workspace');
    const p1 = engine.complete(c1);
    const p2 = engine.complete(c2);
    const [r1, r2] = await Promise.all([p1, p2]);
    assert(r1 === null, 'Outdated completion request is cancelled (returns null)');
    assert(r2 !== null, 'Latest completion request succeeds');
  }

  console.log(`\n========================================`);
  console.log(`Test Summary: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
