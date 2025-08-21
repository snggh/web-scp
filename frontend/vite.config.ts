import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://backend:3000',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug'
      },
      '/ws': {
        target: process.env.WS_URL || 'ws://backend:3000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})