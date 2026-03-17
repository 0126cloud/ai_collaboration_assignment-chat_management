import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  root: __dirname,
  test: {
    name: 'server',
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
