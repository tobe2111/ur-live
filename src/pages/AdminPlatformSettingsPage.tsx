import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Settings, Save, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import PromoBarSection from './admin-platform-settings/PromoBarSection'
import CloudflareCredsSection from './admin-platform-settings/CloudflareCredsSection'
import { CREDENTIAL_KEYS, buildSettingsPayload } from './admin-platform-settings/settings-payload'

/**
 * 🔁 재수출 — 이 페이지가 이 두 심볼의 **공개 표면**이다(시험·다른 화면이 여기서 가져간다).
 *   구현은 파일 크기 래칫 때문에 `admin-platform-settings/settings-payload.ts` 로 옮겼다.
 */
export { CREDENTIAL_KEYS, buildSettingsPayload }

// 🛡️ 2026-04-22: 실제 코드에서 읽는 키로 정정 (UI-코드 매핑 수정).
// 이전: seller_commission_rate 키가 UI 에만 있고 코드에선 안 읽혀서 어드민 수정이 반영되지 않는 버그.

const SETTINGS_FIELDS = [
  { key: 'commission_rate_default', label: '기본 수수료율 — 일반 상품 (%)', default: '10' },
  { key: 'commission_rate_live', label: '라이브 판매 수수료율 (%)', default: '5' },
  { key: 'commission_rate_meal_voucher', label: '이용권(공동구매) 수수료율 (%)', default: '5' },
  { key: 'agency_commission_rate', label: '에이전시 추가 수수료율 (%)', default: '2' },
  { key: 'min_donation', label: '최소 후원 금액 (딜)', default: '500' },
  { key: 'free_shipping_threshold', label: '무료배송 기준 (원)', default: '50000' },
  { key: 'default_shipping_fee', label: '기본 배송비 (원)', default: '3000' },
  { key: 'auto_confirm_days', label: '자동 구매확정 (일)', default: '14' },
  { key: 'return_period_days', label: '반품 가능 기간 (일)', default: '7' },
  { key: 'settlement_hold_days', label: '정산 대기 기간 (일)', default: '7' },
  { key: 'invite_reward_amount', label: '초대 보상 딜', default: '1000' },
  { key: 'review_reward_text', label: '텍스트 리뷰 보상 (딜)', default: '100' },
  { key: 'review_reward_image', label: '이미지 리뷰 보상 (딜)', default: '300' },
  { key: 'review_reward_video', label: '영상 리뷰 보상 (딜)', default: '500' },
  { key: 'affiliate_commission_rate', label: '제휴 마케팅 수수료율 (%)', default: '2' },
  // 💸 2026-07-04 F1: 멀티티어 추천트리 요율 어드민 노출 — 코드 기본값(10/3)이 "추천은 CAC라 2%"
  //   결정(2026-06-17)과 어긋남. 예산 캡(INV-CB)이 초과지급은 막지만 기본율 자체도 여기서 조정.
  { key: 'tier1_commission_rate', label: '추천트리 1단계 요율 (%) — 권장 2', default: '10' },
  { key: 'tier2_commission_rate', label: '추천트리 2단계 요율 (%) — 권장 1', default: '3' },
  // 🛡️ 2026-05-25 (migration 0278/0280): 큐레이터 / 호스팅 / 출금 정책 동적화
  { key: 'curator_affiliate_pct', label: '큐레이터 어필리에이트 (%)', default: '1' },
  { key: 'host_incentive_pct', label: '호스팅 인센티브 (%)', default: '1' },
  { key: 'curator_min_withdrawal', label: '큐레이터 최소 출금 (원)', default: '10000' },
  { key: 'curator_withholding_rate', label: '큐레이터 원천징수율 (%)', default: '3.3' },
  { key: 'seller_upgrade_threshold', label: '셀러 승급 안내 누적 정산 (원)', default: '500000' },
  { key: 'pin_max_per_user', label: '유저당 핀 상한 (개)', default: '200' },
  { key: 'hosting_max_active', label: '호스팅 동시 active 상한 (개)', default: '10' },
  { key: 'jeju_extra_fee', label: '제주 추가 배송비 (원)', default: '3000' },
  { key: 'island_extra_fee', label: '도서산간 추가 배송비 (원)', default: '5000' },
]

