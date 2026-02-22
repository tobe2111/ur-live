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
          // 🔴 CRITICAL FIX: React 로딩 순서 보장
          // ⚠️ WARNING: 이 설정을 수정하면 /admin 페이지 흰 화면 오류 발생!
          // React Core는 반드시 먼저 로드되어야 함 (forwardRef 에러 방지)
          if (id.includes('node_modules')) {
            // 1. React Core (최우선 - 단일 청크로 통합)
            // ⚠️ DO NOT MERGE with other vendors!
            if (id.includes('react/') || id.includes('react-dom/')) {
              return 'react-core'
            }
            // 2. React 의존 라이브러리 (React 이후 로드)
            if (id.includes('react-router') || 
                id.includes('@radix-ui') ||
                id.includes('lucide-react') ||
                id.includes('recharts')) {
              return 'react-deps'
            }
            // 3. Sentry (독립 청크)
            if (id.includes('@sentry')) {
              return 'sentry-vendor'
            }
            // 4. 유틸리티 (axios 등)
            if (id.includes('axios')) {
              return 'utils-vendor'
            }
            // 5. 기타 node_modules
            return 'vendor'
          }
          
          // 페이지별 청크 (더 세분화)
          if (id.includes('/src/pages/')) {
            // 인증 관련 (로그인, 카카오 콜백)
            if (id.includes('Login') || id.includes('Callback')) {
              return 'auth-pages'
            }
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
            // 결제 관련
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
