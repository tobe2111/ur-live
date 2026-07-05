/**
 * 💸 2026-07-04 (대표 승인 "수수료율은 동결, 재원 구조를 고쳐라"): 커미션 예산 아비터 — 순수 코어.
 *
 * 불변식 [INV-CB]: 3P 주문 1건에서 플랫폼이 부담하는 비례(%) 성장 커미션 총합은
 *   커미션 예산 = 플랫폼 수수료 − PG 준비금(pg_reserve_pct × 결제액) 을 절대 초과할 수 없다.
 *   → 요율(platform_settings)은 어드민이 자유 조정하되, 총합이 예산에 닿으면 **비례 축소**.
 *   → 어떤 3P 거래도 커미션 때문에 플랫폼에 구조적 마이너스가 될 수 없음.
 *
 * ⚠️ 이 파일은 **순수 함수만** (DB/네트워크/시간 의존 0) — fee-resolver.ts 와 같은 원칙.
 *    유닛테스트(commission-budget.test.ts)가 불변식을 영구히 지킴.
 *    배선(어느 커미션이 예산 대상인가)은 order-commissions.ts 가 담당.
 *
 * 설계 SSOT: docs/design/commission-funding-restructure.md
 */

/** PG 준비금 기본 % — platform_settings.pg_reserve_pct 미설정 시 폴백(카드 수수료 보수 추정). */
export const DEFAULT_PG_RESERVE_PCT = 2.5

export interface CommissionRequest {
  /** 커미션 식별 키 (예: 'affiliate' | 'multi_tier' | 'influencer_intro' | 'agency_intro') */
  key: string
  /** 요청 적립액 (원, 정수) */
  amountKrw: number
}

export interface CommissionGrant {
  key: string
  requestedKrw: number
  grantedKrw: number
}

function toNonNegInt(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0
  return v > 0 ? v : 0
}

/**
 * 주문 1건의 커미션 예산 = max(0, 플랫폼 수수료 − PG 준비금).
 * pg_reserve 는 결제액 기준(딜 혼합결제도 보수적으로 전액 기준 — 예산이 작아지는 안전 방향).
 */
export function computeCommissionBudget(p: {
  amountKrw: number
  platformFeeKrw: number
  pgReservePct: number
}): number {
  const amount = toNonNegInt(p.amountKrw)
  const fee = toNonNegInt(p.platformFeeKrw)
  const pct = typeof p.pgReservePct === 'number' && Number.isFinite(p.pgReservePct) && p.pgReservePct >= 0 && p.pgReservePct <= 100
    ? p.pgReservePct
    : DEFAULT_PG_RESERVE_PCT
  const reserve = Math.round((amount * pct) / 100)
  return Math.max(0, fee - reserve)
}

/**
 * 요청 커미션들을 예산 안으로 배분.
 *  - Σ요청 ≤ 예산 → 전액.
 *  - 초과 → 비례 축소(largest-remainder 정수 배분): floor(요청×scale) 후 잔여 1원씩
 *    소수부 큰 순으로 분배(요청액 초과 금지). Σgranted ≤ budget 이 수학적으로 보장.
 *  - 예산 ≤ 0 → 전부 0.
 * 결정적(같은 입력 → 같은 출력) — 환불 역전은 기록값 기준이라 대칭에 영향 없음.
 *
 * 🥇 2026-07-05 (운영 감사 Q10 — "에이전시 1% 보호 최우선" 자문 반영):
 *   opts.priorityKeys(순서 보존)에 든 축은 예산에서 **먼저 전액**(min(요청, 잔여예산)) 배정하고,
 *   나머지 축들이 잔여 예산을 비례 배분. 미전달 시 기존과 byte-동일(전 축 비례).
 *   [INV-CB] (Σ≤budget, granted≤requested) 은 어느 모드든 동일하게 성립.
 */
