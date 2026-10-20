/**
 * 🌐 다국어 노출 — **hreflang 을 만들지 않고, 대신 거짓 선언을 지웠다** (2026-10-12)
 *
 * 대표 *"내 판단이 필요한 3가지 모두 가장 이상적으로 해줄 수 없어?"* 의 ③.
 *
 * ## 🔴 결론부터 — 이 항목의 "가장 이상적" 은 **만들지 않는 것**이다
 *
 * 처음엔 "hreflang 0건" 을 결함으로 올렸다. 재 보니 **그게 올바른 상태**이고, 실제 결함은
 * 반대쪽에 있었다 — 우리가 **다국어라고 거짓 선언**을 하고 있었다.
 *
 *     라이브 실측: hreflang **0건** · `og:locale:alternate` **5건**(en_US·ja_JP·zh_CN·es_ES·fr_FR)
 *
 * `og:locale:alternate` 는 *"같은 URL 이 그 언어로도 존재한다"* 는 뜻이다. 그런데
 *
 *   · 언어 전환은 `i18n.changeLanguage` + localStorage 라 **URL 이 한 글자도 안 바뀐다**.
 *   · 그래서 그 다섯 언어의 **URL 이 존재하지 않는다** — 가리킬 대상이 없다.
 *   · 공유·크롤은 **서버 HTML** 을 받는데 거기엔 `ko_KR` 하나뿐이다(봇 셸 · `index.html`).
 *     즉 그 5건은 **크롤러에게 닿지도 않으면서 서버 신호와만 어긋났다.**
 *
 * ## 왜 다국어 hreflang 을 짓지 않는가 (근거)
 *
 *   1. **가리킬 URL 이 없다.** hreflang 은 URL↔언어 쌍이다. 언어별 URL 을 만들려면 라우팅 ·
 *      모든 `<Link>` · sitemap ×6 · canonical 을 전부 바꿔야 한다(소비자 경로 전수).
 *   2. **구글이 단일 언어 사이트엔 필요 없다고 명시한다.** hreflang 은 *같은 내용의 다른 언어
 *      판*이 있을 때의 도구다.
 *   3. **재고가 한국 오프라인이다.** 이용권은 한국 매장에서 QR·PIN 으로 쓴다 — 영어 질의로 들어온
 *      트래픽이 살 수 있는 물건이 거의 없다. 노출을 늘려도 전환이 0 이면 품질 평가만 깎인다.
 *   4. **기계번역 로케일은 역효과다.** 지금 `public/locales/{en,ja,zh,es,fr}` 는 UI 문구뿐이고
 *      **상품·매장 콘텐츠는 한국어 그대로**다. 그 상태로 언어별 URL 을 내면 "번역이 안 된 번역
 *      페이지" 가 5배로 색인된다(thin/duplicate).
 *
 * ⇒ **지금 이상적인 상태 = 단일 언어 신호를 하나로 맞추는 것.** 그래서 이 시험은 그 일관성을
 *   잠그고, 다국어로 갈 때의 **전제 조건**을 기계로 걸어 둔다(아래 ③).
 *
 * ## ⚠️ 못 보는 것
 *
 * - 구글이 한국어 질의에서 우리를 어떻게 평가하는지(외부 판정 · 서치콘솔은 대표만 본다)
 * - 로케일 파일의 번역 품질
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stripComments } from '../helpers/source-text'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')
const SEO = read('src/components/SEO.tsx')
const WORKER = read('src/worker/index.ts')
const INDEX = read('index.html')
const BRAND = read('src/shared/seo/brand-jsonld.ts')
const LIST_LD = read('src/worker/utils/surface-list-jsonld.ts')
const APP = read('src/App.tsx')
/**
 * 🩸 **설명 주석과 단언이 같은 문자열을 공유할 수 없다.** 이 파일의 머리말과 `SEO.tsx` 의 주석이
 * `og:locale:alternate`·`hreflang` 을 **인용**하는데, 원문을 그대로 검사하면 그 주석에 걸려
 * 거짓 빨간불이 난다(이 레포가 `d1-migrate`·`retired-surface` 에서 이미 두 번 겪은 자리다).
 * ⇒ 부재 판정은 **주석을 걷어낸 실행되는 줄**로만 한다.
 */
const code = (s: string) => stripComments(s)
/** HTML 은 `<!-- -->` 를 따로 걷는다. */
const htmlCode = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '')

