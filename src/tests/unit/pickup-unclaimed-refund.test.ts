/**
 * 💸 **미수령 환불 정책** 불변식 〔세션 ④-b · 머니 경로〕
 *
 * 사양: `docs/design/pickup-unclaimed-refund-spec.md` §3~4
 *
 * ## 🔴 이 테스트가 지키는 것
 * 지금 **미수령은 무조건 전액 환불**되고 그 cron(`0 18`)은 **실제로 돌고 있다**.
 * ④-b 는 안 돌던 걸 켜는 게 아니라 **흐르는 돈의 방향을 바꾼다.** 그래서 안전판이 세 겹이고
 * 그 세 겹이 **각각** 여기서 고정된다 — 하나라도 풀리면 라이브 환불액이 조용히 바뀐다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 대표가 넣을 **정책값이 옳은지**(D1·D2 는 사업 판단이지 코드 판단이 아니다)
 *   - 실제 Toss 취소가 그 금액으로 나갔는지(**실결제 검증** 항목 — `STAGING_CHECKLIST` P10)
 *   - 원장 계정 체계가 정산 집계와 맞물리는지(payout 쿼리는 별도 경로)
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_UNCLAIMED_POLICY,
  parseUnclaimedPolicy,
  unclaimedRefundAmount,
  type UnclaimedPolicy,
} from '../../shared/pickup-refund'
import { readCode, sliceFrom } from '../helpers/source-text'

const ON = (over: Partial<UnclaimedPolicy> = {}): UnclaimedPolicy =>
  ({ ...DEFAULT_UNCLAIMED_POLICY, enabled: true, ...over })

describe('🔴 안전판 ① 게이트 — OFF 면 현행(전액)', () => {
  it('게이트가 기본 OFF 다', () => {
    expect(DEFAULT_UNCLAIMED_POLICY.enabled).toBe(false)
  })

  it('OFF 면 어떤 보관구분이든 전액 환불', () => {
    for (const storage of ['cold', 'room', null] as const) {
      const r = unclaimedRefundAmount({
        paidAmount: 12_000,
        storage,
        daysSinceBasis: 999,
        policy: { enabled: false, coldPct: 0, roomPct: 0, roomGraceDays: 0 },
      })
      expect(r.refund, `storage=${storage}`).toBe(12_000)
      expect(r.operatorShare).toBe(0)
      expect(r.reason).toBe('gate-off')
    }
  })
})

describe('🔴 안전판 ② 기본값이 곧 현행 — 켜도 값이 없으면 안 바뀐다', () => {
  it('비율 기본값이 100 이다', () => {
    expect(DEFAULT_UNCLAIMED_POLICY.coldPct).toBe(100)
    expect(DEFAULT_UNCLAIMED_POLICY.roomPct).toBe(100)
  })

  it('게이트만 켜고 값을 안 넣으면 전액 그대로', () => {
    for (const storage of ['cold', 'room'] as const) {
      const r = unclaimedRefundAmount({ paidAmount: 9_900, storage, daysSinceBasis: 30, policy: ON() })
      expect(r.refund, `storage=${storage}`).toBe(9_900)
      expect(r.operatorShare).toBe(0)
    }
  })

  it('설정이 비어 있으면 기본값으로 파싱된다', () => {
    expect(parseUnclaimedPolicy(null)).toEqual(DEFAULT_UNCLAIMED_POLICY)
    expect(parseUnclaimedPolicy({})).toEqual(DEFAULT_UNCLAIMED_POLICY)
  })

  it('이상한 값은 기본값으로 떨어진다 — 오타가 환불액을 흔들지 않는다', () => {
    const p = parseUnclaimedPolicy({
      pickup_unclaimed_policy_enabled: 'yes',      // 'true' 가 아니면 OFF
      pickup_unclaimed_cold_pct: 'abc',
      pickup_unclaimed_room_pct: '',
      pickup_unclaimed_room_grace_days: '-3',
    })
    expect(p).toEqual(DEFAULT_UNCLAIMED_POLICY)
  })

  it('범위 밖 비율은 0~100 으로 잘린다', () => {
    const p = parseUnclaimedPolicy({
      pickup_unclaimed_policy_enabled: 'true',
      pickup_unclaimed_cold_pct: '900',
      pickup_unclaimed_room_pct: '-50',
    })
    expect(p.coldPct).toBe(100)
    expect(p.roomPct).toBe(0)
  })
})

describe('🔴 안전판 ③ 모르면 전액 — 소비자 돈을 추측으로 깎지 않는다', () => {
  it('storage 가 null 이면 정책이 켜져 있어도 전액', () => {
    const r = unclaimedRefundAmount({
      paidAmount: 20_000, storage: null, daysSinceBasis: 999,
      policy: ON({ coldPct: 0, roomPct: 0 }),
    })
    expect(r.refund).toBe(20_000)
    expect(r.reason).toBe('unknown-storage')
  })

  it('낯선 문자열도 전액 — 값 집합이 늘어도 조용히 돈이 깎이지 않는다', () => {
    const r = unclaimedRefundAmount({
      paidAmount: 20_000,
      storage: 'frozen' as unknown as 'cold',
      daysSinceBasis: 999,
      policy: ON({ coldPct: 0 }),
    })
    expect(r.refund).toBe(20_000)
    expect(r.reason).toBe('unknown-storage')
  })

  it('기준일을 모르는데 유예가 설정돼 있으면 유예 안으로 본다', () => {
    const r = unclaimedRefundAmount({
      paidAmount: 10_000, storage: 'room', daysSinceBasis: null,
      policy: ON({ roomPct: 50, roomGraceDays: 3 }),
    })
    expect(r.refund).toBe(10_000)
    expect(r.reason).toBe('room-grace')
  })

  it('유예가 0이면 기준일을 몰라도 비율이 적용된다 — 유예가 아예 없는 설정이다', () => {
    const r = unclaimedRefundAmount({
      paidAmount: 10_000, storage: 'room', daysSinceBasis: null,
      policy: ON({ roomPct: 50, roomGraceDays: 0 }),
    })
    expect(r.refund).toBe(5_000)
    expect(r.reason).toBe('room-after-grace')
  })
})

describe('분기 — 냉장/실온', () => {
  it('cold 는 coldPct 를 쓴다 (유예 무관 — 상하는 물건에 유예는 없다)', () => {
    const r = unclaimedRefundAmount({
      paidAmount: 10_000, storage: 'cold', daysSinceBasis: 0,
      policy: ON({ coldPct: 0, roomGraceDays: 7 }),
    })
    expect(r.refund).toBe(0)
    expect(r.operatorShare).toBe(10_000)
    expect(r.reason).toBe('cold')
  })

  it('room 은 유예 안이면 전액', () => {
    const r = unclaimedRefundAmount({
      paidAmount: 10_000, storage: 'room', daysSinceBasis: 3,
      policy: ON({ roomPct: 30, roomGraceDays: 3 }),
    })
    expect(r.refund).toBe(10_000)
    expect(r.reason).toBe('room-grace')
  })

  it('room 은 유예를 넘기면 roomPct', () => {
    const r = unclaimedRefundAmount({
      paidAmount: 10_000, storage: 'room', daysSinceBasis: 4,
      policy: ON({ roomPct: 30, roomGraceDays: 3 }),
    })
    expect(r.refund).toBe(3_000)
    expect(r.operatorShare).toBe(7_000)
    expect(r.reason).toBe('room-after-grace')
  })
})

describe('🔴 돈이 새지 않는다', () => {
  const cases: Array<[number, number]> = [
    [0, 50], [1, 33], [7, 33], [999, 37], [12_345, 33], [99_999, 7], [1_000_000, 99],
  ]

  it('refund + operatorShare === paidAmount (반올림으로도 새지 않는다)', () => {
    for (const [paid, pctv] of cases) {
      for (const storage of ['cold', 'room'] as const) {
        const r = unclaimedRefundAmount({
          paidAmount: paid, storage, daysSinceBasis: 999,
          policy: ON({ coldPct: pctv, roomPct: pctv }),
        })
        expect(r.refund + r.operatorShare, `${paid}/${pctv}/${storage}`).toBe(paid)
      }
    }
  })

  it('refund 가 결제액을 넘지 않는다 — 넘으면 과다환불(플랫폼 손실)', () => {
    for (const [paid] of cases) {
      const r = unclaimedRefundAmount({
        paidAmount: paid, storage: 'room', daysSinceBasis: 999,
        policy: ON({ roomPct: 100 }),
      })
      expect(r.refund).toBeLessThanOrEqual(paid)
    }
  })

  it('내림이다 — 1원이라도 더 주지 않는다', () => {
    // 999 × 33% = 329.67 → 329 (330 이 아니다)
    const r = unclaimedRefundAmount({
      paidAmount: 999, storage: 'room', daysSinceBasis: 999, policy: ON({ roomPct: 33 }),
    })
    expect(r.refund).toBe(329)
  })

  it('음수·NaN 결제액은 0 으로 정규화된다', () => {
    for (const bad of [-1000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = unclaimedRefundAmount({
        paidAmount: bad, storage: 'room', daysSinceBasis: 999, policy: ON({ roomPct: 50 }),
      })
      expect(r.refund, String(bad)).toBe(0)
      expect(r.operatorShare).toBe(0)
    }
  })
})

/**
 * 아래는 **배선** 검사다. 순수함수가 아무리 옳아도 cron 이 안 부르면 라이브는 안 바뀐다
 * (이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 클래스).
 */
