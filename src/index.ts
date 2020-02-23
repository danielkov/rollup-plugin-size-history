import { readFileSync, writeFileSync, existsSync } from 'fs';
import { brotliCompressSync, gzipSync } from 'zlib';
import { basename, join } from 'path';
import { Buffer } from 'buffer';
import { green, cyan, red, yellow } from 'discolor';
import { bytes } from 'prettybits';

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

const defaultPath = join(process.cwd(), 'size.history.json');

const getName = (options: { file: string }) => basename(options.file);

const getCode = <N extends string>(
  name: N,
  bundle: { [key in N]: { code: string } },
) => {
  return bundle[name].code;
};

const gzipSize = (code: string) => gzipSync(code).length;

const brotliSize = (code: string) => brotliCompressSync(code).length;

const originalSize = (code: string) => Buffer.from(code).length;

const ensureFile = (path: string, defaultValue = '') => {
  if (existsSync(path)) {
    return readFileSync(path, 'utf8');
  }
  writeFileSync(path, defaultValue);
  return defaultValue;
};

const parseSnapshot = (file: string) => {
  try {
    return JSON.parse(file);
  } catch {
    throw new Error(
      'Could not parse previous snapshot. If this is unintentional, please remove this file.',
    );
  }
};

const createDiff = (oldValues, newValues) => {
  const { name, new: isNew, ...oldSizes } = oldValues;
  const diff = { name, new: isNew };
  // eslint-disable-next-line no-shadow
  Object.entries(oldSizes).forEach(([name, value]) => {
    diff[name] = newValues[name] - (value as number);
  });
  return diff;
};

const compareSnapshot = (snap, newValues) => {
  const { name } = newValues;
  const oldValues = snap.find(({ name: oldName }) => oldName === name) || {
    name,
    original: 0,
    gzip: 0,
    brotli: 0,
    new: true,
  };
  return createDiff(oldValues, newValues);
};

const printResult = ({ name, original, gzip, brotli }, difference) => {
  const colorFn = val =>
    // eslint-disable-next-line no-nested-ternary
    difference.new
      ? yellow(bytes(val))
      : val <= 0
      ? green(bytes(val))
      : red(`+${bytes(val)}`);
  // eslint-disable-next-line no-console
  console.log(
    `${cyan(`${name}`)}: ${bytes(original)}(${colorFn(
      difference.original,
    )}) → 📦 ${bytes(gzip)}(${colorFn(difference.gzip)}) • 🥖 ${bytes(
      brotli,
    )}(${colorFn(difference.brotli)})`,
  );
};

const commitDiff = (snap, newValues) => {
  const index = snap.findIndex(({ name }) => newValues.name === name);
  // eslint-disable-next-line no-bitwise
  if (~index) {
    // eslint-disable-next-line no-param-reassign
    snap[index] = newValues;
  } else {
    snap.push(newValues);
  }
  return snap;
};

const writeSnapshot = (path, snap) => {
  writeFileSync(path, JSON.stringify(snap), 'utf8');
};

export type SizeHistoryOptions = {
  path: string;
  overwrite: boolean;
};

const sizeHistory = ({ path = defaultPath }: SizeHistoryOptions) => {
  const file = ensureFile(path, '[]');
  const snap = parseSnapshot(file);
  return {
    name: 'rollup-plugin-size-snapshot',
    generateBundle(options, bundle) {
      const name = getName(options);
      const code = getCode(name, bundle);
      const original = originalSize(code);
      const gzip = gzipSize(code);
      const brotli = brotliSize(code);
      const newValues = { name, original, gzip, brotli };
      const diff = compareSnapshot(snap, newValues);
      printResult(newValues, diff);
      writeSnapshot(defaultPath, commitDiff(snap, newValues));
    },
  };
};

export default sizeHistory;
