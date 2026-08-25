/**
 * 🛡️ 2026-05-15: Double-entry bookkeeping ledger.
 *
 * 각 financial event 는 debit/credit 짝으로 기록 → 정합성 검증 가능 (Σdebit == Σcredit).
 * point_transactions (단일 entry) 와 별개로 ledger_entries 테이블 유지.
 *
 * 사용:
 *   await recordLedger(DB, {
 *     event_type: 'group_buy_join',
 *     reference_id: orderNumber,
 *     amount: 50000,
 *     debit_account: `user:${userId}`,         // 유저 wallet 차감
 *     credit_account: `seller:${sellerId}`,    // 셀러 receivable 증가
 *     fee_amount: 2500,                         // 플랫폼 수수료
 *     fee_account: 'platform:commission',
 *   })
 *
 * 정합성 검증 (cron): SELECT account, SUM(debit) - SUM(credit) FROM ... GROUP BY account
 */

interface LedgerEntry {
  event_type: string  // group_buy_join | refund | charge | settlement | dispute_refund
  reference_id: string  // order_number / voucher_id / dispute_id
  amount: number
  debit_account: string
  credit_account: string
  fee_amount?: number
  fee_account?: string  // 'platform:commission' | 'platform:pg_fee'
  metadata?: Record<string, unknown>
}

/**
 * 💸 [INV-#44] promo flip 판정 — `owner-promo.isOwnerFunded` 로 위임.
 *
 * ⚠️ **동적 import 인 게 의도다.** `owner-promo.ts` 가 이 파일을 static import 하므로,
 *   여기서 되받아 static 으로 걸면 순환 참조가 된다(워커 번들에서 초기화 순서 사고).
 *   fail-soft: 실패 시 false = 현행 플랫폼 재원 — **모르면 바꾸지 않는다.**
 */
async function ownerFundedFor(DB: D1Database, ownerAccount: string): Promise<boolean> {
  try {
    const sellerId = /(?:merchant|seller):(\d+)/.exec(ownerAccount)?.[1] ?? null
    const { isOwnerFunded } = await import('./owner-promo')
    return await isOwnerFunded(DB, sellerId)
  } catch { return false }
}

let DDL_DONE = false

export async function ensureLedgerTable(DB: D1Database): Promise<void> {
  if (_done_ensureLedgerTable.has(DB)) return
  _done_ensureLedgerTable.add(DB)
  if (DDL_DONE) return
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        amount INTEGER NOT NULL,         -- KRW (정수, 음수 X)
        debit_account TEXT NOT NULL,
        credit_account TEXT NOT NULL,
        fee_amount INTEGER DEFAULT 0,
        fee_account TEXT,
        metadata TEXT,                   -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(reference_id)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_event ON ledger_entries(event_type, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_debit ON ledger_entries(debit_account, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_credit ON ledger_entries(credit_account, created_at DESC)`).run()
    DDL_DONE = true
  } catch { /* exists */ }
}

export async function recordLedger(DB: D1Database, entry: LedgerEntry): Promise<void> {
  await ensureLedgerTable(DB)
  if (!Number.isFinite(entry.amount) || entry.amount < 0 || entry.amount > 100_000_000_000) {
    throw new Error('Invalid ledger amount')
  }
  if (!entry.debit_account || !entry.credit_account) {
    throw new Error('Missing accounts')
  }
  try {
    await DB.prepare(`
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount, fee_account, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.event_type,
      entry.reference_id,
      Math.round(entry.amount),
      entry.debit_account,
      entry.credit_account,
      Math.round(entry.fee_amount ?? 0),
      entry.fee_account || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ).run()
  } catch (err) {
    console.error('[ledger] record failed', err)
    // ledger 실패해도 본 트랜잭션은 진행 (audit-only, best-effort)
  }
}

