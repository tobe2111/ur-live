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

// 💸 커미션 재원·요율 **정책**은 별도 모듈(파일크기 래칫 — 원장 기록과 정책 판단은 층이 다르다).
import { ownerFundedFor, channelPlatformRate } from './ledger-commission-policy'

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
  // 💸 2026-08-25 채널별 요율 승격 — **직접 입점 10% / 중개 5%**(대표 최종 2026-08-20).
  //   그 규칙은 `fee-resolver.ts` 에 두 달째 있었지만 **그림자**(계산만 기록)였고, 실제 정산인
  //   이 함수는 채널을 몰라 단일 `platform_fee_pct` 만 봤다 — 즉 직접 입점 매장도 5% 만 뗐다.
  //   여기서 채널을 읽어 authoritative 로 올린다.
  //   게이트: `platform_settings.fee_channel_rates_enabled === 'true'`(기본 OFF = 종전 동일).
  //   ⚠️ env 가 아니라 platform_settings 인 게 의도다 — 어드민에서 **재배포 없이** 끌 수 있어야
  //   되돌리기가 빠르다(머니 경로의 롤백 시간이 곧 손실 크기다).
  //   명시 override(`params.platform_rate`, 어드민 캠페인)가 있으면 그게 최우선 — 여기 안 들어온다.
  if (platformRate === undefined) {
    platformRate = await channelPlatformRate(DB, params.merchant_id)
  }
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
 * 🌇 2026-09-04 에이전시 완전 일몰(대표 확정) — 여기 있던 `recordAgencyCommissionShare` 를 삭제했다.
 *
 * 무엇이었나: 이용권 *사용* 시점에 플랫폼 수수료의 30%(`agency_share_pct`)를 영입 에이전시
 * (`sellers.introduced_by_agency_id`)에게 원장 분개(`platform:revenue` → `agency:N`)로 넘기던 레거시.
 *
 * 왜 지웠나: 대표 확정 원칙과 **정반대**다 — "5%는 중개사 일 때 유어딜의 수수료인거고,
 * 중개사는 나머지 95%에서 매장이랑 거래를 하는거지." 유어딜 몫에서 커미션이 나가면 안 된다.
 * 라이브 실측상 `introduced_by_agency_id` 는 전원 NULL 이라 실제로 지급된 적은 없다.
 *
 * ⚠️ 짝인 `recordIntroductionCommissionShare`(사람 영입)는 **그대로 산다** — 그건 별개 축이고
 *    2026-08-31 대표 확정으로 직접 입점 매장 전용이다.
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
