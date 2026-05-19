import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// 🛡️ 2026-05-07: locales 청크 분할 — 6개 언어를 한 번에 로드하던 것을
//   기본 언어만 eagerly load + 나머지는 lazy load 로 변경.
//   이전: locales-*.js 949KB (gzip 398KB)
//   이후: 기본 언어만 ~150-180KB, 나머지는 changeLanguage 시 fetch
//
//   Vite import.meta.glob 으로 빌드 시 6개 언어를 각 청크로 분리.
//   eager 로드 대신 dynamic import → 각 locale 별 별도 청크 생성.

const SUPPORTED = ['ko', 'en', 'ja', 'zh', 'es', 'fr'] as const
type Lang = typeof SUPPORTED[number]

// 빌드 시 각 언어별 dynamic import 함수 (각각 별도 청크 생성)
const loaders: Record<Lang, () => Promise<{ default: Record<string, unknown> }>> = {
  ko: () => import('../public/locales/ko/translation.json'),
  en: () => import('../public/locales/en/translation.json'),
  ja: () => import('../public/locales/ja/translation.json'),
  zh: () => import('../public/locales/zh/translation.json'),
  es: () => import('../public/locales/es/translation.json'),
  fr: () => import('../public/locales/fr/translation.json'),
}

function detectDefaultLanguage(): Lang {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname.includes('world.ur-team.com') || hostname.includes('global.') || hostname.includes('localhost:5174')) {
      return 'en'
    }
  }
  const env = (import.meta.env.VITE_DEFAULT_LANGUAGE || 'ko') as Lang
  return (SUPPORTED.includes(env) ? env : 'ko')
}

function detectInitialLanguage(): Lang {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage?.getItem('i18nextLng')
      if (stored) {
        const base = stored.split('-')[0] as Lang
        if (SUPPORTED.includes(base)) return base
      }
      const nav = window.navigator?.language?.split('-')[0] as Lang | undefined
      if (nav && SUPPORTED.includes(nav)) return nav
    } catch {
      // ignore
    }
  }
  return detectDefaultLanguage()
}

const defaultLanguage = detectDefaultLanguage()
const initialLanguage = detectInitialLanguage()

const loaded = new Set<Lang>()

async function ensureLanguageLoaded(lang: string): Promise<void> {
  if (_done_ensureLanguageLoaded.has(lang)) return
  _done_ensureLanguageLoaded.add(lang)
  const base = lang.split('-')[0] as Lang
  if (!SUPPORTED.includes(base)) return
  if (loaded.has(base)) return
  try {
    const mod = await loaders[base]()
    i18n.addResourceBundle(base, 'translation', mod.default || mod, true, true)
    loaded.add(base)
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(`[i18n] Failed to load locale: ${base}`, e)
    }
  }
}

// 초기 언어 (사용자 감지 결과) 와 fallback 언어 (보통 ko) 를 동기적으로 미리 로드.
// init() 전에 resources 에 채워 두면 첫 렌더 깜박임 없음.
async function bootstrap() {
  // 우선 i18next init - 빈 resources 로 시작
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      lng: initialLanguage,
      fallbackLng: defaultLanguage,
      debug: false,
      interpolation: { escapeValue: false },
      resources: {},
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'i18nextLng',
      },
      supportedLngs: SUPPORTED as unknown as string[],
      ns: ['translation'],
      defaultNS: 'translation',
      // 첫 로드 동안 화면이 한순간 빈 텍스트로 보이는 걸 막음
      partialBundledLanguages: true,
      react: { useSuspense: false },
    })

  // 초기 언어 + fallback 언어 동시 로드 (대부분 같은 ko 라 1번)
  const need = new Set<Lang>([initialLanguage, defaultLanguage])
  await Promise.all(Array.from(need).map(ensureLanguageLoaded))
}

// changeLanguage 호출 시 자동으로 lazy load 되도록 hook
const originalChangeLanguage = i18n.changeLanguage.bind(i18n)
i18n.changeLanguage = (async (lng?: string, ...rest: unknown[]) => {
  if (lng) await ensureLanguageLoaded(lng)
  // @ts-expect-error - i18next 타입 스프레드 호환
  return originalChangeLanguage(lng, ...rest)
}) as typeof i18n.changeLanguage

// 부트스트랩 시작 (모듈 로드 시 자동 실행)
void bootstrap()

export default i18n


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureLanguageLoaded = new WeakSet<object>()
