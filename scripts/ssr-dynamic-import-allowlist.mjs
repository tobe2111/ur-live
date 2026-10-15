/**
 * 🧊 서버 렌더 번들에서 **동적 import 를 허용목록만** 남긴다 (2026-10-15 — 상세 서버 렌더 3단계, 앱 전체 이어받기).
 *
 * 서버 렌더 진입점(`src/ssr/pass-detail-entry.tsx`)은 앱(`App`) 전체를 그린다. `App` 은 페이지 150여 개를
 * `lazy(() => import(...))` 로 들고 있고, 워커는 한 파일만 받으므로(`inlineDynamicImports`) 그대로 두면
 * **앱 전체가 워커에 들어간다** — 무료 플랜 워커 한도(압축 3MB)를 넘는다. 그리고 서버가 실제로 그리는 것은
 * 이용권 상세 한 페이지다.
 *
 * ⇒ 동적 import 는 서버가 첫 화면을 그리는 데 **실제로 필요한 것만** 남기고 나머지는 빈 자리로 바꾼다:
 *   - 페이지: 서버가 그리는 페이지(`ALLOWED_PAGES`)
 *   - 문구: 한국어 core 문구(`i18nReady` 가 기다린다). 다른 언어·대시보드 문구는 빈 묶음
 * 빈 자리는 **영원히 풀리지 않는 약속을 던지는 컴포넌트**다 — 서버가 실수로 그리면 Suspense 가 "브라우저에서 그려라"
 * 표식(`<!--$!-->`)을 남기고(던져서 깨지지 않는다), 그 표식은 스모크 검사(`check-pass-ssr-smoke.mjs`)가 잡는다.
 * 이펙트 안의 동적 import(`import('@/lib/api')` 등)는 서버에서 돌지 않으므로 빈 자리여도 무해하다.
 *
 * 새 표면을 서버 렌더에 넣을 때 그 페이지를 `ALLOWED_PAGES` 에 더한다(시험이 진입점의 preloadBootPage 와 대조).
 */
import path from 'node:path'

/** 서버가 그리는 페이지 — 레포 루트 기준 경로. */
export const ALLOWED_PAGES = ['src/pages/GroupBuyDetailPage.tsx']
/** 서버가 그리는 문구 묶음(쿼리 포함, 그대로 비교). */
export const ALLOWED_LOCALE = 'public/locales/ko/translation.json?i18n-core'

const STUB_PAGE = '\0ssr-stub-page'
const STUB_LOCALE = '\0ssr-stub-locale'

export function ssrDynamicImportAllowlistPlugin(root) {
  const allowedPages = new Set(ALLOWED_PAGES.map((p) => path.resolve(root, p)))
  const allowedLocale = path.resolve(root, ALLOWED_LOCALE.split('?')[0]) + '?' + ALLOWED_LOCALE.split('?')[1]
  const kept = []
  return {
    name: 'ssr-dynamic-import-allowlist',
    enforce: 'pre',
    async resolveDynamicImport(specifier, importer) {
      if (typeof specifier !== 'string') return null
      const r = await this.resolve(specifier, importer, { skipSelf: true })
      if (!r || r.external) return null
      const id = r.id
      if (allowedPages.has(id) || id === allowedLocale) { kept.push(path.relative(root, id)); return r }
      if (/[\\/]public[\\/]locales[\\/].+\.json(\?|$)/.test(id)) return STUB_LOCALE
      return STUB_PAGE
    },
    load(id) {
      if (id === STUB_LOCALE) return 'export default {}'
      if (id === STUB_PAGE) {
        return 'const never = new Promise(() => {});\n' +
          'export default function SsrStubPage() { throw never }\n'
      }
      return null
    },
    buildEnd() {
      // 허용목록이 하나도 안 걸렸으면 진입점·경로가 바뀐 것이다 — 조용히 빈 번들을 만들지 말고 멈춘다.
      const want = [...ALLOWED_PAGES, ALLOWED_LOCALE.split('?')[0]]
      for (const w of want) if (!kept.some((k) => k.split('?')[0] === w)) this.error(`[ssr-allowlist] 허용 import 가 한 번도 안 걸렸다: ${w}`)
    },
  }
}
