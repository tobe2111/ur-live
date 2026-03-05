import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => {
  // 🎯 Region 분기 (KR vs GLOBAL)
  const isKR = mode === 'kr' || mode === 'development'  // dev는 기본 KR
  const isGlobal = mode === 'global'

  return {
  // 환경변수 정의 (빌드 시점에 번들에 포함)
  define: {
    'import.meta.env.VITE_TOSS_CLIENT_KEY': JSON.stringify(
      process.env.VITE_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm'
    ),
    // 🔥 Region 상수 주입 (tree-shaking 유리)
    '__REGION__': JSON.stringify(isKR ? 'KR' : 'GLOBAL'),
    '__IS_KR__': isKR,
    '__IS_GLOBAL__': isGlobal,
  },
  
  // 🔥 CRITICAL: React 중복 방지
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-router-dom',
      'firebase/auth',
      'firebase/app',
    ],
    // 🔥 React를 단일 번들로 강제
    force: true,
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
    // 🔥 React 중복 해결: 항상 최상위 node_modules/react 사용
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    host: '0.0.0.0',
    port: isKR ? 5173 : 5174,  // 🎯 Region별 포트 분리
    // ✅ 샌드박스 호스트 허용
    allowedHosts: [
      'localhost',
      '.sandbox.novita.ai',  // 모든 sandbox 서브도메인 허용
      '.e2b.dev',            // E2B 샌드박스
    ],
    // 🔥 HMR 안정화
    hmr: {
      overlay: true,
    },
  },
  build: {
    outDir: isKR ? 'dist' : 'dist-global',  // 🎯 Region별 출력 폴더
    emptyOutDir: true,
    // 소스맵 활성화 (에러 디버깅용)
    sourcemap: true,
    // 🔧 esbuild 사용 (terser보다 안전하고 빠름)
    minify: 'esbuild',
    rollupOptions: {
      // 🔧 순환 참조 및 TDZ 에러 방지
      preserveEntrySignatures: 'allow-extension',
      // 🔥 Region별 불필요한 라이브러리 제외
      external: isKR 
        ? ['@stripe/stripe-js', '@stripe/react-stripe-js']  // KR: Stripe 제외
        : [],  // GLOBAL: 모두 포함
      output: {
        // 🔧 해시 기반 파일명으로 캐시 무효화
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // 🔥 CRITICAL FIX: manualChunks 대폭 단순화 (React Duplicate 방지)
        manualChunks: {
          // 🎯 React 관련은 무조건 하나의 청크로!
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom'],
          // Firebase도 하나로
          'firebase-vendor': ['firebase/app', 'firebase/auth'],
        },
      },
    },
    // 청크 크기 경고 임계값
    chunkSizeWarningLimit: 1000,  // 500 → 1000 (단순화로 인한 크기 증가 허용)
  },
  }
})
