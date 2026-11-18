/**
 * ⏱️ 2026-11-17 외부 서비스가 멈춰도 손님 요청이 끝없이 기다리지 않는다 · 장애 알림이 응답과 함께 사라지지 않는다 ·
 * 돈 값 조회 실패를 0원으로 보여 주지 않는다. (대표 *"다른 문제들도 파악해줘"* 안정성 점검)
 *
 * 못 막는 것: 새로 생기는 다른 파일의 시간 제한 없는 fetch(파일별 고정) · 시간 제한 값이 적절한지.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const read = (p: string) => fs.readFileSync(p, 'utf8')
/** 파일 안의 `await fetch(` 마다 그 호출이 끝나기 전에(다음 `await fetch(` 전) AbortSignal.timeout 이 있는가. */
function fetchesWithoutTimeout(src: string): number {
  const parts = src.split('await fetch(').slice(1)
  return parts.filter((p) => !/AbortSignal\.timeout\(/.test(p.slice(0, 600).split('\n').slice(0, 8).join('\n'))).length
}

describe('외부 호출 — 시간 제한', () => {
  for (const f of [
    'src/worker/routes/proxy.routes.ts',
    'src/worker/utils/kakao-region.ts',
    'src/worker/utils/turnstile.ts',
    'src/worker/routes/curator/sns-posts.routes.ts',
    'src/lib/push-notification.ts',
    'src/worker/middleware/error-handler.ts',
  ]) {
    it(f, () => {
      const src = read(f)
      expect(src.includes('await fetch('), '이 파일에 fetch 가 없다 — 시험이 헛돈다').toBe(true)
      expect(fetchesWithoutTimeout(src)).toBe(0)
    })
  }
})

describe('장애 알림 · 돈 값', () => {
  it('오류 알림을 waitUntil 에 맡긴다', () => {
    expect(read('src/worker/middleware/error-handler.ts')).toMatch(/c\.executionCtx\.waitUntil\(notify\)/)
  })
  it('사장님 정산 잔액 조회 실패는 0원이 아니라 503', () => {
    const s = read('src/features/seller/api/seller-settlements.routes.ts')
    expect(s).not.toMatch(/\.catch\(\(\) => \(\{ available_amount: 0 \}\)\)/)
    expect(s).toMatch(/code: 'BALANCE_UNAVAILABLE' \}, 503\)/)
  })
  it('유어샵 소개비 합계 조회 실패는 0원이 아니라 503', () => {
    const s = read('src/worker/routes/curator.routes.ts')
    expect(s).toMatch(/code: 'COMMISSION_UNAVAILABLE' \}, 503\)/)
  })
})