/** 계정별 잔액 조회 (credit - debit 합) — credit 양수, debit 음수 의미. */
export async function getAccountBalance(DB: D1Database, account: string): Promise<number> {
  await ensureLedgerTable(DB)
  const row = await DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN debit_account = ? THEN amount ELSE 0 END), 0) AS debit_total,
      COALESCE(SUM(CASE WHEN credit_account = ? THEN amount ELSE 0 END), 0) AS credit_total
    FROM ledger_entries
    WHERE debit_account = ? OR credit_account = ?
  `).bind(account, account, account, account).first<{ debit_total: number; credit_total: number }>()
  return Number(row?.credit_total ?? 0) - Number(row?.debit_total ?? 0)
}

/**
 * 🛡️ 2026-05-21 Phase C: voucher 사용 완료 시점 정산 entries 자동 생성.
 *
 * 호출 시점: voucher.status='used' 로 atomic UPDATE 성공 직후.
 * 결과: ledger_entries 에 3개 row INSERT
 *   1) escrow → merchant_payable (업체 외상)
 *   2) escrow → seller_commission (셀러 외상)
 *   3) escrow → platform_fee (플랫폼 수익 확정)
 *
 * 멱등: voucher_id 중복 호출 시 entry 중복 방지 (reference_id + event_type unique check).
 * 영구성: 환불 시 reverse entry 생성 (recordRefundLedger).
 */
export async function recordVoucherUsedLedger(
  DB: D1Database,
  params: {
    voucher_id: number | string
    order_amount: number          // 사용자 결제 총액
    merchant_id: number | string  // store_owner seller_id
    seller_id?: number | string | null // 인플루언서 (위탁 판매 시)
    platform_rate?: number        // 명시 시 override (어드민 캠페인별)
    seller_rate?: number          // 명시 시 override
  },
): Promise<{ merchant_amount: number; seller_amount: number; platform_amount: number }> {
  await ensureLedgerTable(DB)
  // 🛡️ 2026-05-21 Phase D: platform_settings 에서 비율 조회 — 어드민 조정 가능.
  let platformRate = params.platform_rate
  let sellerRate = params.seller_rate
  if (platformRate === undefined || sellerRate === undefined) {
    try {
      const rows = await DB.prepare(
        "SELECT key, value FROM platform_settings WHERE key IN ('platform_fee_pct','seller_commission_pct')",
      ).all<{ key: string; value: string }>().catch(() => ({ results: [] as Array<{ key: string; value: string }> }))
      for (const r of rows.results || []) {
        const v = parseFloat(r.value)
        if (!Number.isFinite(v)) continue
        if (r.key === 'platform_fee_pct' && platformRate === undefined) platformRate = v / 100
        if (r.key === 'seller_commission_pct' && sellerRate === undefined) sellerRate = v / 100
      }
    } catch { /* default fallback */ }
  }
  // 🛡️ 2026-05-22 정책 중앙화 — COMMISSION_DEFAULTS fallback (DB 미설정 시)
  if (platformRate === undefined || sellerRate === undefined) {
    const { COMMISSION_DEFAULTS } = await import('../../shared/constants/policy')
    if (platformRate === undefined) platformRate = COMMISSION_DEFAULTS.PLATFORM_FEE_PCT / 100
    if (sellerRate === undefined) sellerRate = COMMISSION_DEFAULTS.SELLER_COMMISSION_PCT / 100
  }
  if (!params.seller_id) sellerRate = 0
  const merchantRate = 1 - platformRate - sellerRate
  const platformAmount = Math.floor(params.order_amount * platformRate)
  const sellerAmount = Math.floor(params.order_amount * sellerRate)
  const merchantAmount = params.order_amount - platformAmount - sellerAmount
  const ref = `voucher:${params.voucher_id}`

  // 멱등 — 이미 처리한 voucher 면 skip
  const existing = await DB.prepare(
    `SELECT id FROM ledger_entries WHERE reference_id = ? AND event_type = 'voucher_used' LIMIT 1`,
  ).bind(ref).first().catch(() => null)
  if (existing) {
    return { merchant_amount: merchantAmount, seller_amount: sellerAmount, platform_amount: platformAmount }
  }

  // 1) 업체 receivable
  await recordLedger(DB, {
    event_type: 'voucher_used',
    reference_id: ref,
    amount: merchantAmount,
    debit_account: 'platform:escrow',
    credit_account: `merchant:${params.merchant_id}`,
    metadata: { kind: 'merchant_payable', voucher_id: params.voucher_id },
  })
  // 2) 셀러 commission (위탁 판매 시만)
  if (params.seller_id && sellerAmount > 0) {
    await recordLedger(DB, {
      event_type: 'voucher_used',
      reference_id: ref,
      amount: sellerAmount,
      debit_account: 'platform:escrow',
      credit_account: `seller:${params.seller_id}`,
      metadata: { kind: 'seller_commission', voucher_id: params.voucher_id },
    })
  }
  // 3) 플랫폼 fee (수익 인식)
  await recordLedger(DB, {
    event_type: 'voucher_used',
    reference_id: ref,
    amount: platformAmount,
    debit_account: 'platform:escrow',
    credit_account: 'platform:revenue',
    metadata: { kind: 'platform_fee', voucher_id: params.voucher_id },
  })

  return { merchant_amount: merchantAmount, seller_amount: sellerAmount, platform_amount: platformAmount }
}

/**
 * 🛡️ 2026-05-21 Phase D: voucher 사용 시점에 에이전시 commission 자동 분배.
 *
 * 구조: 플랫폼 fee 의 일부(default 30%)를 에이전시에게 자동 분배.
 *   - sellers.introduced_by_agency_id 가 있는 가게의 voucher 사용 시 발생.
 *   - 분배 비율은 platform_settings.agency_share_pct (default 30) 에서 조정 (어드민 페이지).
 *   - ledger: platform:revenue → agency:N (debit/credit) 자동 entry.
 *
 * 멱등: voucher_id + agency 조합 1회만.
 */
export async function recordAgencyCommissionShare(
  DB: D1Database,
  params: {
    voucher_id: number | string
    merchant_id: number | string  // sellers.id (introduced_by_agency_id 조회용)
    platform_fee: number          // recordVoucherUsedLedger 가 반환한 platform 분
  },
): Promise<{ agency_id: number | null; amount: number }> {
  await ensureLedgerTable(DB)
  const ref = `voucher:${params.voucher_id}:agency`
  const existing = await DB.prepare(
    `SELECT id FROM ledger_entries WHERE reference_id = ? LIMIT 1`,
  ).bind(ref).first().catch(() => null)
  if (existing) return { agency_id: null, amount: 0 }

  // 가게의 추천 에이전시 조회
  // 🛡️ 2026-05-27 (사용자 결정): 매장별 commission 기간 체크 추가.
  //   referral_bonus_until NULL = 무기한, 날짜 있으면 만료 검사 (admin 이 매장별 설정).
  const seller = await DB.prepare(
    'SELECT introduced_by_agency_id, referral_bonus_until FROM sellers WHERE id = ?',
  ).bind(params.merchant_id).first<{ introduced_by_agency_id: number | null; referral_bonus_until: string | null }>().catch(() => null)
  if (!seller?.introduced_by_agency_id) return { agency_id: null, amount: 0 }
  // 기간 만료 시 commission 0 (referral_bonus_until 설정된 경우만)
  if (seller.referral_bonus_until && new Date(seller.referral_bonus_until) < new Date()) {
    return { agency_id: null, amount: 0 }
  }

  // 💸 2026-07-04 [INV-CB-DEDUP] (F2 이중 커미션 수정 — commission-funding-restructure.md):
  //   같은 구매에 결제확정 시 GMV 커미션(agency_store_intro_commissions sales_commission, 아비터 캡 대상)이
  //   이미 적립됐으면 이 사용시점 셰어(platform_fee 30%)는 **skip** — 두 시스템이 같은 에이전시에
  //   같은 주문으로 이중 적립(최대 GMV 3.5% > 플랫폼 수수료)하던 구조적 누수 차단.
  //   확정 커미션이 없을 때(영입 시점이 구매 후 등)만 이 레거시 셰어가 단독 지급(단일-지급 보장).
  try {
    const v = await DB.prepare('SELECT order_id FROM vouchers WHERE id = ?')
      .bind(params.voucher_id).first<{ order_id: number | null }>().catch(() => null)
    if (v?.order_id) {
      const dup = await DB.prepare(
        `SELECT id FROM agency_store_intro_commissions
          WHERE order_id = ? AND agency_id = ? AND type = 'sales_commission'
            AND COALESCE(status, 'pending') != 'cancelled' LIMIT 1`,
      ).bind(v.order_id, seller.introduced_by_agency_id).first().catch(() => null)
      if (dup) return { agency_id: seller.introduced_by_agency_id, amount: 0 }
    }
  } catch { /* dedup 조회 실패 → 기존 동작(지급) — 멱등 ref 가 재실행 이중은 막음 */ }

  // 분배 비율 (platform_settings)
  let sharePct = 0.30  // default 30%
  try {
    const row = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'agency_share_pct'",
    ).first<{ value: string }>()
    const v = parseFloat(row?.value || '0.30')
    if (v > 0 && v < 1) sharePct = v
    else if (v >= 1 && v <= 100) sharePct = v / 100
  } catch { /* settings 없으면 default */ }

  const agencyAmount = Math.floor(params.platform_fee * sharePct)
  if (agencyAmount <= 0) return { agency_id: seller.introduced_by_agency_id, amount: 0 }

  // 💸 [INV-#44] promo flip — 에이전시는 **매장-인플 조율 독립 사업자**이므로 그 몫도
  //   매장 promo(5% 밖)에서 나온다(대표 확정 2026-07-08 §확정 원칙 3). flip 이 켜지면
  //   debit 을 `merchant:{id}` 로 돌려 **platform:revenue 를 한 푼도 건드리지 않는다**.
  //   OFF(기본)면 종전과 byte-동일. 산식(platform_fee×share_pct)은 **크기 기준일 뿐**이라 불변.
  const ownerFunded = await ownerFundedFor(DB, `merchant:${params.merchant_id}`)
  await recordLedger(DB, {
    event_type: 'agency_commission',
    reference_id: ref,
    amount: agencyAmount,
    debit_account: ownerFunded ? `merchant:${params.merchant_id}` : 'platform:revenue',
    credit_account: `agency:${seller.introduced_by_agency_id}`,
    metadata: {
      kind: 'agency_share', voucher_id: params.voucher_id, share_pct: sharePct,
      ...(ownerFunded ? { funding: 'owner' } : {}),
    },
  })

  return { agency_id: seller.introduced_by_agency_id, amount: agencyAmount }
}

/**
 * 🛡️ 2026-05-28: 유저 commission 통합 적립 SSOT (docs/SERVICE_MODEL.md §9).
 *
 * 모든 유저(크리에이터/큐레이터) commission 의 "현금 vs 딜" 결정을 단 한 곳으로 통합:
 *   - 사업자 (users.business_status='verified') → user:N ledger credit → payouts-generate 현금 정산
 *   - 비사업자                                  → userdeal:N audit + 딜 즉시 적립
 *
 * 영입 commission 이 현재 유일한 호출자. 추천(affiliate) 통합은 payment.routes.ts(Toss 잠금)
 * 해제 후 같은 helper 로 forward-only 수렴 예정.
 *
 * idempotency 는 호출자가 reference_id 중복 체크로 보장 (여기선 재확인 안 함).
 */
export async function creditUserCommission(
  DB: D1Database,
  params: {
    userId: number | string
    amount: number
    referenceId: string
    eventType?: string       // ledger event_type (기존 쿼리 호환 위해 호출자 지정)
    kind: string             // metadata.kind
    dealTxType?: string      // point_transactions.type (딜 경로)
    description?: string
    meta?: Record<string, unknown>
    /**
     * 💸 [INV-#44] 매장 promo 재원 계정(예: `merchant:{id}`). 전달 + flip ON 이면
     *   이 커미션의 debit 이 **platform:revenue 대신 여기**로 간다 = 5% 무접촉.
     *   미전달(기존 호출부)이면 종전과 byte-동일 — additive 하다.
     */
    ownerAccount?: string | null
  },
): Promise<{ payout: 'cash' | 'deal'; amount: number }> {
  if (params.amount <= 0) return { payout: 'deal', amount: 0 }
  const eventType = params.eventType || 'commission'
  // flip 판정: ownerAccount 가 있을 때만 조회한다(없으면 왕복 0 — 기존 호출부 성능 불변).
  const debitAcct = params.ownerAccount && await ownerFundedFor(DB, params.ownerAccount)
    ? params.ownerAccount
    : 'platform:revenue'
  const baseMeta = { kind: params.kind, ...(params.meta || {}) }

  const u = await DB.prepare(
    'SELECT business_status FROM users WHERE id = ?',
  ).bind(params.userId).first<{ business_status: string | null }>().catch(() => null)
  const isBusiness = u?.business_status === 'verified'

  if (isBusiness) {
    await recordLedger(DB, {
      event_type: eventType,
      reference_id: params.referenceId,
      amount: params.amount,
      debit_account: debitAcct,
      credit_account: `user:${params.userId}`,
      metadata: { ...baseMeta, payout: 'cash', ...(debitAcct !== 'platform:revenue' ? { funding: 'owner' } : {}) },
    })
    return { payout: 'cash', amount: params.amount }
  }

  await recordLedger(DB, {
    event_type: eventType,
    reference_id: params.referenceId,
    amount: params.amount,
    debit_account: debitAcct,
    credit_account: `userdeal:${params.userId}`,
    metadata: { ...baseMeta, payout: 'deal', ...(debitAcct !== 'platform:revenue' ? { funding: 'owner' } : {}) },
  })
  // 비사업자 → 딜 즉시 적립 (signup-bonus 와 동일 패턴).
  try {
    const uid = String(params.userId)
    await DB.prepare(
      `INSERT INTO user_points (user_id, balance, total_charged) VALUES (?, ?, 0)
       ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?, updated_at = datetime('now')`,
    ).bind(uid, params.amount, params.amount).run()
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)`,
    ).bind(uid, params.dealTxType || 'commission', params.amount, params.description || '커미션 적립').run().catch(() => null)
  } catch { /* fail-soft: ledger audit 는 이미 기록됨 */ }
  return { payout: 'deal', amount: params.amount }
}

