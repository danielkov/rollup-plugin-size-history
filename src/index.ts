import { readFileSync, writeFileSync, existsSync } from 'fs';
import { brotliCompressSync, gzipSync } from 'zlib';
import { basename, join } from 'path';
import { Buffer } from 'buffer';
import { execSync } from 'child_process';

import { green, cyan, red, yellow } from 'discolor';
import { bytes } from 'prettybits';

export const getCurrentCommitHash = (): string => {
  return execSync('git rev-parse --short HEAD')
    .toString()
    .trim();
};

export const allChangesCommited = (): boolean => {
  return !execSync('git status -s').length;
};

export const defaultPath = join(process.cwd(), 'size.history.json');

export type Size = {
  name: string;
  original: number;
  gzip: number;
  brotli: number;
  new?: boolean;
};

export type Snapshot = {
  sizes: Size[];
  id: string;
};

export type History = Snapshot[];

export type GenerateBundleOptionsPartial = { file: string };

export type GenerateBundleBundlePartial<N extends string> = {
  [key in N]: { code: string };
};

const getName = (options: GenerateBundleOptionsPartial) =>
  basename(options.file);

const getCode = <N extends string>(
  name: N,
  bundle: GenerateBundleBundlePartial<N>,
) => {
  return bundle[name].code;
};

const gzipSize = (code: string): number => gzipSync(code).length;

const brotliSize = (code: string): number => brotliCompressSync(code).length;

/**
 * originalSize - determine size of code
 * *Why not just use `String.prototype.length`?*
 *
 * ```js
 * '😋'.length === 2 // > true
 * Buffer.from('😋').length === 4 // > true
 * ```
 *
 * @param {string} code
 * @returns {number} size
 */
const originalSize = (code: string): number => Buffer.from(code).length;

const ensureFile = (path: string, defaultValue = ''): string => {
  if (existsSync(path)) {
    return readFileSync(path, 'utf8');
  }
  writeFileSync(path, defaultValue);
  return defaultValue;
};

const parseFile = <T>(file: string): T => {
  try {
    return JSON.parse(file);
  } catch {
    throw new Error(
      'Could not parse previous snapshot. If this is unintentional, please remove this file.',
    );
  }
};

const createDiff = (oldValues: Size, newValues: Size) => {
  const { name, new: isNew, ...oldSizes } = oldValues;
  const diff: Partial<Size> = { name, new: isNew };
  Object.entries(oldSizes).forEach(([sizeName, value]) => {
    diff[sizeName] = newValues[sizeName] - value;
  });
  return diff as Size;
};

const compareSnapshot = (snap: Snapshot, newValues: Size) => {
  const { name } = newValues;
  const oldValues = snap?.sizes?.find(
    ({ name: oldName }) => oldName === name,
  ) || {
    name,
    original: 0,
    gzip: 0,
    brotli: 0,
    new: true,
  };
  return createDiff(oldValues, newValues);
};

const color = (isNew: boolean) => (value: number): string => {
  if (isNew) {
    return yellow(bytes(value));
  }
  return value <= 0 ? green(bytes(value)) : red(`+${bytes(value)}`);
};

const printResult = (
  { name, original, gzip, brotli }: Size,
  difference: Size,
  emoji: boolean,
) => {
  const prefixes = {
    gzip: '📦',
    brotli: '🥖',
  };
  const format = emoji ? Object.values(prefixes) : Object.keys(prefixes);

  const colorFn = color(difference.new);

  // eslint-disable-next-line no-console
  console.log(
    `${cyan(`${name}`)}: ${bytes(original)}(${colorFn(
      difference.original,
    )}) → ${format[0]} ${bytes(gzip)}(${colorFn(difference.gzip)}) • ${
      format[1]
    } ${bytes(brotli)}(${colorFn(difference.brotli)})`,
  );
};

const writeHistory = (path: string, history: History) => {
  writeFileSync(path, JSON.stringify(history), 'utf8');
};

export type SizeHistoryOptions = {
  path?: string;
  overwrite?: boolean;
  emoji?: boolean;
  write?: boolean;
  id?: string;
};

const getSnapshots = (
  history: History,
  id: Snapshot['id'],
): [Snapshot, Snapshot] => {
  const newSnapshot = { id, sizes: [] };
  if (!history.length) {
    history.push(newSnapshot);
    return [newSnapshot, newSnapshot];
  }
  const last = history[history.length - 1];
  if (last.id === id) {
    return [history[history.length - 2], last];
  }
  return [last, newSnapshot];
};

const addSize = (snapshot: Snapshot, size: Size, overwrite: boolean) => {
  const index = snapshot.sizes.findIndex(({ name }) => name === size.name);
  if (index > -1) {
    if (!overwrite) {
      throw new Error(
        'Snapshot already saved for this file and commit, use options.overwrite to replace it.',
      );
    }
    // eslint-disable-next-line no-param-reassign
    snapshot.sizes[index] = size;
    return;
  }
  snapshot.sizes.push(size);
};

const sizeHistory = ({
  path = defaultPath,
  write = allChangesCommited(),
  emoji = true,
  overwrite = false,
  id = getCurrentCommitHash(),
}: SizeHistoryOptions = {}) => {
  const file = ensureFile(path, '[]');
  const history = parseFile<History>(file);
  const [previousSnapshot, currentSnapshot] = getSnapshots(history, id);
  return {
    name: 'rollup-plugin-size-history',
    generateBundle(
      options: GenerateBundleOptionsPartial,
      bundle: GenerateBundleBundlePartial<string>,
    ) {
      const name = getName(options);
      const code = getCode(name, bundle);
      const original = originalSize(code);
      const gzip = gzipSize(code);
      const brotli = brotliSize(code);
      const newSizes = { name, original, gzip, brotli };
      addSize(currentSnapshot, newSizes, overwrite);
      const diff = compareSnapshot(previousSnapshot, newSizes);
      printResult(newSizes, diff, emoji);
      if (write) {
        writeHistory(defaultPath, history);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          'Output was not written to disk, because options.write === false',
        );
      }
    },
  };
};

export default sizeHistory;
