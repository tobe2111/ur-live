import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
// ✅ Week 5 Day 2: 환경 변수 검증
import { validateEnvForBuild } from './src/shared/config/env-validator'

export default defineConfig(({ mode }) => {
  // 🔥 환경 변수 로드 (Week 5 Day 2)
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  // 🎯 Region 분기 (KR vs GLOBAL)
  const isKR = mode === 'kr' || mode === 'development'  // dev는 기본 KR
  const isGlobal = mode === 'global'

  console.log(`🌍 [Vite Config] Building for region: ${isKR ? 'KR' : 'GLOBAL'}`)
  console.log(`📦 [Vite Config] Mode: ${mode}`)
  console.log(`🔧 [Vite Config] Tree-shaking: ${isKR ? 'Stripe/Google excluded' : 'Toss/Kakao excluded'}`)

  // ✅ 빌드 타임 환경 변수 검증 (Week 5 Day 2)
  validateEnvForBuild(mode)

  return {
  // 환경변수 정의 (빌드 시점에 번들에 포함)
  define: {
    'import.meta.env.VITE_TOSS_CLIENT_KEY': JSON.stringify(
      process.env.VITE_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm'
    ),
    // 🔥 Region 상수 주입 (tree-shaking 최적화)
    '__REGION__': JSON.stringify(isKR ? 'KR' : 'GLOBAL'),
    '__IS_KR__': JSON.stringify(isKR),
    '__IS_GLOBAL__': JSON.stringify(isGlobal),
    // 🔥 호환성을 위한 추가 상수
    'process.env.VITE_REGION': JSON.stringify(isKR ? 'KR' : 'GLOBAL'),
  },
  
  // 🔥 CRITICAL FIX: React 중복 방지 강화
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-router-dom',
      'firebase/auth',
      'firebase/app',
    ],
    // 🔥 모든 의존성을 사전 번들링 (중복 방지)
    force: false,  // ✅ true → false (불필요한 force 제거)
    // 🔥 외부 링크 제거 (단일 번들로 강제)
    esbuildOptions: {
      // React를 절대로 외부화하지 않음
      external: [],
    },
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
      // 🔥 Region별 불필요한 라이브러리 제외 (Tree-shaking 강화)
      external: isKR 
        ? [
            '@stripe/stripe-js', 
            '@stripe/react-stripe-js',
            // ✅ GLOBAL 전용 제거 대상 추가
          ]
        : [
            // ✅ KR 전용 제거 대상
            '@tosspayments/payment-sdk',
            'kakao-js-sdk',
          ],
      output: {
        // 🔧 해시 기반 파일명으로 캐시 무효화
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // 🔥 CRITICAL FIX: React를 vendor에 포함하여 로딩 순서 보장
        manualChunks: (id) => {
          // 🎯 Firebase → 별도 chunk
          if (id.includes('node_modules/firebase/') ||
              id.includes('node_modules/@firebase/')) {
            return 'firebase'
          }
          
          // 🎯 모든 node_modules (React 포함) → vendor chunk
          // React를 별도 chunk로 분리하지 않고 vendor에 포함
          if (id.includes('node_modules/')) {
            return 'vendor'
          }
          
          // 기본값: undefined (Vite 자동 처리)
          return undefined
        },
      },
    },
    // 청크 크기 경고 임계값
    chunkSizeWarningLimit: 1000,  // 500 → 1000 (단순화로 인한 크기 증가 허용)
  },
  }
})