/**
 * 🛡️ 2026-05-21 Phase D-6: 인플루언서 입점 유치 영구 commission.
 *
 * 흐름:
 *   1. 인플루언서가 본인 추천 코드로 매장 사장님 가입 유도
 *   2. sellers.introduced_by_influencer_id 영구 lock-in
 *   3. 해당 매장 voucher 사용 시마다 자동 분배 (platform_fee 의 일정 %)
 *   4. 다른 인플루언서가 후속 홍보로 판매해도 본 commission 은 별개 영구 수령
 *
 * 멱등: voucher_id + 'introducing_influencer' 1회만 entry.
 */
export async function recordIntroductionCommissionShare(
  DB: D1Database,
  params: {
    voucher_id: number | string
    merchant_id: number | string
    platform_fee: number
  },
): Promise<{ influencer_id: number | null; amount: number }> {
  await ensureLedgerTable(DB)
  const ref = `voucher:${params.voucher_id}:intro-inf`
  const existing = await DB.prepare(
    `SELECT id FROM ledger_entries WHERE reference_id = ? LIMIT 1`,
  ).bind(ref).first().catch(() => null)
  if (existing) return { influencer_id: null, amount: 0 }

  // 매장의 입점 유치 인플루언서 조회
  // 🛡️ 2026-05-27 (사용자 결정): 매장별 commission 기간 체크 (referral_bonus_until).
  const seller = await DB.prepare(
    'SELECT introduced_by_influencer_id, referral_bonus_until FROM sellers WHERE id = ?',
  ).bind(params.merchant_id).first<{ introduced_by_influencer_id: number | null; referral_bonus_until: string | null }>().catch(() => null)
  if (!seller?.introduced_by_influencer_id) return { influencer_id: null, amount: 0 }
  // 기간 만료 시 commission 0 (referral_bonus_until 설정된 경우만, NULL = 무기한)
  if (seller.referral_bonus_until && new Date(seller.referral_bonus_until) < new Date()) {
    return { influencer_id: null, amount: 0 }
  }

  // 💸 2026-07-04 [INV-CB-DEDUP] (F2 이중 커미션 수정): 같은 구매에 결제확정 시 영입 커미션
  //   (influencer_attributions source='store_intro', 아비터 캡 대상)이 이미 적립됐으면 이 사용시점
  //   셰어(platform_fee 20%)는 skip — 같은 크리에이터에 같은 주문 이중 적립(GMV 2.5%) 차단.
  // 🛡️ 2026-07-12 (§0-2 본인구매 가드 — 대표 [UNLOCK]): 이용권 구매자==영입 인플이면 skip —
  //   영입자가 자기 영입 매장 이용권을 사서 쓰면 platform_fee 20% 를 스스로 수령하던 자가 루프 차단
  //   (store-intro-commission.ts 의 결제시점 가드와 짝 — 이 함수는 사용시점 레일).
  try {
    const v = await DB.prepare('SELECT order_id, user_id FROM vouchers WHERE id = ?')
      .bind(params.voucher_id).first<{ order_id: number | null; user_id: string | number | null }>().catch(() => null)
    if (v?.user_id != null && String(v.user_id) === String(seller.introduced_by_influencer_id)) {
      return { influencer_id: seller.introduced_by_influencer_id, amount: 0 }
    }
    if (v?.order_id) {
      const dup = await DB.prepare(
        `SELECT id FROM influencer_attributions
          WHERE order_id = ? AND influencer_id = ? AND source = 'store_intro'
            AND COALESCE(status, 'pending') NOT IN ('clawed_back', 'cancelled') LIMIT 1`,
      ).bind(v.order_id, String(seller.introduced_by_influencer_id)).first().catch(() => null)
      if (dup) return { influencer_id: seller.introduced_by_influencer_id, amount: 0 }
    }
  } catch { /* dedup 조회 실패 → 기존 동작(지급) — 멱등 ref 가 재실행 이중은 막음 */ }

  // 분배 비율 (platform_settings.influencer_intro_share_pct, default 20%)
  let sharePct = 0.20
  try {
    const row = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'influencer_intro_share_pct'",
    ).first<{ value: string }>()
    const v = parseFloat(row?.value || '20')
    if (v > 0 && v < 1) sharePct = v
    else if (v >= 1 && v <= 100) sharePct = v / 100
  } catch { /* default */ }

  const amount = Math.floor(params.platform_fee * sharePct)
  if (amount <= 0) return { influencer_id: seller.introduced_by_influencer_id, amount: 0 }

  const influencerUserId = seller.introduced_by_influencer_id

  // 🛡️ 2026-05-28: introduced_by_influencer_id 는 users.id (sellers.id 아님!).
  //   현금/딜 분기는 통합 SSOT creditUserCommission 으로 위임. event_type 은
  //   기존 audit/조회 쿼리 호환 위해 'introduction_commission' 유지.
  await creditUserCommission(DB, {
    userId: influencerUserId,
    amount,
    referenceId: ref,
    eventType: 'introduction_commission',
    kind: 'introducing_influencer',
    dealTxType: 'intro_commission',
    description: `영입 매장 공구 커미션 (voucher ${params.voucher_id})`,
    meta: { voucher_id: params.voucher_id, share_pct: sharePct },
    // 💸 [INV-#44] flip ON 이면 이 20% 도 매장 promo 재원에서 — 5% 무접촉.
    ownerAccount: `merchant:${params.merchant_id}`,
  })

  return { influencer_id: influencerUserId, amount }
}

