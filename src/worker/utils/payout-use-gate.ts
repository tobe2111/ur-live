/**
 * 🔒 소개 커미션 성숙 게이트 — **사용 확인 뒤에 돈이 움직인다** (2026-09-16 대표 확정)
 *
 * ## 무엇을 막나
 * 대표: *"그 전에도 사기꾼이 멋대로 이용권 기껏 유저들에게 팔았는데 사장님은 아예 모르는
 * 단계라 난처해질 수 있잖아."*
 *
 * 가짜 매장을 등록해 이용권을 팔고, 아무도 그 가게에 가지 않아도, 소개 커미션은
 * **주문 시각 + 환불창(T+7)** 만 지나면 성숙해 송금 대기에 올랐다. 즉 **서비스가 한 번도
 * 일어나지 않았는데 돈이 나가는 길**이 열려 있었다.
 *
 * 매장 몫(`merchant:N`)은 이미 사용 시점에만 붙는다(`ledger.ts recordVoucherUsedLedger` —
 * `voucher.status='used'` 로 atomic UPDATE 성공 직후). **소개 몫만 시간으로 익고 있었다.**
 * 이 파일은 그 비대칭을 없앤다.
 *
 * ## 규칙 (대표 승인: *"사용된 것 → 사용 확인 즉시 / 안 쓰인 것 → 유효기간 만료 후"*)
 * 성숙을 **허용**하는 경우는 셋뿐이다:
 *   1. 그 주문의 이용권 중 **하나라도 사용됐다** → 그 매장에서 실제로 서비스가 일어났다.
 *   2. 그 주문의 이용권이 **전부 처리됐다**(expired·refunded) → 만료 레일이 이미 지나갔다.
 *   3. 그 주문에 **이용권 행이 아예 없다** → 이용권 주문이 아니다(쇼핑·교환권). 게이트 대상 아님.
 *
 * ## ⚠️ "안 쓰이면 소개비가 나온다"가 **아니다**
 * 미사용 만료분은 2026-05-30 정책대로 **고객에게 100% 환불**되고, 소개비는
 * `clawbackVoucherCommission` 이 회수한다(공정위 신유형 상품권 표준약관 90% 기준을 상회).
 * 즉 안 쓰인 이용권의 소개비는 **결국 0** 이다 — 이 게이트는 그 정리가 끝날 때까지
 * 돈이 먼저 나가지 않게 막는 것이지, 만료를 지급 사유로 만드는 게 아니다.
 *
 * ## ⚠️ 정직한 사람을 막지 않는 것이 설계의 절반이다
 * 이 게이트는 사기를 막으려다 **더 흔한 정상 거래를 얼려 버리기 쉽다.** 그래서 셋을 일부러 넣었다:
 *
 * - **부분 사용도 성숙**(규칙 1 이 "하나라도"인 이유). 3장 사서 1장만 쓰는 건 소비자의 평범한
 *   선택이지 사기 신호가 아니다. 게이트가 묻는 것은 *"이 매장이 실재하는가"* 하나이고,
 *   **한 번의 사용이 그 답이 된다.** 전량 소진을 기다리면 정상 주문이 몇 달씩 묶인다.
 * - **이용권 행이 없으면 통과**(규칙 3). 반대로 짰다면 이용권이 아닌 주문의 소개 커미션이
 *   **영영 안 익는다.** 배선 누락(`order_id = 0`)도 같은 쪽으로 열어 둔다 — 돈을 얼리는 실패보다
 *   내보내는 실패가 낫다는 뜻이 아니라, **얼림은 알아채기 어렵고 되돌리기도 늦기 때문**이다
 *   (성숙은 송금이 아니다 — 어드민 [송금 처리]가 한 번 더 있다).
 * - **무기한 이용권에 정산용 천장**. 2026-08-22 대표 결정으로 `voucher_expiry` 미설정 =
 *   **무기한**이다(`group-buy.routes.ts:601` — 90일 강제 기본값 폐지). 그리고 만료 cron 은
 *   `WHERE v.expires_at < datetime('now')` 라 **무기한 이용권을 아예 안 집는다**(실측) — 즉
 *   그런 주문의 소개비는 만료도, 환불도, 회수도 영영 안 일어나 **pending 에 갇힌다.**
 *   천장이 그 유일한 출구다. ⚠️ 이건 **소비자의 사용 권리와 무관하다** — 소비자는 여전히 무기한으로 쓴다.
 *
 * ## 게이트
 * `platform_settings.payout_requires_voucher_use === 'true'` 일 때만 적용(기본 OFF = 종전과 byte-동일).
 * env 가 아니라 `platform_settings` 인 게 의도다 — 어드민에서 **재배포 없이** 끌 수 있어야
 * 되돌리기가 빠르다(머니 경로의 롤백 시간이 곧 손실 크기다 — `ledger.ts` 와 같은 판단).
 *
 * 🔴 **켜기 전까지 이 파일은 아무것도 안 지킨다.** "코드에 있다 ≠ 살아 있다"(CLAUDE.md).
 *    활성은 등급 C — `docs/STAGING_CHECKLIST.md` S-사용게이트 통과 후 대표가 켠다.
 */

