/**
 * 🛡️ 2026-07-13 (데이터 감사 3단계): CSV/엑셀 수식 인젝션 안전 유틸 — 서비스 중립 SSOT.
 *
 * 배경: 소비자 어드민 주문 export 가 hand-rolled `[...].join(',')` 로 셀러/유저-제어 free-text
 *   (수취인명·연락처·주소)를 escape 없이 내보내 수식 인젝션·콤마 깨짐 위험(감사 지적). 도매용
 *   supply-csv.ts 에 이미 있는 가드를 서비스 분리 위해 복제하지 않고, 중립 유틸로 SSOT 화.
 *
 * (도매 supply-csv.ts 는 자체 사본 유지 — 서비스 경계. 향후 그쪽도 이 유틸로 수렴 가능.)
 */

/** 셀 값 escape — 수식 인젝션(= + - @ tab CR 선행) 무력화 + quote-escape. */
export function csvEscape(v: unknown): string {
  if (v == null) return ''
  let s = String(v)
  // 🛡️ = + - @ 또는 탭/CR 로 시작하면 Excel/Sheets 가 수식 실행(=cmd|'/c calc'!A1, =HYPERLINK).
  //   선행 작은따옴표로 무력화(값 보존 — Excel 은 ' 를 텍스트 표식으로만 사용).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 헤더 + 행 → UTF-8 BOM CSV 문자열(Excel 한글 안 깨짐). */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.map(csvEscape).join(',')
  const body = rows.map(r => r.map(csvEscape).join(',')).join('\r\n')
  return '﻿' + head + (body ? '\r\n' + body : '')
}
