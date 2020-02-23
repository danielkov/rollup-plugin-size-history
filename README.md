# 📜 rollup-plugin-size-history

Keep track of how your bundle's size changed between commits.

This project was bootstrapped with [this template](https://github.com/danielkov/single-package).

```sh
npm install --save-dev rollup-plugin-size-history
```

## Usage

`rollup.config.js`

```ts
import size from 'rollup-plugin-size-history';
import pkg from './package.json';

const { name, source: input, main: file } = pkg;

export default {
  input,
  plugins: [size()],
  output: [
    {
      file,
      format: 'cjs',
    },
  ],
};
```

Behaviour can be configured with the following options:

| Name      | Description                                                         | Default value           |
| --------- | ------------------------------------------------------------------- | ----------------------- |
| path      | Where the snapshot file should be saved                             | `'./size.history.json'` |
| overwrite | Should the saved record with the current commit hash be overwritten | false                   |

```ts
import size, { SizeHistoryOptions } from 'rollup-plugin-size-history';
import { join } from 'path';

const options: SizeHistoryOptions = {
  path: join(process.cwd(), 'size.json'),
  overwrite: true,
};

const plugins = [size(options)];
```

## Contributing

Thank you for wanting to contribute. Before you get started, [read our contribution guidelines](CONTRIBUTING.md).

To get started, fork the repository and then clone it to your machine. You will need Node JS v8+ and NPM to run the project.

To grab all the dependencies for development:

```sh
npm install
```

Run tests in watch mode:

```sh
npm test -w
```

Once you're happy with your changes, use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard to create your commit messages.

To build the package, use the command:

```sh
npm build
```

If all seems good and tests are green, push your changes and submit a pull request.
