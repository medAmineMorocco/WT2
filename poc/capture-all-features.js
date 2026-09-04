const fs = require('fs');
const path = require('path');

const PLAYWRIGHT_CORE =
  'C:\\Users\\moham\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright-core';
const { _electron: electron } = require(PLAYWRIGHT_CORE);

const APP_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(APP_DIR, 'poc', 'screenshots');
const ELECTRON_EXE = path.join(
  APP_DIR,
  'node_modules',
  'electron',
  'dist',
  'electron.exe',
);

async function waitForReady(page) {
  await page.getByText('Worktrees', { exact: true }).waitFor({ timeout: 45_000 });
  await page.locator('.worktrees-panel-header').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Reload Git Log' }).waitFor({
    state: 'visible',
    timeout: 45_000,
  });
}

async function hideAuthorColumn(page) {
  if (await page.locator('.terminal-workspace-modal').isVisible().catch(() => false)) {
    return;
  }
  const visibleAuthorHeader = page.locator('.git-log-list-header').getByText(
    'Author',
    { exact: true },
  );
  if (!(await visibleAuthorHeader.count())) return;
  const columnsButton = page.getByRole('button', { name: 'Columns' });
  if (!(await columnsButton.isVisible().catch(() => false))) return;
  await columnsButton.click();
  const authorCheckbox = page.getByRole('checkbox', { name: 'Author' });
  await authorCheckbox.waitFor({ state: 'visible' });
  if (await authorCheckbox.isChecked()) {
    await page.locator('.git-log-columns-menu').getByText('Author', {
      exact: true,
    }).click();
  }
  if (await authorCheckbox.isChecked()) {
    throw new Error('Unable to disable the Git Log Author column.');
  }
  await columnsButton.click();
  await visibleAuthorHeader
    .waitFor({ state: 'detached', timeout: 5_000 })
    .catch(async () => {
      if (await visibleAuthorHeader.count()) {
        throw new Error('Refusing screenshot: Git Log Author column is visible.');
      }
    });
}

async function screenshot(page, filename) {
  await hideAuthorColumn(page);
  if (
    (await page.locator('.commit-column-author').count()) ||
    (await page.locator('.git-log-list-header').getByText('Author', {
      exact: true,
    }).count())
  ) {
    throw new Error(`Refusing ${filename}: Author column is visible.`);
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename) });
  console.log(filename);
}

