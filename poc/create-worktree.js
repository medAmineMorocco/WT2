const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const PLAYWRIGHT_CORE =
  'C:\\Users\\moham\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright-core';
const { _electron: electron } = require(PLAYWRIGHT_CORE);

const APP_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(APP_DIR, 'poc', 'artifacts');
const FRAMES_DIR = path.join(OUTPUT_DIR, 'frames');
const ELECTRON_EXE = path.join(
  APP_DIR,
  'node_modules',
  'electron',
  'dist',
  'electron.exe',
);
const GIT_EXE = 'C:\\Program Files\\Git\\cmd\\git.exe';
const DEMO_BRANCH = 'codex-create-worktree-demo';

function git(args, repoPath = APP_DIR) {
  return execFileSync(GIT_EXE, args, {
    cwd: repoPath,
    encoding: 'utf8',
    stdio: 'pipe',
  }).trim();
}

function cleanDemoWorktree(repoPath) {
  const records = git(['worktree', 'list', '--porcelain'], repoPath)
    .split(/\r?\n\r?\n/)
    .map((record) => Object.fromEntries(
      record.split(/\r?\n/).map((line) => {
        const splitAt = line.indexOf(' ');
        return splitAt === -1
          ? [line, true]
          : [line.slice(0, splitAt), line.slice(splitAt + 1)];
      }),
    ));
  const demo = records.find(
    (record) => record.branch === `refs/heads/${DEMO_BRANCH}`,
  );
  if (demo && demo.worktree) {
    git(['worktree', 'remove', '--force', demo.worktree], repoPath);
  }
  git(['worktree', 'prune'], repoPath);
  const branchExists = spawnSync(
    GIT_EXE,
    ['show-ref', '--verify', '--quiet', `refs/heads/${DEMO_BRANCH}`],
    { cwd: repoPath, stdio: 'ignore' },
  );
  if (branchExists.status === 0) {
    git(['branch', '-D', DEMO_BRANCH], repoPath);
  }
}

async function waitForReady(page) {
  await page.getByText('Worktrees', { exact: true }).waitFor({ timeout: 45_000 });
  await page.locator('.worktrees-panel-header').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const panel = document.querySelector('.worktrees-panel-header');
    return panel && document.body.innerText.includes('Worktrees');
  });
}

async function startScreencast(page) {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const session = await page.context().newCDPSession(page);
  let frameNumber = 0;
  let acceptingFrames = true;
  const pendingWrites = new Set();
  session.on('Page.screencastFrame', ({ data, sessionId }) => {
    if (acceptingFrames) {
      frameNumber += 1;
      const filename = path.join(
        FRAMES_DIR,
        `frame-${String(frameNumber).padStart(5, '0')}.jpg`,
      );
      const write = fs.promises.writeFile(filename, Buffer.from(data, 'base64'));
      pendingWrites.add(write);
      write.finally(() => pendingWrites.delete(write));
    }
    session.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await session.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 90,
    maxWidth: 1440,
    maxHeight: 900,
    everyNthFrame: 1,
  });
  return async () => {
    acceptingFrames = false;
    await session.send('Page.stopScreencast');
    await Promise.all([...pendingWrites]);
    if (frameNumber < 2) {
      throw new Error(`Screencast produced only ${frameNumber} frame(s)`);
    }
    return frameNumber;
  };
}

async function runScenario(runNumber, captureMedia) {
  const app = await electron.launch({
    executablePath: ELECTRON_EXE,
    args: ['.'],
    cwd: APP_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
    timeout: 45_000,
  });
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForReady(page);
    const repoPath = await page.evaluate(() => {
      const activeTab = window.localStorage.getItem('activeTab') || 'tab1';
      const tab = JSON.parse(window.localStorage.getItem(activeTab) || '{}');
      return tab.selectedRepoPath;
    });
    if (!repoPath || !fs.existsSync(repoPath)) {
      throw new Error(`The active tab has no usable repository path: ${repoPath}`);
    }
    cleanDemoWorktree(repoPath);
    await page.evaluate((selectedRepoPath) => {
      window.electron.ipcRenderer.send('get-worktrees', selectedRepoPath);
    }, repoPath);
    await page.waitForTimeout(500);

    // The visible action advertises Shift+W; using it avoids relying on the
    // icon-only button's generated Ant Design DOM.
    let stopScreencast;
    if (captureMedia) stopScreencast = await startScreencast(page);
    await page.keyboard.press('Shift+W');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await page.waitForTimeout(650);
    if (captureMedia) {
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'create-worktree-dialog.png'),
      });
    }

    const nameInput = page.getByRole('textbox', { name: 'Name' });
    await nameInput.fill(DEMO_BRANCH);
    await page.waitForTimeout(850);
    await page.getByText('Full repository', { exact: true }).click();
    if (captureMedia) {
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'create-worktree-configured.png'),
      });
    }
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: 'Create Worktree', exact: true }).click();

    await dialog.waitFor({ state: 'hidden', timeout: 60_000 });
    await page.getByText(DEMO_BRANCH, { exact: true }).first().waitFor({
      state: 'visible',
      timeout: 30_000,
    });
    await page.waitForTimeout(900);
    if (captureMedia) {
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'create-worktree-result.png'),
      });
      await page.waitForTimeout(900);
      const frameCount = await stopScreencast();
      console.log(`Captured ${frameCount} source frames.`);
    }

    const worktrees = git(['worktree', 'list', '--porcelain'], repoPath);
    if (!worktrees.includes(`branch refs/heads/${DEMO_BRANCH}`)) {
      throw new Error('UI showed the worktree, but Git did not register its branch.');
    }
    console.log(`Run #${runNumber}: PASS`);
  } finally {
    await app.close();
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await runScenario(1, false);
  await runScenario(2, true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
