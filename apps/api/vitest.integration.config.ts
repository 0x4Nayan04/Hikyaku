import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    fileParallelism: false,
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
