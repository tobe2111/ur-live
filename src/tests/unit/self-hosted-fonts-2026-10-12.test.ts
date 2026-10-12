/**
 * 🔤 첫 페인트가 남의 CDN 에 걸려 있지 않은가 (2026-10-12, 대표 "메인페이지 로딩 속도 문제도 확인해줘 느려").
 *
 * ■ 무엇을 재서 무엇을 고쳤나 (라이브 `urdeal.kr`, 아이폰13 에뮬)
 *   서버는 안 느렸다 — 워커 71ms, `X-SSR-Status: MAIN:kv-hit`, 풀스크린 로더 0회.
 *   느린 것은 **HTML 도착 후 첫 페인트까지 677ms** 였고, 그걸 `rel="stylesheet"` 두 개가 먹고 있었다:
 *
 *       우리 index-*.css                     37KB   →  92ms   (우리 오리진)
 *       jsdelivr pretendard …subset.min.css  12KB   → 384ms   ← 4배
 *       fonts.googleapis.com Poppins        0.2KB   → 382ms   ← 0.2KB 인데 같은 값
 *
 *   **비용은 바이트가 아니라 외부 오리진의 왕복이다**(preconnect 는 둘 다 이미 있었다).
 *   A/B(각 4회 중위값, 두 CSS 를 우리 오리진에 둔 것과 같게 즉시 응답):
 *       HTML→FCP  677ms → 337ms (340ms 단축) · 편차 264ms → 42ms
 *   빨라진 것보다 **편차가 준 게 더 중요하다** — 매 접속이 남의 CDN 사정에 걸려 있었다.
 *
 * ■ 이 시험이 지키는 것
 *   ① 첫 페인트를 막는 `<link rel="stylesheet">` 가 **외부 오리진을 가리키지 않는다**(핵심 불변식).
 *   ② 들여온 Pretendard 사본의 `src` 가 **상대경로 0건**이다 — 원본은 `../../../` 라 우리 오리진에
 *      그대로 두면 **폰트 92개가 전부 404**(디자인 전멸인데 에러 로그는 안 난다).
 *   ③ `index.html` 의 href 와 **실제 파일명이 같다** — 버전을 한쪽만 올리면 404.
 *   ④ Poppins 는 인라인 `@font-face` + 자가호스팅 woff2(876B)이고 `unicode-range` 가 원본 그대로다.
 *   ⑤ `_headers` 의 `/static/fonts/*` immutable — 지우면 전역 `no-store` 에 걸려 **매 방문 재다운로드**.
 *   ⑥ `src` 없는 `@font-face` 가 되살아나지 않는다(아래 🩸).
 *
 * 🩸 같은 자리에서 찾은 거짓 주석 둘 (둘 다 2026-10-12 수리)
 *   - `index.html` 이 jsdelivr 비용을 **"~50ms"** 라고 적어 뒀다. 실측 **384ms** — 8배.
 *     2026-04-30 이후 아무도 다시 재지 않았다. **추정값을 주석에 적고 떠나지 말 것.**
 *   - `@font-face { font-family:'Pretendard Variable'; font-display:optional; ascent-override:… }` 가
 *     **한 번도 적용된 적이 없다.** `src` 없는 `@font-face` 는 무효라 브라우저가 통째로 버린다
 *     (라이브 실측: Pretendard face 들의 `display` 가 **전부 `swap`**). 그래서 그 주석이 약속한
 *     "swap 없음 → LCP 영향 0" 도, 줄 높이 튐을 막으려던 `ascent/descent-override` 도 전부 죽어 있었다.
 *
 * ⚠️ 이 시험이 **못 막는 것**
 *   - 실제 FCP — jsdom 에 레이아웃·네트워크가 없다. 숫자는 브라우저가 판정한다
 *     (`node /tmp/.../ab2.mjs` 류 또는 `scripts/probe-loading.mjs`). 여기서는 **구조**만 본다.
 *   - 들여온 사본이 업스트림과 같은지 — CI 에 네트워크를 요구하면 안 되므로 **형태**만 본다
 *     (92개 · 상대경로 0 · swap). 버전 올릴 때는 그 파일 머리말의 절차를 따를 것.
 *   - Pages 가 `/static/**.css` 를 `text/css` 로 주는지 — 배포 후 1회 curl 로 봐야 한다(E4).
 *   - woff2 를 jsdelivr 에 남긴 선택 자체. 그쪽이 죽으면 폰트가 폴백으로 떨어진다(화면은 뜬다).
 *
 * 🩸 **이 시험 자신이 처음에 반쯤 헛돌았다**(pre-push 게이트가 잡았다). `index.html` 주석에 설명으로
 *   적은 `<style>`·`<link rel=stylesheet>` **글자**가 추출의 첫 매치가 되어 엉뚱한 구간을 검사했다.
 *   고친 방법 둘: ⓐ index.html 주석에서 그 태그 글자를 없앴다 ⓑ 검사 전에 HTML 주석을 걷고,
 *   추출물이 진짜 CSS 인지(`html{line-height`) 단언한다. ⇒ **주석에 태그를 쓰면 그 파일을 읽는
 *   모든 텍스트 가드가 오염된다.**
 *
 * 주입 매니페스트: scripts/mutations/self-hosted-fonts.mjs
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { readRaw, stripComments } from '../helpers/source-text'

/**
 * 🩸 `index.html` 은 **HTML 주석을 먼저 걷고** 봐야 한다 — 2026-10-12 에 이 시험이 그걸 안 해서
 *   **반쯤 헛돌았다.** 내가 주석 안에 설명으로 적은 `<style>` 글자가 `<style>…</style>` 추출의
 *   **첫 매치**가 되어, 추출된 "CSS" 가 주석 산문 가운데부터 시작했다. 그러면 ⓐ 실제 CSS 가 아닌
 *   것을 검사하고 ⓑ 주석 속 `@font-face` 예시를 진짜 규칙으로 센다(=내가 막으려던 바로 그 오탐).
 *   pre-push 게이트가 잡았다. ⇒ **주석에 태그 글자를 쓰지 말 것**(index.html 쪽도 함께 고쳤다)
 *   **그리고** 검사 전에 주석을 걷을 것. HTML 주석은 안에 `-->` 를 담을 수 없어 비탐욕 제거가 안전하다.
 */
