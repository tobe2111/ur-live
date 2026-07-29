/**
 * 🏭 2026-06-03 유통스타트 도매몰 — CSV(엑셀) 대량처리 공용 유틸.
 * (스펙: 주문 많을 경우 엑셀 다운/업로드, 대량등록 표준양식)
 *
 * "엑셀" = UTF-8 BOM CSV (Excel 한글 안 깨짐, 별도 라이브러리 의존 0).
 */

export function csvEscape(v: unknown): string {
  if (v == null) return ''
  let s = String(v)
  // 🛡️ 2026-06-26 [보안] CSV/엑셀 수식 인젝션 차단 — 셀이 = + - @ 또는 탭/CR 로 시작하면
  //   Excel/Sheets 가 수식으로 실행(=cmd|'/c calc'!A1, =HYPERLINK(...)). 셀러-제어 free-text
  //   (상품명/카테고리/바코드/회사명)가 도매 CSV 로 나가므로, 선행 작은따옴표로 무력화한 뒤
  //   기존 quote-escape 적용. (값 자체는 보존 — Excel 이 ' 를 텍스트 표식으로만 사용.)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 헤더 + 행 → UTF-8 BOM CSV 문자열. */
export function buildCsv(headers: string[], rows: (unknown[])[]): string {
  const head = headers.map(csvEscape).join(',')
  const body = rows.map(r => r.map(csvEscape).join(',')).join('\r\n')
  return '﻿' + head + (body ? '\r\n' + body : '')
}

/** CSV 다운로드 Response (Content-Disposition attachment). */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * 단순 CSV 파서 (따옴표/이스케이프 처리). 헤더 1줄 + 데이터행 → 객체 배열.
 * 대량 업로드용 — 최대 maxRows 제한.
 */
export function parseCsv(text: string, maxRows = 5000): Record<string, string>[] {
  // BOM 제거
  const clean = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; if (rows.length > maxRows + 1) break }
      else if (ch === '\r') { /* skip — handled by \n */ }
      else { field += ch }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  if (rows.length === 0) return []
  const headers = rows[0].map(h => h.trim())
  return rows.slice(1)
    .filter(r => r.some(cell => cell.trim() !== ''))
    .map(r => {
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim() })
      return obj
    })
}
