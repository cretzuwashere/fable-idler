/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: { usePolling: true },
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://api:3000', changeOrigin: false } },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts'],
    environment: 'node',
  },
})
