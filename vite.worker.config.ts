import { defineConfig } from 'vite'
import path from 'path'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig({
  plugins: [
    pages({
      entry: 'src/index.tsx', // 🔄 ROLLBACK: 모든 204개 엔드포인트 포함
      // entry: 'src/worker/index.ts', // 🆕 새 Worker 진입점 (10개 미만만 포함 - 롤백됨)
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
