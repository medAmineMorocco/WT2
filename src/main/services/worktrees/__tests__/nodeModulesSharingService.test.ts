import assert from 'node:assert';
import test, { describe, beforeEach, afterEach } from 'node:test';
import fs from 'fs/promises';
import { existsSync, lstatSync } from 'fs';
import path from 'path';
import os from 'os';
import {
  hasNodeModules,
  linkNodeModules,
  getWorktreesWithNodeModules,
} from '../nodeModulesSharingService';

describe('nodeModulesSharingService', () => {
  let tempDir: string;
  let mainRepoDir: string;
  let worktreeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ww-nm-test-'));
    mainRepoDir = path.join(tempDir, 'main-repo');
    worktreeDir = path.join(tempDir, 'worktree-1');
    await fs.mkdir(mainRepoDir, { recursive: true });
    await fs.mkdir(worktreeDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('hasNodeModules', () => {
    test('returns false when directory does not exist or has no node_modules', async () => {
      assert.strictEqual(await hasNodeModules(mainRepoDir), false);
      assert.strictEqual(await hasNodeModules(''), false);
    });

    test('returns true when node_modules directory exists', async () => {
      const nmPath = path.join(mainRepoDir, 'node_modules');
      await fs.mkdir(nmPath);
      assert.strictEqual(await hasNodeModules(mainRepoDir), true);
    });
  });

  describe('linkNodeModules', () => {
    test('creates a valid link to source node_modules', async () => {
      const sourceNm = path.join(mainRepoDir, 'node_modules');
      await fs.mkdir(sourceNm);
      // create a dummy file inside node_modules to verify access through link
      await fs.writeFile(path.join(sourceNm, 'package.json'), '{"name":"test"}');

      await linkNodeModules(mainRepoDir, worktreeDir);

      const targetNm = path.join(worktreeDir, 'node_modules');
      assert.ok(existsSync(targetNm));
      const stat = lstatSync(targetNm);
      assert.ok(stat.isSymbolicLink() || stat.isDirectory());

      const content = await fs.readFile(
        path.join(targetNm, 'package.json'),
        'utf8',
      );
      assert.strictEqual(content, '{"name":"test"}');
    });

    test('throws error if source node_modules does not exist', async () => {
      await assert.rejects(
        async () => {
          await linkNodeModules(mainRepoDir, worktreeDir);
        },
        /Cannot share node_modules: source directory does not exist/,
      );
    });

    test('throws error if destination node_modules already exists', async () => {
      const sourceNm = path.join(mainRepoDir, 'node_modules');
      await fs.mkdir(sourceNm);
      const targetNm = path.join(worktreeDir, 'node_modules');
      await fs.mkdir(targetNm);

      await assert.rejects(
        async () => {
          await linkNodeModules(mainRepoDir, worktreeDir);
        },
        /Cannot share node_modules: destination already exists/,
      );
    });
  });

  describe('getWorktreesWithNodeModules', () => {
    test('returns empty array if no node_modules exists', async () => {
      const result = await getWorktreesWithNodeModules(mainRepoDir);
      assert.deepStrictEqual(result, []);
    });

    test('returns main project if node_modules exists in main project', async () => {
      await fs.mkdir(path.join(mainRepoDir, 'node_modules'));
      const result = await getWorktreesWithNodeModules(mainRepoDir);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].path, mainRepoDir);
      assert.strictEqual(result[0].isPrimary, true);
    });
  });
});
