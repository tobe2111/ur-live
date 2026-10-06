/**
 * 🔢 머니 스위치 라벨 — **대표가 손잡이를 짚을 수 있는가** (2026-09-30)
 *
 * ## 무엇이 잘못돼 있었나
 *
 * 대표: *"스위치 on 어떤거 얘기하는거야? 지금 이 페이지 너무 복잡해 이해하기도 어렵고"*
 *
 * 세션이 *"머니 스위치 ⑨ 를 켜 주세요"* 라고 안내했는데 **화면에 ⑨ 가 둘**이었다. 실측(2026-09-30):
 *
 *   ③ ×3 (채널요율 · 셀러 소개비 필드 · +③-a/③-b 가 가리키는 대상)
 *   ⑧ ×3 (담기 적립 · 이용권 일부 환불 · 이용권 장바구니)
 *   ⑨ ×2 (소개 정산 사용 뒤로 · 자동정산 원장 제외)  ← 지시가 통하지 않은 자리
 *   ⑩ ×2 (중개사 몫 · 제휴 제안 자동 발송)
 *
 * 원래 ①②③④ 는 8월 flip **활성화 순서**였고 hint 들이 서로 그 번호를 참조한다. 뒤 세션들이
 * 새 스위치에 "다음 번호"를 붙이며 부딪혔고, 그래서 `③-a 직접 입점 요율` 의 *"③ 이 ON 일 때만"* 이
 * **어느 ③ 인지 화면에서 알 수 없게** 됐다(활성화 순서의 ③ 은 셀러 소개비 필드이고, 실제 부모는
 * 채널별 요율이다 — 정반대를 가리켰다).
 *
 * ## 규약 (이 시험이 강제하는 것)
 *
 *   1. 라벨에 동그라미 번호를 쓰지 않는다. 순서가 있는 넷만 `[순서 N]`.
 *   2. 부속 값 필드는 `↳` 로 시작하고 **부모 바로 뒤**에 온다.
 *   3. 라벨은 서로 달라야 한다(같으면 짚을 수 없다).
 *   4. hint 의 상호참조는 번호가 아니라 **이름**으로 쓴다.
 *   5. 키 집합은 이 정리로 **하나도 변하지 않는다** — 표시만 바꾼 것이다.
 *
 * ## 이 시험이 **못 막는 것**
 *
 * - 문구가 이해하기 쉬운지는 안 본다(사람이 읽어야 한다). 짚을 수 있는지만 본다.
 * - `OPS_POLICY_FIELDS`(같은 화면의 다른 섹션)는 번호를 쓰지 않아 대상이 아니다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'
import { COMMISSION_BUDGET_FIELDS } from '../../pages/admin-platform-settings/money-switch-fields'

const SRC = readCode('src/pages/admin-platform-settings/money-switch-fields.ts')
/** 규약은 **주석**에 있으므로 원문을 따로 읽는다 — `readCode` 는 주석을 이미 지운다(2026-09-30 에 이걸로 헛돌았다). */
const RAW = readRaw('src/pages/admin-platform-settings/money-switch-fields.ts')

/** 2026-09-30 정리 시점의 키 집합 — 표시를 고치다 손잡이를 잃지 않았는지 고정. */
const KEYS_AT_CLEANUP = [
  'commission_budget_enabled', 'pg_reserve_pct', 'commission_priority_axes',
  'promo_funding_source', 'seller_promo_field_enabled', 'gb_engine_enabled',
  'fee_channel_rates_enabled', 'platform_fee_pct_direct', 'platform_fee_pct_brokered',
  'affiliate_program_enabled', 'payout_requires_voucher_use', 'payout_unused_max_wait_days',
  'broker_share_enabled', 'invite_reward_monthly_budget_krw',
  'agency_signup_bonus_monthly_budget_krw', 'voucher_deal_payment_enabled',
  'voucher_partial_deal_enabled', 'voucher_cart_enabled', 'pickup_unclaimed_policy_enabled',
  'partial_refund_enabled', 'voucher_partial_refund_enabled', 'gb_pricing_enabled',
  'settlement_skip_ledgered', 'outreach_auto_send', 'review_bonus_owner_funded',
]