/** 무기한 이용권을 정산 판정에서 만료로 볼 때까지의 기본 대기일. */
export const DEFAULT_UNUSED_MAX_WAIT_DAYS = 180

export interface PayoutUseGate {
  /** 성숙 UPDATE/SELECT 의 WHERE 에 그대로 이어 붙일 SQL 조각. OFF 면 빈 문자열. */
  sql: string
  /** 켜져 있는가 — 로그·진단용. */
  enabled: boolean
  /** 실제 적용된 무기한 천장(일). */
  maxWaitDays: number
}

/**
 * 성숙 WHERE 조각을 만든다(순수). 바인딩 파라미터를 쓰지 않는 이유는 아래 주석 참조.
 *
 * @param enabled      게이트 활성 여부
 * @param maxWaitDays  무기한 이용권 천장(일)
 * @param table        조건을 붙일 테이블명(상관 서브쿼리에서 order_id 를 참조한다)
 */
export function buildPayoutUseGateSql(
  enabled: boolean,
  maxWaitDays: number = DEFAULT_UNUSED_MAX_WAIT_DAYS,
  table = 'influencer_attributions',
): PayoutUseGate {
  // ⚠️ 정수로 **강제**한 뒤 문자열에 박는다. `datetime(x, '+' || ? || ' days')` 로 바인딩하면
  //    D1 에서 modifier 가 문자열 결합으로 만들어져 타입에 따라 조용히 NULL 이 되는 길이 생긴다
  //    (NULL modifier → datetime NULL → 비교 거짓 → **성숙이 영영 안 됨**). 값은 여기서만 오고
  //    사용자 입력이 아니라 platform_settings 숫자라, 정수 클램프가 유일한 방어면 충분하다.
  //    🩸 첫 판은 `Number(maxWaitDays) || DEFAULT` 였는데 시험이 잡았다 — **0 이 falsy** 라
  //    어드민이 0 을 넣으면 조용히 180 이 됐다(CLAUDE.md 가 경고하는 그 `|| N` 함정).
  //    0 은 "최대한 짧게"라는 뜻이지 "기본값"이 아니다 ⇒ 유한수면 클램프, 아니면 기본값.
  const raw = Number(maxWaitDays)
  const days = Number.isFinite(raw)
    ? Math.max(1, Math.min(3650, Math.floor(raw)))
    : DEFAULT_UNUSED_MAX_WAIT_DAYS
  if (!enabled) return { sql: '', enabled: false, maxWaitDays: days }
  // 🩸 첫 판은 "만료일이 지났으면 통과" 였는데, 만료 레일을 실제로 읽어 보니 **레이스**가 있었다:
  //    `auto-settlement.handleExpiredVoucherRefunds` 는 만료된 이용권을 [status='expired' → 고객
  //    100% 환불 → `clawbackVoucherCommission`] 으로 처리한다. 만료일이 지났지만 그 cron 이 아직
  //    안 돈 창에서 첫 판은 소개비를 익혀 "송금 대기"로 올렸다 — **곧 회수될 돈**을 그렇게 보여 주는 셈.
  //    그래서 날짜가 아니라 **처리 결과(status)** 를 본다: 아직 `unused` 면 기다린다.
  const sql = `AND (
      EXISTS (SELECT 1 FROM vouchers v
               WHERE v.order_id = ${table}.order_id
                 AND v.status = 'used')
      OR NOT EXISTS (SELECT 1 FROM vouchers v
               WHERE v.order_id = ${table}.order_id
                 AND v.status = 'unused'
                 AND (v.expires_at IS NOT NULL
                      OR datetime(v.created_at, '+${days} days') > datetime('now')))
    )`
  return { sql, enabled: true, maxWaitDays: days }
}

/** platform_settings 를 읽어 게이트를 만든다. 조회 실패는 OFF(= 종전 동작) — fail-open. */
export async function resolvePayoutUseGate(
  DB: D1Database,
  table = 'influencer_attributions',
): Promise<PayoutUseGate> {
  let enabled = false
  let days = DEFAULT_UNUSED_MAX_WAIT_DAYS
  try {
    const rows = await DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key IN ('payout_requires_voucher_use','payout_unused_max_wait_days')",
    ).all<{ key: string; value: string }>()
    for (const r of rows.results || []) {
      if (r.key === 'payout_requires_voucher_use') enabled = String(r.value) === 'true'
      if (r.key === 'payout_unused_max_wait_days') {
        const v = Number(r.value)
        if (Number.isFinite(v) && v > 0) days = v
      }
    }
  } catch {
    // 설정을 못 읽었다고 돈을 얼리지 않는다 — 게이트 OFF 가 종전 동작이다.
  }
  return buildPayoutUseGateSql(enabled, days, table)
}
