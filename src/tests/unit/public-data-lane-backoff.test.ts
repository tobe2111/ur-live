/**
 * 🩹 공공데이터 레인 하드 실패 백오프 (2026-07-29).
 *
 *   실측: `franchise` 13회 · `nara` 10회 연속 HTTP 404 "API not found" — 저장 0. 재시도로 낫는 실패가
 *   아닌데(엔드포인트/활용신청 문제) 두 시간마다 같은 요청을 8페이지씩 다시 쐈다. 서브리퀘스트는
 *   인보케이션당 45~50 이 천장이라, 고칠 수 없는 레인의 재시도는 **잘 도는 레인에서 예산을 빼앗는다**.
 *
 *   ⚠️ 동시에, 영구 차단은 안 된다 — 대표가 활용신청을 마치면 **배포 없이 스스로 살아나야** 한다.
 *   그 두 요구(물러남 · 자가치유)가 동시에 성립하는지를 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import {
  isHardConfigFailure, laneShouldSkip, updateLaneHealth, laneHealthNote,
  HARD_FAIL_GRACE, HARD_FAIL_MAX_BACKOFF_MS,
} from '@/features/marketing/api/public-data-diag'

const T0 = Date.parse('2026-07-29T00:00:00Z')

describe('isHardConfigFailure — 사람이 고쳐야 낫는 실패인가', () => {
  it('설정 문제는 하드', () => {
    expect(isHardConfigFailure('API: HTTP 404 — API not found')).toBe(true)
    expect(isHardConfigFailure('개인회원은 사용할 수 없는 OPEN-API입니다')).toBe(true)
    expect(isHardConfigFailure('등록되지 않은 서비스키')).toBe(true)
    expect(isHardConfigFailure('SERVICE ACCESS DENIED')).toBe(true)
  })

  it('🔒 일시적 실패는 하드가 아니다 — 5xx/타임아웃/한도까지 백오프하면 정상 레인이 멈춘다', () => {
    expect(isHardConfigFailure('API: HTTP 503')).toBe(false)
    expect(isHardConfigFailure('네트워크 오류')).toBe(false)
    expect(isHardConfigFailure('⛔ 플랫폼 요청한도 도달')).toBe(false)
    expect(isHardConfigFailure('시간초과')).toBe(false)
  })

  it('🔒 5xx 라도 본문이 설정 오류면 하드 — 포털은 키 미등록을 500 으로도 준다(순서 회귀 테스트)', () => {
    expect(isHardConfigFailure('API: HTTP 500 — 등록되지 않은 서비스키')).toBe(true)
    expect(isHardConfigFailure('API: HTTP 500 — SERVICE_KEY_IS_NOT_REGISTERED_ERROR')).toBe(true)
    // 반대로 본문 단서가 없는 5xx 는 상대 사정이므로 계속 재시도한다
    expect(isHardConfigFailure('API: HTTP 500')).toBe(false)
  })

  it('빈 메시지(성공)는 하드 아님', () => {
    expect(isHardConfigFailure(null)).toBe(false)
    expect(isHardConfigFailure('')).toBe(false)
  })
})

describe('updateLaneHealth / laneShouldSkip', () => {
  it(`유예(${HARD_FAIL_GRACE}회)까지는 백오프 없이 계속 시도한다`, () => {
    let h = updateLaneHealth(null, 'HTTP 404', T0)
    for (let i = 1; i < HARD_FAIL_GRACE; i++) h = updateLaneHealth(h, 'HTTP 404', T0)
    expect(h.fail_streak).toBe(HARD_FAIL_GRACE)
    expect(laneShouldSkip(h, T0)).toBe(false)
  })

  it('유예를 넘기면 물러난다 — 그리고 실패가 이어질수록 더 길게', () => {
    let h = updateLaneHealth(null, 'HTTP 404', T0)
    for (let i = 1; i <= HARD_FAIL_GRACE; i++) h = updateLaneHealth(h, 'HTTP 404', T0)
    expect(laneShouldSkip(h, T0)).toBe(true)
    const first = (h.next_probe_at as number) - T0
    h = updateLaneHealth(h, 'HTTP 404', T0)
    expect((h.next_probe_at as number) - T0).toBeGreaterThan(first)
  })

  it('백오프에 상한이 있다 — 하루에 한 번은 반드시 찔러본다(영구 정지 금지)', () => {
    let h = updateLaneHealth(null, 'HTTP 404', T0)
    for (let i = 0; i < 40; i++) h = updateLaneHealth(h, 'HTTP 404', T0)
    expect((h.next_probe_at as number) - T0).toBeLessThanOrEqual(HARD_FAIL_MAX_BACKOFF_MS)
  })

  it('🔓 대기 시간이 지나면 다시 시도한다', () => {
    let h = updateLaneHealth(null, 'HTTP 404', T0)
    for (let i = 0; i <= HARD_FAIL_GRACE; i++) h = updateLaneHealth(h, 'HTTP 404', T0)
    expect(laneShouldSkip(h, T0)).toBe(true)
    expect(laneShouldSkip(h, (h.next_probe_at as number) + 1)).toBe(false)
  })

  it('✅ 성공하면 즉시 초기화 — 대표가 설정을 고치면 배포 없이 정상 복귀', () => {
    let h = updateLaneHealth(null, 'HTTP 404', T0)
    for (let i = 0; i < 10; i++) h = updateLaneHealth(h, 'HTTP 404', T0)
    const healed = updateLaneHealth(h, null, T0)
    expect(healed.fail_streak).toBeUndefined()
    expect(laneShouldSkip(healed, T0)).toBe(false)
  })

  it('소프트 실패는 아무리 이어져도 백오프하지 않는다', () => {
    let h = updateLaneHealth(null, 'HTTP 503', T0)
    for (let i = 0; i < 20; i++) h = updateLaneHealth(h, 'HTTP 503', T0)
    expect(h.fail_streak).toBe(21)
    expect(laneShouldSkip(h, T0)).toBe(false) // 계속 시도 — 일시 장애는 스스로 낫는다
  })

  it('건강한 레인은 skip 하지 않는다', () => {
    expect(laneShouldSkip(null, T0)).toBe(false)
    expect(laneShouldSkip({}, T0)).toBe(false)
  })

  it('상태줄 문구가 사실을 담는다(횟수·최초시각·다음 시도)', () => {
    expect(laneHealthNote(null, T0)).toBeNull()
    let h = updateLaneHealth(null, 'HTTP 404', T0)
    for (let i = 0; i <= HARD_FAIL_GRACE; i++) h = updateLaneHealth(h, 'HTTP 404', T0)
    const note = laneHealthNote(h, T0) || ''
    expect(note).toContain('연속 실패')
    expect(note).toContain('재시도 대기')
  })
})