const HTML_RAW = readRaw('index.html')
const HTML = HTML_RAW.replace(/<!--[\s\S]*?-->/g, '')
const HEADERS = readRaw('public/_headers')
const PRETENDARD = 'public/static/fonts/pretendard-dynamic-subset-v1.3.9.css'
const POPPINS = 'public/static/fonts/poppins-800-urdeal-v24.woff2'

/** 인라인 스타일 블록 안의 **실행되는** CSS. HTML 주석은 위에서 이미 걷혔고, CSS 주석은 공용 스캐너가 걷는다. */
function inlineCss(): string {
  const blocks = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1])
  expect(blocks.length, '`index.html` 에 인라인 스타일 블록이 없다 — 이 시험이 볼 대상이 사라졌다').toBeGreaterThan(0)
  const joined = blocks.join('\n')
  // 🛡️ 추출이 **진짜 CSS** 를 잡았는지 자기검증한다. 이 마커는 주석 산문에는 없고 critical reset 에만 있다 —
  //   2026-10-12 에 추출이 주석 가운데부터 시작해 이 시험이 헛돌았고, 그때 이 단언이 있었으면 바로 잡혔다.
  expect(joined, '추출한 인라인 CSS 에 critical reset 이 없다 — 엉뚱한 구간을 잡았다(위 🩸 참조)').toContain('html{line-height')
  const stripped = stripComments(joined)
  expect(stripped.length, 'CSS 주석 제거가 본문의 절반 이상을 먹었다 — 제거기를 의심할 것').toBeGreaterThan(joined.length * 0.4)
  expect(stripped.length, 'CSS 주석이 하나도 안 걷혔다 — 제거기가 no-op 이다(2026-10-12 에 실제로 그랬다)').toBeLessThan(joined.length)
  return stripped
}

