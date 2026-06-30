/**
 * 🆕 2026-06-28 클라이언트 CSV 다운로드(UTF-8 BOM — Excel 한글 안 깨짐). 라이브러리 0.
 *   수식 인젝션 차단: 셀이 = + - @ 또는 탭/CR 로 시작하면 Excel/Sheets 가 수식 실행
 *   (=cmd|'/c calc'!A1 등) → 선행 작은따옴표로 무력화 후 quote-escape.
 */
export function csvEscape(v: unknown): string {
  if (v == null) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const head = headers.map(csvEscape).join(',')
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
  const csv = '﻿' + head + (body ? '\r\n' + body : '')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
