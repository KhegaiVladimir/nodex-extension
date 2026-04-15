import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node environment — no DOM, no Chrome APIs.
    // Chrome and window stubs are injected via setupFiles.
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],

    // Show individual test names in output.
    reporters: ['verbose'],

    // Treat uncaught promise rejections as failures.
    dangerouslyIgnoreUnhandledErrors: false,
  },
})
