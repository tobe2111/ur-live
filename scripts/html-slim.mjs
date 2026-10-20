/**
 * ✂️ 배포 HTML 다이어트 — 개발자용 주석을 손님에게 보내지 않는다 (2026-10-15 대표 *"아직 로딩 되게 긴데?"*).
 *
 * 라이브 실측(홈, 폰): 첫 그림 전에 받아야 하는 `<head>` 가 압축 34KB 였는데 그중
 *   · HTML 주석 32개 — 18KB raw / 8.5KB gzip
 *   · 인라인 스크립트 안의 주석·공백 — 청크 자가복구 부트가드 하나만 21.6KB raw / 8.4KB gzip
 * 이 전부 **사람이 읽으라고 쓴 설명**이었다. 브라우저는 이걸 다 받고 파싱한 뒤에야 `<body>` 를 그린다.
 *
 * 하는 일(빌드 산출물 `dist/client/index.html` 에만 — 소스 `index.html` 은 그대로 읽힌다):
 *   ① HTML 주석 제거 — 단 IE 조건부 주석(`<!--[if`)은 남긴다(쓰는 곳은 없지만 의미가 있는 주석이다).
 *   ② 일반 인라인 `<script>`(type 없음·text/javascript, src 없음)를 esbuild 로 압축.
 *      `type="module"`·`application/json`·`ld+json`·`speculationrules`·`ur-module` 등은 건드리지 않는다
 *      (JSON 은 데이터이고, 모듈·규칙은 의미가 다르다).
 * 압축이 실패하면 그 스크립트는 **원문 그대로** 둔다(빌드를 깨지 않는다 — 대신 경고를 낸다).
 *
 * ⚠️ CSP 가 인라인 스크립트를 **해시**로 허용하게 바뀌면 이 압축이 해시를 깨뜨린다. 지금은 nonce(워커가
 *    서빙할 때 붙인다)라 무관하다 — 시험이 그 전제를 고정한다.
 */

const COMMENT_RE = /<!--(?!\[if)[\s\S]*?-->/g
const SCRIPT_RE = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g

/** 일반 JS 인라인 스크립트인가 — 속성 문자열로 판정 */
export function isPlainInlineScript(attrs = '') {
  if (/\bsrc\s*=/.test(attrs)) return false
  const m = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)
  if (!m) return true
  return /^(text|application)\/(javascript|ecmascript)$/i.test(m[1])
}

export function stripHtmlComments(html) {
  return html.replace(COMMENT_RE, '')
}

/**
 * @param {string} html
 * @param {(code: string) => Promise<string>} minify  JS 압축기(빌드에선 esbuild, 시험에선 가짜)
 */
export async function slimHtml(html, minify) {
  let out = stripHtmlComments(html)
  const jobs = []
  out.replace(SCRIPT_RE, (whole, attrs = '', body) => {
    if (isPlainInlineScript(attrs) && body.trim()) jobs.push({ whole, attrs, body })
    return whole
  })
  for (const j of jobs) {
    let code
    try { code = (await minify(j.body)).trim() } catch (e) {
      console.warn(`[html-slim] 인라인 스크립트 압축 실패 — 원문 유지: ${String(e?.message || e).slice(0, 120)}`)
      continue
    }
    // 함수로 치환한다 — 문자열 치환은 압축된 코드 속 `$&`·`$1` 을 특수 패턴으로 읽어 코드를 바꾼다.
    out = out.replace(j.whole, () => `<script${j.attrs}>${code}</script>`)
  }
  // 주석을 걷어낸 자리에 남는 빈 줄을 정리한다(내용 없는 줄만).
  return out.replace(/\n[ \t]*(?=\n)/g, '').replace(/\n{2,}/g, '\n')
}
