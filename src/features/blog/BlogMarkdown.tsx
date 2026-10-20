/**
 * 🔤 2026-09-24 (대표 문서 ② "너무 가독성이 떨어진다"): 본문 15px → **16.5px**, 줄간격 1.8 → 1.85.
 *
 * 왜 이 숫자인가 — 상세는 `[목차 220 | 본문 | 사이드 260]` 3열이라 1280px 에서 본문 칸이 약 760px 다.
 * 15px 한글이면 한 줄에 **95자** 가까이 들어가는데, 편한 길이는 40~50자다. 글자를 키우고
 * (한 줄 글자 수↓) 같은 커밋에서 본문 폭도 `max-w-[46rem]` 으로 묶었다(`BlogDetailPage`).
 * ⚠️ 둘은 짝이다 — 폭만 줄이거나 글자만 키우면 반쪽이다.
 */
/**
 * 📝 2026-07-01 블로그 본문 렌더러 (SSOT) — 상세 페이지 + 관리자 미리보기 공용.
 *
 *   안전성: dangerouslySetInnerHTML 미사용 — 전부 React 노드로 렌더(문자열 자식은 React 가 자동 이스케이프).
 *     링크/이미지 URL 은 SAFE_HREF 화이트리스트(http(s)/상대/mailto/tel)만 허용 → javascript:/data: 차단.
 *   지원: ## / ### 헤딩, - 불릿, 1. 번호목록, 표(|---|), 인용구(> ), 구분선(---),
 *         인라인 **굵게** · [링크](url) · ![이미지](url). 짝 안 맞는 ** 는 제거(글자 노출 방지).
 */
import { ReactNode } from 'react'
// 🧱 2026-10-19 클래스는 서버 첫 화면(`worker/utils/blog-detail-first-screen.ts`)과 같은 상수 — 두 벌이면 마운트 때 본문이 튄다.
import { BLOG_MD } from '@/shared/blog-page'

const SAFE_HREF = /^(https?:\/\/|\/(?!\/)|mailto:|tel:)/i

// 인라인: **bold** · [text](url) · ![alt](url) → 안전한 React 노드.
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // 이미지 → 링크 → 굵게 순(이미지가 링크 문법을 포함하므로 먼저).
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  const pushText = (s: string) => { if (s) nodes.push(s.replace(/\*\*/g, '')) } // 잔여 ** 제거
  while ((m = re.exec(text)) !== null) {
    pushText(text.slice(last, m.index))
    if (m[1] !== undefined && m[2] !== undefined) {
      // 이미지
      nodes.push(SAFE_HREF.test(m[2])
        ? <img key={`${keyBase}-img${i}`} src={m[2]} alt={m[1]} loading="lazy" className={BLOG_MD.img} />
        : m[1])
    } else if (m[3] !== undefined && m[4] !== undefined) {
      // 링크
      if (SAFE_HREF.test(m[4])) {
        const ext = /^https?:/i.test(m[4])
        nodes.push(
          <a key={`${keyBase}-a${i}`} href={m[4]} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={BLOG_MD.a}>{m[3]}</a>,
        )
      } else nodes.push(m[3])
    } else if (m[5] !== undefined) {
      nodes.push(<strong key={`${keyBase}-b${i}`} className={BLOG_MD.strong}>{m[5]}</strong>)
    }
    last = re.lastIndex
    i++
  }
  pushText(text.slice(last))
  return nodes
}

const stripBold = (s: string) => s.replace(/\*\*/g, '')

// 📝 목차(TOC) 추출 — BlogMarkdown 과 동일 블록 파싱으로 H2/H3 를 순서대로 뽑아
//   같은 `sec-{n}` id 를 부여(렌더러의 헤딩 id 와 1:1 매칭). 좌측 Contents 사이드바가 사용.
export function blogToc(content: string): Array<{ level: 2 | 3; text: string; id: string }> {
  const out: Array<{ level: 2 | 3; text: string; id: string }> = []
  let h = 0
  ;(content || '').split('\n\n').forEach(block => {
    const t = block.trim()
    if (t.startsWith('## ')) out.push({ level: 2, text: stripBold(t.slice(3)), id: `sec-${h++}` })
    else if (t.startsWith('### ')) out.push({ level: 3, text: stripBold(t.slice(4)), id: `sec-${h++}` })
  })
  return out
}