describe('① 거짓 다국어 선언 0 — 가리킬 URL 이 없는 claim 금지', () => {
  it('`og:locale:alternate` 가 어디에도 없다', () => {
    for (const [n, s] of [['SEO.tsx', code(SEO)], ['worker/index.ts', code(WORKER)], ['index.html', htmlCode(INDEX)]] as const) {
      expect(s, `${n} 에 og:locale:alternate 가 있다 — 그 URL 은 존재하지 않는다`).not.toContain('og:locale:alternate')
    }
  })

  // 🩸 **대소문자를 가리면 놓친다** — JSX 는 `hrefLang`, HTML 은 `hreflang` 이다(주입이 잡았다).
  it('`hreflang` 도 없다 (RSS `rel=alternate` 는 언어 선언이 아니라 무관)', () => {
    for (const [n, s] of [['SEO.tsx', code(SEO)], ['worker/index.ts', code(WORKER)], ['index.html', htmlCode(INDEX)]] as const) {
      expect(s, n).not.toMatch(/hreflang/i)
    }
  })
})

describe('② 단일 언어 신호가 한 값으로 맞는다', () => {
  it('`og:locale` 은 세 자리에서 전부 `ko_KR` (고정)', () => {
    expect(SEO).toContain("const OG_LOCALE = 'ko_KR'")
    expect(SEO).toContain('<meta property="og:locale" content={OG_LOCALE} />')
    expect(WORKER).toContain('<meta property="og:locale" content="ko_KR" />')
    expect(INDEX).toContain('<meta property="og:locale" content="ko_KR" />')
  })

  it('`og:locale` 이 i18n 언어로 흔들리지 않는다 — 서버 값과 갈릴 수 없게', () => {
    // 🔑 그 값은 **크롤러에게 닿지도 않으면서**(크롤은 서버 HTML 을 받는다) 서버와 어긋나기만 했다.
    const m = SEO.match(/property="og:locale"\s+content=\{([^}]*)\}/)
    expect(m, 'og:locale 배선이 낡았다').toBeTruthy()
    expect(m![1].trim()).toBe('OG_LOCALE')
  })

  it('`<html lang>` 과 `inLanguage` 가 같은 언어다', () => {
    expect(INDEX).toMatch(/<html lang="ko"/)
    const langs = new Set<string>()
    for (const s of [BRAND, LIST_LD, INDEX]) {
      for (const m of s.matchAll(/inLanguage"?\s*:\s*'?"?([a-zA-Z-]+)'?"?/g)) langs.add(m[1])
    }
    expect(langs.size, `inLanguage 값이 갈렸다: ${[...langs].join(', ')}`).toBe(1)
    expect([...langs][0]).toBe('ko')
  })

  it('`inLanguage` 를 실제로 읽어 냈다 (0건이면 통과가 아니라 고장)', () => {
    const n = [BRAND, LIST_LD, INDEX].reduce((a, s) => a + [...s.matchAll(/inLanguage/g)].length, 0)
    expect(n).toBeGreaterThanOrEqual(4)
  })
})

describe('③ 🔴 반대 방향 — 다국어로 갈 때의 전제 조건을 기계로 걸어 둔다', () => {
  /**
   * 이 시험은 "다국어 금지" 가 아니다. **URL 없이 선언만 하는 것**을 막는다.
   * 언어별 URL(`/en/...` 같은 경로 접두)이 라우터에 생기면 위 ① 은 그때 풀고
   * hreflang 을 짝으로 넣으면 된다 — 그 순서가 뒤집히면 구글에 거짓을 말하는 것이다.
   */
  it('언어 접두 라우트가 없다 = 다국어 claim 의 전제가 아직 없다', () => {
    const prefixed = [...APP.matchAll(/path="\/(en|ja|zh|es|fr)(?:\/|")/g)].map(m => m[1])
    expect(prefixed, '언어 접두 라우트가 생겼다 — 이제 hreflang 을 짝으로 넣을 수 있다(① 을 함께 갱신)').toEqual([])
  })

  it('로케일 파일은 UI 문구용으로 남아 있다 — 지우는 작업이 아니다', () => {
    // ③은 "다국어를 버린다" 가 아니다. 앱 안 언어 전환은 그대로 돌아간다.
    for (const l of ['en', 'ja', 'zh', 'es', 'fr']) {
      expect(read(`public/locales/${l}/translation.json`).length).toBeGreaterThan(1000)
    }
  })
})
