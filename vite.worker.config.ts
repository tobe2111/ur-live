import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig({
  plugins: [
    pages({
      entry: 'src/index.tsx',
    }),
  ],
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
