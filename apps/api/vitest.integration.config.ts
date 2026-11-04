import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    fileParallelism: false,
    setupFiles: ['./test/integration/setup.ts'],
    globalTeardown: './test/integration/teardown.ts',
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
