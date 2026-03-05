/**
 * 🌍 Region Configuration - Build-time Constants
 * 
 * 빌드 타임에 주입되는 Region 상수로 런타임 분기 최소화
 * Tree-shaking을 통해 불필요한 코드 완전 제거
 * 
 * @example
 * ```typescript
 * // KR 빌드: __IS_KR__ = true, __IS_GLOBAL__ = false
 * // GLOBAL 빌드: __IS_KR__ = false, __IS_GLOBAL__ = true
 * 
 * if (__IS_KR__) {
 *   // KR 전용 코드 (GLOBAL 빌드에서 제거됨)
 * }
 * 
 * if (__IS_GLOBAL__) {
 *   // GLOBAL 전용 코드 (KR 빌드에서 제거됨)
 * }
 * ```
 */

// ============================================
// Build-time Constants (vite.config.ts에서 주입)
// ============================================

// TypeScript 타입 선언
declare global {
  const __REGION__: 'KR' | 'GLOBAL'
  const __IS_KR__: boolean
  const __IS_GLOBAL__: boolean
}

// ============================================
// Region Types
// ============================================

/**
 * 지원하는 Region 목록
 */
export type Region = 'KR' | 'GLOBAL' | 'JP' | 'SEA'

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
  paymentProvider: 'toss' | 'stripe' | 'paypal'
  /** 인증 제공자 목록 */
  authProviders: Array<'kakao' | 'google' | 'facebook' | 'apple'>
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
    authProviders: ['kakao', 'google']
  },
  GLOBAL: {
    code: 'GLOBAL',
    name: 'Global',
    language: 'en',
    currency: 'USD',
    paymentProvider: 'stripe',
    authProviders: ['google', 'facebook', 'apple']
  },
  JP: {
    code: 'JP',
    name: '日本',
    language: 'ja',
    currency: 'JPY',
    paymentProvider: 'stripe',
    authProviders: ['google', 'facebook']
  },
  SEA: {
    code: 'SEA',
    name: 'Southeast Asia',
    language: 'en',
    currency: 'USD',
    paymentProvider: 'stripe',
    authProviders: ['google', 'facebook']
  }
}

// ============================================
// Runtime Region Detection (with Build-time Fallback)
// ============================================

/**
 * 현재 Region 가져오기 (빌드 타임 상수 우선)
 */
