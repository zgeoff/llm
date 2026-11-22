import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { readGitHubRelease } from './read-github-release.ts';

function setupTest() {
  const asset = {
    name: 'a.zip',
    browser_download_url: 'https://example.test/a.zip',
    digest: 'sha256:abc123',
  };

  return { asset };
}

test('it picks the newest release that has assets', async () => {
  const ctx = setupTest();

  network.use(
    http.get('https://api.github.com/repos/owner/tool/releases', () =>
      HttpResponse.json([
        { tag_name: 'b3', assets: [] },
        { tag_name: 'b2', assets: [ctx.asset] },
      ]),
    ),
  );

  const result = await readGitHubRelease('owner/tool', null);

  expect(result).toStrictEqual({
    tag: 'b2',
    assets: [{ name: 'a.zip', url: 'https://example.test/a.zip', sha256: 'abc123' }],
  });
});

test('it reads the release of a tag, with no digest as null', async () => {
  network.use(
    http.get('https://api.github.com/repos/owner/tool/releases/tags/v9', () =>
      HttpResponse.json({
        tag_name: 'v9',
        assets: [{ name: 'b.zip', browser_download_url: 'https://example.test/b.zip' }],
      }),
    ),
  );

  const result = await readGitHubRelease('owner/tool', 'v9');

  expect(result).toStrictEqual({
    tag: 'v9',
    assets: [{ name: 'b.zip', url: 'https://example.test/b.zip', sha256: null }],
  });
});

test('it rejects a tag that GitHub does not find', () => {
  network.use(
    http.get('https://api.github.com/repos/owner/tool/releases/tags/v0', () =>
      HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
    ),
  );

  expect(readGitHubRelease('owner/tool', 'v0')).rejects.toThrow('GitHub answered 404');
});
