/**
 * 📝 2026-07-01 블로그 본문 렌더러 (SSOT) — 상세 페이지 + 관리자 미리보기 공용.
 *
 *   안전성: dangerouslySetInnerHTML 미사용 — 전부 React 노드로 렌더(문자열 자식은 React 가 자동 이스케이프).
 *     링크/이미지 URL 은 SAFE_HREF 화이트리스트(http(s)/상대/mailto/tel)만 허용 → javascript:/data: 차단.
 *   지원: ## / ### 헤딩, - 불릿, 1. 번호목록, 표(|---|), 인용구(> ), 구분선(---),
 *         인라인 **굵게** · [링크](url) · ![이미지](url). 짝 안 맞는 ** 는 제거(글자 노출 방지).
 */
import { ReactNode } from 'react'

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
        ? <img key={`${keyBase}-img${i}`} src={m[2]} alt={m[1]} loading="lazy" className="block max-w-full rounded-lg my-3" />
        : m[1])
    } else if (m[3] !== undefined && m[4] !== undefined) {
      // 링크
      if (SAFE_HREF.test(m[4])) {
        const ext = /^https?:/i.test(m[4])
        nodes.push(
          <a key={`${keyBase}-a${i}`} href={m[4]} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80">{m[3]}</a>,
        )
      } else nodes.push(m[3])
    } else if (m[5] !== undefined) {
      nodes.push(<strong key={`${keyBase}-b${i}`} className="font-bold text-gray-900 dark:text-white">{m[5]}</strong>)
    }
    last = re.lastIndex
    i++
  }
  pushText(text.slice(last))
  return nodes
}

const stripBold = (s: string) => s.replace(/\*\*/g, '')

export function BlogMarkdown({ content }: { content: string }) {
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
          <div key={i} className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>{headers.map((h, j) => <th key={j} className="text-left px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border-b border-gray-200 dark:border-[#2A2A2A] font-semibold text-gray-700 dark:text-gray-200">{renderInline(h, `t${i}h${j}`)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="px-3 py-2 border-b border-gray-100 dark:border-[#1A1A1A] text-gray-600 dark:text-gray-300">{renderInline(cell, `t${i}r${ri}c${ci}`)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    }

    // 헤딩 (이미 굵게 — ** 제거)
    if (trimmed.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-3">{stripBold(trimmed.slice(3))}</h2>
    if (trimmed.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2">{stripBold(trimmed.slice(4))}</h3>

    // 불릿 리스트
    if (trimmed.startsWith('- ')) {
      const items = trimmed.split('\n').filter(l => l.trim().startsWith('- '))
      return (
        <ul key={i} className="my-3 space-y-1.5">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-[15px] text-gray-700 dark:text-gray-200 leading-relaxed">
              <span className="text-pink-500 mt-1 shrink-0">•</span>
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
        <ol key={i} className="my-3 space-y-1.5 list-none">
          {items.map((item, j) => {
            const mm = item.trim().match(/^(\d+)\.\s+(.*)$/)
            return (
              <li key={j} className="flex items-start gap-2 text-[15px] text-gray-700 dark:text-gray-200 leading-relaxed">
                <span className="text-pink-500 font-semibold mt-0.5 shrink-0 tabular-nums">{mm?.[1] ?? j + 1}.</span>
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
        <blockquote key={i} className="my-4 pl-4 border-l-4 border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300 italic">
          {renderInline(body, `q${i}`)}
        </blockquote>
      )
    }

    // 구분선
    if (trimmed === '---') return <hr key={i} className="my-8 border-gray-200 dark:border-[#2A2A2A]" />

    // 일반 단락
    return <p key={i} className="text-[15px] text-gray-700 dark:text-gray-200 leading-[1.8] my-3">{renderInline(trimmed, `p${i}`)}</p>
  }).filter(Boolean)

  return <>{blocks}</>
}

export default BlogMarkdown
