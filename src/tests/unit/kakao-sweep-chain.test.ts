/**
 * 🔁 카카오 전화 스윕 self-chain 판정 (2026-07-29).
 *
 *   왜 체인인가: 연락처 없는 리드 **145,809** 건 / 한 인보케이션 ≈55건 / 크론 시간당 1회 = **110일**.
 *   인보케이션당 서브리퀘스트가 천장이라 한 번에 더 할 수는 없지만, SELF kick 은 **새 인보케이션 = 새 예산**이다.
 *
 *   ⚠️ 체인의 위험은 하나뿐 — **진전 없는 라운드를 반복하는 헛돌기**(한도에 즉시 막히거나 대상이 없을 때).
 *   그러면 카카오 쿼터만 태우고 아무것도 안 남는다. 그 판정을 순수 함수로 고정한다.
 */
import { describe, it, expect } from 'vitest'

/** worker-ads 의 체인 중단 판정과 **같은 식**(그 파일은 Hono 핸들러라 직접 import 불가 — 식만 미러). */
const chainDone = (
  stats: { done?: boolean; tried?: number } | null,
  depth: number,
  maxDepth: number,
): boolean => !stats || !!stats.done || !stats.tried || depth + 1 >= maxDepth

describe('스윕 체인 중단 판정', () => {
  it('진전이 있으면 이어간다', () => {
    expect(chainDone({ done: false, tried: 55 }, 0, 6)).toBe(false)
  })

  it('대상이 소진되면 멈춘다', () => {
    expect(chainDone({ done: true, tried: 0 }, 0, 6)).toBe(true)
  })

  it('🔒 한 건도 못 했으면 멈춘다 — 이게 없으면 쿼터만 태우는 헛돌기가 된다', () => {
    expect(chainDone({ done: false, tried: 0 }, 0, 6)).toBe(true)
  })

  it('깊이 상한에서 멈춘다(런어웨이 방지)', () => {
    expect(chainDone({ done: false, tried: 55 }, 5, 6)).toBe(true)
    expect(chainDone({ done: false, tried: 55 }, 4, 6)).toBe(false)
  })

  it('스윕이 실패(null)하면 멈춘다', () => {
    expect(chainDone(null, 0, 6)).toBe(true)
  })

  it('깊이 1 이면 체인 없이 1회만(기존 동작과 동일 — 안전한 롤백값)', () => {
    expect(chainDone({ done: false, tried: 55 }, 0, 1)).toBe(true)
  })
})

/**
 * 🔁 인허가(매장 후보) 체인 — **유어딜 이용권의 공급 DB** 가 0 이던 원인.
 *
 *   실측: `store_prospects` 24,160 중 학원 24,038(99.5%) · 인허가 `total_saved` **0**.
 *   유어딜이 실제로 파는 네 업종(일반음식점·휴게음식점·미용업·숙박업)이 한 건도 없었다.
 *   산수: `mode=collect` 하루 1회 × 업종 16 × 페이지 6 → 한 인보케이션 예산으로 1~2 업종.
 *   밀린 날이 14일치를 넘으면 **버려진다**(영구 누락).
 *
 *   ⚠️ 여기서 전화 스윕과 **중단 조건이 다르다**: '수확 0' 은 멈출 이유가 아니다 —
 *   예산이 끊겨 0 인 경우가 바로 체인이 필요한 상황이기 때문. 대신 하드 설정 실패는 멈춘다.
 */
const localdataDone = (
  stats: { pending_days?: number; diag?: { error?: string } } | null,
  depth: number,
  maxDepth: number,
  hardFail: (m?: string | null) => boolean,
): boolean => !stats || !stats.pending_days || depth + 1 >= maxDepth || hardFail(stats.diag?.error)

describe('인허가 체인 중단 판정', () => {
  const hard = (m?: string | null) => /HTTP 4\d\d|활용\s*신청/.test(String(m || ''))

  it('남은 날이 있으면 이어간다 — 예산이 끊겨 멈춘 것이므로', () => {
    expect(localdataDone({ pending_days: 3 }, 0, 6, hard)).toBe(false)
  })

  it('🔒 수확 0 은 중단 사유가 아니다(전화 스윕과 반대) — 예산 소진이 바로 체인이 필요한 상황', () => {
    expect(localdataDone({ pending_days: 2, diag: {} }, 0, 6, hard)).toBe(false)
  })

  it('남은 날이 없으면 멈춘다', () => {
    expect(localdataDone({ pending_days: 0 }, 0, 6, hard)).toBe(true)
  })

  it('하드 설정 실패(404·활용신청)면 멈춘다 — 재시도로 안 낫는다', () => {
    expect(localdataDone({ pending_days: 5, diag: { error: 'API: HTTP 404' } }, 0, 6, hard)).toBe(true)
  })

  it('일시 실패(요청한도)는 계속 — 다음 인보케이션은 새 예산이다', () => {
    expect(localdataDone({ pending_days: 5, diag: { error: '⛔ 플랫폼 요청한도 도달' } }, 0, 6, hard)).toBe(false)
  })

  it('깊이 상한에서 멈춘다', () => {
    expect(localdataDone({ pending_days: 9 }, 5, 6, hard)).toBe(true)
  })
})
