import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { readReleaseChecksum } from './read-release-checksum.ts';

function setupTest() {
  const zip = {
    name: 'tool_windows_amd64.zip',
    url: 'https://example.test/zip',
    sha256: 'fromdigest',
  };

  const sums = { name: 'tool_checksums.txt', url: 'https://example.test/sums', sha256: null };

  return { zip, sums };
}

test('it reads the line of the asset in the checksum file', async () => {
  const ctx = setupTest();

  network.use(
    http.get('https://example.test/sums', () =>
      HttpResponse.text('AAA  tool_linux_amd64.tar.gz\nBBB  tool_windows_amd64.zip\n'),
    ),
  );

  const result = await readReleaseChecksum({ tag: 'v1', assets: [ctx.zip, ctx.sums] }, ctx.zip);

  expect(result).toBe('bbb');
});

test('it falls back to the GitHub digest when the release has no checksum file', async () => {
  const ctx = setupTest();

  const result = await readReleaseChecksum({ tag: 'v1', assets: [ctx.zip] }, ctx.zip);

  expect(result).toBe('fromdigest');
});

test('it returns null when nothing publishes a checksum', async () => {
  const ctx = setupTest();
  const bare = { ...ctx.zip, sha256: null };

  const result = await readReleaseChecksum({ tag: 'v1', assets: [bare] }, bare);

  expect(result).toBeNull();
});
