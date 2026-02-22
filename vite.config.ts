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
    // 소스맵 비활성화 (프로덕션)
    sourcemap: false,
    // 최소화 설정
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 🔧 console.log 보존 (디버깅용)
        drop_debugger: true,
      },
      format: {
        ascii_only: false, // 🔧 한글 유니코드 이스케이프 방지
        beautify: false,
      },
    },
    rollupOptions: {
      output: {
        // 🔧 해시 기반 파일명으로 캐시 무효화
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // 🔴 CRITICAL: React must be in ONE chunk ONLY to prevent duplicate instances
          // Multiple React instances cause: "Cannot set properties of undefined (setting 'Children')"
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
            
            // 5. Other node_modules (excluding React to prevent duplicates)
            return 'vendor'
          }
          
          // Page-level chunks
          if (id.includes('/src/pages/')) {
            if (id.includes('Login') || id.includes('Callback')) {
              return 'auth-pages'
            }
            if (id.includes('/src/pages/Seller')) {
              return 'seller-pages'
            }
            if (id.includes('/src/pages/Admin')) {
              return 'admin-pages'
            }
            if (id.includes('/src/pages/My')) {
              return 'user-pages'
            }
            if (id.includes('/src/pages/Cart') || 
                id.includes('/src/pages/Checkout') || 
                id.includes('/src/pages/Live')) {
              return 'shopping-pages'
            }
            if (id.includes('/src/pages/Payment')) {
              return 'payment-pages'
            }
          }
        },
      },
    },
    // 청크 크기 경고 임계값
    chunkSizeWarningLimit: 500,
  },
})