async function closeOverlay(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function captureCreateWorktree(page) {
  await page.locator('.worktrees-panel-header button.ant-btn-primary').click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await screenshot(page, '07-create-worktree-from-head.png');

  const name = page.getByRole('textbox', { name: 'Name' });
  await name.fill('feature-marketing-preview');
  await screenshot(page, '08-create-worktree-configured.png');

  await page.getByRole('textbox', { name: 'Pre-hook' }).fill('git fetch origin');
  await page.getByRole('textbox', { name: 'Post-hook' }).fill('npm install');
  await screenshot(page, '09-create-worktree-hooks.png');
  await page.getByRole('textbox', { name: 'Pre-hook' }).clear();
  await page.getByRole('textbox', { name: 'Post-hook' }).clear();

  await page.getByText('Selected folders', { exact: true }).click();
  await page.getByText('Choose folders', { exact: true }).waitFor();
  await page.getByText('Inspecting repository folders…', { exact: true })
    .waitFor({ state: 'hidden', timeout: 30_000 });
  const sparseFolderCheckboxes = page.locator(
    '.sparse-checkout-tree-wrap .ant-tree-checkbox',
  );
  await sparseFolderCheckboxes.first().waitFor({ state: 'visible' });
  const sparseFolderCount = await sparseFolderCheckboxes.count();
  await sparseFolderCheckboxes.nth(0).click();
  if (sparseFolderCount > 1) await sparseFolderCheckboxes.nth(1).click();
  await screenshot(page, '10-create-worktree-sparse-checkout.png');
  await page.getByText('Full repository', { exact: true }).click();

  const shareModules = page.getByRole('checkbox', { name: 'Share node_modules' });
  if (await shareModules.isVisible().catch(() => false)) {
    await shareModules.check();
    await screenshot(page, '11-create-worktree-share-node-modules.png');
    await shareModules.uncheck();
  }

  const isolateEnvironment = page.getByRole('checkbox', { name: 'Isolate environment' });
  await isolateEnvironment.check();
  await page.getByText('Environment sources', { exact: true }).waitFor();
  await screenshot(page, '12-create-worktree-environment-isolation.png');
  await isolateEnvironment.uncheck();

  await page.getByText('From Branch', { exact: true }).click();
  await page.getByText('Local branch', { exact: true }).waitFor();
  await screenshot(page, '13-create-worktree-from-local-branch.png');
  await page.getByRole('switch').click();
  await page.getByText('Remote branch', { exact: true }).waitFor();
  await screenshot(page, '14-create-worktree-from-remote-branch.png');

  await page.getByText('From Tag', { exact: true }).click();
  await page.getByText('Existing tag', { exact: true }).waitFor();
  await screenshot(page, '15-create-worktree-from-tag.png');
  await closeOverlay(page);
  await dialog.waitFor({ state: 'hidden' });
}

async function captureSettings(page) {
  await page.keyboard.press('Shift+S');
  await page.getByText('Exit Settings', { exact: true }).waitFor();
  const entries = [
    ['Worktrees', '30-settings-worktrees.png'],
    ['Editors', '31-settings-editors.png'],
    ['AI Agents', '32-settings-ai-agents.png'],
    ['Shell', '33-settings-shell.png'],
    ['Git', '34-settings-git.png'],
    ['Encoding', '35-settings-encoding.png'],
  ];
  for (const [label, filename] of entries) {
    await page.getByRole('menuitem', { name: label }).click();
    await page.waitForTimeout(500);
    await screenshot(page, filename);
  }
  await page.getByRole('menuitem', { name: 'Exit Settings' }).click();
  await page.getByText('Worktrees', { exact: true }).waitFor();
}

async function openDemoWorktreeActions(page) {
  const item = page.locator('.worktree-item').filter({
    hasText: 'codex-create-worktree-demo',
  }).first();
  const target = (await item.count()) ? item : page.locator('.worktree-item').nth(1);
  await target.locator('svg').last().click();
  await page.getByText('Open in Explorer', { exact: true }).waitFor();
}

async function captureWorktreeActions(page) {
  await openDemoWorktreeActions(page);
  await screenshot(page, '16-worktree-actions.png');

  await page.getByText('Open in', { exact: true }).hover();
  await page.waitForTimeout(250);
  await screenshot(page, '17-worktree-actions-editors.png');
  await closeOverlay(page);

  await openDemoWorktreeActions(page);
  await page.getByText('Copy', { exact: true }).hover();
  await page.waitForTimeout(250);
  await screenshot(page, '18-worktree-actions-copy.png');
  await closeOverlay(page);

  await openDemoWorktreeActions(page);
  await page.getByText('Delete', { exact: true }).hover();
  await page.waitForTimeout(250);
  await screenshot(page, '18b-worktree-actions-delete-options.png');
  await closeOverlay(page);

  const dialogs = [
    ['Rename', '19-worktree-rename.png'],
    ['Change Naming Pattern', '20-worktree-change-pattern.png'],
    ['Move', '21-worktree-move.png'],
    ['Lock', '22-worktree-lock.png'],
  ];
  for (const [action, filename] of dialogs) {
    await openDemoWorktreeActions(page);
    await page.getByText(action, { exact: true }).last().click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    if (action === 'Rename') {
      await page.getByRole('textbox', { name: 'Name' }).fill(
        'codex-refactor-auth-flow',
      );
    } else if (action === 'Change Naming Pattern') {
      await page.getByRole('combobox', { name: 'Pattern' }).fill(
        '{repo}__feature__{branch}',
      );
      await page.waitForTimeout(400);
    } else if (action === 'Lock') {
      await page.getByRole('textbox', { name: 'Reason' }).fill(
        'Preserve this worktree for the release candidate review',
      );
    }
    await screenshot(page, filename);
    await closeOverlay(page);
    if (await page.getByRole('dialog').isVisible().catch(() => false)) {
      await page.locator('.ant-modal-wrap').last().click({ position: { x: 5, y: 5 } });
    }
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
}

async function addTerminalPane(page, optionIndex) {
  await page.locator('.terminal-add-select').click();
  const options = page.locator(
    '.ant-select-dropdown:visible .ant-select-item-option:not(.ant-select-item-option-disabled)',
  );
  await options.first().waitFor({ state: 'visible' });
  await options.nth(optionIndex % (await options.count())).evaluate((option) => {
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    option.click();
  });
}

async function captureTerminalAndAgentWorkspaces(page) {
  await openDemoWorktreeActions(page);
  await page.getByText('Open in Terminal', { exact: true }).click();
  await page.getByText('Terminal workspace', { exact: true }).waitFor();
  await page.locator('.terminal-pane').first().waitFor({ state: 'visible' });
  await addTerminalPane(page, 0);
  await addTerminalPane(page, 1);
  await page.getByText('3 open', { exact: true }).waitFor();
  await page.locator('.terminal-workspace-toolbar .ant-segmented-item-label')
    .getByText('3', { exact: true }).click();
  await page.waitForTimeout(1_000);
  await screenshot(page, '23-multiple-terminals.png');
  await page.getByRole('button', { name: 'Close terminal workspace' }).click();
  await page.getByText('Terminal workspace', { exact: true }).waitFor({ state: 'hidden' });

  await openDemoWorktreeActions(page);
  await page.getByText('Work with AI Agent', { exact: true }).click();
  await page.getByText('Terminal workspace', { exact: true }).waitFor();
  const agentSelectors = page.getByRole('combobox', {
    name: 'AI agent for this terminal',
  });
  await agentSelectors.first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const select = document.querySelector('.terminal-agent-select');
    return select && !select.classList.contains('ant-select-disabled');
  }, null, { timeout: 30_000 });
  await addTerminalPane(page, 0);
  await addTerminalPane(page, 1);
  await page.getByText('3 open', { exact: true }).waitFor();
  await page.locator('.terminal-workspace-toolbar .ant-segmented-item-label')
    .getByText('3', { exact: true }).click();
  await page.getByRole('combobox', { name: 'AI agent for this terminal' })
    .nth(2).waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await screenshot(page, '24-multiple-ai-agents.png');
  await page.getByRole('button', { name: 'Close terminal workspace' }).click();
  await page.getByText('Terminal workspace', { exact: true }).waitFor({ state: 'hidden' });
}

