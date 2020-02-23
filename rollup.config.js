import bundleSize from 'rollup-plugin-bundle-size';
import typescript from 'rollup-plugin-typescript2';

import pkg from './package.json';

const plugins = [
  typescript({
    tsconfigOverride: {
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
      ],
    },
  }),
  bundleSize(),
];

const { source: input, main: file } = pkg;

// rollup supports plugins in ESM format
const format = 'esm';

export default {
  input,
  plugins,
  output: {
    file,
    format,
  },
};
