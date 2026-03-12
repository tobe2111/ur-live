/**
 * Region Configuration (Legacy Compatibility)
 * 
 * ⚠️ DEPRECATED: Use @/shared/config/region instead
 * 
 * This file is kept for backward compatibility.
 * All new code should import from @/shared/config/region
 */

// Re-export from the new centralized location
export {
  type Region,
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
  logRegionInfo
} from '@/shared/config/region'

import { isKorea as _isKorea } from '@/shared/config/region'

// Legacy compatibility exports
export const REGION = (() => {
  if (typeof (globalThis as any).__REGION__ !== 'undefined') {
    return (globalThis as any).__REGION__ as 'KR' | 'GLOBAL'
  }
  return (import.meta.env.VITE_REGION || 'KR') as 'KR' | 'GLOBAL'
})()

export const getLoginProvider = () => {
  return _isKorea() ? 'kakao' : 'google'
}

export const getDefaultLanguage = () => {
  return _isKorea() ? 'ko' : 'en'
}

export const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 
    (_isKorea() ? 'https://live.ur-team.com' : 'https://global.ur-team.com')
}

export const getSupportedLanguages = () => {
  return _isKorea() 
    ? ['ko', 'en']
    : ['en', 'ko', 'ja', 'zh']
}

