import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],

  // Mirrors the production Caddy routing so the frontend can always talk to a
  // same-origin `/api`, `/uploads` and `/socket.io` in dev and in production.
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
})