describe('머니 스위치 라벨 — 짚을 수 있는가', () => {
  it('배열이 실재하고 비어 있지 않다 (0건이면 통과가 아니라 실패)', () => {
    expect(COMMISSION_BUDGET_FIELDS.length).toBeGreaterThanOrEqual(20)
    expect(SRC.length).toBeGreaterThan(500)
  })

  it('라벨에 동그라미 번호가 하나도 없다', () => {
    const circled = COMMISSION_BUDGET_FIELDS.filter(f => /[①-⑳㉑-㉟]/.test(f.label))
    expect(
      circled.map(f => `${f.key}: ${f.label}`),
      '동그라미 번호는 세션마다 부딪힌다 — 순서가 있으면 [순서 N], 아니면 이름으로',
    ).toEqual([])
  })

  it('라벨이 서로 다르다 (같으면 대표가 어느 것인지 못 고른다)', () => {
    const seen = new Map<string, string[]>()
    for (const f of COMMISSION_BUDGET_FIELDS) {
      seen.set(f.label, [...(seen.get(f.label) ?? []), f.key])
    }
    const dup = [...seen.entries()].filter(([, ks]) => ks.length > 1)
    expect(dup, '라벨이 겹쳤다').toEqual([])
  })

  it('활성화 순서는 [순서 N] 으로만 표시되고 번호가 겹치지 않는다', () => {
    const nums = COMMISSION_BUDGET_FIELDS
      .map(f => f.label.match(/^\[순서 (\d+)\]/)?.[1])
      .filter((x): x is string => !!x)
    expect(nums.length, '활성화 순서 표시가 사라졌다 — hint 들이 이 번호를 참조한다').toBeGreaterThanOrEqual(4)
    expect(new Set(nums).size, `[순서 N] 이 겹쳤다: ${nums.join(',')}`).toBe(nums.length)
  })

  it('부속 값 필드는 ↳ 로 표시되고 자기 부모 바로 뒤에 온다', () => {
    // 🩸 첫 판은 `↳ 개수 >= 4` 로 셌다. 주입 러너가 헛돈다고 잡았다 — ↳ 하나를 떼도 넷이 남아
    //   초록이었다. **개수는 불변식이 아니다.** 어느 값 필드가 어느 스위치에 딸렸는지를 직접 적는다.
    const DEPENDENTS: Record<string, string> = {
      pg_reserve_pct: 'commission_budget_enabled',
      commission_priority_axes: 'commission_budget_enabled',
      platform_fee_pct_direct: 'fee_channel_rates_enabled',
      platform_fee_pct_brokered: 'fee_channel_rates_enabled',
      payout_unused_max_wait_days: 'payout_requires_voucher_use',
    }
    const idx = new Map(COMMISSION_BUDGET_FIELDS.map((f, i) => [f.key, i]))
    for (const [child, parent] of Object.entries(DEPENDENTS)) {
      const ci = idx.get(child), pi = idx.get(parent)
      expect(ci, `부속 필드 ${child} 가 사라졌다`).toBeDefined()
      expect(pi, `부모 ${parent} 가 사라졌다`).toBeDefined()
      const label = COMMISSION_BUDGET_FIELDS[ci!].label
      expect(label.startsWith('↳'), `${child} 라벨이 ↳ 로 시작하지 않는다 — 독립 스위치처럼 보인다`).toBe(true)
      expect(ci!, `${child} 가 부모(${parent})보다 위에 있다`).toBeGreaterThan(pi!)
      // 부모와 자기 사이에는 **같은 부모의 다른 자식만** 올 수 있다.
      for (let i = pi! + 1; i < ci!; i++) {
        const between = COMMISSION_BUDGET_FIELDS[i].key
        expect(
          DEPENDENTS[between],
          `${child} 와 부모 ${parent} 사이에 무관한 스위치 ${between} 가 끼었다 — 정리 전 상태다`,
        ).toBe(parent)
      }
    }
  })

  it("hint 상호참조가 동그라미 번호를 쓰지 않는다 (가리키는 대상이 화면에 없다)", () => {
    const bad = COMMISSION_BUDGET_FIELDS
      .filter(f => /[①-⑳][\s가이을는의]|[①-⑳]재원|[①-⑳]promo|[①-⑳]예산캡|[①-⑳]owner/.test(f.hint ?? ''))
      .map(f => `${f.key}: ${f.hint}`)
    expect(bad, 'hint 가 번호로 다른 스위치를 가리킨다 — 이름으로 쓸 것').toEqual([])
  })

  it('손잡이 키가 하나도 사라지지 않았다 (표시만 바꾼 정리였다)', () => {
    expect(COMMISSION_BUDGET_FIELDS.map(f => f.key).sort()).toEqual([...KEYS_AT_CLEANUP].sort())
  })

  it('파일 머리말이 이 규약을 적어 둔다 (다음 세션이 또 번호를 붙이지 않게)', () => {
    // 🩸 첫 판은 `SRC`(=readCode, 주석 제거됨)에서 머리말을 찾아 **빈 문자열**을 검사했다 — 규약을
    //   통째로 지워도 초록이 떴을 자리다. 규약은 주석이므로 원문(`RAW`)을 본다.
    const doc = RAW.slice(0, RAW.indexOf('export type MoneySwitchField'))
    expect(doc.length, '머리말을 찾지 못했다').toBeGreaterThan(200)
    expect(doc).toMatch(/동그라미 번호/)
    expect(doc).toMatch(/\[순서 N\]/)
    // 교차 확인: 그 문구는 주석에만 있어야 한다(실행 코드에 새면 라벨로 새어든 것).
    expect(SRC).not.toMatch(/동그라미 번호/)
  })
})