describe('🔴 cron 배선', () => {
  const cron = readCode('src/worker/cron/auto-settlement.ts')
  const fn = sliceFrom(cron, 'export async function handleExpiredVoucherRefunds', undefined, 9000)

  it('환불액 계산이 판정 함수를 지난다', () => {
    expect(fn).toMatch(/const verdict = unclaimedRefundAmount\(/)
    expect(fn).toMatch(/const refundAmount = verdict\.refund/)
  })

  it('보관구분은 저장된 값에서 읽는다 — 추측하지 않는다', () => {
    expect(fn).toContain('parsePickup(pickupMeta.get(')
    expect(fn).toMatch(/storage: pickup\.storage/)
  })

  it('🔴 CAS 멱등이 그대로다 — 이중 환불의 유일한 방어선', () => {
    expect(fn).toContain("UPDATE vouchers SET status = 'expired' WHERE id = ? AND status = 'unused'")
    expect(fn).toMatch(/if \(!casResult\.meta\?\.changes\)[\s\S]{0,80}continue/)
  })

  it('🔴 운영자 귀속분이 원장에 남는다 — 없으면 돈이 공중에 뜬다', () => {
    const block = sliceFrom(fn, 'verdict.operatorShare > 0', undefined, 900)
    expect(block).toContain('recordLedger')
    expect(block).toContain("event_type: 'unclaimed_forfeit'")
    expect(block).toMatch(/amount: verdict\.operatorShare/)
  })

  it('🔴 원장 기록이 CAS 통과분 안에 있다 — 밖이면 매 실행마다 중복 적립', () => {
    const casAt = fn.indexOf('casResult')
    const ledgerAt = fn.indexOf("'unclaimed_forfeit'")
    expect(casAt).toBeGreaterThan(-1)
    expect(ledgerAt).toBeGreaterThan(casAt)
  })

  it('전액 미환불이면 만료 알림이 대신 나간다 — 아무 통보도 못 받는 상태 금지', () => {
    const block = sliceFrom(fn, 'refundAmount <= 0 && voucher.user_id', undefined, 700)
    expect(block).toContain('INSERT INTO notifications')
  })

  it('🔴 유어딜 5% 는 이 경로에서 안 건드린다', () => {
    // 미수령 처리는 소비자↔운영자 분배다. 플랫폼 몫은 결제 시점에 확정됐다.
    expect(fn).not.toContain('platform:commission')
    expect(fn).not.toMatch(/fee_amount/)
  })

  it('정책 조회 실패는 기본값(현행)으로 떨어진다', () => {
    const loader = sliceFrom(cron, 'async function loadUnclaimedPolicy', undefined, 1200)
    expect(loader).toContain('DEFAULT_UNCLAIMED_POLICY')
  })

  it('게이트 OFF 면 메타 조회조차 안 한다 — OFF 경로는 쿼리 수까지 현행과 같다', () => {
    expect(fn).toMatch(/unclaimedPolicy\.enabled[\s\S]{0,120}getSupplyMeta/)
  })
})