/** 렌더를 막는 스타일시트 링크의 href 전부. */
function blockingStylesheetHrefs(): string[] {
  const links = [...HTML.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((t) => /rel="stylesheet"/.test(t))
  return links.map((t) => (t.match(/href="([^"]+)"/) || [])[1]).filter(Boolean) as string[]
}

describe('🔤 첫 페인트를 막는 CSS 는 우리 오리진만 (2026-10-12)', () => {
  it('① 렌더 블로킹 stylesheet 가 외부 오리진을 가리키지 않는다', () => {
    const hrefs = blockingStylesheetHrefs()
    expect(hrefs.length, '`index.html` 에 stylesheet 링크가 0개 — 선택자가 낡았다(측정 0건은 통과가 아니라 실패)').toBeGreaterThan(0)
    const external = hrefs.filter((h) => /^(https?:)?\/\//.test(h))
    expect(
      external,
      `첫 페인트를 막는 CSS 가 외부 오리진에 있다: ${external.join(', ')}\n` +
        '   라이브 실측에서 외부 CSS 는 0.2KB 여도 382~384ms 를 먹었다(우리 CSS 는 37KB 에 92ms).\n' +
        '   비용은 바이트가 아니라 왕복이다 — 들여와서 /static/fonts/ 에 둘 것.',
    ).toEqual([])
  })

  it('①-2 jsdelivr·fonts.googleapis 가 stylesheet 로 다시 들어오지 않았다', () => {
    const hrefs = blockingStylesheetHrefs().join(' ')
    for (const host of ['cdn.jsdelivr.net', 'fonts.googleapis.com']) {
      expect(hrefs, `${host} 가 다시 렌더 블로킹 stylesheet 로 들어왔다`).not.toContain(host)
    }
  })

  it('②-1 들여온 Pretendard 사본이 실재하고 통째로 잘리지 않았다', () => {
    expect(existsSync(PRETENDARD), `${PRETENDARD} 가 없다 — href 가 404 가 되어 폰트 전멸`).toBe(true)
    const css = readFileSync(PRETENDARD, 'utf8')
    expect((css.match(/@font-face/g) || []).length, '@font-face 92개여야 한다(업스트림 v1.3.9 의 서브셋 수)').toBe(92)
    expect((css.match(/unicode-range/g) || []).length, 'unicode-range 가 @font-face 수와 달라졌다').toBe(92)
    expect((css.match(/src:url/g) || []).length, 'src 가 @font-face 수와 달라졌다').toBe(92)
  })

  it('②-2 src 에 상대경로가 0건이다 (있으면 폰트 92개가 전부 404)', () => {
    const css = readFileSync(PRETENDARD, 'utf8')
    const rel = (css.match(/url\(\.\.?[/\\]/g) || []).length
    expect(
      rel,
      '사본의 src 가 상대경로다. 업스트림은 `url(../../../packages/…)` 이고 그 기준은 jsdelivr 의\n' +
        '   디렉터리다 — 우리 오리진에 그대로 두면 `/packages/…` 를 찾아 404 가 난다.\n' +
        '   들여올 때 jsdelivr 절대주소로 바꿀 것(절차는 그 파일 머리말).',
    ).toBe(0)
    const abs = (css.match(/url\(https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@/g) || []).length
    expect(abs, 'woff2 를 가리키는 jsdelivr 절대주소가 92건이어야 한다').toBeGreaterThanOrEqual(92)
    expect(css, '폰트 파일은 렌더를 막지 않아야 한다 — font-display 가 swap 이어야 한다').toContain('font-display:swap')
    expect((css.match(/@import/g) || []).length, '사본에 @import 가 생겼다 — 또 하나의 렌더 블로킹 외부 요청이 된다').toBe(0)
  })

  it('③ index.html 의 href 와 실제 파일명이 같다 (버전 한쪽만 올리는 사고)', () => {
    const href = blockingStylesheetHrefs().find((h) => h.includes('pretendard'))
    expect(href, 'index.html 이 Pretendard 사본을 가리키지 않는다').toBeTruthy()
    expect(href, 'href 는 우리 오리진 절대경로여야 한다').toMatch(/^\/static\/fonts\//)
    expect(
      existsSync(`public${href}`),
      `index.html 은 ${href} 를 가리키는데 그 파일이 없다 — 파일명과 href 를 같이 올릴 것`,
    ).toBe(true)
  })

  it('④ Poppins 워드마크는 인라인 @font-face + 자가호스팅 woff2', () => {
    expect(existsSync(POPPINS), `${POPPINS} 가 없다`).toBe(true)
    const size = statSync(POPPINS).size
    expect(size, 'Poppins 서브셋 woff2 가 비정상적으로 크다 — urdeal 6글자 서브셋이어야 한다').toBeLessThan(8 * 1024)
    expect(size, 'woff2 가 비어 있다').toBeGreaterThan(200)
    // wOF2 매직바이트
    expect(readFileSync(POPPINS).subarray(0, 4).toString('hex'), 'woff2 매직바이트가 아니다(파일이 깨졌다)').toBe('774f4632')

    const css = inlineCss()
    const face = (css.match(/@font-face\s*\{[^}]*\}/g) || []).find((b) => /['"]Poppins['"]/.test(b))
    expect(face, '인라인 @font-face 에 Poppins 가 없다 — 워드마크가 폴백으로 떨어진다').toBeTruthy()
    expect(face!, 'Poppins 가 자가호스팅 woff2 를 가리켜야 한다').toContain('/static/fonts/poppins-800-urdeal-v24.woff2')
    expect(face!, 'font-display 는 swap — 2026-09-21 측정으로 optional 이 기각됐다(첫 방문자가 Poppins 를 못 봄)').toContain('swap')
    expect(
      face!,
      'unicode-range 가 빠졌다 — 그러면 그 글자가 없는 화면에서도 폰트를 받는다(원본 Google 응답에는 있었다)',
    ).toContain('unicode-range')
  })

  it('⑤ _headers 의 /static/fonts/* immutable (지우면 매 방문 재다운로드)', () => {
    const block = HEADERS.split('\n')
    const i = block.findIndex((l) => l.trim() === '/static/fonts/*')
    expect(
      i,
      '`_headers` 에 `/static/fonts/*` 블록이 없다. 그러면 맨 위 `/*` 의 `no-cache, no-store` 에 걸린다 —\n' +
        '   2026-10-12 라이브 실측에서 자가호스팅 숫자 폰트가 실제로 그 상태였고 `cf-cache-status: BYPASS` 였다\n' +
        '   (남의 CDN 은 1년 immutable 인데 우리 것만 매 요청이 오리진까지 갔다).',
    ).toBeGreaterThan(-1)
    const body = block.slice(i + 1, i + 4).join(' ')
    expect(body, '/static/fonts/* 에 immutable 1년 캐시가 없다').toMatch(/max-age=31536000/)
    expect(body, '/static/fonts/* 에 immutable 이 없다').toContain('immutable')
  })

  it('⑥ src 없는 @font-face 가 되살아나지 않았다 (무효 규칙 = 조용한 거짓)', () => {
    const css = inlineCss()
    const faces = css.match(/@font-face\s*\{[^}]*\}/g) || []
    expect(faces.length, '인라인 @font-face 가 0개 — 선택자가 낡았다(측정 0건은 통과가 아니라 실패)').toBeGreaterThan(0)
    const broken = faces.filter((b) => !/\bsrc\s*:/.test(b))
    expect(
      broken,
      `src 없는 @font-face 가 있다: ${broken.join(' | ')}\n` +
        '   `@font-face` 는 src 가 없으면 **규칙 전체가 무효**라 브라우저가 버린다. 2026-10-12 까지\n' +
        '   `font-display:optional` + `ascent/descent-override` 를 그렇게 써 놓고 "적용된다"고 믿고 있었다\n' +
        '   (라이브 실측: 전부 swap). 메트릭을 덮어쓰려면 src 를 가진 유효한 규칙으로 쓰고, 줄 높이가\n' +
        '   실제로 바뀌므로 레이아웃을 측정하고 들어갈 것.',
    ).toEqual([])
  })
})
