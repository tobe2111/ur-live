/**
 * Region Configuration
 * 
 * 한국(KR)과 글로벌(GLOBAL) 버전을 구분하는 설정 유틸리티
 */

export type Region = 'KR' | 'GLOBAL'

export const REGION = (import.meta.env.VITE_REGION || 'KR') as Region

export const isKorea = () => REGION === 'KR'
export const isGlobal = () => REGION === 'GLOBAL'

export const getLoginProvider = () => {
  return isKorea() ? 'kakao' : 'google'
}

export const getPaymentProvider = () => {
  return isKorea() ? 'toss' : 'stripe'
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
