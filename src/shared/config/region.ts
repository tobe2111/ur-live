/**
 * 🌍 Multi-Region Configuration (Runtime Detection)
 * 
 * 전략: Single Build + Runtime Detection
 * - 빌드: 1번만 (npm run build)
 * - Region: hostname으로 런타임 판단
 * - Tree-shaking: 조건부 import로 보장
 * 
 * @example
 * ```typescript
 * // KR 전용 코드 (world.ur-team.com에서 실행 안 됨)
 * if (isKorea()) {
 *   const toss = await import('./toss-payment')  // lazy import
 *   await toss.initialize()
 * }
 * 
 * // GLOBAL 전용 코드 (live.ur-team.com에서 실행 안 됨)
 * if (isGlobal()) {
 *   const stripe = await import('./stripe-payment')  // lazy import
 *   await stripe.initialize()
 * }
 * ```
 */

// ============================================
// Region Types
// ============================================

/**
 * 지원하는 Region 목록
 */
export type Region = 'KR' | 'GLOBAL'

/**
 * Region별 설정
 */
export interface RegionConfig {
  /** Region 코드 */
  code: Region
  /** Region 이름 */
  name: string
  /** 언어 코드 (ISO 639-1) */
  language: string
  /** 통화 코드 (ISO 4217) */
  currency: string
  /** 결제 제공자 */
  paymentProvider: 'toss' | 'stripe'
  /** 인증 제공자 목록 */
  authProviders: Array<'kakao' | 'google'>
  /** 도메인 패턴 (런타임 감지용) */
  domainPatterns: string[]
}

// ============================================
// Region Configuration Map
// ============================================

const REGION_CONFIG_MAP: Record<Region, RegionConfig> = {
  KR: {
    code: 'KR',
    name: '대한민국',
    language: 'ko',
    currency: 'KRW',
    paymentProvider: 'toss',
    authProviders: ['kakao', 'google'],
    domainPatterns: ['live.ur-team.com', 'kr.', 'localhost:5173', 'localhost:4173']
  },
  GLOBAL: {
    code: 'GLOBAL',
    name: 'Global',
    language: 'en',
    currency: 'USD',
    paymentProvider: 'stripe',
    authProviders: ['google'],
    domainPatterns: ['world.ur-team.com', 'global.', 'localhost:5174']
  }
}

// ============================================
// Runtime Region Detection
// ============================================

/**
 * 현재 Region 감지 (Runtime)
 * 
 * @returns 현재 hostname 기반 Region
 */
export function getRegion(): Region {
  // SSR 환경 대응 (window가 없는 경우)
  if (typeof window === 'undefined') {
    return 'KR'  // 기본값
  }
  
  const hostname = window.location.hostname
  
  // GLOBAL 패턴 매칭
  for (const pattern of REGION_CONFIG_MAP.GLOBAL.domainPatterns) {
    if (hostname.includes(pattern)) {
      return 'GLOBAL'
    }
  }
  
  // 기본값: KR (국내 우선)
  return 'KR'
}

/**
 * Region 설정 가져오기
 */
export function getRegionConfig(): RegionConfig {
  const region = getRegion()
  return REGION_CONFIG_MAP[region]
}

// ============================================
// Region Check Helpers
// ============================================

/**
 * KR Region 체크
 * 
 * @returns 현재 hostname이 KR 도메인인 경우 true
 * @example
 * ```typescript
 * if (isKorea()) {
 *   // KR 전용 코드 (lazy import로 tree-shaking 보장)
 *   const toss = await import('./toss-payment')
 *   await toss.initialize()
 * }
 * ```
 */
export function isKorea(): boolean {
  return getRegion() === 'KR'
}

/**
 * GLOBAL Region 체크
 * 
 * @returns 현재 hostname이 GLOBAL 도메인인 경우 true
 * @example
 * ```typescript
 * if (isGlobal()) {
 *   // GLOBAL 전용 코드 (lazy import로 tree-shaking 보장)
 *   const stripe = await import('./stripe-payment')
 *   await stripe.initialize()
 * }
 * ```
 */
export function isGlobal(): boolean {
  return getRegion() === 'GLOBAL'
}

// ============================================
// Feature Flag Helpers
// ============================================

/**
 * Kakao 로그인 사용 가능 여부
 */
export function isKakaoAuthEnabled(): boolean {
  const config = getRegionConfig()
  return config.authProviders.includes('kakao')
}

