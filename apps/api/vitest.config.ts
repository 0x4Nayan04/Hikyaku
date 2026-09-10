import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ['test/unit/**/*.test.ts'],
    passWithNoTests: true,
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
