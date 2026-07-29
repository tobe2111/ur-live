/**
 * 🔧 2026-07-18 — off-live user_id backfill 자동 스위퍼 (대표 "직접 실행 말고 자동으로").
 *
 * 배경(데이터 감사 3단계, #514): off-live(Firebase) 이력의 user_id(firebase_uid 문자열)를
 *   숫자 users.id 로 수렴하는 backfill 이 수동 endpoint(dry-run 기본)로만 있었음. 이 cron 이
 *   주 1회 자동 실행해 사람 손을 제거한다.
 *
 * 안전(자동 apply 가 안전한 이유 — user-id-backfill.ts 설계):
 *  - 매핑은 users.firebase_uid **정확 일치**만(모호 매핑 0) + **멱등**(수렴 후 재실행 no-op).
 *  - orders/vouchers/point_transactions = 유니크 제약 없는 안전 relabel → 자동 apply.
 *  - user_points(PK 충돌 가능) = **충돌 행은 절대 자동 병합 안 함** — 건드리지 않고 카운트만.
 *    충돌이 있으면 어드민 벨로 보고(수동 검토 유도). 잔액 머니라 자동화 범위 밖(불변).
 *  - 라이브(카카오)는 이미 숫자 키라 대상 0 — 이 cron 은 off-live 이력만 만짐.
 *
 * 통지: 변경/충돌이 있을 때만 어드민 벨(무소식=변경 0). 실패는 safeCron 이 Discord 보고.
 */
import type { Env } from '../types/env'
import { backfillUserIdMapping } from '../utils/user-id-backfill'

export async function handleUserIdBackfillSweep(env: Env): Promise<void> {
  const DB = env.DB
  // 1) dry-run 으로 규모 파악 — 대상 0 이면 조용히 종료(주간 no-op 이 정상 상태).
  const dry = await backfillUserIdMapping(DB, false)
  if (dry.total_candidates === 0) return

  // 2) 자동 apply — 안전 subset 만 실제 UPDATE(충돌 행은 함수가 스스로 제외).
  const applied = await backfillUserIdMapping(DB, true)

  // 3) 어드민 벨 — 무엇이 수렴됐고 무엇이 수동 검토인지(충돌) 투명 보고.
  try {
    const lines = applied.tables
      .filter((t) => t.candidates > 0 || t.conflicts > 0)
      .map((t) => `- ${t.table}: 대상 ${t.candidates} → 수렴 ${t.updated}${t.conflicts ? ` · ⚠️ 충돌(수동검토) ${t.conflicts}` : ''}`)
    const conflictNote = applied.total_conflicts > 0
      ? `\n⚠️ user_points 충돌 ${applied.total_conflicts}건은 자동 병합하지 않았습니다(잔액 — 수동 검토: docs/DATA_CAPTURE_AUDIT_2026-07.md).`
      : ''
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    await createDashboardNotification(DB, 'admin', null, 'user_id_backfill',
      '🔧 user_id backfill 주간 자동 수렴',
      `off-live 이력 user_id 를 숫자 users.id 로 자동 수렴했습니다.\n${lines.join('\n')}${conflictNote}`,
      '/admin')
  } catch { /* fail-soft — 통지 실패가 backfill 결과를 무르지 않음 */ }
}