export function BlogMarkdown({ content }: { content: string }) {
  let hIdx = 0 // 헤딩 순번 — blogToc 와 동일 순서로 sec-{n} id 부여(앵커 매칭).
  const blocks = (content || '').split('\n\n').map((block, i) => {
    const trimmed = block.trim()
    if (!trimmed) return null

    // 표 (| --- |)
    if (trimmed.includes('|') && trimmed.includes('---')) {
      const lines = trimmed.split('\n').filter(l => l.trim() && !l.trim().match(/^\|[-\s|]+\|$/))
      if (lines.length >= 2) {
        const headers = lines[0].split('|').filter(Boolean).map(h => h.trim())
        const rows = lines.slice(1).map(l => l.split('|').filter(Boolean).map(c => c.trim()))
        return (
          <div key={i} className={BLOG_MD.tableWrap}>
            <table className={BLOG_MD.table}>
              <thead>
                <tr>{headers.map((h, j) => <th key={j} className={BLOG_MD.th}>{renderInline(h, `t${i}h${j}`)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>{row.map((cell, ci) => <td key={ci} className={BLOG_MD.td}>{renderInline(cell, `t${i}r${ri}c${ci}`)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    }

    // 헤딩 (이미 굵게 — ** 제거) + 목차 앵커 id · sticky 헤더 대응 scroll-mt
    if (trimmed.startsWith('## ')) return <h2 id={`sec-${hIdx++}`} key={i} className={BLOG_MD.h2}>{stripBold(trimmed.slice(3))}</h2>
    if (trimmed.startsWith('### ')) return <h3 id={`sec-${hIdx++}`} key={i} className={BLOG_MD.h3}>{stripBold(trimmed.slice(4))}</h3>

    // 불릿 리스트
    if (trimmed.startsWith('- ')) {
      const items = trimmed.split('\n').filter(l => l.trim().startsWith('- '))
      return (
        <ul key={i} className={BLOG_MD.ul}>
          {items.map((item, j) => (
            <li key={j} className={BLOG_MD.li}>
              <span className={BLOG_MD.bullet}>•</span>
              <span>{renderInline(item.trim().slice(2), `u${i}i${j}`)}</span>
            </li>
          ))}
        </ul>
      )
    }

    // 번호 목록 (1. 2. 3.)
    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed.split('\n').filter(l => /^\d+\.\s/.test(l.trim()))
      return (
        <ol key={i} className={BLOG_MD.ol}>
          {items.map((item, j) => {
            const mm = item.trim().match(/^(\d+)\.\s+(.*)$/)
            return (
              <li key={j} className={BLOG_MD.li}>
                <span className={BLOG_MD.num}>{mm?.[1] ?? j + 1}.</span>
                <span>{renderInline(mm?.[2] ?? item, `o${i}i${j}`)}</span>
              </li>
            )
          })}
        </ol>
      )
    }

    // 인용구 (> )
    if (trimmed.startsWith('> ')) {
      const body = trimmed.split('\n').map(l => l.replace(/^>\s?/, '')).join(' ')
      return (
        <blockquote key={i} className={BLOG_MD.quote}>
          {renderInline(body, `q${i}`)}
        </blockquote>
      )
    }

    // 구분선
    if (trimmed === '---') return <hr key={i} className={BLOG_MD.hr} />

    // 일반 단락
    return <p key={i} className={BLOG_MD.p}>{renderInline(trimmed, `p${i}`)}</p>
  }).filter(Boolean)

  return <>{blocks}</>
}

export default BlogMarkdown
