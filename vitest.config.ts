import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['netlify/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node' },
})