/**
 * 💸 [머니 룰 #2] 이용권 커미션 셰어(에이전시 30% · 인플 20%) **원장 역전**.
 *
 * 🩸 2026-08-25 실측으로 확인한 갭: `recordAgencyCommissionShare` / `recordIntroductionCommissionShare`
 *   가 쓴 원장 엔트리(`voucher:N:agency` · `voucher:N:intro-inf`)를 **되돌리는 코드가 어디에도
 *   없었다.** `clawbackVoucherCommission` 은 `influencer_balances` 만 만지고 원장은 무접촉,
 *   `recordVoucherRefundLedger` 는 호출부 0(죽은 함수)였다. 설계 문서는 *"기존 역전이 debit_account 를
 *   읽어 복원하므로 대칭 유지"* 라고 적혀 있었지만 **그런 코드는 없었다** — 문서가 앞서간 것이다.
 *
 * ⚠️ **flip 이 켜지면 이게 더 나빠진다**: debit 이 `merchant:{id}` 로 가므로, 역전이 없으면
 *   **매장이 환불된 주문의 커미션을 영구 부담**한다(플랫폼 돈이 아니라 남의 돈이다).
 *
 * 설계: 원본 엔트리의 **debit/credit 을 읽어 그대로 뒤집는다** → flip 상태와 무관하게 자동 대칭.
 *   (그래서 flip ON/OFF 어느 시점에 적립됐든 되돌아가는 곳이 정확히 맞는다.)
 * 멱등: `{ref}:reversal` 이 이미 있으면 no-op. fail-soft — 역전 실패가 환불을 막지 않는다.
 */
