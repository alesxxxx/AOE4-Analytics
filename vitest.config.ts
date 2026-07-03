import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/**/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@domain': resolve('src/domain'),
      '@api': resolve('src/api'),
      '@data': resolve('src/data'),
      '@store': resolve('src/store'),
    },
  },
})
