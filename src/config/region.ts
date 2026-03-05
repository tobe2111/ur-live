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

// Legacy compatibility exports
export const REGION = (() => {
  if (typeof __REGION__ !== 'undefined') {
    return __REGION__
  }
  return (import.meta.env.VITE_REGION || 'KR') as 'KR' | 'GLOBAL'
})()

export const getLoginProvider = () => {
  return isKorea() ? 'kakao' : 'google'
}

export const getDefaultLanguage = () => {
  return isKorea() ? 'ko' : 'en'
}

export const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 
    (isKorea() ? 'https://live.ur-team.com' : 'https://global.ur-team.com')
}

export const getSupportedLanguages = () => {
  return isKorea() 
    ? ['ko', 'en']
    : ['en', 'ko', 'ja', 'zh']
}

