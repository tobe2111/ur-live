import { defineConfig } from 'vite'
import path from 'path'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig({
  plugins: [
    pages({
      entry: 'src/index.tsx', // ✅ Stable worker with all routes (rollback from modular worker)
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Path alias 지원
    },
  },
  ssr: {
    external: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false, // Worker 빌드는 minify 하지 않음 (디버깅 용이)
    rollupOptions: {
      external: [],
    },
  },
})