export async function reverseVoucherCommissionShares(
  DB: D1Database,
  voucherId: number | string,
  reason: string,
): Promise<{ reversed: number }> {
  await ensureLedgerTable(DB)
  let reversed = 0
  for (const suffix of ['agency', 'intro-inf']) {
    const ref = `voucher:${voucherId}:${suffix}`
    try {
      const src = await DB.prepare(
        `SELECT amount, debit_account, credit_account FROM ledger_entries
          WHERE reference_id = ? ORDER BY id LIMIT 1`,
      ).bind(ref).first<{ amount: number; debit_account: string; credit_account: string }>()
      if (!src || !(Number(src.amount) > 0)) continue
      const revRef = `${ref}:reversal`
      const dup = await DB.prepare('SELECT id FROM ledger_entries WHERE reference_id = ? LIMIT 1')
        .bind(revRef).first().catch(() => null)
      if (dup) continue
      await recordLedger(DB, {
        event_type: 'commission_reversal',
        reference_id: revRef,
        amount: Number(src.amount),
        debit_account: src.credit_account,   // 뒤집는다 — 받았던 쪽에서 회수
        credit_account: src.debit_account,   // 냈던 쪽으로 복원(platform:revenue 또는 merchant:N)
        metadata: { kind: 'voucher_share_reversal', voucher_id: voucherId, reason, of: ref },
      })
      reversed++
    } catch { /* fail-soft — 역전 실패가 환불을 막으면 안 된다 */ }
  }
  return { reversed }
}

