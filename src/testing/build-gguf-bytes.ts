import { match } from 'ts-pattern';

type GGUFTestValue =
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'uint32'; readonly value: number }
  | { readonly type: 'uint64'; readonly value: number }
  | { readonly type: 'float32'; readonly value: number }
  | { readonly type: 'bool'; readonly value: boolean }
  | { readonly type: 'array'; readonly items: readonly GGUFTestValue[] };

interface GGUFTestEntry {
  readonly key: string;
  readonly value: GGUFTestValue;
}

const typeCodes = { uint32: 4, float32: 6, bool: 7, string: 8, array: 9, uint64: 10 } as const;

// Builds a GGUF version 3 file with the given key-value entries and an empty tensor table.
export function buildGGUFBytes(entries: readonly GGUFTestEntry[]): Uint8Array {
  const parts: Uint8Array[] = [
    new TextEncoder().encode('GGUF'),
    buildUint32(3),
    buildUint64(0),
    buildUint64(entries.length),
  ];

  for (const entry of entries) {
    parts.push(
      buildString(entry.key),
      buildUint32(typeCodes[entry.value.type]),
      buildValue(entry.value),
    );
  }

  return concatenate(parts);
}

function buildUint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);

  new DataView(bytes.buffer).setUint32(0, value, true);

  return bytes;
}

function buildUint64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);

  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);

  return bytes;
}

function buildString(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);

  return concatenate([buildUint64(encoded.length), encoded]);
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));

  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);

    offset += part.length;
  }

  return result;
}

function buildValue(value: GGUFTestValue): Uint8Array {
  return match(value)
    .with({ type: 'string' }, (text) => buildString(text.value))
    .with({ type: 'uint32' }, (number) => buildUint32(number.value))
    .with({ type: 'uint64' }, (number) => buildUint64(number.value))
    .with({ type: 'float32' }, (number) => {
      const bytes = new Uint8Array(4);

      new DataView(bytes.buffer).setFloat32(0, number.value, true);

      return bytes;
    })
    .with({ type: 'bool' }, (flag) => Uint8Array.of(Number(flag.value)))
    .with({ type: 'array' }, (array) => {
      const [first] = array.items;
      const itemType = first === undefined ? typeCodes.uint32 : typeCodes[first.type];

      return concatenate([
        buildUint32(itemType),
        buildUint64(array.items.length),
        ...array.items.map((item) => buildValue(item)),
      ]);
    })
    .exhaustive();
}
