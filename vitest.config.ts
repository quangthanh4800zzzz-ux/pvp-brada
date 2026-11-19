import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@pra/shared': resolve(__dirname, './shared/src/index.ts'),
      '@shared': resolve(__dirname, './shared/src'),
      '@client': resolve(__dirname, './client/src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
