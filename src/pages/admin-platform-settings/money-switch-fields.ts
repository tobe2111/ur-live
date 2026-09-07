/**
 * 💸 **머니 스위치 필드 정의** (어드민 `/admin/platform-settings` "머니 스위치" 섹션).
 *
 * 🩸 2026-09-07 에 이 파일로 뽑았다. 이유는 두 가지다:
 *   ① 페이지가 파일크기 래칫(600줄)에 닿았다 — 스위치를 하나 더 붙일 자리가 없었다.
 *   ② 이 배열이 곧 **"대표가 켤 수 있는 것의 목록"** 이다. 페이지 렌더 코드 사이에 묻혀 있으면
 *      다음 세션이 게이트를 만들고도 여기에 줄을 안 넣는다 — 그게 실제로 반복된 사고다.
 *
 * ⚠️ 새 게이트를 만들면 여기에 한 줄 넣어라. `check-gate-registry` 가 강제한다
 *    (`platform_settings` 를 `=== 'true'` 로 읽는 키는 OPS_GATES 등재 필수, 등재되면
 *     `ops-gate-reachable` 이 이 배열에 실재하는지 확인한다).
 */
export type MoneySwitchField = {
  key: string
  label: string
  default: string
  options?: Array<{ value: string; label: string }>
  hint?: string
}

