import assert from 'node:assert';
import test, { describe } from 'node:test';
import gitMainService from '../gitMainService';

describe('Git Tag Operations', () => {
  describe('deleteTagLocally', () => {
    test('rejects empty repository directory', async () => {
      const result = await gitMainService.deleteTagLocally('', 'v1.0.0');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /no repository directory/i);
    });

    test('rejects empty or whitespace-only tag name', async () => {
      const result = await gitMainService.deleteTagLocally(process.cwd(), '   ');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /enter a tag name/i);
    });

    test('rejects invalid tag name containing forbidden characters', async () => {
      const result = await gitMainService.deleteTagLocally(process.cwd(), 'tag with spaces');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /invalid tag name/i);
    });
  });

  describe('deleteTagRemotely', () => {
    test('rejects empty repository directory', async () => {
      const result = await gitMainService.deleteTagRemotely('', 'v1.0.0', 'origin');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /no repository directory/i);
    });

    test('rejects empty tag name', async () => {
      const result = await gitMainService.deleteTagRemotely(process.cwd(), '', 'origin');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /enter a tag name/i);
    });

    test('rejects invalid tag name format', async () => {
      const result = await gitMainService.deleteTagRemotely(process.cwd(), 'invalid:tag', 'origin');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /invalid tag name/i);
    });
  });

  describe('pushTag', () => {
    test('rejects empty repository directory', async () => {
      const result = await gitMainService.pushTag('', 'v1.0.0', 'origin');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /no repository directory/i);
    });

    test('rejects empty tag name', async () => {
      const result = await gitMainService.pushTag(process.cwd(), '   ', 'origin');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /enter a tag name/i);
    });

    test('rejects invalid tag name with ref syntax errors', async () => {
      const result = await gitMainService.pushTag(process.cwd(), 'v1..0', 'origin');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /invalid tag name/i);
    });
  });

  describe('deleteTagBoth', () => {
    test('rejects empty repository directory', async () => {
      const result = await gitMainService.deleteTagBoth('', 'v1.0.0', 'origin');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /no repository directory/i);
    });

    test('rejects empty tag name', async () => {
      const result = await gitMainService.deleteTagBoth(process.cwd(), '   ', 'origin');
      assert.strictEqual(result.ok, false);
      assert.match((!result.ok && result.error) || '', /enter a tag name/i);
    });
  });

  describe('getTagStatuses', () => {
    test('returns empty array when directory is empty', async () => {
      const result = await gitMainService.getTagStatuses('');
      assert.deepStrictEqual(result, []);
    });

    test('retrieves tag statuses for current repository directory', async () => {
      const result = await gitMainService.getTagStatuses(process.cwd());
      assert.ok(Array.isArray(result));
      if (result.length > 0) {
        const first = result[0];
        assert.ok(typeof first.name === 'string');
        assert.ok(typeof first.isLocal === 'boolean');
        assert.ok(typeof first.isRemote === 'boolean');
        assert.ok(Array.isArray(first.remotes));
      }
    });
  });
});
