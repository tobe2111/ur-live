/**
 * 📝 2026-07-28 블로그 서버측 **본문 HTML** 렌더러 (대표 "네이버에 유어딜 검색해도 안 나옴" 근본원인).
 *
 * ## 왜 필요한가 (실측 근거)
 * 워커는 `/blog/*` 의 `#root` 를 **빈 문자열로 비워서** 서빙해 왔다(홈 shell 잔상 제거 목적).
 * 그 결과 JS 를 실행하지 않는 크롤러가 받는 HTML 은 `<head>` 메타/JSON-LD 뿐이고 **본문 텍스트가 0**:
 *   - 네이버 **Yeti**: JS 미실행 → 글 내용을 못 봄 → 색인 1페이지에서 정체(서치어드바이저 실측:
 *     7/22 수집 2·색인 1 이후 수집 0). 사이트맵·RSS 를 제출해도 "읽을 내용이 없는 페이지".
 *   - **AI 개요/LLM 크롤러**: 대부분 JS 렌더를 안 함 → 우리 블로그 22편이 통째로 인용 후보에서 제외.
 *     (구글 일반검색만 JS 렌더 덕에 정상 작동했던 것 — 대표가 본 "검색 1위 vs AI 개요 오답"의 정체.)
 *
 * ## 설계
 * - **순수 함수**(worker/index.ts 는 결과 문자열만 소비 — god 파일 성장 방지).
 * - React 는 `createRoot`(비-hydrate)로 마운트되므로 이 HTML 을 **그대로 덮어쓴다** → 하이드레이션
 *   불일치 위험 0. 사용자에겐 첫 페인트에 본문이 보였다가 React 로 교체(LCP 개선 부수효과).
 * - 지원 문법은 `BlogMarkdown.tsx`(클라 렌더러)의 부분집합: `## / ###` 헤딩 · `- ` 불릿 ·
 *   `1. ` 번호목록 · `> ` 인용 · `---` 구분선 · `**볼드**` · `[텍스트](링크)` · 문단.
 *   표는 텍스트 행으로 평문화(검색엔진엔 텍스트가 중요, 시각 정렬은 React 가 담당).
 * - **XSS 방어**: 모든 원문을 escape 한 뒤 허용 문법만 태그로 승격. 링크는 http(s)/상대경로만 허용.
 */

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 이스케이프 완료된 텍스트에 인라인 문법(**볼드**, [링크](url))만 태그로 승격. */
function inline(escaped: string): string {
  // [텍스트](url) — http(s) 또는 '/' 시작만 허용(javascript: 등 차단)
  let out = escaped.replace(/\[([^\]]{1,200})\]\((https?:&#x2F;&#x2F;[^)\s]+|https?:\/\/[^)\s]+|\/[^)\s]*)\)/g,
    (_m, text: string, href: string) => `<a href="${href}">${text}</a>`)
  out = out.replace(/\*\*([^*]{1,300})\*\*/g, '<strong>$1</strong>')
  return out.replace(/\*\*/g, '') // 짝 안 맞는 잔여 마커 제거
}

/** 마크다운(부분집합) → 시맨틱 HTML. 크롤러가 읽을 본문 텍스트 확보가 목적. */
export function blogContentToHtml(content: string): string {
  const lines = String(content || '').split('\n')
  const out: string[] = []
  let listType: 'ul' | 'ol' | null = null
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null } }

  for (const raw of lines) {
    const t = raw.trim()
    if (!t) { closeList(); continue }
    const e = esc(t)

    if (t.startsWith('### ')) { closeList(); out.push(`<h3>${inline(e.slice(4))}</h3>`); continue }
    if (t.startsWith('## ')) { closeList(); out.push(`<h2>${inline(e.slice(3))}</h2>`); continue }
    if (/^---+$/.test(t)) { closeList(); out.push('<hr />'); continue }
    if (t.startsWith('> ')) { closeList(); out.push(`<blockquote>${inline(e.slice(2))}</blockquote>`); continue }
    if (t.startsWith('- ')) {
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul' }
      out.push(`<li>${inline(e.slice(2))}</li>`); continue
    }
    const num = t.match(/^(\d{1,3})\.\s+(.*)$/)
    if (num) {
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol' }
      out.push(`<li>${inline(esc(num[2]))}</li>`); continue
    }
    // 표(|a|b|) — 구분행은 버리고 셀을 텍스트 문단으로(내용 보존이 목적)
    if (t.startsWith('|')) {
      if (/^\|[\s:|-]+\|$/.test(t)) continue
      closeList()
      const cells = t.split('|').map(c => c.trim()).filter(Boolean).map(c => inline(esc(c)))
      if (cells.length) out.push(`<p>${cells.join(' · ')}</p>`)
      continue
    }
    closeList()
    out.push(`<p>${inline(e)}</p>`)
  }
  closeList()
  return out.join('\n')
}

/**
 * 블로그 상세 `#root` 초기 HTML — 제목(h1) + 요약 + 본문.
 * payload 파싱 실패/본문 없음이면 '' (호출부가 기존 '빈 #root' 동작 유지).
 */
export function buildBlogPostBody(ssrPayload: string): string {
  try {
    const post = (JSON.parse(ssrPayload) as { data?: { title?: string; summary?: string; content?: string; published_at?: string } })?.data
    if (!post || !post.title || !post.content) return ''
    const title = esc(String(post.title).replace(/\*\*/g, ''))
    const summary = post.summary ? `<p>${inline(esc(String(post.summary).replace(/\*\*/g, '')))}</p>` : ''
    const date = post.published_at ? `<time>${esc(String(post.published_at).slice(0, 10))}</time>` : ''
    return `<main><article><h1>${title}</h1>${date}${summary}${blogContentToHtml(post.content)}</article></main>`
  } catch { return '' }
}

/**
 * 블로그 목록 `#root` 초기 HTML — 각 글로 가는 **실제 <a> 링크**.
 * Yeti·AI 크롤러가 목록에서 22편 상세로 타고 들어갈 경로를 확보(사이트맵 외 내부링크 발견 경로).
 */
export function buildBlogListBody(ssrPayload: string | null): string {
  if (!ssrPayload) return ''
  try {
    const posts = (JSON.parse(ssrPayload) as { data?: Array<{ slug?: string; title?: string; summary?: string }> })?.data || []
    const items = posts.filter(p => p && p.slug && p.title).map(p =>
      `<li><a href="/blog/${esc(String(p.slug))}"><h2>${esc(String(p.title).replace(/\*\*/g, ''))}</h2></a>` +
      (p.summary ? `<p>${esc(String(p.summary).replace(/\*\*/g, ''))}</p>` : '') + '</li>')
    if (!items.length) return ''
    return `<main><h1>유어딜 블로그</h1><ul>${items.join('')}</ul></main>`
  } catch { return '' }
}