async function capturePruneReview(page) {
  await page.keyboard.press('Shift+P');
  await page.getByText('Review Damaged Worktrees', { exact: true })
    .waitFor({ state: 'visible', timeout: 30_000 });
  await screenshot(page, '25-prune-worktrees.png');
  await closeOverlay(page);
}

async function main() {
  if (process.env.CAPTURE_MISSING_ONLY !== '1') {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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
    const browserWindow = await app.browserWindow(page);
    await browserWindow.evaluate((win) => win.setContentSize(1600, 950));
    await page.setViewportSize({ width: 1600, height: 950 });
    await waitForReady(page);
    await hideAuthorColumn(page);

    if (process.env.CAPTURE_MISSING_ONLY === '1') {
      await page.getByText('Workflow', { exact: true }).last().click();
      await page.getByText('Workflows', { exact: true }).waitFor();
      const workflowRow = page.locator('.ant-table-row').filter({ hasText: 'eslint' }).first();
      await workflowRow.locator('td').last().locator('svg').nth(2).click();
      await page.getByText('Edit Workflow', { exact: true }).waitFor();
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const wrapper = document.querySelector(
          '.ant-drawer-open .ant-drawer-content-wrapper',
        );
        if (wrapper) {
          wrapper.style.setProperty('width', '420px', 'important');
          wrapper.style.setProperty('right', '0', 'important');
          wrapper.style.setProperty('transform', 'none', 'important');
        }
      });
      await screenshot(page, '06d-edit-workflow.png');
      await page.locator('.ant-drawer-close').click();
      await page.locator('.worktree-mode-selector').getByText('Git Log', { exact: true }).click();
      await page.getByRole('button', { name: 'Reload Git Log' }).waitFor();
      await hideAuthorColumn(page);
      await captureTerminalAndAgentWorkspaces(page);
      await capturePruneReview(page);
      return;
    }

    await screenshot(page, '01-git-log.png');
    await page.getByRole('button', { name: 'Columns' }).click();
    await screenshot(page, '02-git-log-columns.png');
    await page.getByRole('button', { name: 'Columns' }).click();

    await page.keyboard.press('Shift+D');
    await page.getByText('Git Diff', { exact: true }).waitFor();
    await screenshot(page, '03-git-diff.png');
    await closeOverlay(page);

    await page.getByText('Overview', { exact: true }).last().click();
    await page.getByText('All worktrees', { exact: true }).waitFor();
    await page.locator('.worktree-overview-title').getByText('Loading', { exact: true })
      .waitFor({ state: 'hidden', timeout: 45_000 });
    await page.locator('.worktree-overview tbody .ant-table-row').first()
      .waitFor({ state: 'visible', timeout: 45_000 });
    await page.getByText('Calculating…', { exact: true }).first()
      .waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => {});
    await screenshot(page, '04-worktree-overview.png');

    await page.getByText('Workflow', { exact: true }).last().click();
    await page.getByText('Workflows', { exact: true }).waitFor();
    await screenshot(page, '05-workflows.png');
    await page.getByRole('button', { name: 'plus Add', exact: true }).click();
    await page.getByText('Add New Workflow', { exact: true }).waitFor();
    await screenshot(page, '06-add-workflow.png');
    await page.getByRole('textbox', { name: 'Name' }).fill('Quality checks');
    await page.getByRole('textbox', { name: 'Command(s)' }).fill('npm test');
    await page.getByRole('button', { name: 'plus Add Command' }).click();
    await page.locator('.ant-drawer input').last().fill('npm run lint');
    await screenshot(page, '06b-add-workflow-configured.png');
    await page.locator('.ant-drawer-close').click();
    await page.locator('.ant-drawer-open').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'upload Import' }).hover();
    await page.getByText('Import Workflow', { exact: true }).waitFor();
    await screenshot(page, '06c-import-workflow-action.png');
    const firstWorkflowRow = page.locator('.ant-table-row').filter({ hasText: 'eslint' }).first();
    await firstWorkflowRow.locator('td').last().locator('svg').nth(2).click();
    await page.getByText('Edit Workflow', { exact: true }).waitFor();
    await page.locator('.ant-drawer-content-wrapper').waitFor({ state: 'visible' });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const wrapper = document.querySelector(
        '.ant-drawer-open .ant-drawer-content-wrapper',
      );
      if (wrapper) {
        wrapper.style.setProperty('width', '420px', 'important');
        wrapper.style.setProperty('right', '0', 'important');
        wrapper.style.setProperty('transform', 'none', 'important');
      }
    });
    await screenshot(page, '06d-edit-workflow.png');
    await page.locator('.ant-drawer-close').click();
    await page.locator('.ant-drawer-open').waitFor({ state: 'detached' });

    await page.locator('.worktree-mode-selector').getByText('Git Log', { exact: true }).click();
    await page.getByRole('button', { name: 'Reload Git Log' }).waitFor();
    await hideAuthorColumn(page);
    await captureCreateWorktree(page);

    await captureWorktreeActions(page);

    await captureTerminalAndAgentWorkspaces(page);
    await capturePruneReview(page);

    await page.keyboard.press('Shift+K');
    await page.getByText('Keyboard Shortcuts', { exact: false }).waitFor();
    await screenshot(page, '26-keyboard-shortcuts-general.png');
    await page.getByText('Worktree', { exact: true }).last().click();
    await screenshot(page, '27-keyboard-shortcuts-worktree.png');
    await page.getByText('Workflow', { exact: true }).last().click();
    await screenshot(page, '28-keyboard-shortcuts-workflow.png');
    await closeOverlay(page);

    await captureSettings(page);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  fs.writeFileSync(
    path.join(APP_DIR, 'poc', 'capture-errors.log'),
    `${error?.stack || error}\n`,
  );
  process.exitCode = 1;
});
