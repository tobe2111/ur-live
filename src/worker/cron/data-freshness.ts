/**
 * 🩺 데이터 신선도 감시 — 매일 1회 (2026-11-17 대표 "모두 가장 이상적이고 영구적으로").
 *
 * 왜: KT 교환권 목록은 **2026-05-19 부터 반 년 동안** 한 번도 갱신되지 않았는데 아무 경보가 없었다.
 *   cron 은 매일 돌았지만 "비밀값 없음 → skip" 을 성공으로 기록했기 때문이다(실패가 아니라 *부재*).
 *   그래서 "일이 돌았나" 가 아니라 **"결과가 최근인가"** 를 본다 — 원인이 무엇이든(키·시간초과·API 장애) 같은 경보로 잡힌다.
 * 문제가 있으면 throw → `safeCron` 이 cron_failures + 어드민 벨 + Discord 에 남긴다. 하루 1회라 경보가 쌓이지 않는다.
 */
export const KT_STALE_HOURS = 30

type Env = { DB: D1Database }

export function hoursSince(sqlUtc: string | null | undefined, nowMs: number): number | null {
  if (!sqlUtc) return null
  const t = Date.parse(String(sqlUtc).replace(' ', 'T') + 'Z')
  return Number.isFinite(t) ? (nowMs - t) / 3600_000 : null
}

/** 문제 목록(빈 배열 = 이상 없음). 순수 판정 — 시험이 직접 돌린다. */
export function freshnessProblems(s: { ktEnabled: boolean; ktLastSyncAt: string | null; ktBalance: number | null; ktLowWon: number }, nowMs: number): string[] {
  const out: string[] = []
  if (!s.ktEnabled) return out
  const h = hoursSince(s.ktLastSyncAt, nowMs)
  if (h == null) out.push('KT 교환권 목록: 갱신 기록 없음')
  else if (h > KT_STALE_HOURS) out.push(`KT 교환권 목록: ${Math.floor(h / 24)}일 ${Math.floor(h % 24)}시간째 갱신 안 됨`)
  if (s.ktBalance != null && s.ktBalance < s.ktLowWon) out.push(`KT 충전 잔액 ${s.ktBalance.toLocaleString()}원 (기준 ${s.ktLowWon.toLocaleString()}원 미만) — 교환권 발송이 막힐 수 있음`)
  return out
}

export async function runDataFreshness(env: Env, nowMs = Date.now()): Promise<string> {
  const { results } = await env.DB.prepare(
    `SELECT key, value FROM platform_settings WHERE key IN
       ('kt_alpha_api_enabled','kt_alpha_last_sync_at','kt_alpha_biz_money_balance','kt_alpha_low_balance_won')`,
  ).all<{ key: string; value: string }>()
  const m = new Map((results || []).map((r) => [r.key, r.value]))
  const bal = Number(m.get('kt_alpha_biz_money_balance'))
  const low = Number(m.get('kt_alpha_low_balance_won'))
  const problems = freshnessProblems({
    ktEnabled: m.get('kt_alpha_api_enabled') === '1',
    ktLastSyncAt: m.get('kt_alpha_last_sync_at') ?? null,
    ktBalance: Number.isFinite(bal) && m.has('kt_alpha_biz_money_balance') ? bal : null,
    ktLowWon: low > 0 ? low : 100_000,
  }, nowMs)
  if (problems.length) throw new Error(problems.join(' · '))
  return 'ok'
}
