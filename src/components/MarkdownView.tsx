/**
 * 🗂️ 2026-07-02: 경량 마크다운 → JSX 렌더러 (외부 의존성 0 — CLAUDE.md 패키지 추가 지양).
 *   용도: 어드민 문서 뷰어(플랫폼 모델 등) — repo 의 .md 를 `?raw` import 해 그대로 렌더.
 *   지원: #/##/### 제목 · 표(| … |) · > 인용 · - 목록 · **굵게** · `코드` · [링크](url) · --- 구분선.
 *   테마 자동(dark: variant) — 어드민(라이트 고정)에선 dark: 가 inert.
 */
import { Fragment, type ReactNode } from 'react'

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2] !== undefined) {
      nodes.push(<strong key={key++} className="font-semibold text-gray-900 dark:text-white">{m[2]}</strong>)
    } else if (m[3] !== undefined) {
      nodes.push(<code key={key++} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-[#1A1C21] text-[0.85em] text-pink-600 dark:text-pink-400 font-mono break-all">{m[3]}</code>)
    } else if (m[4] !== undefined) {
      const href = m[5]
      const external = /^https?:\/\//.test(href)
      nodes.push(
        <a key={key++} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="text-blue-600 dark:text-blue-400 underline underline-offset-2">{m[4]}</a>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function MarkdownView({ source, className = '' }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
  const isSep = (l: string) => /^\s*\|[-:\s|]+\|\s*$/.test(l)
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())

  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()

    if (t === '') { i++; continue }

    // 구분선
    if (/^(---|===|\*\*\*)$/.test(t)) { blocks.push(<hr key={key++} className="my-6 border-gray-200 dark:border-[#2C2F35]" />); i++; continue }

    // 제목
    const h = t.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      const txt = h[2]
      const cls = lvl === 1 ? 'text-2xl font-extrabold mt-2 mb-4'
        : lvl === 2 ? 'text-lg font-bold mt-8 mb-3 pb-1 border-b border-gray-100 dark:border-[#2C2F35]'
        : lvl === 3 ? 'text-[15px] font-bold mt-5 mb-2'
        : 'text-[13px] font-bold mt-4 mb-1.5 text-gray-600 dark:text-gray-300'
      blocks.push(<div key={key++} className={`text-gray-900 dark:text-white ${cls}`}>{renderInline(txt)}</div>)
      i++; continue
    }

    // 표
    if (isTableRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i++ }
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-[#2C2F35]">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr>{header.map((c, j) => <th key={j} className="text-left px-3 py-2 bg-gray-50 dark:bg-[#1A1C21] border-b border-gray-200 dark:border-[#2C2F35] font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">{renderInline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="align-top">{r.map((c, ci) => <td key={ci} className="px-3 py-2 border-b border-gray-100 dark:border-[#2C2F35] text-gray-600 dark:text-gray-300">{renderInline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // 인용(>) — 연속 묶음
    if (/^>\s?/.test(t)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^>\s?/, '')); i++ }
      blocks.push(
        <blockquote key={key++} className="my-3 border-l-4 border-gray-300 dark:border-[#3A3A3A] bg-gray-50 dark:bg-[#1A1C21] px-3 py-2 text-[13px] text-gray-600 dark:text-gray-300 rounded-r-lg">
          {buf.map((b, bi) => <p key={bi} className={bi ? 'mt-1' : ''}>{renderInline(b)}</p>)}
        </blockquote>,
      )
      continue
    }

    // 목록(- / *) — 연속 묶음
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++ }
      blocks.push(
        <ul key={key++} className="my-2 ml-4 list-disc space-y-1 text-[13.5px] text-gray-600 dark:text-gray-300 marker:text-gray-400">
          {items.map((it, ii) => <li key={ii}>{renderInline(it)}</li>)}
        </ul>,
      )
      continue
    }

    // 번호 목록
    if (/^\d+\.\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, '')); i++ }
      blocks.push(
        <ol key={key++} className="my-2 ml-5 list-decimal space-y-1 text-[13.5px] text-gray-600 dark:text-gray-300 marker:text-gray-400">
          {items.map((it, ii) => <li key={ii}>{renderInline(it)}</li>)}
        </ol>,
      )
      continue
    }

    // 문단
    blocks.push(<p key={key++} className="my-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-300">{renderInline(t)}</p>)
    i++
  }

  return <div className={className}>{blocks.map((b, bi) => <Fragment key={bi}>{b}</Fragment>)}</div>
}
