import assert from 'node:assert';
import test, { afterEach, beforeEach, describe } from 'node:test';
import fs from 'fs/promises';
import { existsSync, lstatSync } from 'fs';
import os from 'os';
import path from 'path';
import { hasPythonVenv, linkPythonVenv } from '../pythonVenvSharingService';

describe('pythonVenvSharingService', () => {
  let tempDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ww-venv-test-'));
    sourceDir = path.join(tempDir, 'main-repo');
    targetDir = path.join(tempDir, 'worktree-1');
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createVenv() {
    const venvPath = path.join(sourceDir, '.venv');
    await fs.mkdir(venvPath);
    await fs.writeFile(path.join(venvPath, 'pyvenv.cfg'), 'home = python');
    await fs.writeFile(path.join(venvPath, 'marker.txt'), 'shared');
  }

  test('detects only a valid .venv directory', async () => {
    assert.strictEqual(await hasPythonVenv(sourceDir), false);
    await fs.mkdir(path.join(sourceDir, '.venv'));
    assert.strictEqual(await hasPythonVenv(sourceDir), false);
    await fs.writeFile(
      path.join(sourceDir, '.venv', 'pyvenv.cfg'),
      'home = python',
    );
    assert.strictEqual(await hasPythonVenv(sourceDir), true);
  });

  test('creates a usable .venv link', async () => {
    await createVenv();
    await linkPythonVenv(sourceDir, targetDir);
    const targetVenv = path.join(targetDir, '.venv');
    assert.ok(existsSync(targetVenv));
    const stat = lstatSync(targetVenv);
    assert.ok(stat.isSymbolicLink() || stat.isDirectory());
    assert.strictEqual(
      await fs.readFile(path.join(targetVenv, 'marker.txt'), 'utf8'),
      'shared',
    );
  });

  test('rejects missing sources and existing destinations', async () => {
    await assert.rejects(
      () => linkPythonVenv(sourceDir, targetDir),
      /valid Python virtual environment does not exist/,
    );
    await createVenv();
    await fs.mkdir(path.join(targetDir, '.venv'));
    await assert.rejects(
      () => linkPythonVenv(sourceDir, targetDir),
      /destination already exists/,
    );
  });
});