/**
 * 환불 시 reverse entries (멱등 보장).
 */
export async function recordRefundLedger(
  DB: D1Database,
  params: {
    voucher_id: number | string
    reason: string
    amount: number
  },
): Promise<void> {
  await ensureLedgerTable(DB)
  const ref = `voucher:${params.voucher_id}:refund`
  const existing = await DB.prepare(
    `SELECT id FROM ledger_entries WHERE reference_id = ? LIMIT 1`,
  ).bind(ref).first().catch(() => null)
  if (existing) return
  await recordLedger(DB, {
    event_type: 'voucher_refund',
    reference_id: ref,
    amount: params.amount,
    debit_account: 'platform:revenue', // 모든 분배 취소 (단순화 — admin 이 세분화 가능)
    credit_account: 'platform:escrow',
    metadata: { reason: params.reason, voucher_id: params.voucher_id },
  })
}

// 💸 owner-promo 원장 차감/역전(debitOwnerPromoForOrder/reverseOwnerPromoDebit)은 ./owner-promo.ts 로 추출(2026-07-12 file-size 래칫 — 본문 byte-동일).

/**
 * 순 receivable (지급 이력 제외) = (credit − fee_amount) − debit.
 *
 * 💸 2026-07-01 (정산 정합 — 대표 승인): 이전 payout 집계가 **credit-only** 여서 두 가지가 새고 있었음:
 *   ① 공구 seller credit 은 `amount=gross`(수수료 포함)+`fee_amount=수수료` 로 기록 → 수수료 미차감 gross 지급.
 *      (이용권은 `amount=net`+`fee_amount=0`.) → `amount − fee_amount` 로 통일 net 산출.
 *   ② seller:N 에 이미 존재하던 debit(환불 역전·인플루언서/추천 커미션)이 무시됨 → receivable 과다.
 *      → debit 를 차감.
 * 📐 **규칙(신규 credit 추가 시 준수)**: payout 대상 credit 의 `fee_amount` = `amount` 중 payee 의 net 이
 *    아닌 부분(플랫폼 수수료). net 을 그대로 credit 하면 fee_amount=0. (이 규칙을 어기면 payout 오산.)
 */
