import assert from 'node:assert';
import test, { describe } from 'node:test';
import { parseGitLogRefs } from '../gitRefParser';
import type { GitRemote } from '../gitRemote';

describe('gitRefParser', () => {
  const remotes: GitRemote[] = [
    {
      name: 'origin',
      fetchUrl: 'https://github.com/org/repo.git',
      pushUrl: 'https://github.com/org/repo.git',
      branches: ['master', 'dev'],
    },
    {
      name: 'upstream',
      fetchUrl: 'https://github.com/upstream/repo.git',
      pushUrl: 'https://github.com/upstream/repo.git',
      branches: ['master'],
    },
  ];

  test('merges HEAD -> master, origin/master and filters origin/HEAD into a single unified branch chip', () => {
    const raw = 'HEAD -> master, origin/master, origin/HEAD';
    const items = parseGitLogRefs(raw, remotes);

    assert.strictEqual(items.length, 1);
    const branch = items[0];
    assert.strictEqual(branch.type, 'branch');
    if (branch.type === 'branch') {
      assert.strictEqual(branch.branchName, 'master');
      assert.strictEqual(branch.isHead, true);
      assert.strictEqual(branch.isLocal, true);
      assert.strictEqual(branch.isRemote, true);
      assert.deepStrictEqual(branch.remotes, ['origin']);
      assert.strictEqual(branch.remoteUrl, 'https://github.com/org/repo.git');
    }
  });

  test('merges local and remote branches with slashes in branch name', () => {
    const raw = 'HEAD -> securekit/fix/CWE-400, origin/securekit/fix/CWE-400';
    const items = parseGitLogRefs(raw, remotes);

    assert.strictEqual(items.length, 1);
    const branch = items[0];
    assert.strictEqual(branch.type, 'branch');
    if (branch.type === 'branch') {
      assert.strictEqual(branch.branchName, 'securekit/fix/CWE-400');
      assert.strictEqual(branch.isHead, true);
      assert.strictEqual(branch.isLocal, true);
      assert.strictEqual(branch.isRemote, true);
      assert.deepStrictEqual(branch.remotes, ['origin']);
    }
  });

  test('correctly identifies local-only branch', () => {
    const raw = 'linked-master';
    const items = parseGitLogRefs(raw, remotes);

    assert.strictEqual(items.length, 1);
    const branch = items[0];
    assert.strictEqual(branch.type, 'branch');
    if (branch.type === 'branch') {
      assert.strictEqual(branch.branchName, 'linked-master');
      assert.strictEqual(branch.isHead, false);
      assert.strictEqual(branch.isLocal, true);
      assert.strictEqual(branch.isRemote, false);
      assert.deepStrictEqual(branch.remotes, []);
    }
  });

  test('correctly identifies remote-only branch', () => {
    const raw = 'origin/feature-auth';
    const items = parseGitLogRefs(raw, remotes);

    assert.strictEqual(items.length, 1);
    const branch = items[0];
    assert.strictEqual(branch.type, 'branch');
    if (branch.type === 'branch') {
      assert.strictEqual(branch.branchName, 'feature-auth');
      assert.strictEqual(branch.isHead, false);
      assert.strictEqual(branch.isLocal, false);
      assert.strictEqual(branch.isRemote, true);
      assert.deepStrictEqual(branch.remotes, ['origin']);
    }
  });

  test('combines multiple remotes pointing to the same branch commit', () => {
    const raw = 'master, origin/master, upstream/master';
    const items = parseGitLogRefs(raw, remotes);

    assert.strictEqual(items.length, 1);
    const branch = items[0];
    assert.strictEqual(branch.type, 'branch');
    if (branch.type === 'branch') {
      assert.strictEqual(branch.branchName, 'master');
      assert.strictEqual(branch.isLocal, true);
      assert.strictEqual(branch.isRemote, true);
      assert.deepStrictEqual(branch.remotes, ['origin', 'upstream']);
    }
  });

  test('parses tags, stashes, and detached HEAD properly', () => {
    const raw = 'HEAD, tag: v1.0.0, refs/stash';
    const items = parseGitLogRefs(raw, remotes);

    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].type, 'head');
    assert.strictEqual(items[1].type, 'stash');
    if (items[1].type === 'stash') {
      assert.strictEqual(items[1].stashName, 'stash@{0}');
    }
    assert.strictEqual(items[2].type, 'tag');
    if (items[2].type === 'tag') {
      assert.strictEqual(items[2].tagName, 'v1.0.0');
    }
  });

  test('returns empty array when value is empty or only symbolic remote HEADs', () => {
    assert.deepStrictEqual(parseGitLogRefs(''), []);
    assert.deepStrictEqual(parseGitLogRefs('origin/HEAD', remotes), []);
  });
});