// 💸 2026-07-04 [INV-CB] 커미션 예산 아비터 스위치 (docs/design/commission-funding-restructure.md).
//   전부 미설정=현행. 활성화는 staging 실결제 검증 후(설계 §5). select 형은 숫자 검증 제외.
export const COMMISSION_BUDGET_FIELDS: MoneySwitchField[] = [
  {
    key: 'commission_budget_enabled', label: '① 커미션 예산 캡 활성화', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행)' }, { value: 'true', label: 'ON — 예산 캡 적용' }],
    hint: '3P 주문당 성장 커미션 총합 ≤ 수수료 − PG준비금 (비례 축소). ⚠️ staging 검증 후 ON',
  },
  {
    key: 'pg_reserve_pct', label: 'PG 준비금 (%)', default: '2.5',
    hint: '예산 = 플랫폼 수수료 − 결제액×이 비율',
  },
  {
    // 💸 2026-08-25 (누락 발견): **플랫폼 take 율 자체를 정하는 게이트인데 켤 화면이 없었다.**
    //   `channelPlatformRate` 가 이 값으로 직판 10% / 중개 5% 를 가른다(OFF 면 종전 `commission_rate`).
    //   `ops-gate-reachable` 가 즉시 잡아 줬다 — 그 시험의 docblock 이 말하는
    //   *"안 켠 게 아니라 못 켠"* 경우다. 게이트를 만들 때 손잡이를 같이 만들지 않으면 이렇게 된다.
    key: 'fee_channel_rates_enabled', label: '③ 채널별 플랫폼 요율 (직판 10% / 중개 5%)', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행 — sellers.commission_rate)' }, { value: 'true', label: 'ON — 채널로 요율 분기' }],
    hint: '직판(자기 상품)=10% · 중개(벤더 상품)=5%. ⚠️ 원장 fee 가 바뀐다 — staging 실결제 각 1건 확인 후 ON',
  },
  // 🪙 2026-09-07 (대표 "모두 어드민에 붙혀줘"): **담기 적립의 주 스위치인데 켤 화면이 없었다.**
  //   `affiliate_program_enabled` 는 읽는 곳이 둘(affiliate-credit.ts 지급 · affiliate-program.ts 표시)
  //   인데 쓰는 화면이 0 이라, 켜려면 D1 을 직접 고쳐야 했다 — 머니 스위치를 그렇게 켜면
  //   오타값('True'/'1')이 저장돼도 read-site 의 `==='true'` 가 조용히 OFF 로 읽는다.
  //   ⚠️ 이 구멍이 `ops-gate-reachable` 를 통과한 이유: 그 시험은 **OPS_GATES 에 등재된 것만** 본다.
  //   등재를 안 하면 검사 대상이 아니다 — 그래서 같은 커밋에서 OPS_GATES 에도 넣는다.
  {
    key: 'affiliate_program_enabled', label: '⑧ 담기 적립(어필리에이트) 프로그램', default: 'false',
    options: [{ value: 'false', label: 'OFF (2026-08-22 종료 — 현행)' }, { value: 'true', label: 'ON — 담아서 팔면 소개비 적립' }],
    hint: "🔴 머니 경로. **② 재원을 'owner' 로 먼저** 켤 것 — 'platform' 인 채로 켜면 매장이 건 소개비를 유어딜이 문다. 순서: ②재원 → ③promo필드 → 이 키. OFF 면 지급도 화면 배지도 함께 꺼진다(표시 게이트가 같은 키를 본다)",
  },
  // 💸 2026-09-07: ③ 게이트는 켬/끔만 있고 **요율 값 자체를 고칠 자리가 없었다**(매장 카드는 표시 전용).
  //   미설정이면 코드 기본값(직접 10 / 중개 5)으로 동작한다 — 비워 두는 것이 안전한 기본이다.
  {
    key: 'platform_fee_pct_direct', label: '③-a 직접 입점 요율 (%)', default: '10',
    hint: '③ 이 ON 일 때만 쓰인다. 비우면 코드 기본 10%',
  },
  {
    key: 'platform_fee_pct_brokered', label: '③-b 중개(대행사) 요율 (%)', default: '5',
    hint: '③ 이 ON 일 때만 쓰인다. 비우면 코드 기본 5%',
  },
  {
    key: 'promo_funding_source', label: '② 핀 추천(어필리에이트) 재원', default: 'platform',
    options: [{ value: 'platform', label: '플랫폼 부담 (현행)' }, { value: 'owner', label: '주인(셀러) 부담 — promo 슬라이스' }],
    hint: "'owner' 시 추천인 딜 적립은 유지, 같은 금액을 매장/셀러 정산에서 차감",
  },
  {
    key: 'invite_reward_monthly_budget_krw', label: '초대 보상 월 예산 (딜, 0=무제한)', default: '0',
    hint: '이달 지급 합계가 예산 초과 시 자동 skip',
  },
  {
    key: 'agency_signup_bonus_monthly_budget_krw', label: '에이전시 signup 보너스 월 예산 (원, 0=무제한)', default: '0',
    hint: '₩30,000 정액 보너스의 월 상한',
  },
  // 🥇 2026-07-05 (운영 감사 Q10): 캡 발동 시 어느 축을 먼저 보전할지 — "에이전시 1% 보호 최우선" 자문.
  {
    key: 'commission_priority_axes', label: '캡 발동 시 우선 보전 축', default: 'agency_intro',
    options: [
      { value: 'agency_intro', label: '에이전시 매장영입 최우선 (권장)' },
      { value: '', label: '우선 없음 — 전 축 비례 축소' },
    ],
    hint: '계약 기반(24개월) 에이전시 커미션을 캡 축소에서 먼저 보전. 발동 이력은 아래 표',
  },
  // 💰 2026-07-05 (§1 인플루언서 엔진): 셀러 딜 등록 화면의 소개비(promo)% 저장 게이트.
  {
    key: 'seller_promo_field_enabled', label: '③ 셀러 소개비(promo)% 필드 저장', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행 — 저장 안 함)' }, { value: 'true', label: 'ON — referral_commission_rate 저장' }],
    hint: "⚠️ owner-funding('주인 부담') 을 먼저 켜고 staging 검증한 뒤에만 ON. 안 그러면 매장 소개비를 플랫폼이 부담(누수). 클라 플래그 SELLER_PROMO_FIELD_ENABLED 도 함께 배포",
  },
  // 🎟️ 2026-07-10 (flip-ui-checklist A1): 공구 엔진 서버 게이트 — gb-marketplace/gb-proposals/seller-orders 가
  //   platform_settings.gb_engine_enabled==='true' 로 읽음. 8월 flip 단계 ④ 조종석 토글.
  {
    key: 'gb_engine_enabled', label: '④ 공구 엔진 (gb_engine)', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행 — 표면 미노출)' }, { value: 'true', label: 'ON — 공구 엔진 서버 게이트' }],
    hint: '활성화 순서 ④ — ①예산캡 ②owner펀딩 ③promo필드가 staging 검증 후 켜진 뒤에만. ⚠️ 서버 게이트만 켜짐 — 클라 표면은 GB_ENGINE_ENABLED(코드 배포) 별도. 런북: commission-funding-restructure.md §1',
  },
  // 💰 2026-08-31: 이용권을 딜로도 살 수 있게 (대표 방향 — 상품 마진 대신 현금 출구에 마진).
  //   ⚠️ 이 키가 없으면 게이트를 **켤 방법 자체가 없다** — `ops-gate-reachable` 테스트가 그걸 막았다.
  {
    key: 'voucher_deal_payment_enabled', label: '이용권 딜 결제', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행 — 이용권은 카드만)' }, { value: 'true', label: 'ON — 이용권도 딜로 결제' }],
    hint: '🔴 선행 필수: influencer_deal_bonus_pct = 0. 보너스 20% 가 이용권 마진(5~10%)보다 커서 켜면 팔릴수록 건당 8~14원 적자(2026-08-31 실측). 순서: ①교환권 마진 0+재계산 ②딜 보너스 0 + 현금 정산 수수료 ③이 키. ⚠️ 서버 게이트만 — 클라 표면은 VOUCHER_DEAL_PAYMENT_ENABLED(코드 배포) 별도. 검증: STAGING_CHECKLIST S9',
  },
  // 🥡💳 2026-08-12: **켤 화면이 없어서 영영 못 켜던 게이트 2개** (검증 데이 블로커).
  //   실측: `pickup_unclaimed_policy_enabled` 는 이 화면에 *"시스템 모니터링에서 켜라"* 는 **안내문만**
  //   있었는데 그 화면(`/admin/system-monitoring`)은 **조회 전용**이라 쓰기 API 가 없다.
  //   `partial_refund_enabled` 는 어느 화면에도 **아예 없었다**.
  //   ⇒ 대표가 검증(P10·P11)을 시작할 방법 자체가 없었다. 같은 클래스가 바로 위 OPS_POLICY_FIELDS
  //   주석이 기록한 사고(*"결정은 했는데 넣을 화면이 없어 값이 비어 있었다"*)와 동일하다.
  //   기본값·환불 로직·계산은 전부 무변경 — **토글 노출만** 추가한다.
  {
    key: 'pickup_unclaimed_policy_enabled', label: '⑤ 미수령 환불 정책 (보관구분별)', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행 — 항상 전액 환불)' }, { value: 'true', label: 'ON — 아래 보관구분 비율 적용' }],
    hint: '🔴 머니 경로. 켜면 이미 흐르던 환불의 **금액이 바뀐다**. 아래 "운영 정책" 의 비율을 먼저 채울 것 — 비우면 100%(전액)로 동작한다. 끄면 즉시 전액 환불로 복귀. 검증 절차: docs/VERIFICATION_DAY.md (P10)',
  },
  {
    key: 'partial_refund_enabled', label: '⑥ 부분환불 금액 지정', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행 — 전액 환불만)' }, { value: 'true', label: 'ON — 반품 화면에서 금액 지정 가능' }],
    hint: '🔴 머니 경로. OFF 면 금액 설정 API 가 403 이다(=현행 전액 환불 그대로). ON 시 결제액 초과는 서버가 클램프하고, 환불 실행 후에는 변경 불가. 검증 절차: docs/VERIFICATION_DAY.md (P11)',
  },
  // 🪙 2026-09-01: 이용권을 "딜 일부 + 카드 나머지" 로 살 수 있게 하는 스위치(대표 "포인트 차감처럼").
  //   ⚠️ 게이트를 만들면서 이 손잡이를 안 만들면 `ops-gate-reachable` 가 즉시 잡는다 — 이번에도 잡혔다.
  {
    key: 'voucher_partial_deal_enabled', label: '⑦ 이용권 부분결제 (딜 + 카드)', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행 — 전부-딜 또는 전부-카드)' }, { value: 'true', label: 'ON — 가진 딜만큼 카드 청구액 차감' }],
    hint: '🔴 머니 경로. **먼저 딜 보너스(influencer_deal_bonus_pct)를 0 으로** — 20%가 살아 있으면 딜이 액면가보다 비싸서(1,000딜 = 부채 1,200원) 마진 5~10%인 이용권에 쓰일수록 적자다. 그다음 이걸 켜면 딜 잔액만큼 카드 청구액이 줄고 차액이 딜에서 빠진다. 매장 정산은 총액 기준 그대로(딜도 유저가 낸 현금). 끄면 즉시 현행 복귀. 검증 절차: docs/STAGING_CHECKLIST.md (S12)',
  },
  // 🚨 2026-08-12: **킬스위치인데 당길 손잡이가 없었다.**
  //   `gb_pricing_enabled` 는 *"잘못 설정된 공구가로 과소청구가 날 때 false 로 저장해 즉시 상시가로
  //   되돌린다"* 는 긴급 안전장치인데(OPS_GATES 의 turn_on_when), 어느 화면에도 없었다 —
  //   즉 **돈이 새는 중에 멈출 방법이 없었다.** 위 ⑤⑥ 과 같은 클래스이고 이쪽이 더 급하다.
  //
  //   🔴 **다른 게이트와 반대로 기본이 ON 이다.** 그래서 `default: 'true'` 여야 한다 —
  //   'false' 로 적으면 이 페이지를 **한 번 저장하는 것만으로** 공구가 청구가 꺼져
  //   전 공구가 상시가로 청구된다(대표가 의도하지 않은 머니 변경). 바꾸지 말 것.
  {
    key: 'gb_pricing_enabled', label: '🚨 공구가 청구 킬스위치', default: 'true',
    options: [{ value: 'true', label: 'ON (정상 — 공구가로 청구)' }, { value: 'false', label: 'OFF — 긴급 정지: 즉시 상시가로 청구' }],
    hint: '🔴 평소엔 ON 이 정상이다. 잘못된 공구가로 **과소청구**가 발생할 때만 OFF 로 내려 즉시 상시가로 되돌린다. 되돌리면 곧바로 복구되므로 사고 시 주저하지 말 것',
  },
  // 🎛️ 2026-09-07: 게이트 레지스트리 가드가 **손잡이 없는 strict-true 게이트 둘**을 찾아냈다.
  //   둘 다 read-site 가 `=== 'true'` 인데 어느 화면에도 없어서 D1 을 직접 고쳐야 켤 수 있었다.
  {
    key: 'settlement_skip_ledgered', label: '⑨ 자동정산에서 원장 기록분 제외', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행)' }, { value: 'true', label: 'ON — 원장에 이미 잡힌 주문은 자동정산 건너뜀' }],
    hint: '🔴 머니 경로. 원장(ledger) 경로와 자동정산이 같은 매출을 두 번 정산하는 것을 막는 스위치. 원장 적립이 실제로 돌기 시작한 뒤에 켠다',
  },
  {
    key: 'outreach_auto_send', label: '⑩ 인플루언서 제휴 제안 자동 발송', default: 'false',
    options: [{ value: 'false', label: 'OFF (현행 — 사람이 보낸다)' }, { value: 'true', label: 'ON — 승인된 제안을 자동 발송' }],
    hint: '📮 콜드 발송은 법·평판 문제라 **대표 판단 사항**이다. 켜면 사람 확인 없이 나간다',
  },
]
