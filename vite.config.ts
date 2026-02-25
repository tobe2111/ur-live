import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  // 환경변수 정의 (빌드 시점에 번들에 포함)
  define: {
    'import.meta.env.VITE_TOSS_CLIENT_KEY': JSON.stringify(
      process.env.VITE_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm'
    ),
  },
  plugins: [
    react(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 소스맵 활성화 (에러 디버깅용)
    sourcemap: true,
    // 🔧 esbuild 사용 (terser보다 안전하고 빠름)
    minify: 'esbuild',
    rollupOptions: {
      // 🔧 순환 참조 및 TDZ 에러 방지
      preserveEntrySignatures: 'allow-extension',
      output: {
        // 🔧 해시 기반 파일명으로 캐시 무효화
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // 🔴 CRITICAL: React must be in ONE chunk ONLY to prevent duplicate instances
          if (id.includes('node_modules')) {
            // 1. React Core - MUST be single instance
            if (id.includes('node_modules/react/') || 
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/scheduler/')) {
              return 'react-core'
            }
            
            // 2. React ecosystem - depends on react-core
            if (id.includes('node_modules/react-router') || 
                id.includes('node_modules/@radix-ui') ||
                id.includes('node_modules/lucide-react') ||
                id.includes('node_modules/recharts')) {
              return 'react-deps'
            }
            
            // 3. Sentry
            if (id.includes('node_modules/@sentry')) {
              return 'sentry-vendor'
            }
            
            // 4. Utilities
            if (id.includes('node_modules/axios')) {
              return 'utils-vendor'
            }
            
            // 5. Other node_modules
            return 'vendor'
          }
          
          // 🔧 SIMPLIFIED: 3개 청크로 단순화 (순환 참조 방지)
          if (id.includes('/src/pages/')) {
            // LivePage만 별도 분리 (가장 복잡한 페이지)
            if (id.includes('/src/pages/Live')) {
              return 'live-pages'
            }
            // Seller pages
            if (id.includes('/src/pages/Seller')) {
              return 'seller-pages'
            }
            // 나머지 모든 페이지는 하나로 묶음
            return 'app-pages'
          }
        },
      },
    },
    // 청크 크기 경고 임계값
    chunkSizeWarningLimit: 500,
  },
})
