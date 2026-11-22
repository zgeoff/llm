import { buildGGUFBytes } from './build-gguf-bytes.ts';

// Writes a GGUF file whose only metadata is the chat template, creating the folders on the way.
export async function createStubModelFile(path: string, chatTemplate: string): Promise<void> {
  await Bun.write(
    path,
    buildGGUFBytes([
      { key: 'tokenizer.chat_template', value: { type: 'string', value: chatTemplate } },
    ]),
  );
}
