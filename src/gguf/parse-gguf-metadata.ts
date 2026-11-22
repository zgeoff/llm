import { match } from 'ts-pattern';

// A scalar, a string, or an array of scalars. An array of strings, such as the tokenizer
// vocabulary, is skipped and leaves no key.
export type GGUFValue = string | number | boolean | readonly (number | boolean)[];

export interface GGUFMetadata {
  readonly version: number;
  readonly tensorCount: number;
  readonly values: ReadonlyMap<string, GGUFValue>;
}

type GGUFParseResult =
  | { readonly status: 'ok'; readonly metadata: GGUFMetadata }
  | { readonly status: 'truncated' }
  | { readonly status: 'invalid'; readonly reason: string };

class GGUFError extends Error {
  readonly kind: 'truncated' | 'invalid';

  constructor(kind: 'truncated' | 'invalid', message: string) {
    super(message);

    this.name = 'GGUFError';
    this.kind = kind;
  }
}

// Parses the header and the key-value section of a GGUF file. The bytes may stop anywhere after
// that section, since the tensor table follows it and is never read.
export function parseGGUFMetadata(bytes: Uint8Array): GGUFParseResult {
  try {
    return { status: 'ok', metadata: decodeMetadata(buildCursor(bytes)) };
  } catch (error) {
    if (error instanceof GGUFError) {
      return error.kind === 'truncated'
        ? { status: 'truncated' }
        : { status: 'invalid', reason: error.message };
    }

    throw error;
  }
}

const magic = 'GGUF';

interface Cursor {
  readonly take: (length: number) => Uint8Array;
  readonly skip: (length: number) => void;
  readonly readView: (length: number) => DataView;
  readonly readUint32: () => number;
  readonly readUint64: () => number;
  readonly readString: () => string;
}

function decodeMetadata(cursor: Cursor): GGUFMetadata {
  const signature = new TextDecoder().decode(cursor.take(4));

  if (signature !== magic) {
    throw new GGUFError('invalid', 'not a GGUF file: the magic bytes are missing');
  }

  const version = cursor.readUint32();

  if (version < 2 || version > 3) {
    throw new GGUFError('invalid', `unsupported GGUF version ${version}`);
  }

  const tensorCount = cursor.readUint64();
  const entryCount = cursor.readUint64();

  const values = new Map<string, GGUFValue>();

  for (let index = 0; index < entryCount; index += 1) {
    const key = cursor.readString();
    const valueType = cursor.readUint32();
    const value = readValue(cursor, valueType);

    if (value !== null) {
      values.set(key, value);
    }
  }

  return { version, tensorCount, values };
}

const arrayType = 9;
const stringType = 8;

// Null means the value was skipped.
function readValue(cursor: Cursor, valueType: number): GGUFValue | null {
  if (valueType !== arrayType) {
    return readScalar(cursor, valueType);
  }

  const itemType = cursor.readUint32();
  const length = cursor.readUint64();

  if (itemType === stringType) {
    for (let index = 0; index < length; index += 1) {
      cursor.skip(cursor.readUint64());
    }

    return null;
  }

  const items: (number | boolean)[] = [];

  for (let index = 0; index < length; index += 1) {
    const item = readScalar(cursor, itemType);

    if (typeof item === 'string') {
      throw new GGUFError('invalid', 'an array holds a nested value that is not a scalar');
    }

    items.push(item);
  }

  return items;
}

function readScalar(cursor: Cursor, valueType: number): string | number | boolean {
  return match(valueType)
    .with(0, () => cursor.readView(1).getUint8(0))
    .with(1, () => cursor.readView(1).getInt8(0))
    .with(2, () => cursor.readView(2).getUint16(0, true))
    .with(3, () => cursor.readView(2).getInt16(0, true))
    .with(4, () => cursor.readUint32())
    .with(5, () => cursor.readView(4).getInt32(0, true))
    .with(6, () => cursor.readView(4).getFloat32(0, true))
    .with(7, () => cursor.readView(1).getUint8(0) !== 0)
    .with(8, () => cursor.readString())
    .with(10, () => cursor.readUint64())
    .with(11, () => Number(cursor.readView(8).getBigInt64(0, true)))
    .with(12, () => cursor.readView(8).getFloat64(0, true))
    .otherwise(() => {
      throw new GGUFError('invalid', `unknown value type ${valueType}`);
    });
}

function buildCursor(bytes: Uint8Array): Cursor {
  let offset = 0;

  const take = (length: number): Uint8Array => {
    if (offset + length > bytes.length) {
      throw new GGUFError('truncated', 'the bytes end inside the key-value section');
    }

    const slice = bytes.subarray(offset, offset + length);

    offset += length;

    return slice;
  };

  const readView = (length: number): DataView => {
    const slice = take(length);

    return new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
  };

  const readUint64 = (): number => {
    const value = readView(8).getBigUint64(0, true);

    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new GGUFError('invalid', 'a length or count is too large');
    }

    return Number(value);
  };

  return {
    take,
    skip: (length) => {
      take(length);
    },
    readView,
    readUint32: () => readView(4).getUint32(0, true),
    readUint64,
    readString: () => new TextDecoder().decode(take(readUint64())),
  };
}