export function getRegion(): Region {
  // 1순위: 빌드 타임 상수 (가장 정확)
  if (typeof __REGION__ !== 'undefined') {
    return __REGION__
  }
  
  // 2순위: 환경 변수 (개발 환경)
  if (import.meta.env.VITE_REGION) {
    return import.meta.env.VITE_REGION as Region
  }
  
  // 3순위: 호스트네임 기반 감지 (런타임 fallback)
  const hostname = window.location.hostname
  
  if (hostname.includes('live.ur-team.com') || hostname.includes('kr.')) {
    return 'KR'
  }
  
  if (hostname.includes('global.ur-team.com') || hostname.includes('global.')) {
    return 'GLOBAL'
  }
  
  if (hostname.includes('jp.')) {
    return 'JP'
  }
  
  if (hostname.includes('sea.')) {
    return 'SEA'
  }
  
  // 기본값: KR
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
// Region Check Helpers (Tree-shakable)
// ============================================

/**
 * KR Region 체크 (Tree-shakable)
 * 
 * @returns KR 빌드에서는 항상 true, GLOBAL 빌드에서는 항상 false
 * @example
 * ```typescript
 * if (isKorea()) {
 *   // KR 전용 코드 (GLOBAL 빌드에서 제거됨)
 *   await import('./toss-payment')
 * }
 * ```
 */
export function isKorea(): boolean {
  // 빌드 타임 상수 사용 (Tree-shaking 가능)
  if (typeof __IS_KR__ !== 'undefined') {
    return __IS_KR__
  }
  
  // Fallback: 런타임 체크
  return getRegion() === 'KR'
}

/**
 * GLOBAL Region 체크 (Tree-shakable)
 * 
 * @returns GLOBAL 빌드에서는 항상 true, KR 빌드에서는 항상 false
 * @example
 * ```typescript
 * if (isGlobal()) {
 *   // GLOBAL 전용 코드 (KR 빌드에서 제거됨)
 *   await import('./stripe-payment')
 * }
 * ```
 */
export function isGlobal(): boolean {
  // 빌드 타임 상수 사용 (Tree-shaking 가능)
  if (typeof __IS_GLOBAL__ !== 'undefined') {
    return __IS_GLOBAL__
  }
  
  // Fallback: 런타임 체크
  return getRegion() === 'GLOBAL'
}

/**
 * 특정 Region 체크
 */
export function isRegion(region: Region): boolean {
  return getRegion() === region
}

// ============================================
// Feature Flag Helpers
// ============================================

/**
 * Kakao 로그인 사용 가능 여부
 */
export function isKakaoAuthEnabled(): boolean {
  // KR 빌드에서만 true (tree-shaking 가능)
  if (typeof __IS_KR__ !== 'undefined' && __IS_KR__) {
    return true
  }
  
  // Fallback: Region config 확인
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
  // KR 빌드에서만 true (tree-shaking 가능)
  if (typeof __IS_KR__ !== 'undefined' && __IS_KR__) {
    return true
  }
  
  // Fallback: Region config 확인
  const config = getRegionConfig()
  return config.paymentProvider === 'toss'
}

/**
 * Stripe Payment 사용 가능 여부
 */
export function isStripePaymentEnabled(): boolean {
  // GLOBAL 빌드에서만 true (tree-shaking 가능)
  if (typeof __IS_GLOBAL__ !== 'undefined' && __IS_GLOBAL__) {
    return true
  }
  
  // Fallback: Region config 확인
  const config = getRegionConfig()
  return config.paymentProvider === 'stripe'
}

// ============================================
// Payment Provider Import (Lazy)
// ============================================

/**
 * 결제 제공자 동적 Import
 * 
 * @example
 * ```typescript
 * const paymentModule = await getPaymentProvider()
 * await paymentModule.initialize()
 * ```
 */
export async function getPaymentProvider() {
  // KR: Toss Payment (lazy load로 수정)
  if (isKorea()) {
    // ⚠️ 실제 toss-payment 모듈이 구현되면 import
    // return await import('@/lib/toss-payment')
    throw new Error('Toss Payment module not implemented yet')
  }
  
  // GLOBAL: Stripe (lazy load로 수정)
  if (isGlobal()) {
    // ⚠️ 실제 stripe-payment 모듈이 구현되면 import
    // return await import('@/lib/stripe-payment')
    throw new Error('Stripe Payment module not implemented yet')
  }
  
  throw new Error(`Unsupported region: ${getRegion()}`)
}

/**
 * 인증 제공자 동적 Import
 * 
 * @example
 * ```typescript
 * const authModule = await getAuthProvider('kakao')
 * await authModule.login()
 * ```
 */
export async function getAuthProvider(provider: 'kakao' | 'google') {
  if (provider === 'kakao' && isKakaoAuthEnabled()) {
    return await import('@/features/auth/services/KakaoAuthService')
  }
  
  if (provider === 'google' && isGoogleAuthEnabled()) {
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
  const config = getRegionConfig()
  
  console.group('🌍 Region Configuration')
  console.log('Region:', config.code)
  console.log('Name:', config.name)
  console.log('Language:', config.language)
  console.log('Currency:', config.currency)
  console.log('Payment Provider:', config.paymentProvider)
  console.log('Auth Providers:', config.authProviders.join(', '))
  console.log('Build-time Constants:', {
    __REGION__: typeof __REGION__ !== 'undefined' ? __REGION__ : 'undefined',
    __IS_KR__: typeof __IS_KR__ !== 'undefined' ? __IS_KR__ : 'undefined',
    __IS_GLOBAL__: typeof __IS_GLOBAL__ !== 'undefined' ? __IS_GLOBAL__ : 'undefined'
  })
  console.groupEnd()
}

// ============================================
// Exports
// ============================================

export default {
  getRegion,
  getRegionConfig,
  isKorea,
  isGlobal,
  isRegion,
  isKakaoAuthEnabled,
  isGoogleAuthEnabled,
  isTossPaymentEnabled,
  isStripePaymentEnabled,
  getPaymentProvider,
  getAuthProvider,
  logRegionInfo
}
