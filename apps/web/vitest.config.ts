import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
    },
  },
});
