// 🪶 2026-10-14: i18next·react-i18next·감지기(첫 화면 18.2 KB br) → 같은 동작의 작은 엔진. 감지는 아래 함수가 한다.
import i18n, { initReactI18next } from './lib/i18n-lite'
import { CRITICAL_I18N } from './i18n-critical'
import { CONSUMER_LANGUAGE_SWITCH_HIDDEN } from './shared/feature-flags'

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
// 🌐 2026-10-11: 손님용(core)과 대시보드용(dash)을 나눠 받는다 — 빌드 플러그인(`scripts/i18n-split.mjs`)이
//   `?i18n-core|dash` 쿼리를 보고 나눈다. 손님 첫 접속이 받는 양이 ko 기준 gzip 92 → 33 KB.
//   플러그인이 없는 환경(vitest)에서는 쿼리가 무시돼 두 쪽 모두 전체 파일이 온다(그래도 맞게 동작한다).
type Bundle = () => Promise<{ default: Record<string, unknown> }>
const loaders: Record<Lang, Bundle> = {
  ko: () => import('../public/locales/ko/translation.json?i18n-core'),
  en: () => import('../public/locales/en/translation.json?i18n-core'),
  ja: () => import('../public/locales/ja/translation.json?i18n-core'),
  zh: () => import('../public/locales/zh/translation.json?i18n-core'),
  es: () => import('../public/locales/es/translation.json?i18n-core'),
  fr: () => import('../public/locales/fr/translation.json?i18n-core'),
}
const dashLoaders: Record<Lang, Bundle> = {
  ko: () => import('../public/locales/ko/translation.json?i18n-dash'),
  en: () => import('../public/locales/en/translation.json?i18n-dash'),
  ja: () => import('../public/locales/ja/translation.json?i18n-dash'),
  zh: () => import('../public/locales/zh/translation.json?i18n-dash'),
  es: () => import('../public/locales/es/translation.json?i18n-dash'),
  fr: () => import('../public/locales/fr/translation.json?i18n-dash'),
}

/** dash 문구가 필요한 화면 — 대시보드 주소. 마이의 판매 화면은 `ensureDashStrings()` 를 직접 부른다. */
const DASH_PATH_RE = /^\/(seller|admin|agency|supplier|wholesale|mall-admin|distributor)(\/|$)/
const DASH_KEY_RE = /^(seller|admin|agency|supplier|wholesale|live|liveWs)\./

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
  // 🌐 2026-08-11: 언어 전환을 닫았으면 **저장된 선택도 무시하고 ko 로 고정**한다.
  //   숨기기만 하면 이미 en 으로 바꿔 둔 사용자는 되돌릴 문이 없어 **갇힌다** — 숨김과 고정은 한 쌍이다.
  //   (셀러 대시보드의 언어 전환은 이 함수를 안 타므로 영향 없다.)
  if (CONSUMER_LANGUAGE_SWITCH_HIDDEN) return 'ko'
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
const dashLoaded = new Set<Lang>()
/** dash 를 한 번이라도 요청했나 — 언어를 바꾸면 새 언어의 dash 도 같이 받는다. */
let dashWanted = false

async function ensureDashLoaded(lang: string): Promise<void> {
  const base = lang.split('-')[0] as Lang
  if (!SUPPORTED.includes(base) || dashLoaded.has(base)) return
  dashLoaded.add(base)
  try {
    const mod = await dashLoaders[base]()
    // deep merge — core 에 이미 있는 손님용 키는 그대로, 나머지만 더한다. 'added' 이벤트로 화면이 다시 그려진다.
    i18n.addResourceBundle(base, 'translation', mod.default || mod, true, false)
  } catch (e) {
    dashLoaded.delete(base)
    if (import.meta.env.DEV) console.error(`[i18n] Failed to load dash locale: ${base}`, e)
  }
}

/**
 * 셀러·어드민·에이전시·제조사·도매 문구를 받는다. 대시보드 주소에서는 부팅 때 알아서 부르고,
 * 마이 안의 판매 화면처럼 손님 주소에서 대시보드 화면을 띄우는 곳은 직접 부른다.
 * 빠뜨려도 괜찮다 — 없는 dash 키를 요청하는 순간 `missingKeyHandler` 가 불러온다(안전망).
 */
export function ensureDashStrings(): Promise<void> {
  dashWanted = true
  const langs = new Set<string>([i18n.language || initialLanguage, defaultLanguage])
  return Promise.all(Array.from(langs).map(ensureDashLoaded)).then(() => undefined)
}

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
      // 🌐 2026-10-11: dash 문구가 나중에 도착하면('added') 화면을 다시 그린다.
      react: { useSuspense: false, bindI18nStore: 'added' },
      // 안전망 — core 에 없는 dash 키가 요청되면 그 자리에서 dash 를 받는다(받는 동안은 defaultValue 가 보인다).
      saveMissing: true,
      missingKeyHandler: (_lngs: readonly string[], _ns: string, key: string) => {
        if (DASH_KEY_RE.test(key) && !dashLoaded.has((i18n.language || initialLanguage).split('-')[0] as Lang)) void ensureDashStrings()
      },
      // 🏷️ 번역자용 `[TODO:xx]` 표식이 화면에 나가지 않게 한다(위 stripTodoMarker 주석 참조).
      postProcess: ['stripTodoMarker'],
    })

  // 초기 언어 + fallback 언어 동시 로드 (대부분 같은 ko 라 1번)
  const need = new Set<Lang>([initialLanguage, defaultLanguage])
  // 대시보드 주소로 들어왔으면 dash 도 처음부터 함께(페이지 청크와 병렬) — 키가 잠깐 보이는 일을 줄인다.
  const onDash = typeof window !== 'undefined' && DASH_PATH_RE.test(window.location.pathname)
  await Promise.all([...Array.from(need).map(ensureLanguageLoaded), ...(onDash ? [ensureDashStrings()] : [])])
}

// changeLanguage 호출 시 자동으로 lazy load 되도록 hook
const originalChangeLanguage = i18n.changeLanguage.bind(i18n)
i18n.changeLanguage = (async (lng?: string, ...rest: unknown[]) => {
  if (lng) await Promise.all([ensureLanguageLoaded(lng), ...(dashWanted ? [ensureDashLoaded(lng)] : [])])
  // @ts-expect-error - i18next 타입 스프레드 호환
  return originalChangeLanguage(lng, ...rest)
}) as typeof i18n.changeLanguage

// 부트스트랩 시작 (모듈 로드 시 자동 실행)
/**
 * 🧊 2026-10-15 서버 렌더 이어받기: 이 약속이 풀리면 첫 화면이 쓸 한국어 문구(critical + core)가 다 들어와 있다.
 *   서버(`src/ssr/pass-detail-entry.tsx`)는 **이 모듈을 그대로** 불러 이 약속을 기다린 뒤 그리고,
 *   브라우저(`main.tsx`)는 서버가 그린 화면을 이어받기 전에 같은 약속을 기다린다 — 둘이 같은 문구로 그려야 이어받기가 안 갈린다.
 *   (사본을 따로 두면 언젠가 갈리고, 갈려도 에러는 0 이다 — React 가 조용히 화면을 버리고 다시 그릴 뿐.)
 */
export const i18nReady: Promise<void> = bootstrap().catch(() => {})

export default i18n


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureLanguageLoaded = new WeakSet<object>()
