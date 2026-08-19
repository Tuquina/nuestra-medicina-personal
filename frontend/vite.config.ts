import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Mirrors the production topology (architecture.md §3): Nginx proxies
    // `/api/*` to the Go backend. There's no backend yet, so this just
    // means API calls 404 locally until it exists — same behavior as prod
    // would have before deploying it.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