export function allocateCommissions(
  requests: CommissionRequest[],
  budgetKrw: number,
  opts?: { priorityKeys?: string[] },
): CommissionGrant[] {
  const budget = toNonNegInt(budgetKrw)
  const items = (requests || []).map((r) => ({
    key: String(r?.key ?? ''),
    requestedKrw: toNonNegInt(r?.amountKrw),
  }))
  const total = items.reduce((s, it) => s + it.requestedKrw, 0)

  if (budget <= 0) {
    return items.map((it) => ({ ...it, grantedKrw: 0 }))
  }
  if (total <= budget) {
    return items.map((it) => ({ ...it, grantedKrw: it.requestedKrw }))
  }

  // ── 우선 축 선배정 → 나머지를 잔여 예산으로 재귀(비례) ──────────────────
  const prio = (opts?.priorityKeys || []).filter(Boolean)
  if (prio.length > 0 && items.some((it) => prio.includes(it.key))) {
    let remaining = budget
    const grantedByIdx = new Map<number, number>() // 인덱스 기반 — 같은 key 중복 요청에도 이중배정 불가
    for (const pk of prio) {
      items.forEach((it, idx) => {
        if (it.key !== pk || grantedByIdx.has(idx)) return
        const g = Math.min(it.requestedKrw, remaining)
        grantedByIdx.set(idx, g)
        remaining -= g
      })
    }
    const rest = items.filter((_, idx) => !grantedByIdx.has(idx))
    const restGrants = allocateCommissions(
      rest.map((it) => ({ key: it.key, amountKrw: it.requestedKrw })),
      remaining,
    )
    let restCursor = 0
    return items.map((it, idx) => {
      if (grantedByIdx.has(idx)) {
        return { key: it.key, requestedKrw: it.requestedKrw, grantedKrw: grantedByIdx.get(idx)! }
      }
      return { key: it.key, requestedKrw: it.requestedKrw, grantedKrw: restGrants[restCursor++]?.grantedKrw ?? 0 }
    })
  }

  const scale = budget / total
  const scaled = items.map((it, idx) => {
    const exact = it.requestedKrw * scale
    const floored = Math.floor(exact)
    return { ...it, grantedKrw: floored, frac: exact - floored, idx }
  })
  let remainder = budget - scaled.reduce((s, it) => s + it.grantedKrw, 0)
  // 잔여 분배: 소수부 desc → 요청액 desc → 원래 순서(결정적 tie-break). granted==requested 는 skip.
  const order = [...scaled].sort((a, b) => (b.frac - a.frac) || (b.requestedKrw - a.requestedKrw) || (a.idx - b.idx))
  for (const it of order) {
    if (remainder <= 0) break
    if (it.grantedKrw >= it.requestedKrw) continue
    it.grantedKrw += 1
    remainder -= 1
  }
  return scaled
    .sort((a, b) => a.idx - b.idx)
    .map(({ key, requestedKrw, grantedKrw }) => ({ key, requestedKrw, grantedKrw }))
}

/**
 * [INV-CB] 검사 — 위반 시 throw. 호출측(order-commissions)은 위반 시 **적립을 중단**(fail-closed)해야 함
 * (돈 방향: 초과 지급보다 미지급이 안전 — 미지급분은 재실행/보정 가능, 초과 지급은 회수 어려움).
 *   ① Σgranted ≤ budget
 *   ② 각 0 ≤ granted ≤ requested
 */
export function assertCommissionBudgetInvariants(grants: CommissionGrant[], budgetKrw: number): void {
  const budget = toNonNegInt(budgetKrw)
  const fail = (msg: string) => {
    throw new Error(`[commission-budget] invariant violated: ${msg} — ${JSON.stringify({ grants, budget })}`)
  }
  let sum = 0
  for (const g of grants) {
    if (!Number.isFinite(g.grantedKrw) || g.grantedKrw < 0) fail(`${g.key} granted < 0`)
    if (!Number.isFinite(g.requestedKrw) || g.requestedKrw < 0) fail(`${g.key} requested < 0`)
    if (g.grantedKrw > g.requestedKrw) fail(`${g.key} granted > requested`)
    sum += g.grantedKrw
  }
  if (sum > budget) fail('sum(granted) > budget')
}
