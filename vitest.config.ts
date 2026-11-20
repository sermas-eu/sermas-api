import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // esbuild cannot emit decorator metadata, which Nest dependency injection needs
  oxc: false,
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2023',
      },
    }),
  ],
  resolve: {
    // #apps/* and #libs/* to the TypeScript sources (package.json imports,
    // "source" condition)
    alias: [
      {
        find: /^#(apps|libs)\/(.*)$/,
        replacement: fileURLToPath(new URL('./$1/$2.ts', import.meta.url)),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    // *.int.spec.ts need the running stack (sermas-dev), see test:int
    include:
      process.env.SERMAS_TEST === 'int'
        ? ['apps/**/*.int.spec.ts', 'libs/**/*.int.spec.ts']
        : ['apps/**/*.spec.ts', 'libs/**/*.spec.ts'],
    exclude: process.env.SERMAS_TEST === 'int' ? [] : ['**/*.int.spec.ts'],
  },
});
