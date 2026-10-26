/**
 * 🏦 환급 받을 계좌 = 내 가게 정산 계좌 (2026-10-26 대표 *"a 해주고"*)
 *
 * ## 왜 생겼나
 * 대표: *"정산 시 계좌도 등록이 이미 되어있어야 하는데"* — 사장님은 정산 계좌를 이미 넣어 뒀는데
 * 충전 딜 환급 시트는 은행·계좌·예금주를 **매번 처음부터** 치게 했다.
 *
 * ## 🔴 화면이 계좌번호를 받지 않는다
 * 정산 계좌는 화면에 **끝 4자리만** 나간다(`seller-profile.routes` `maskBankAccount` — 2026-06-12
 * 감사 1단계, 계좌 탈취 방어). 그 결정을 지키려고 화면은 *"가게 계좌로"* 라는 **선택만** 보내고,
 * 실제 계좌는 **서버가 여기서** 꺼낸다. 화면이 전체 계좌번호를 들고 있는 순간 그 마스킹은 무의미해진다.
 *
 * ## 🔴 주인 것만 — 운영(대행)하는 남의 가게는 안 된다
 * 위임 운영자도 그 가게 좌석을 가진다. 운영자의 **개인 환급**이 그 가게 사장님 통장으로 가면
 * 안 되므로 `linked_user_id`(직접 연결) 또는 `seller_operators.role='owner'` 만 본다
 * (판정 기준은 `seller-operators.findOwnerSeatSellerId` 와 같다 — 회수된 좌석 제외).
 *
 * ## 환급 로직은 건드리지 않는다
 * 한도·CAS·원장은 `deal-refund.ts` 그대로다. 여기는 **입력 칸 세 개를 서버가 채우는 것**뿐이다.
 */

export interface OwnedStoreAccount {
  seller_id: number
  store_name: string
  bank_name: string
  bank_account: string
  account_holder: string
}

/** 화면에 보내는 모양 — 계좌는 끝 4자리만. */
export interface PublicStoreAccount {
  store_name: string
  bank_name: string
  bank_account_masked: string
  account_holder: string
}

const FILLED = `COALESCE(TRIM(s.bank_name), '') <> ''
   AND COALESCE(TRIM(s.bank_account), '') <> ''
   AND COALESCE(TRIM(s.account_holder), '') <> ''`

const COLS = `s.id AS seller_id, COALESCE(NULLIF(TRIM(s.business_name), ''), s.name) AS store_name,
  s.bank_name, s.bank_account, s.account_holder`

/**
 * 이 사람이 **주인인** 가게 중 정산 계좌가 다 채워진 첫 곳. 직접 연결된 가게를 먼저 고른다.
 * 못 찾거나 조회가 깨지면 `null` — 화면은 종전대로 손으로 입력하게 한다(돈이 잘못 가는 쪽보다 낫다).
 */
export async function findOwnedStoreAccount(
  DB: D1Database,
  userId: string | number,
): Promise<OwnedStoreAccount | null> {
  const uid = Number(userId)
  if (!Number.isFinite(uid) || uid <= 0) return null
  const pick = (r: OwnedStoreAccount | null): OwnedStoreAccount | null => {
    if (!r) return null
    const id = Number(r.seller_id)
    return Number.isFinite(id) && id > 0 ? { ...r, seller_id: id } : null
  }
  try {
    const row = await DB.prepare(
      `SELECT ${COLS} FROM sellers s
        WHERE (s.linked_user_id = ?
               OR EXISTS (SELECT 1 FROM seller_operators o
                           WHERE o.seller_id = s.id AND o.user_id = ?
                             AND o.role = 'owner' AND o.revoked_at IS NULL))
          AND ${FILLED}
        ORDER BY CASE WHEN s.linked_user_id = ? THEN 0 ELSE 1 END, s.id
        LIMIT 1`,
    ).bind(uid, uid, uid).first<OwnedStoreAccount>()
    return pick(row)
  } catch {
    // 좌석 테이블이 없는 환경 — 직접 연결만 본다.
    try {
      const row = await DB.prepare(
        `SELECT ${COLS} FROM sellers s WHERE s.linked_user_id = ? AND ${FILLED} ORDER BY s.id LIMIT 1`,
      ).bind(uid).first<OwnedStoreAccount>()
      return pick(row)
    } catch {
      return null
    }
  }
}

export function toPublicStoreAccount(a: OwnedStoreAccount | null): PublicStoreAccount | null {
  if (!a) return null
  const digits = String(a.bank_account).replace(/[^0-9]/g, '')
  return {
    store_name: a.store_name,
    bank_name: a.bank_name,
    bank_account_masked: `****${digits.slice(-4)}`,
    account_holder: a.account_holder,
  }
}
