import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { readRepoFiles } from './read-repo-files.ts';

function setupTest() {
  const digest = 'a'.repeat(64);

  return { digest };
}

test('it lists the LFS files with their size and SHA256', async () => {
  const ctx = setupTest();

  network.use(
    http.get('https://huggingface.co/api/models/example-org/example-GGUF/tree/main', () =>
      HttpResponse.json([
        { type: 'file', path: 'README.md', size: 100 },
        {
          type: 'file',
          path: 'model.gguf',
          size: 135,
          lfs: { oid: ctx.digest, size: 12_000_000_000, pointerSize: 135 },
        },
        { type: 'directory', path: 'extras', size: 0 },
      ]),
    ),
  );

  const files = await readRepoFiles('example-org/example-GGUF');

  expect([...files]).toStrictEqual([
    ['model.gguf', { sizeBytes: 12_000_000_000, sha256: ctx.digest }],
  ]);
});

test('it rejects a repo that Hugging Face does not know', () => {
  network.use(
    http.get(
      'https://huggingface.co/api/models/example-org/missing/tree/main',
      () => new HttpResponse(null, { status: 404 }),
    ),
  );

  expect(readRepoFiles('example-org/missing')).rejects.toThrow(
    'Hugging Face answered 404 for the file list of example-org/missing',
  );
});

test('it rejects a file list in a shape it cannot read', () => {
  network.use(
    http.get('https://huggingface.co/api/models/example-org/odd/tree/main', () =>
      HttpResponse.json({ error: 'not a list' }),
    ),
  );

  expect(readRepoFiles('example-org/odd')).rejects.toThrow('cannot read');
});
