import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { CRITICAL_I18N } from './i18n-critical'

// 🛡️ 2026-05-07: locales 청크 분할 — 6개 언어를 한 번에 로드하던 것을
//   기본 언어만 eagerly load + 나머지는 lazy load 로 변경.
//   이전: locales-*.js 949KB (gzip 398KB)
//   이후: 기본 언어만 ~150-180KB, 나머지는 changeLanguage 시 fetch
//
//   Vite import.meta.glob 으로 빌드 시 6개 언어를 각 청크로 분리.
//   eager 로드 대신 dynamic import → 각 locale 별 별도 청크 생성.

const SUPPORTED = ['ko', 'en', 'ja', 'zh', 'es', 'fr'] as const
type Lang = typeof SUPPORTED[number]

/**
 * 🏷️ 2026-08-11 (AB 스윕 라이브 실측): **번역자용 표식이 사용자 화면에 나가고 있었다.**
 *
 * `scripts/check-i18n-sync.mjs --fix` 는 6개 언어의 **키 동수**를 맞추려고, 빠진 키를
 * `"[TODO:en] 자주 묻는 질문"` 처럼 **ko 값에 마커를 붙여** 채운다. 번역자에게 "여기 아직 안 됐다"를
 * 알리려는 표식인데, i18next 는 그 값을 그대로 렌더한다. 영어로 전환하고 `/faq` 를 열면 화면에
 * 이렇게 뜬다:
 *
 *     [TODO:en] 자주 묻는 질문
 *     [TODO:en] 무엇을 도와드릴까요?
 *
 * 실측: `[TODO:*]` 가 **언어당 289개**(ko 0). 대부분 소비자 표면이다 —
 * `introduce` 65 · `register` 37 · `faq` 36 · `orderDetail` 35 · `groupbuy` 28 · `referral` 18.
 * 언어 전환은 마이 페이지(`LanguageSection`)에 **실제로 노출**돼 있어 누구나 이 상태에 빠질 수 있다.
 *
 * ⚠️ **키를 지우면 안 된다** — `check-i18n-sync` 가 키 동수를 강제하므로 가드가 깨진다. 그래서
 * **렌더 직전에 마커만 벗긴다.** 결과는 i18next 의 ko 폴백과 같은 화면(한국어)이고, 마커는 사라진다.
 * 마커가 없는 값에는 아무 일도 하지 않는다.
 *
 * ⚠️ **이건 번역이 아니다.** 289개를 실제로 번역하는 것은 별건이고, 이 서비스가 한국 전용
 * (`urdeal.kr` · GLOBAL 폐기 #804)이라 우선순위는 대표 판단 사항이다. 이 안전판은 그 판단과
 * 무관하게 "표식이 사용자에게 보이는" 것만 영구히 막는다.
 */
export const TODO_MARKER = /^\[TODO:[a-z]{2}\]\s*/

const stripTodoMarker = {
  type: 'postProcessor' as const,
  name: 'stripTodoMarker',
  process(value: string) {
    return typeof value === 'string' ? value.replace(TODO_MARKER, '') : value
  },
}

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
  // 🛡️ 2026-05-19: WeakSet memoize 회귀 수정.
  //   memoize-ensure-fix.mjs 가 lang: string 을 WeakSet 키로 변환 → TypeError →
  //   locale 로드 실패 → 모든 i18n 키가 raw 노출 (mainHome.nearbyTitle 등).
  //   `loaded: Set<Lang>` (아래) 이 이미 중복 호출 방어 → 별도 memoize 불필요.
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

// 🛡️ 2026-05-25 (loading P0): critical i18n inline — main bundle 에 ~5KB 포함.
//   첫 paint 부터 한국어 표시 (locale chunk fetch 대기 X).
//   bootstrap 의 await 가 React mount 안 차단 (fire-and-forget) 이지만,
//   critical 키들은 init resources 에 즉시 포함되어 t() 호출 즉시 동작.
function buildInitialResources() {
  const resources: Record<string, { translation: any }> = {}
  for (const [lang, ns] of Object.entries(CRITICAL_I18N)) {
    resources[lang] = { translation: ns }
  }
  return resources
}

// 초기 언어 (사용자 감지 결과) 와 fallback 언어 (보통 ko) 를 동기적으로 미리 로드.
// init() 전에 resources 에 채워 두면 첫 렌더 깜박임 없음.
async function bootstrap() {
  // 우선 i18next init - critical resources 로 시작 (background 에 full translation 추가)
  await i18n
    .use(LanguageDetector)
    .use(stripTodoMarker)
    .use(initReactI18next)
    .init({
      lng: initialLanguage,
      fallbackLng: defaultLanguage,
      debug: false,
      interpolation: { escapeValue: false },
      resources: buildInitialResources(),
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
      // 🏷️ 번역자용 `[TODO:xx]` 표식이 화면에 나가지 않게 한다(위 stripTodoMarker 주석 참조).
      postProcess: ['stripTodoMarker'],
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
