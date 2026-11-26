/**
 * 💸 커미션 **정책** — 재원(누가 부담하나)과 요율(얼마나 떼나), 그리고 그 역전.
 *
 * `ledger.ts` 에서 분리했다(2026-08-25, 파일크기 래칫 634줄). 가른 기준은 **층**이다:
 *   - `ledger.ts` = *기록*(복식부기 엔트리를 쓴다)
 *   - 이 파일     = *판단*(누구 주머니에서 / 몇 % / 되돌릴 때 무엇을 뒤집나)
 *
 * ⚠️ **이 파일은 `./ledger` 를 static import 하지 않는다.** 반대 방향(ledger → 여기)이 static 이라
 *   되받으면 순환 참조가 된다(워커 번들 초기화 순서 사고). 역전 함수가 `recordLedger` 를 쓸 때는
 *   **동적 import** 로 간다 — 아래 `ownerFundedFor` 가 `owner-promo` 를 부르는 것과 같은 수법이다.
 */
import type { D1Database } from '@cloudflare/workers-types'

/**
 * 💸 [INV-#44] promo flip 판정 — `owner-promo.isOwnerFunded` 로 위임.
 *
 * ⚠️ **동적 import 인 게 의도다.** `owner-promo.ts` 는 `ledger.ts` 를 static import 하고,
 *   `ledger.ts` 는 이 파일을 static import 한다 — 여기서 `owner-promo` 를 static 으로 되받으면
 *   ledger → policy → owner-promo → ledger 로 고리가 닫힌다(워커 번들 초기화 순서 사고).
 *   fail-soft: 실패 시 false = 현행 플랫폼 재원 — **모르면 바꾸지 않는다.**
 */
export async function ownerFundedFor(DB: D1Database, ownerAccount: string): Promise<boolean> {
  try {
    const sellerId = /(?:merchant|seller):(\d+)/.exec(ownerAccount)?.[1] ?? null
    const { isOwnerFunded } = await import('./owner-promo')
    return await isOwnerFunded(DB, sellerId)
  } catch { return false }
}

/**
 * 🏢 **유어딜 운영사(유어팀) 계정** — 2026-11-16 대표 *"내 유어딜 계정 있지? 그걸로 매장 영입할 때는
 *   그렇게 해줘"* (= 운영사가 직접 데려온 매장은 중개 5% 가 아니라 직접 10%).
 *   `users.id = 3` 은 대표 본인 계정이다(CLAUDE.md "대표 본인 계정"). ⚠️ 30("유어팀 (정지원)")과 헷갈리지 말 것.
 *   결재 기록: `docs/decisions/archive/2026-11-16-operator-recruited-stores-direct.md`.
 */
export const PLATFORM_OPERATOR_USER_IDS: readonly number[] = [3]
/** 🏢 운영사 **에이전시 계정** — `agency_accounts.id = 1` 은 대표 회사(옛 리스터코퍼레이션 → 현 유어팀, 2026-11-16 대표
 *  *"리스터코퍼레이션 내 회사야. 그리고 이제 유어팀으로 회사명도 바꼈어"*). 이 계정이 맡은 매장도 직접 10% 이고 에이전시 몫은 없다. */
export const PLATFORM_OPERATOR_AGENCY_IDS: readonly number[] = [1]

/**
 * 💸 채널별 플랫폼 요율 — **직접 입점 10% / 대행사 경유 5%**(대표 최종 2026-08-20, 08-27 재확인:
 *   *"10%는 매장이 직접 입점해 이용권을 팔 때. 대행사로 가입하면 5%"*).
 *
 * @returns 비율(0~1). 게이트 OFF·채널 **미상**·조회 실패면 `undefined`(= 호출부가 종전 단일 요율 사용).
 *
 * 🩸 **fail-soft 방향이 중요하다**: 채널을 **모르면** `undefined` 를 돌려 종전 경로로 떨어진다.
 *   잘못 10% 를 물리면 매장에서 더 떼는 것이고, 그건 되돌리기 훨씬 비싸다.
 *
 * 🩸 **2026-08-27: 중개(brokered)를 명시적으로 돌려주도록 고쳤다.** 그전엔 direct 가 아니면 전부
 *   `undefined` 였는데, 그건 *"종전 경로가 마침 5% 다"* 라는 전제에 기대고 있었고 **그 전제가 실제로
 *   깨져 있었다** — 라이브 실측에서 활성 매장 7곳 전부 `sellers.commission_rate = 10` 이 박혀 있어,
 *   종전 경로를 타는 대행사 매장이 **10% 를 내고 있었다**(5% 여야 하는데). 폴백은 "아무 값"이 아니라
 *   *특정 값*을 전제하므로, 그 전제를 코드가 아니라 데이터가 정하게 두면 조용히 어긋난다.
 *   ⇒ 채널이 **확정된** 매장은 두 방향 모두 이 함수가 값을 정한다. 미지정만 종전 경로.
 */
export async function channelPlatformRate(
  DB: D1Database, merchantId: number | string | null | undefined,
): Promise<number | undefined> {
  try {
    const id = Number(merchantId)
    if (!Number.isFinite(id) || id <= 0) return undefined
    const gate = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'fee_channel_rates_enabled'")
      .first<{ value: string }>().catch(() => null)
    if (gate?.value !== 'true') return undefined
    const { getSellerMeta } = await import('./seller-meta')
    const meta = (await getSellerMeta(DB, [id])).get(id)
    // 🏢 2026-11-16 대표 *"내가 하더라도 5%로 하고 싶은 곳은 할 수 있게끔"* — 저장값이 정본이다.
    //   운영사 매장은 **등록 때 기본값을 direct 로 저장**하고(agency-store-register), 5% 로 할 곳은 어드민·등록 화면에서
    //   brokered 로 고른다. 실행 시점에 저장값을 덮어쓰면 그 선택이 무시된다(그래서 덮어쓰기를 걷었다).
    const channel = meta?.store_channel
    if (channel !== 'direct' && channel !== 'brokered') return undefined  // 미지정 → 종전 경로
    const key = channel === 'direct' ? 'platform_fee_pct_direct' : 'platform_fee_pct_brokered'
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(key).first<{ value: string }>().catch(() => null)
    const { DEFAULT_FEE_RATES } = await import('./fee-resolver')
    const fallback = channel === 'direct' ? DEFAULT_FEE_RATES.platformPctDirect : DEFAULT_FEE_RATES.platformPct
    const pct = Number.parseFloat(row?.value ?? '')
    const use = Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : fallback
    return use / 100
  } catch { return undefined }
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
  // ⚠️ 동적 import — 위 헤더 참조(순환 참조 회피). 정적으로 걸면 ledger↔policy 가 서로를 문다.
  const { ensureLedgerTable, recordLedger } = await import('./ledger')
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

