/**
 * 🧹 2026-10-15 — **서빙되는 `index.html` 에서 HTML 주석을 뗀다**(소스는 1바이트도 안 바뀐다).
 *
 * 📊 **라이브 실측**: `index.html` 의 HTML 주석이 **65,471B 중 19,557B(30%)** 이고 **gzip 8,073B** 다.
 *    그 문서는 임계 경로의 **맨 앞**이라 모든 하드로드가 그만큼을 먼저 받는다 — 이 레포가 한
 *    아이콘 다이어트(3.4KB br)·i18n 분리보다 큰 덩어리가 `check-bundle-size` 의 예산 **밖**에
 *    있었다(그 가드는 dist index.html 의 `<script type=module>`·`modulepreload` 만 센다).
 *
 * 🤖 **GEO 쪽 이유도 있다**: 주석은 사람 화면엔 안 보이지만 **언어모델은 문서를 토큰으로 읽는다.**
 *    9개 3,116B 가 `shared/og-share-image.ts`·`App.tsx 의 useStatusBarTheme()` 같은 내부 파일·심볼
 *    이름을 담은 개발 메모라, *"이 페이지가 무엇인가"* 를 희석하면서 내부 구조를 공짜로 알려 준다.
 *    (실제로 이 결함을 찾은 세션의 측정기가 그 주석을 **본문으로 읽었다** — 기계는 그걸 본다.)
 *
 * 🔒 **소스를 안 건드리는 것이 요점이다.** 그 주석들은 이 레포의 자산이고(왜 그렇게 했는지),
 *    잠금표가 `index.html` 에서 지키는 항목(preload `crossOrigin` 없음 · Speculation Rules ·
 *    preconnect · 청크 자가복구 부트가드 · 폰트 지연 · 지도 SDK 조기 출발)은 전부 **코드**라
 *    주석만 빠지면 byte-불변이다. 그래서 방향도 잠금과 같다 — 임계 경로의 바이트를 **줄인다**.
 *
 * 🩸 **이 레포가 다섯 번 밟은 자리를 피한다**: 순진한 주석 제거기는 문자열·정규식 안의 구분자를
 *    주석 시작으로 읽어 코드를 통째로 먹는다(`scripts/comment-strip.mjs` 머리말이 그 이력이고,
 *    같은 클래스가 테스트에서 네 번·스크립트에서 한 번 났다). 오늘 `index.html` 의 인라인
 *    스크립트엔 `<!--`·`-->` 가 **0개**라 안전한데, **내일 하나 생기면 조용히 깨진다** ⇒ 매 빌드마다
 *    **무손실을 스스로 검증**하고 어긋나면 **빌드를 멈춘다**. 조용히 넘기지 않는다 — 이 레포에서
 *    "검사가 실패할 수 없다" 가 반복 사고의 모양이었다.
 *
 * ⚠️ **이 플러그인이 못 보는 것**
 *    - 주석이 빠져서 **빠르다**는 것(바이트는 쟀지만 LCP·TTFB 는 브라우저가 판정한다).
 *    - `index.html` 밖의 HTML(워커가 손으로 쓰는 봇 셸 — 거기엔 주석이 거의 없다).
 *    - 주석 안에 **의미가 있는** 경우(조건부 주석·빌드 자리표시자). 실측상 `index.html` 의
 *      자리표시자형 주석은 CSP nonce **설명** 하나뿐이고, 워커가 바꾸는 것은 그 옆 `<meta>` 의
 *      `content` 값이라 주석이 빠져도 무관하다. 새로 생기면 아래 `handler` 를 다시 볼 것.
 */

/** 인라인 `<script>`·`<style>` 블록을 그대로 뽑는다 — 무손실 판정의 기준이다. */
export function inlineBlocks(html) {
  return [...String(html).matchAll(/<(script|style)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g)].map((m) => m[0])
}

/** 수가 변하면 안 되는 태그들(주석 제거가 구조를 먹었는지 보는 값싼 지표). */
export const COUNTED_TAGS = ['<link', '<meta', '<script', '<style', '<div', '<noscript', '<img', '<title']

/**
 * 주석을 떼고 **무손실인지 확인한다**. 어긋나면 던진다(호출부가 빌드를 멈춘다).
 * 순수 함수라 시험이 그대로 돌린다 — 그게 이 파일이 `vite.config.ts` 밖에 있는 이유다.
 */
export function stripHtmlComments(html) {
  const src = String(html)
  const out = src.replace(/<!--[\s\S]*?-->/g, '')
  const a = inlineBlocks(src)
  const b = inlineBlocks(out)
  const blocksSame = a.length === b.length && a.every((x, i) => x === b[i])
  const changed = COUNTED_TAGS.filter((t) => src.split(t).length !== out.split(t).length)
  if (!blocksSame || changed.length) {
    throw new Error(
      '[strip-html-comments] 주석 제거가 무손실이 아니다 — 인라인 스크립트/스타일에 ' +
        '`<!--` 또는 `-->` 가 생겼을 수 있다. ' +
        `인라인 블록 ${a.length}→${b.length}, 수가 변한 태그: ${changed.join(', ') || '없음'}. ` +
        '그 구분자를 스크립트 밖으로 빼거나(문자열을 쪼개면 된다) 이 플러그인을 끌 것 ' +
        '(끄면 서빙 문서가 gzip 8KB 다시 늘어난다).',
    )
  }
  return out
}

/** Vite 플러그인 — `order: 'post'` 라 다른 플러그인이 태그를 다 넣은 뒤에 돈다. */
export function stripHtmlCommentsPlugin() {
  return {
    name: 'ur-strip-html-comments',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => stripHtmlComments(html),
    },
  }
}
