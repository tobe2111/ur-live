import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  // 환경변수 정의 (빌드 시점에 번들에 포함)
  define: {
    'import.meta.env.VITE_TOSS_CLIENT_KEY': JSON.stringify(
      process.env.VITE_TOSS_CLIENT_KEY || 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'
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
        drop_console: true, // console.log 제거
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // node_modules 의존성 분리
          if (id.includes('node_modules')) {
            // React 관련
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor'
            }
            // UI 라이브러리
            if (id.includes('lucide-react')) {
              return 'ui-vendor'
            }
            // HTTP 클라이언트
            if (id.includes('axios')) {
              return 'utils-vendor'
            }
            // Sentry
            if (id.includes('@sentry')) {
              return 'sentry-vendor'
            }
            // 기타 node_modules
            return 'vendor'
          }
          
          // 페이지별 청크
          if (id.includes('/src/pages/')) {
            // Seller 페이지들
            if (id.includes('/src/pages/Seller')) {
              return 'seller-pages'
            }
            // Admin 페이지들
            if (id.includes('/src/pages/Admin')) {
              return 'admin-pages'
            }
            // User 페이지들 (MyPage, MyOrders)
            if (id.includes('/src/pages/My')) {
              return 'user-pages'
            }
            // 쇼핑 관련 (Cart, Checkout, Live)
            if (id.includes('/src/pages/Cart') || 
                id.includes('/src/pages/Checkout') || 
                id.includes('/src/pages/Live')) {
              return 'shopping-pages'
            }
          }
        },
      },
    },
    // 청크 크기 경고 임계값
    chunkSizeWarningLimit: 500,
  },
})
