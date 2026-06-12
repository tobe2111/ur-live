/**
 * 🛡️ 2026-06-12 (전수조사 4차 B-6): 숙소 체크아웃 자동 전이.
 *
 * 배경: confirmed → checked_out 전이가 셀러 수동 처리뿐이라, 셀러가 잊으면
 *   리뷰 작성 게이트(stays-public `status==='checked_out'` 검사)가 영구 잠김.
 *
 * 규칙:
 *   - date 모드 confirmed 예약 중 check_out_date + 1일 경과 → checked_out (CAS).
 *     (+1일 버퍼: 당일 체크아웃 직후 분쟁/노쇼 처리 여지를 셀러에게 남김.)
 *   - voucher 모드(check_in_date NULL)는 대상 아님 — 셀러 '사용 처리'가 checked_out 전이 담당.
 *   - 매일 1회 (scheduled.ts '0 9 * * *' 블록). per-row CAS 라 중복 실행 안전 (멱등).
 */
type Env = { DB: D1Database }

export async function handleStayCheckoutTransition(env: Env): Promise<{ transitioned: number }> {
  // 후보 조회 — date 모드 confirmed + 체크아웃 다음날 경과.
  const rows = await env.DB.prepare(
    `SELECT id, check_out_date FROM stay_bookings
      WHERE status = 'confirmed'
        AND check_out_date IS NOT NULL
        AND date(check_out_date, '+1 day') <= date('now')
      ORDER BY check_out_date ASC
      LIMIT 200`
  ).bind().all<{ id: number; check_out_date: string }>().catch(() => ({ results: [] as Array<{ id: number; check_out_date: string }> }))

  let transitioned = 0
  for (const b of (rows.results || [])) {
    // CAS — confirmed 에서만 전이 (동시 취소/수동 처리와 race 안전).
    const r = await env.DB.prepare(
      `UPDATE stay_bookings SET status = 'checked_out', updated_at = datetime('now')
        WHERE id = ? AND status = 'confirmed'`
    ).bind(b.id).run().catch(() => null)
    if (!r || (r.meta?.changes ?? 0) === 0) continue
    transitioned++
    await env.DB.prepare(
      `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
       VALUES (?, 'confirmed', 'checked_out', 'system', NULL, '체크아웃 자동 전이 (체크아웃 +1일 경과)')`
    ).bind(b.id).run().catch(() => { /* 로그 실패는 무시 */ })
  }

  return { transitioned }
}
