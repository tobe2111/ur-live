import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'
// ✅ Week 5 Day 2: 환경 변수 검증
import { validateEnvForBuild } from './src/shared/config/env-validator'

// @ts-ignore - vite defineConfig type
export default defineConfig(({ mode }) => {
  // 🔥 환경 변수 로드 (Week 5 Day 2)
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  // 🌍 Runtime Detection Mode (단일 빌드, 호스트명으로 자동 감지)
  console.log(`🌍 [Vite Config] Building UNIVERSAL build (supports KR + GLOBAL)`)
  console.log(`📦 [Vite Config] Mode: ${mode}`)
  console.log(`🔧 [Vite Config] Region detection: Runtime (hostname-based)`)

  // ✅ 빌드 타임 환경 변수 검증 (Week 5 Day 2)
  validateEnvForBuild(mode)

  return {
  // 환경변수 정의 (빌드 시점에 번들에 포함)
  define: {
    'import.meta.env.VITE_TOSS_CLIENT_KEY': JSON.stringify(
      process.env.VITE_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm'
    ),
    // 🌍 Runtime Detection: Region은 hostname으로 자동 감지
    // (빌드 타임 상수 불필요 - region.ts의 getRegion() 사용)
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
      external: [] as string[],
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
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // 10KB 이상 파일만 압축
      deleteOriginFile: false,
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
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
    port: 5173,  // 🌍 단일 포트 (도메인으로 구분)
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
    outDir: 'dist',  // 🌍 단일 빌드 출력
    emptyOutDir: true,
    // 소스맵: 프로덕션 빌드에서는 비활성화 (번들 크기 감소)
    // 개발 시 디버깅이 필요하면 'inline' 또는 true로 변경
    sourcemap: mode === 'development' ? 'inline' : false,
    // 🔧 esbuild 사용 (terser보다 안전하고 빠름)
    minify: 'esbuild',
    rollupOptions: {
      // 🔧 순환 참조 및 TDZ 에러 방지
      preserveEntrySignatures: 'allow-extension',
      // 🌍 Runtime Detection: external 제거 (모든 라이브러리 포함, lazy import로 tree-shaking)
      output: {
        // 🔧 해시 기반 파일명으로 캐시 무효화
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // 🔥 성능 최적화: 세분화된 청크 전략 (1.13MB → 500KB 목표)
        manualChunks: (id) => {
          // 🎯 React 코어 라이브러리 (가장 높은 우선순위)
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-core'
          }
          
          // 🎯 React 라우터 (페이지 네비게이션)
          if (id.includes('node_modules/react-router') ||
              id.includes('node_modules/@remix-run/')) {
            return 'react-router'
          }
          
          // 🎯 Firebase Auth (인증만 분리 - 가장 큰 청크)
          if (id.includes('node_modules/firebase/auth') ||
              id.includes('node_modules/@firebase/auth')) {
            return 'firebase-auth'
          }

          // 🎯 Firebase App (코어만 분리)
          if (id.includes('node_modules/firebase/app') ||
              id.includes('node_modules/@firebase/app') ||
              id.includes('node_modules/@firebase/util') ||
              id.includes('node_modules/@firebase/component') ||
              id.includes('node_modules/@firebase/logger')) {
            return 'firebase-app'
          }

          // 🎯 Firebase 기타 (database, storage, analytics 등)
          if (id.includes('node_modules/firebase/') ||
              id.includes('node_modules/@firebase/')) {
            return 'firebase-misc'
          }
          
          // 🎯 UI 라이브러리 (아이콘, 유틸리티)
          if (id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/react-icons') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/tailwindcss-animate')) {
            return 'ui-libs'
          }
          
          // 🎯 상태 관리 (Zustand, Jotai 등)
          if (id.includes('node_modules/zustand') ||
              id.includes('node_modules/jotai') ||
              id.includes('node_modules/immer')) {
            return 'state-management'
          }
          
          // 🎯 React Query (데이터 페칭 & 캐싱)
          if (id.includes('node_modules/@tanstack/react-query') ||
              id.includes('node_modules/@tanstack/query-core')) {
            return 'react-query'
          }
          
          // 🎯 Sentry (에러 추적 - 비동기 로드, vendor 순환 참조 방지)
          // sentry를 vendor보다 먼저 매칭해야 순환 참조 방지
          if (id.includes('node_modules/@sentry/')) {
            return 'sentry'
          }
          
          // 🎯 국제화 (i18next)
          if (id.includes('node_modules/i18next') ||
              id.includes('node_modules/react-i18next')) {
            return 'i18n'
          }
          
          // 🎯 유틸리티 라이브러리 (date-fns, lodash 등)
          if (id.includes('node_modules/date-fns') ||
              id.includes('node_modules/lodash') ||
              id.includes('node_modules/dayjs')) {
            return 'utils'
          }
          
          // 🎯 HTTP 클라이언트 (Axios)
          if (id.includes('node_modules/axios')) {
            return 'http-client'
          }

          // 🎯 결제 SDK (Toss, Stripe - 필요 시만 로드)
          if (id.includes('node_modules/@tosspayments') ||
              id.includes('node_modules/@stripe') ||
              id.includes('node_modules/stripe')) {
            return 'payment-sdk'
          }

          // 🎯 Radix UI (헤드리스 UI 컴포넌트)
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix-ui'
          }

          // 🎯 bcrypt / crypto utilities
          if (id.includes('node_modules/bcrypt')) {
            return 'crypto-utils'
          }

          // 🎯 hono (서버 프레임워크 - 번들에서 분리)
          if (id.includes('node_modules/hono')) {
            return 'vendor-hono'
          }
          
          // 🎯 나머지 node_modules → vendor
          if (id.includes('node_modules/')) {
            return 'vendor'
          }
          
          // 기본값: undefined (Vite 자동 처리)
          return undefined
        },
      },
    },
    // 청크 크기 경고 임계값 (세분화 후 각 청크는 500KB 미만 목표)
    chunkSizeWarningLimit: 500,  // 더 작은 청크로 분할 권장
  },
  }
})
