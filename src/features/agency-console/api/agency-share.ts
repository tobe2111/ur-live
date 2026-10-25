/**
 * 🤝 **에이전시 몫 — 1단계: 정하고 계산해서 보여 주기만** (2026-10-24 대표 확정)
 *   대표: 에이전시 3단계를 *"응 하는게 좋겠는데 … 가장 이상적이야?"* → 추천안(지금은 돈 이동 없이 % 와 금액만,
 *   플랫폼 지급은 실제 에이전시가 들어온 뒤) → *"응 해줘"*.
 *
 * ## 무엇을 하나
 * 사장님이 에이전시마다 **몫 %** 를 정한다(`agency_share_terms`). 그 % 로 "이 에이전시에 줄 금액"을 계산해
 * 사장님 성과표('누가 팔았나')와 에이전시 판매 내역에 같은 숫자로 보인다.
 *
 * ## 돈은 안 움직인다
 * 실제 돈은 지금처럼 **매장이 에이전시에게 직접** 보낸다. 세금계산서도 **에이전시가 매장에** 발행한다(둘 사이의 거래).
 * 유어딜 원장·정산·결제 경로를 한 줄도 안 건드린다 — 그래서 결재(C)가 아니다. 플랫폼이 걷어 지급하는 단계(2단계)는
 * 결재 `docs/decisions/2026-10-11-agency-model-email-only.md` 규칙 1~3 그대로, staging 실결제 뒤에 붙인다.
 *
 * ## 규칙 (결재 규칙 2·3)
 *   - 유어딜 고정 상한 없음. 남는 바닥은 하나 — 매장 몫(판매가 − 유어딜 수수료)을 넘을 수 없다 → 90% 를 넘지 못한다.
 *   - % 를 바꾸면 **그 뒤 판매부터** 새 % 다(이력을 남기고, 판매 시각의 % 로 계산한다 — 지난 달 금액이 안 바뀐다).
 *   - 끊으면 그다음 판매부터 몫이 멈춘다 — 맡은 기간이 닫히므로 저절로 그렇다(`channel-sales.ts`).
 *   - 몫은 **환불 안 된 판매**의 결제가에 붙는다.
 */

/** 매장 몫(유어딜 수수료를 뺀 나머지)을 넘지 않게 — 유어딜 최소 수수료가 5% 라 95, 여유를 두고 90. */
export const AGENCY_SHARE_PCT_MAX = 90

export function validateSharePct(raw: unknown): { ok: true; pct: number } | { ok: false; error: string } {
  // 숫자 또는 숫자 문자열만 — `Number(null)`·`Number(false)`·`Number('')` 는 0 이 되어 '0% 로 정함' 으로 조용히 저장된다.
  const pct = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
  if (!Number.isFinite(pct) || pct < 0 || pct > AGENCY_SHARE_PCT_MAX) {
    return { ok: false, error: `에이전시 몫은 0 ~ ${AGENCY_SHARE_PCT_MAX}% 사이로 적어 주세요.` }
  }
  return { ok: true, pct: Math.round(pct * 10) / 10 }
}

/** 판매 시각(`o.created_at`)에 그 에이전시에게 적용되던 % — 정한 적 없으면 NULL. */
export function sharePctAtSaleSql(sellerCol: string, agencyCol: string, orderAlias = 'o'): string {
  return `(SELECT t.pct FROM agency_share_terms t WHERE t.seller_id = ${sellerCol} AND t.agency_id = ${agencyCol}
      AND t.effective_from <= ${orderAlias}.created_at ORDER BY t.effective_from DESC, t.id DESC LIMIT 1)`
}

/** 지금 % — 정한 적 없으면 NULL. */
export function currentSharePctSql(sellerCol: string, agencyCol: string): string {
  return `(SELECT t.pct FROM agency_share_terms t WHERE t.seller_id = ${sellerCol} AND t.agency_id = ${agencyCol}
      ORDER BY t.effective_from DESC, t.id DESC LIMIT 1)`
}

/**
 * 에이전시 몫 합(원, 반올림 전) — `pr` = 맡은 기간 별칭. 기간 밖(사장님 직접)·환불·% 미설정은 0.
 * 판매 한 장마다 그 판매 시각의 % 를 곱한다.
 */
// 기간 밖(사장님 직접)은 맡은 기간의 agency_id 가 NULL 이라 % 를 못 찾아 0 이 된다 — 따로 막지 않는다(겹친 잠금은 시험할 수 없다).
export function shareSumSql(pr: string): string {
  return `SUM(CASE WHEN v.status = 'refunded' THEN 0
      ELSE COALESCE(v.applied_price, p.price, 0) * COALESCE(${sharePctAtSaleSql('p.seller_id', `${pr}.agency_id`)}, 0) END) / 100.0 AS share_raw`
}

/** 사장님이 % 를 정한다(지금부터 판매에 적용). 같은 값이면 기록하지 않는다. */
export async function setAgencyShare(DB: D1Database, sellerId: number, agencyId: number, pct: number, userId: number | null): Promise<boolean> {
  const cur = await DB.prepare(`SELECT ${currentSharePctSql('?', '?')} AS pct`).bind(sellerId, agencyId).first<{ pct: number | null }>()
  if (cur?.pct != null && Number(cur.pct) === pct) return false
  await DB.prepare(
    "INSERT INTO agency_share_terms (seller_id, agency_id, pct, effective_from, set_by_user_id) VALUES (?, ?, ?, datetime('now'), ?)",
  ).bind(sellerId, agencyId, pct, userId).run()
  return true
}