// 💸 2026-07-04 [INV-CB] 커미션 예산 아비터 스위치 (docs/design/commission-funding-restructure.md).
//   전부 미설정=현행. 활성화는 staging 실결제 검증 후(설계 §5). select 형은 숫자 검증 제외.
const COMMISSION_BUDGET_FIELDS: Array<{ key: string; label: string; default: string; options?: Array<{ value: string; label: string }>; hint?: string }> = [
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
]

/**
 * 🥡 **운영 정책 — 입력칸이 없어 대표가 넣을 방법이 없던 값들** (2026-08-03 신설)
 *
 * 실측으로 드러났다: 대표가 2026-08-02 에 미수령 정책을 확정(냉장 0% · 실온 유예 3일)했는데
 * `platform_settings` 를 직접 조회하니 **두 값 다 없었다.** 원인은 결정 누락이 아니라
 * **넣을 화면이 없었던 것**이다. `operator_support_contact` 도 같은 상태라 운영자 문의 카드가
 * 아예 렌더되지 않고 있었다. 이 세션의 감사 주제(*"코드는 있는데 연결·등록되지 않음"*)가
 * 설정값 층에서 반복된 사례다.
 *
 * 🔴 **빈 값의 의미가 0 이 아니다.** `shared/pickup-refund.ts` 의 `pct()` 는 빈 문자열을
 *   **미설정**으로 보고 기본값(100% = 전액 환불)으로 되돌린다 — *"값이 없을수록 소비자에게
 *   유리해야 한다"* 는 원칙이다. 그래서 여기 기본값은 **빈 문자열**이다. 숫자를 미리 채워 두면
 *   저장 한 번에 **머니 정책이 조용히 바뀐다**(0% = 환불 없음).
 *
 * ⚠️ 이 값들만으로는 아무 일도 일어나지 않는다 — 실제 적용은 게이트
 *   `pickup_unclaimed_policy_enabled`(기본 OFF, `/admin/system-monitoring`)가 켜져야 한다.
 */
export const OPS_POLICY_FIELDS: Array<{ key: string; label: string; hint: string; text?: boolean }> = [
  {
    // 🎯 2026-08-12: 파일럿 매장을 정해도 **넣을 칸이 없었다**(어느 화면에도 없음).
    //   ⚠️ 반드시 `text: true` — 값이 `5,12` 형태라 위 커미션 배열에 두면 `validateSetting` 이
    //   `Number('5,12')=NaN` 으로 **저장 자체를 거부**한다(이 세션이 실제로 그렇게 만들 뻔했다).
    key: 'flip_pilot_seller_ids',
    label: '8월 flip 파일럿 매장 (seller_id)',
    hint: '파일럿 매장이 정해지면 seller_id 를 쉼표로 구분해 넣는다(예: 5,12). 비우면 파일럿 스코프 없음',
    text: true,
  },
  {
    key: 'operator_support_contact',
    label: '운영자 문의 연락처',
    hint: '비우면 셀러 화면의 문의 카드가 **아예 안 뜬다**(현재 상태). 전화·이메일·카카오 링크 중 하나',
    text: true,
  },
  {
    key: 'pickup_unclaimed_cold_pct',
    label: '냉장·냉동 미수령 환불 (%)',
    hint: '대표 확정값 0(환불 없음 — 상품 폐기). ⚠️ 비우면 100(전액 환불)으로 동작한다',
  },
  {
    key: 'pickup_unclaimed_room_grace_days',
    label: '실온 미수령 유예 (일)',
    hint: '대표 확정값 3. 이 기간 안에 찾아가면 전액. 비우면 0(유예 없음)',
  },
  {
    key: 'pickup_unclaimed_room_pct',
    label: '실온 유예 경과 후 환불 (%)',
    hint: '⚠️ 비우면 100(전액). 유예 이후를 깎으려면 **명시해야** 한다',
  },
]