/**
 * Google 로그인 사용 가능 여부
 */
export function isGoogleAuthEnabled(): boolean {
  const config = getRegionConfig()
  return config.authProviders.includes('google')
}

/**
 * Toss Payment 사용 가능 여부
 */
export function isTossPaymentEnabled(): boolean {
  const config = getRegionConfig()
  return config.paymentProvider === 'toss'
}

/**
 * Stripe Payment 사용 가능 여부
 */
export function isStripePaymentEnabled(): boolean {
  const config = getRegionConfig()
  return config.paymentProvider === 'stripe'
}

// ============================================
// Lazy Import Helpers (Tree-shaking 보장)
// ============================================

/**
 * 결제 제공자 동적 Import
 * 
 * ⚠️ 중요: lazy import로 tree-shaking 보장
 * - KR에서 실행: Toss만 import
 * - GLOBAL에서 실행: Stripe만 import
 * 
 * @example
 * ```typescript
 * const paymentModule = await getPaymentProvider()
 * await paymentModule.initialize()
 * ```
 */
export async function getPaymentProvider() {
  if (isKorea()) {
    // KR: Toss Payment (lazy import)
    // ⚠️ 실제 모듈 경로로 변경 필요
    return await import('@/components/payments/TossPaymentWidget')
  }
  
  if (isGlobal()) {
    // GLOBAL: Stripe (lazy import)
    // ⚠️ 실제 모듈 경로로 변경 필요
    return await import('@/components/payments/StripeCheckout')
  }
  
  throw new Error(`Unsupported region: ${getRegion()}`)
}

/**
 * 인증 제공자 동적 Import
 * 
 * @example
 * ```typescript
 * if (isKakaoAuthEnabled()) {
 *   const kakao = await getAuthProvider('kakao')
 *   await kakao.login()
 * }
 * ```
 */
export async function getAuthProvider(provider: 'kakao' | 'google') {
  if (provider === 'kakao' && isKakaoAuthEnabled()) {
    // Kakao Auth (lazy import)
    // ⚠️ 실제 모듈 경로로 변경 필요
    return await import('@/features/auth/services/KakaoAuthService')
  }
  
  if (provider === 'google' && isGoogleAuthEnabled()) {
    // Google Auth (lazy import)
    // ⚠️ 실제 모듈 경로로 변경 필요
    return await import('@/features/auth/services/GoogleAuthService')
  }
  
  throw new Error(`Auth provider ${provider} not enabled in region ${getRegion()}`)
}

// ============================================
// Debug Utilities
// ============================================

/**
 * Region 정보 출력 (디버깅용)
 */
export function logRegionInfo() {
  // 🛡️ 2026-05-01: DEV gate 수정 — 이전 `!(import.meta as any).env?.DEV` 가
  //   항상 true 로 해석돼 production 에서도 console 노출됨.
  if (!import.meta.env.DEV) return

  const config = getRegionConfig()

  console.group('Region Configuration')
  console.log('Region:', config.code)
  console.log('Name:', config.name)
  console.log('Language:', config.language)
  console.log('Currency:', config.currency)
  console.log('Payment Provider:', config.paymentProvider)
  console.log('Auth Providers:', config.authProviders.join(', '))
  console.log('Current Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'SSR')
  console.groupEnd()
}

// ============================================
// Build-time Constants (Optional)
// ============================================

/**
 * 빌드 타임 Region Hint (선택사항)
 * 
 * vite.config.ts에서 주입 가능:
 * ```typescript
 * define: {
 *   __REGION_HINT__: JSON.stringify('KR')  // 기본 region hint
 * }
 * ```
 * 
 * 용도: 빌드 타임 최적화 힌트 (실제 region은 runtime에서 결정)
 */
declare global {
  const __REGION_HINT__: Region | undefined
}

/**
 * 빌드 타임 Region Hint 가져오기 (선택사항)
 */
export function getRegionHint(): Region | undefined {
  return typeof __REGION_HINT__ !== 'undefined' ? __REGION_HINT__ : undefined
}

// ============================================
// Exports
// ============================================

export default {
  getRegion,
  getRegionConfig,
  isKorea,
  isGlobal,
  isKakaoAuthEnabled,
  isGoogleAuthEnabled,
  isTossPaymentEnabled,
  isStripePaymentEnabled,
  getPaymentProvider,
  getAuthProvider,
  logRegionInfo,
  getRegionHint
}
