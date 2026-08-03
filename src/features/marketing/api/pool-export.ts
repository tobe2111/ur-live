/**
 * 📤 **풀 CSV 내보내기 — 화면 필터를 그대로 따른다** (2026-08-03 실측 수리 후 분리).
 *
 * ## 무엇이 있었나
 * 두 풀의 내보내기가 **필터를 통째로 무시**하고 무필터 상위 N행을 뱉었다.
 *
 * ```
 *   파트너 풀 174,000건 · 이메일 보유 12%   → 무필터 5,000행의 실제 발송 가능분 ≈ 600건 + 보류 혼입
 *   매장   풀  52,000건 · 학원이 95%        → "카페 + 전화 보유" 로 좁혀도 파일은 사실상 전부 학원
 * ```
 * **화면과 파일이 다른데 경고가 없다.** 이 DB 의 성공 지표는 총 인원이 아니라
 * *"제안 보낼 수 있는 리드 수"* 인데(CLAUDE.md 방향), 내보내기가 그 정의를 못 따르면
 * 지표가 **화면에만 있고 손에는 안 잡힌다.**
 *
 * ## 왜 별도 모듈인가
 * `partner-pool.routes.ts` 가 파일크기 래칫(600줄)에 닿았다. 래칫을 우회(`[SKIP_SIZE]`)하는 대신
 * **자기완결 유틸을 빼냈다** — 두 풀이 같은 이스케이프·같은 절단 고지를 쓰게 되는 부수 이득도 있다.
 *
 * ## ⚠️ 못 하는 것
 * - 필터 **의미**는 각 풀의 `build*Where` 소관이다. 여기서는 행을 받아 문자열로 만든다.
 */

/** CSV 셀 이스케이프 — 수식 인젝션 방어 포함(선행 `= + - @ \t \r` 은 작은따옴표로 무력화). */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * 행 배열을 엑셀 호환 CSV 응답으로. **상한에 닿으면 파일 안에 잘렸다고 적는다** —
 * 조용한 절단은 읽는 사람에게 "이게 전부"로 보인다(가드 규율 '무음 캡 금지').
 *
 * @param cap 상한. `rows.length >= cap` 이면 고지 줄을 덧붙인다.
 */
export function csvResponse(opts: {
  filename: string
  header: readonly string[]
  rows: readonly (readonly unknown[])[]
  cap: number
}): Response {
  const lines = [opts.header.join(',')]
  for (const r of opts.rows) lines.push(r.map(csvCell).join(','))
  if (opts.rows.length >= opts.cap) {
    lines.push(`⚠️ ${opts.cap}건에서 잘렸습니다 — 화면 필터를 더 좁혀 다시 내보내세요(내보내기는 화면 필터를 그대로 따릅니다)`)
  }
  return new Response(`﻿${lines.join('\n')}`, {
    headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename="${opts.filename}"` },
  })
}

/**
 * 🧭 **비-필터 파라미터에 기본값이 흔들리지 않게** — '필터가 하나라도 왔는가' 를 **필터 키로만** 본다.
 *
 *   화면 버튼이 붙이는 `format=csv` 같은 것까지 세면, 그걸 붙였다는 이유만으로
 *   `includeHeld` 기본값이 뒤집힌다(첫 작성이 그랬다 — 기존 호출부 동작을 조용히 바꿀 뻔했다).
 */
export function hasAnyFilter(read: (k: string) => string | undefined, keys: readonly string[]): boolean {
  return keys.some(k => (read(k) ?? '') !== '')
}

const COMPANY_FILTER_KEYS = ['category', 'subcategory', 'region', 'tier', 'status', 'hasContact', 'hasEmail', 'includeHeld', 'heldOnly', 'pipeline', 'recentDays', 'leadType', 'q'] as const

/**
 * 파트너 풀 내보내기 필터 — **목록 라우트와 같은 키/의미**로 읽는다.
 *   `includeHeld` 만 예외: 필터가 하나도 없으면 예전처럼 보류 포함(기존 호출부 호환),
 *   필터를 준 순간부터는 화면과 같게 군다.
 */
export function parseCompanyExportFilter(read: (k: string) => string | undefined, int: (v: string | undefined, d: number) => number): Record<string, unknown> {
  const tierRaw = read('tier')
  const anyFilter = hasAnyFilter(read, COMPANY_FILTER_KEYS)
  return {
    category: read('category') || undefined,
    subcategory: read('subcategory') || undefined,
    region: (read('region') || '').trim() || undefined,
    tier: tierRaw != null && tierRaw !== '' ? int(tierRaw, 0) : undefined,
    status: read('status') || undefined,
    hasContact: read('hasContact') === '1',
    hasEmail: read('hasEmail') === '1',
    includeHeld: read('includeHeld') === '1' || !anyFilter,
    heldOnly: read('heldOnly') === '1',
    pipeline: read('pipeline') === '1',
    recentDays: read('recentDays') ? int(read('recentDays'), 0) : undefined,
    leadType: read('leadType') || undefined,
    q: (read('q') || '').trim() || undefined,
  }
}
