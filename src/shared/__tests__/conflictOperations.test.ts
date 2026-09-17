import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  CherryPickResolution,
  CherryPickResult,
} from '../cherryPick';
import {
  RevertResolution,
  RevertCommitResult,
} from '../gitResetRevert';

describe('conflictOperations shared contracts', () => {
  describe('cherry-pick contracts', () => {
    test('supports completed cherry-pick result shape', () => {
      const result: CherryPickResult = {
        ok: true,
        status: 'completed',
        commit: '1a2b3c4d',
        targetBranch: 'main',
        output: '[main 1a2b3c4] test commit',
      };
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.status, 'completed');
    });

    test('supports conflicted cherry-pick result shape', () => {
      const result: CherryPickResult = {
        ok: true,
        status: 'conflicts',
        commit: '1a2b3c4d',
        targetBranch: 'main',
        destinationPath: '/path/to/worktree',
        conflictedFiles: ['fileA.txt', 'fileB.ts'],
      };
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.status, 'conflicts');
      assert.strictEqual(result.conflictedFiles.length, 2);
    });

    test('supports failed cherry-pick result shape', () => {
      const result: CherryPickResult = {
        ok: false,
        error: 'The destination worktree has uncommitted changes.',
      };
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'The destination worktree has uncommitted changes.');
    });

    test('accepts valid resolution options', () => {
      const validResolutions: CherryPickResolution[] = ['source', 'target', 'staged'];
      assert.deepStrictEqual(validResolutions, ['source', 'target', 'staged']);
    });
  });

  describe('revert contracts', () => {
    test('supports completed revert result shape', () => {
      const result: RevertCommitResult = {
        ok: true,
        status: 'completed',
        commit: 'abc1234',
        targetBranch: 'feature',
        output: '[feature abc1234] Revert "test"',
      };
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.status, 'completed');
    });

    test('supports conflicted revert result shape', () => {
      const result: RevertCommitResult = {
        ok: true,
        status: 'conflicts',
        commit: 'abc1234',
        targetBranch: 'feature',
        worktreePath: '/path/to/feature',
        conflictedFiles: ['conflict1.txt'],
      };
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.status, 'conflicts');
      assert.strictEqual(result.conflictedFiles.length, 1);
    });

    test('supports failed revert result shape', () => {
      const result: RevertCommitResult = {
        ok: false,
        error: 'Revert failed.',
      };
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'Revert failed.');
    });

    test('accepts valid resolution options', () => {
      const validResolutions: RevertResolution[] = ['source', 'target', 'staged'];
      assert.deepStrictEqual(validResolutions, ['source', 'target', 'staged']);
    });
  });
});
