/**
 * 🏦 **정산 계좌가 없는 매장 알림** (2026-11-24 대표 *"일단 지금 할 수 있는거 진행해줘 알리는 기능"*)
 *
 * 라이브 실측(11-24): 승인 매장 13곳 중 계좌 등록 **0곳** · 송금 대기 정산 1건(15,200원). 돈이 생겨도 보낼 곳이 없다.
 * 계좌 등록 화면은 이미 있고(마이 › 정산 › 계좌 등록) 비어 있을 뿐이다 — 그래서 **알린다**:
 *   ① 사장님 대시보드 알림(벨) — 판매 중이거나 받을 돈이 있는 매장에, **7일에 한 번**
 *   ② 대표 아침 요약 — "계좌 없는 매장 N곳 · 그중 받을 돈 있는 매장 M곳"
 *
 * 앱 안 알림만 보낸다(알림톡은 카카오 템플릿 심사 대상 — 발송은 결재 C). 돈은 한 푼도 안 움직인다(읽기 + 알림).
 * 🩸 매장 사장님의 정산 행은 `payee_type='store_owner'` 다(`payoutPayeeType`). `'seller'` 만 보면 받을 돈이 0 으로 읽힌다 —
 *   첫 판이 그랬고 라이브 조회(매장 14 · 15,200원)가 잡았다. 둘 다 본다.
 * 계좌 판정은 `payout-payee-account.ts`·`PayoutSheet` 와 같다 — **은행 이름과 계좌번호가 둘 다** 있어야 등록된 것.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { PAYOUT_ELIGIBLE_SELLER_STATUSES } from '../../shared/seller-status'

export const BANK_MISSING_NOTIF_TYPE = 'bank_missing'
/** 같은 매장에 다시 알리기까지 — 매일 뜨면 소음이고, 한 번뿐이면 잊는다. */
export const BANK_NUDGE_COOLDOWN_DAYS = 7

export interface BankMissingRow {
  sellerId: number
  name: string
  /** 송금 대기(pending) 정산 합계 — 계좌만 있으면 나갈 돈 */
  waiting: number
  liveProducts: number
}

/** 알릴 가치가 있는 매장인가 — 팔고 있거나 받을 돈이 있다(가입만 하고 멈춘 매장은 조용히 둔다). */
export function shouldNudge(r: BankMissingRow): boolean {
  return r.waiting > 0 || r.liveProducts > 0
}

const won = (n: number) => `${Math.floor(n).toLocaleString('ko-KR')}원`

/** 사장님에게 가는 알림 문구 — 받을 돈이 있으면 그 금액부터 말한다. */
export function bankNudgeMessage(r: BankMissingRow): { title: string; message: string } {
  return r.waiting > 0
    ? { title: `🏦 정산 ${won(r.waiting)}이 계좌를 기다리고 있어요`, message: '정산받을 계좌를 등록하면 다음 정산일에 보내 드려요. 마이 › 정산 › 계좌 등록' }
    : { title: '🏦 정산받을 계좌를 등록해 주세요', message: '이용권이 사용되면 정산 대상이 돼요. 계좌가 있어야 보낼 수 있어요. 마이 › 정산 › 계좌 등록' }
}

/** 대표 아침 요약 줄 — 없으면 빈 배열(조용히). */
export function bankMissingDigestLines(rows: BankMissingRow[]): string[] {
  if (rows.length === 0) return []
  const owed = rows.filter((r) => r.waiting > 0)
  const head = `🏦 정산 계좌 없는 매장 ${rows.length}곳` + (owed.length > 0
    ? ` · 그중 받을 돈 있는 매장 ${owed.length}곳(합계 ${won(owed.reduce((s, r) => s + r.waiting, 0))}) — 계좌를 받아야 송금할 수 있어요`
    : ' · 아직 보낼 돈은 없어요')
  return [head, ...owed.slice(0, 5).map((r) => `   · #${r.sellerId} ${r.name}: ${won(r.waiting)}`)]
}

/** 승인 매장 중 계좌가 없는 곳 + 그 매장의 송금 대기액·판매 중 이용권 수. 조회 실패는 빈 배열. */
export async function loadBankMissingStores(DB: D1Database): Promise<BankMissingRow[]> {
  const statuses = PAYOUT_ELIGIBLE_SELLER_STATUSES.map((s) => `'${s}'`).join(', ')
  const { results } = await DB.prepare(
    `SELECT s.id AS id, COALESCE(NULLIF(s.business_name, ''), s.name) AS name,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payouts p
              WHERE p.payee_type IN ('seller', 'store_owner') AND p.payee_id = CAST(s.id AS TEXT) AND p.status = 'pending') AS waiting,
            (SELECT COUNT(*) FROM products pr WHERE pr.seller_id = s.id AND pr.is_active = 1) AS live
       FROM sellers s
      WHERE s.status IN (${statuses}) AND s.seller_type = 'store_owner'
        AND (TRIM(COALESCE(s.bank_name, '')) = '' OR TRIM(COALESCE(s.bank_account, '')) = '')
      LIMIT 500`,
  ).all<{ id: number; name: string | null; waiting: number | null; live: number | null }>()
    .catch(() => ({ results: [] as Array<{ id: number; name: string | null; waiting: number | null; live: number | null }> }))
  return (results || []).map((r) => ({
    sellerId: Number(r.id), name: String(r.name ?? `매장 ${r.id}`), waiting: Number(r.waiting) || 0, liveProducts: Number(r.live) || 0,
  }))
}

/**
 * 사장님 대시보드 알림을 보낸다 — 매장마다 7일에 한 번.
 * 쿨다운은 "최근 7일 안에 같은 종류 알림이 있나" 로 판정한다(읽지 않았어도 다시 쌓지 않는다).
 */
export async function sendBankMissingNudges(DB: D1Database): Promise<{ sent: number; skipped: number }> {
  const rows = (await loadBankMissingStores(DB)).filter(shouldNudge)
  let sent = 0, skipped = 0
  for (const r of rows) {
    const recent = await DB.prepare(
      `SELECT 1 AS ok FROM dashboard_notifications
        WHERE recipient_type = 'seller' AND recipient_id = ? AND type = ? AND created_at > datetime('now', ?) LIMIT 1`,
    ).bind(String(r.sellerId), BANK_MISSING_NOTIF_TYPE, `-${BANK_NUDGE_COOLDOWN_DAYS} days`).first<{ ok: number }>().catch(() => ({ ok: 1 })) // 조회 실패면 보내지 않는다(중복보다 침묵)
    if (recent) { skipped++; continue }
    const m = bankNudgeMessage(r)
    const ins = await DB.prepare(
      `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link) VALUES ('seller', ?, ?, ?, ?, '/seller/settlements')`,
    ).bind(String(r.sellerId), BANK_MISSING_NOTIF_TYPE, m.title, m.message).run().catch(() => null)
    if (ins) sent++
  }
  return { sent, skipped }
}
