import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

// ✅ Runtime region detection (single build → runtime hostname check)
function detectDefaultLanguage(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // GLOBAL 도메인이면 영어 기본
    if (hostname.includes('world.ur-team.com') || hostname.includes('global.') || hostname.includes('localhost:5174')) {
      return 'en'
    }
  }
  return import.meta.env.VITE_DEFAULT_LANGUAGE || 'ko'
}

function detectSupportedLngs(): string[] {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname.includes('world.ur-team.com') || hostname.includes('global.') || hostname.includes('localhost:5174')) {
      return ['en', 'ko', 'ja', 'zh']
    }
  }
  return ['ko', 'en']
}

const defaultLanguage = detectDefaultLanguage()

i18n
  .use(HttpBackend) // 번역 파일 로드
  .use(LanguageDetector) // 브라우저 언어 감지
  .use(initReactI18next) // React 통합
  .init({
    fallbackLng: defaultLanguage,
    debug: import.meta.env.DEV, // 개발 환경에서만 디버그
    
    interpolation: {
      escapeValue: false, // React가 XSS 방지 처리
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json', // 번역 파일 경로
    },
    
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'i18nextLng',
    },
    
    // 지원 언어 (runtime detection)
    supportedLngs: detectSupportedLngs(),
    
    // 기본 네임스페이스
    ns: ['translation'],
    defaultNS: 'translation',
    
    // 로딩 실패 시 콜백
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env.DEV) {
        console.warn(`Missing translation: ${key}`)
      }
    }
  })

export default i18n
