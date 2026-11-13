/**
 * 🔇 **조용히 죽은 계측 감시** (2026-11-13 대표 *"계속 개선해 영구적으로"*)
 *
 * 2026-08 부터 '로그인 성공' 이 한 번도 안 찍혔는데 석 달 동안 아무도 몰랐다 — 계측 코드가 안 쓰이는 화면에만 있었다(#2352 수리).
 * 숫자가 0 인 것과 "기록이 끊긴 것" 은 화면에서 구분이 안 된다. 그래서 **앞 단계는 찍히는데 다음 단계가 7일 내내 0** 이면
 * 매일 아침 어드민 다이제스트에 경고 한 줄을 붙인다(`cron/ops-daily-digest.ts`). 고치는 건 사람이 — 여기는 알리기만 한다.
 *
 * ⚠️ 진짜로 0 일 수도 있다(예: 결제가 정말 없는 주). 그래서 문구가 "실제 0 이거나 계측 끊김" 둘 다 말한다.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** [앞 단계, 다음 단계, 앞 단계 최소 건수, 사람이 읽는 이름] — 앞이 이만큼 있는데 뒤가 0 이면 의심. */
export const FUNNEL_CHAINS: ReadonlyArray<readonly [string, string, number, string]> = [
  ['login_wall_shown', 'login_succeeded', 10, '로그인 성공'],
  ['checkout_started', 'payment_succeeded', 5, '결제 성공'],
  ['creator_content_shown', 'creator_content_opened', 30, '다녀온 사람들 열기'],
]

/** 7일 건수 → 경고 줄. 순수 함수 — 시험이 직접 돌린다. */
export function funnelSilenceWarnings(counts: Record<string, number>): string[] {
  const n = (k: string) => Number(counts[k] ?? 0) || 0
  const out: string[] = []
  if (n('app_open') === 0) out.push('🔇 계측 끊김 의심: 7일간 앱 열기(app_open) 0건 — 퍼널 기록 자체가 멈췄을 수 있음')
  for (const [prev, next, min, label] of FUNNEL_CHAINS) {
    if (n(prev) >= min && n(next) === 0) out.push(`🔇 '${label}' 7일 0건(앞 단계 ${n(prev)}건) — 실제 0 이거나 계측이 끊김. /admin/funnel 확인`)
  }
  return out
}

export async function loadFunnel7d(DB: D1Database): Promise<Record<string, number>> {
  const r = await DB.prepare(`SELECT event, COUNT(*) n FROM funnel_events WHERE created_at > datetime('now', '-7 days') GROUP BY event`)
    .all<{ event: string; n: number }>().catch(() => ({ results: [] as { event: string; n: number }[] }))
  return Object.fromEntries((r.results ?? []).map((x) => [x.event, Number(x.n) || 0]))
}