export async function getLedgerReceivable(
  DB: D1Database,
  account: string,
): Promise<number> {
  await ensureLedgerTable(DB)
  const bal = await DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN credit_account = ? THEN amount - COALESCE(fee_amount, 0) ELSE 0 END), 0) AS credit_net,
      COALESCE(SUM(CASE WHEN debit_account  = ? THEN amount ELSE 0 END), 0) AS debit_total
    FROM ledger_entries
    WHERE credit_account = ? OR debit_account = ?
  `).bind(account, account, account, account)
    .first<{ credit_net: number; debit_total: number }>()
    .catch(() => ({ credit_net: 0, debit_total: 0 }))
  return Number(bal?.credit_net ?? 0) - Number(bal?.debit_total ?? 0)
}

/** 정산 가능 잔액 = 순 receivable − 이미 payout(approved/sent) 처리분 */
export async function getPayablePending(
  DB: D1Database,
  payeeAccount: string,
): Promise<number> {
  const receivable = await getLedgerReceivable(DB, payeeAccount)
  const paid = await DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payouts
      WHERE (payee_type || ':' || payee_id) = ? AND status IN ('approved','sent')`,
  ).bind(payeeAccount).first<{ total: number }>().catch(() => ({ total: 0 }))
  return receivable - Number(paid?.total ?? 0)
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureLedgerTable = new WeakSet<object>()
