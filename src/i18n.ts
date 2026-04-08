import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// 번역 파일을 빌드 시 번들에 포함 (네트워크 요청 없이 즉시 전환)
import ko from '../public/locales/ko/translation.json'
import en from '../public/locales/en/translation.json'
import ja from '../public/locales/ja/translation.json'
import zh from '../public/locales/zh/translation.json'
import es from '../public/locales/es/translation.json'
import fr from '../public/locales/fr/translation.json'

function detectDefaultLanguage(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname.includes('world.ur-team.com') || hostname.includes('global.') || hostname.includes('localhost:5174')) {
      return 'en'
    }
  }
  return import.meta.env.VITE_DEFAULT_LANGUAGE || 'ko'
}

const defaultLanguage = detectDefaultLanguage()

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: defaultLanguage,
    debug: false,

    interpolation: {
      escapeValue: false,
    },

    resources: {
      ko: { translation: ko },
      en: { translation: en },
      ja: { translation: ja },
      zh: { translation: zh },
      es: { translation: es },
      fr: { translation: fr },
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    supportedLngs: ['ko', 'en', 'ja', 'zh', 'es', 'fr'],

    ns: ['translation'],
    defaultNS: 'translation',
  })

export default i18n
