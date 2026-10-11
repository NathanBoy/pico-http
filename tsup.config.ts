import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'PicoHttp',
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  minify: true,
  splitting: false,
  treeshake: true,
});