export default function AdminPlatformSettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  /** 저장 성공 횟수 — 자격 섹션이 입력칸을 닫고 '설정됨 · 끝4자리' 로 되돌리는 신호. */
  const [savedTick, setSavedTick] = useState(0)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery. 편집형이라 데이터 도착 시 시드.
  const settingsQ = useApiQuery<Record<string, string>>(['admin', 'platform-settings'], '/api/admin/tools/settings', { select: (r: any) => (r?.success ? r.data || {} : {}) })
  const loading = settingsQ.isLoading
  /**
   * 🩸 **시드는 한 번만** (2026-08-02 대표 신고 "입력이 된건지 안된건지" — 실제 데이터 손실).
   *
   *   원래는 `settingsQ.data` 가 바뀔 때마다 **입력 폼 전체를 서버 값으로 덮어썼다.** 그런데 이 페이지는
   *   편집 폼이고, RQ 는 창 포커스 복귀 등으로 **사용자가 타이핑하는 중에도 리페치**한다.
   *   실제 시나리오: 토큰을 붙여넣고 → 다른 창에 다녀오고 → 돌아오면 리페치가 **방금 붙여넣은 값을
   *   서버의 옛 값으로 되돌려** 놓는다 → '저장' 을 눌러도 **옛 값이 다시 저장된다.**
   *   화면에는 여전히 "설정됨" 이 떠 있어서 성공한 것처럼 보인다.
   *   ⇒ 실측으로 확인: 대표가 새 토큰을 넣었는데 저장된 값의 해시가 옛 토큰과 같았다(길이는 우연히 동일).
   *
   *   고침: **첫 도착 때만 시드**한다. 이후 서버 값 반영이 필요하면 저장 성공 시 명시적으로 다시 시드한다.
   */
  const seeded = useRef(false)
  /**
   * 🩸 2026-08-25 — **서버가 준 스냅샷을 그대로 보관한다.** 저장은 이 스냅샷과 *다른* 키만 보낸다.
   *   왜 필요한지는 아래 `save()` 의 주석에 있다(전체를 보내면 저장이 통째로 실패한다).
   */
  const serverSnapshot = useRef<Record<string, string>>({})
  useEffect(() => {
    if (settingsQ.data && !seeded.current) {
      seeded.current = true
      serverSnapshot.current = settingsQ.data
      setSettings(settingsQ.data)
    }
  }, [settingsQ.data])

  function validateSetting(key: string, value: string): string | null {
    const n = Number(value)
    if (!Number.isFinite(n)) return `${key}: 숫자 값만 허용됩니다`
    if (n < 0) return `${key}: 0 이상이어야 합니다`
    // 수수료/할인율 (%) — 0~100 사이 (pct 표기 포함 — pg_reserve_pct 등)
    if (key.includes('rate') || key.includes('percent') || key.includes('pct')) {
      if (n < 0 || n > 100) return `${key}: 0~100 사이 값만 허용됩니다`
    }
    // 금액/딜 — 상한 1억
    if (key.includes('amount') || key.includes('fee') || key.includes('threshold') || key.includes('donation') || key.includes('reward')) {
      if (n > 100_000_000) return `${key}: 1억 이하여야 합니다`
    }
    // 일(days) — 1~365
    if (key.endsWith('_days')) {
      if (n < 0 || n > 365) return `${key}: 0~365일 사이여야 합니다`
    }
    return null
  }

  const save = async () => {
    // Pre-save validation
    for (const f of SETTINGS_FIELDS) {
      const v = settings[f.key] ?? f.default
      const err = validateSetting(f.key, v)
      if (err) { toast.error(err); return }
    }
    // [INV-CB] 커미션 예산 필드 — select 는 옵션값 검증, 숫자형만 validateSetting
    for (const f of COMMISSION_BUDGET_FIELDS) {
      const v = settings[f.key] ?? f.default
      if (f.options) {
        if (!f.options.some(o => o.value === v)) { toast.error(`${f.key}: 허용되지 않는 값`); return }
      } else {
        const err = validateSetting(f.key, v)
        if (err) { toast.error(err); return }
      }
    }
    // 🥡 운영 정책 — **빈 값은 통과시킨다**(미설정 = 소비자에게 유리한 기본값). 텍스트형은 숫자 검증 제외.
    for (const f of OPS_POLICY_FIELDS) {
      const v = (settings[f.key] ?? '').trim()
      if (!v || f.text) continue
      const err = validateSetting(f.key, v)
      if (err) { toast.error(err); return }
    }
    setSaving(true)
    try {
      /**
       * 🩸 2026-08-25 — **바뀐 키만 보낸다. 전체를 보내면 저장이 반드시 실패한다.**
       *
       *   이 폼은 서버가 준 `platform_settings` **전체**로 시드된다(그 테이블의 모든 행).
       *   그런데 거기엔 설정이 아닌 것들이 잔뜩 들어 있다 — `cron_hb:*` 하트비트만 **129개**,
       *   그 밖에 `backup_chunk:*` 커서 등. 예전 코드는 그 전부를 `{ ...settings }` 로 PUT 했고,
       *   서버는 키 하나당 D1 write 를 **순차로** 돌린다. 무료 플랜은 인보케이션당 서브리퀘스트가
       *   50 이라, 200개짜리 페이로드는 **매번 한도에서 끊긴다** → 500 → 화면엔 "저장 실패".
       *   ⇒ 대표가 무엇을 입력하든 저장이 안 됐다. 값이 틀려서가 아니라 **페이로드가 커서**.
       *   (하트비트가 쌓이면서 조용히 넘어간 선이라, 8월 어느 날부터 이 페이지가 통째로 먹통이었다.)
       *
       * 🔒 빈 자격 값은 여전히 **보내지 않는다** — 이 endpoint 는 받은 키를 그대로 upsert 하므로
       *   빈 문자열을 보내면 저장돼 있던 토큰이 지워진다('교체'만 누르고 저장해도 날아간다).
       */
      const { payload, creds } = buildSettingsPayload(settings, serverSnapshot.current)
      if (Object.keys(payload).length === 0) {
        toast.info('변경된 값이 없습니다')
        return
      }
      await api.put('/api/admin/tools/settings', payload, h)
      /**
       * 🔎 **자격은 무엇이 바뀌었는지 말해 준다** — 위 필터가 조용히 걸러 내므로, 자격을 안 바꿨는데도
       *   "저장되었습니다" 만 뜨면 대표는 반영 여부를 알 길이 없다(실제로 그래서 옛 토큰이 남아 있었다).
       */
      toast.success(creds.length
        ? `설정 저장 · ${creds.join('·')} 교체됨`
        : t('admin.platformSettings.saveSuccess', { defaultValue: '설정이 저장되었습니다' }))
      // 저장분을 서버에서 되읽어 '설정됨' 표시(끝 4자리)를 새 값으로 갱신 — 시드는 여기서만 다시 연다.
      seeded.current = false
      await settingsQ.refetch().catch(() => undefined)
      setSavedTick(n => n + 1)
    } catch (err) {
      /**
       * 🩸 2026-08-25 — **서버가 이유를 말해 주는데 화면이 버렸다.**
       *   이 endpoint 는 검증 위반 시 400 + `error` 에 **어느 키가 왜 틀렸는지**를 담아 준다.
       *   그런데 여기서 통째로 삼키고 "저장 실패" 만 띄워, 대표가 토큰을 넣어도 왜 안 되는지
       *   알 길이 없었다(그날 왕복 4회). 401 은 api 인터셉터가 따로 처리하므로 여기 오면
       *   대개 검증 거부이거나 네트워크다 — **셋을 구분해서 말한다.**
       */
      const e = err as { response?: { status?: number; data?: { error?: string } } }
      const status = e?.response?.status
      const detail = e?.response?.data?.error
      toast.error(
        detail ? `저장 실패 — ${detail}`
          : status === 401 || status === 403 ? '저장 실패 — 세션이 끊겼습니다. 다시 로그인해 주세요.'
          : status ? `저장 실패 (HTTP ${status})`
          : '저장 실패 — 서버에 닿지 못했습니다(네트워크).',
      )
    }
    finally { setSaving(false) }
  }

  return (
    <AdminLayout title={t('admin.pages.platformSettings')}>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.platformSettings')}
          subtitle={t('admin.platformSettings.subtitle', { defaultValue: '수수료율, 정책, 기본값 등 플랫폼 파라미터' })}
          icon={<Settings className="h-5 w-5" />}
          actions={
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t('admin.platformSettings.save', { defaultValue: '저장' })}
            </button>
          }
        />

        {/* 🛡️ 2026-05-25: KT Alpha 운영 seller 자동 생성 + admin_seller_id 자동 set */}
        <KtAlphaSystemSellerSection />

        {loading ? <DashboardLoading /> : (
          <>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {SETTINGS_FIELDS.map(f => (
              <div key={f.key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.label}</p>
                  <p className="text-xs text-gray-400">{t('admin.platformSettings.defaultLabel', { defaultValue: '기본값' })}: {f.default}</p>
                </div>
                <input
                  value={settings[f.key] ?? f.default}
                  onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 text-right font-medium"
                />
              </div>
            ))}
          </div>

          {/* 💸 [INV-CB] 커미션 예산 아비터 — 2026-07-04 재원 구조 개편. 활성화는 staging 검증 후. */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-sm font-bold text-gray-900">💸 커미션 예산 아비터 (INV-CB)</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                플랫폼 부담 성장 커미션(핀 추천·멀티티어·영입자·에이전시)의 주문당 총액 캡.
                ⚠️ 활성화 전 staging 실결제 검증 필수 — 설계: commission-funding-restructure.md
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {COMMISSION_BUDGET_FIELDS.map(f => (
                <div key={f.key} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{f.label}</p>
                    {f.hint && <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>}
                  </div>
                  {f.options ? (
                    <select
                      value={settings[f.key] ?? f.default}
                      onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium bg-white"
                    >
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      value={settings[f.key] ?? f.default}
                      onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-28 shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 text-right font-medium"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 🥡 운영 정책 — 결정은 있었는데 넣을 화면이 없던 값들(2026-08-03 실측) */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-sm font-bold text-gray-900">🥡 운영 정책 (미수령 · 문의)</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                비워 두면 <span className="font-semibold text-gray-600">소비자에게 유리한 기본값</span>(전액 환불)으로 동작한다 — 0 이 아니다.
                미수령 정책의 실제 적용은 게이트 <code className="text-[11px]">pickup_unclaimed_policy_enabled</code>(기본 OFF, 시스템 모니터링)가 켜져야 한다.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {OPS_POLICY_FIELDS.map(f => (
                <div key={f.key} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{f.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>
                  </div>
                  <input
                    value={settings[f.key] ?? ''}
                    placeholder="미설정"
                    onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={`${f.text ? 'w-56' : 'w-28 text-right'} shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 📣 2026-08-19 (대표 확정): 소비자 홈 최상단 프로모 바 — 켜고 끄기 + 문구/버튼/색 */}
          <PromoBarSection settings={settings} setSettings={setSettings} />

          {/* ☁️ 진단용 Cloudflare 자격 — 입력칸이 없어 대표가 넣을 방법이 없던 것(2026-07-29) */}
          <CloudflareCredsSection settings={settings} setSettings={setSettings} savedTick={savedTick} onSave={save} saving={saving} />

          {/* 📊 Q10 캡 관측성 — 발동 이력 (order-commissions 가 Σ요청>예산 주문만 기록) */}
          <CommissionCapLogsSection />
          </>
        )}
      </div>
    </AdminLayout>
  )
}

// 🛡️ 2026-05-25: KT Alpha 운영 seller 자동 생성 + admin_seller_id 자동 set.
function KtAlphaSystemSellerSection() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function init() {
    if (!(await confirmDialog("'유어딜 공식 운영' system seller 자동 생성 + kt_alpha_admin_seller_id 자동 set. 진행하시겠습니까?"))) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.post("/api/admin/kt-alpha/init-system-seller", {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
      })
      if (r.data?.success) {
        setResult(r.data.message || "완료")
        toast.success(r.data.message || "system seller 설정 완료")
      } else {
        setError(r.data?.error || "실패")
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "실패")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <h3 className="text-sm font-bold text-amber-900 mb-1">🤖 KT Alpha 운영 seller 자동 설정</h3>
      <p className="text-xs text-amber-800 mb-3">
        KT Alpha 자동발송 voucher_orders 가 누구 명의로 기록될지 결정. 기존 fallback (첫 approved seller) → '유어딜 공식 운영' 명의로 분리.<br/>
        클릭 1번 → sellers 신규 row 생성 (idempotent) + platform_settings.kt_alpha_admin_seller_id 자동 set.
      </p>
      <button
        onClick={init}
        disabled={loading}
        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
      >
        {loading ? "처리 중..." : "🤖 자동 설정"}
      </button>
      {result && <p className="mt-2 text-xs text-emerald-700 font-bold">✅ {result}</p>}
      {error && <p className="mt-2 text-xs text-red-600 font-bold">❌ {error}</p>}
    </div>
  )
}

// 📊 2026-07-05 (운영 감사 Q10): 커미션 예산 캡 발동 이력 — "캡이 언제 누굴 얼마 깎았나"를
//   어드민이 직접 확인. 발동 0건이면 안내문만(게이트 OFF/여유 예산 = 정상).
function CommissionCapLogsSection() {
  interface CapLog { id: number; order_id: number; budget_krw: number; requested_krw: number; granted_krw: number; detail: string | null; created_at: string }
  const logsQ = useApiQuery<CapLog[]>(
    ['admin', 'commission-budget-logs'],
    '/api/admin/tools/commission-budget-logs',
    { select: (r: any) => (r?.success ? r.data || [] : []) },
  )
  const logs = logsQ.data || []
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 pt-4 pb-2">
        <p className="text-sm font-bold text-gray-900">커미션 캡 발동 이력</p>
        <p className="text-xs text-gray-400 mt-0.5">Σ요청 커미션이 주문 예산(수수료−PG준비금)을 넘어 비례/우선 축소가 실행된 주문 — 최근 100건</p>
      </div>
      {logs.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-gray-400">발동 이력이 없습니다 (캡 OFF 또는 예산 내 정상)</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2 font-semibold">주문</th>
                <th className="px-2 py-2 font-semibold text-right">예산</th>
                <th className="px-2 py-2 font-semibold text-right">요청</th>
                <th className="px-2 py-2 font-semibold text-right">배분</th>
                <th className="px-5 py-2 font-semibold">축별 내역 · 시각</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => {
                let axes = ''
                try {
                  const d = JSON.parse(l.detail || '[]') as Array<{ key: string; requestedKrw: number; grantedKrw: number }>
                  axes = d.map(g => `${g.key} ${g.requestedKrw.toLocaleString()}→${g.grantedKrw.toLocaleString()}`).join(' · ')
                } catch { /* 표시용 */ }
                return (
                  <tr key={l.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2 font-semibold text-gray-900">#{l.order_id}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{Number(l.budget_krw).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-red-500 font-semibold">{Number(l.requested_krw).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-gray-900 font-semibold">{Number(l.granted_krw).toLocaleString()}</td>
                    <td className="px-5 py-2 text-[11px] text-gray-500">{axes}<span className="text-gray-300"> · {l.created_at}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

