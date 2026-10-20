/**
 * 💸 **미수령 환불 정책** — 세션 ④-b (머니 경로 · 게이트 뒤)
 *
 * 사양: `docs/design/pickup-unclaimed-refund-spec.md`
 *
 * ## 🔴 이 파일은 "방향을 바꾸는" 코드다
 * **지금도 미수령은 전액 환불된다**(`auto-settlement.handleExpiredVoucherRefunds` — 낙전 정책
 * *"만료 시 고객 환불"*, cron `0 18` 로 **실제로 돌고 있다**). 안 돌던 걸 켜는 게 아니라
 * **이미 흐르는 돈의 방향을 바꾸는 것**이라 더 위험하다.
 *
 * ## 🔴 3중 안전
 * 1. **게이트**(`pickup_unclaimed_policy_enabled`, 기본 OFF) — OFF 면 **현행 100% 동일**
 * 2. **기본값이 곧 현행**(비율 100%) — 게이트를 켜도 **값을 안 바꾸면 동작 불변**
 * 3. **`storage` 가 `null` 이면 현행** — 모르는 상태에서 **소비자 돈을 덜 주지 않는다**
 *
 * ⇒ 정책값(D1·D2)은 **코드가 정하지 않는다.** 어드민이 `platform_settings` 에서 넣는다.
 *
 * ## 🔴 유어딜 5% 는 이 파일 밖이다
 * 미수령 처리는 **소비자 ↔ 운영자 사이의 분배**다. 플랫폼 몫은 결제 시점에 이미 확정됐고
 * 여기서 건드리지 않는다(CLAUDE.md 커미션 재원 원칙 — *"유어딜 5% 는 불변, 깨지면 버그"*).
 */
import type { StorageKind } from './pickup'

export interface UnclaimedPolicy {
  /** 게이트. `false` 면 이 파일의 판정을 아예 쓰지 않는다(호출부가 현행 로직). */
  enabled: boolean
  /** 냉장·냉동 환불 비율 %(0~100). **기본 100 = 현행 전액.** D1 결정 대상. */
  coldPct: number
  /** 실온 환불 비율 %(0~100). **기본 100 = 현행 전액.** D2 결정 대상. */
  roomPct: number
  /** 실온 보관 유예일. 이 기간 안이면 **전액**, 지나면 `roomPct`. **기본 0 = 즉시 적용.** D2 결정 대상. */
  roomGraceDays: number
}

/** 어떤 값도 없을 때의 정책 — **현행과 동일**하다는 것이 핵심이다. */
export const DEFAULT_UNCLAIMED_POLICY: UnclaimedPolicy = {
  enabled: false,
  coldPct: 100,
  roomPct: 100,
  roomGraceDays: 0,
}

function pct(v: unknown, fallback: number): number {
  // 🔴 빈 문자열은 **미설정**이지 0% 가 아니다. `Number('')` 이 0 이라 이 가드가 없으면
  //    설정을 지운 순간 환불이 0원이 된다 — 값이 없을수록 소비자에게 유리해야 한다.
  const s = String(v ?? '').trim()
  if (!s) return fallback
  const n = Number(s)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

/** `platform_settings` 문자열 맵 → 정책. 값이 없거나 이상하면 **기본값(=현행)**. */
export function parseUnclaimedPolicy(rec: Record<string, string | null | undefined> | null | undefined): UnclaimedPolicy {
  if (!rec) return { ...DEFAULT_UNCLAIMED_POLICY }
  const days = Number(rec.pickup_unclaimed_room_grace_days)
  return {
    enabled: String(rec.pickup_unclaimed_policy_enabled ?? '') === 'true',
    coldPct: pct(rec.pickup_unclaimed_cold_pct, DEFAULT_UNCLAIMED_POLICY.coldPct),
    roomPct: pct(rec.pickup_unclaimed_room_pct, DEFAULT_UNCLAIMED_POLICY.roomPct),
    roomGraceDays: Number.isFinite(days) && days >= 0 ? Math.floor(days) : DEFAULT_UNCLAIMED_POLICY.roomGraceDays,
  }
}

export interface UnclaimedInput {
  /** 소비자가 실제로 낸 금액(원). `applied_price` — 주문 총액이 아니다(BUG #45 패턴). */
  paidAmount: number
  /** 보관구분. **`null` 이면 모르는 것** → 전액(현행). */
  storage: StorageKind | null
  /** 기준일(픽업일)로부터 지난 일수. 모르면 `null`. */
  daysSinceBasis: number | null
  policy: UnclaimedPolicy
}

export interface UnclaimedResult {
  /** 소비자에게 돌려줄 금액(원, 정수). */
  refund: number
  /** 운영자에게 남는 금액(원, 정수) = `paidAmount - refund`. **원장에 기록돼야 한다.** */
  operatorShare: number
  /** 왜 이 값이 나왔는지 — 로그·감사용. */
  reason: 'gate-off' | 'unknown-storage' | 'cold' | 'room-grace' | 'room-after-grace'
}

/**
 * 미수령 환불액 판정.
 *
 * 🔴 **어떤 경로로도 `refund` 가 `paidAmount` 를 넘지 않는다** — 넘으면 과다환불(플랫폼 손실)이다.
 * 🔴 **`refund + operatorShare === paidAmount`** — 반올림으로 돈이 새지 않게 `operatorShare` 는 **차액**으로 낸다.
 */
export function unclaimedRefundAmount(i: UnclaimedInput): UnclaimedResult {
  // `Number(x) || 0` 만으로는 Infinity 가 통과한다 — 금액에 무한대가 실리면 환불 계산 전체가 깨진다.
  const raw = Number(i.paidAmount)
  const paid = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
  const full = (reason: UnclaimedResult['reason']): UnclaimedResult =>
    ({ refund: paid, operatorShare: 0, reason })

  // ① 게이트 OFF → 현행(전액). 이 분기가 살아 있는 한 라이브 동작은 안 바뀐다.
  if (!i.policy.enabled) return full('gate-off')

  // ② 보관구분을 모르면 전액. **모르는 상태에서 소비자 돈을 덜 주지 않는다.**
  if (i.storage !== 'cold' && i.storage !== 'room') return full('unknown-storage')

  let ratio: number
  let reason: UnclaimedResult['reason']
  if (i.storage === 'cold') {
    ratio = i.policy.coldPct
    reason = 'cold'
  } else if (
    i.daysSinceBasis == null
      // 🔴 기준일을 모르는데 유예가 설정돼 있으면 **유예 안으로 본다.**
      //    "유예가 지났다"를 확인 못 한 채로 소비자 돈을 깎지 않는다(§3.3 과 같은 방향).
      //    유예가 0이면 애초에 유예가 없으므로 기준일을 몰라도 상관없다.
      ? i.policy.roomGraceDays > 0
      : i.daysSinceBasis <= i.policy.roomGraceDays
  ) {
    // ③ 실온 유예 기간 안 — 아직 찾아갈 수 있는 시간이다. 전액.
    ratio = 100
    reason = 'room-grace'
  } else {
    ratio = i.policy.roomPct
    reason = 'room-after-grace'
  }

  // 내림 — 반올림으로 소비자에게 1원 더 주면 그만큼 플랫폼/운영자가 손해다.
  const refund = Math.min(paid, Math.max(0, Math.floor((paid * ratio) / 100)))
  return { refund, operatorShare: paid - refund, reason }
}
