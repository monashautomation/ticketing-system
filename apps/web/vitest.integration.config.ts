import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 15000,
    // All integration test files share one real Postgres instance (no
    // per-worker schema isolation), so files must not run concurrently.
    fileParallelism: false,
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
    },
  },
});
