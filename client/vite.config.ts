import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  resolve: {
    alias: {
      '@pra/shared': resolve(root, '../shared/src/index.ts'),
      '@shared': resolve(root, '../shared/src'),
      '@client': resolve(root, './src')
    }
  },
  build: { outDir: 'dist', target: 'es2022' },
  server: { port: 5173 }
});
