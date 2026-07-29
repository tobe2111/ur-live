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
