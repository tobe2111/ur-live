import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'
import { adminStoreChannelRoutes } from '@/features/admin/api/admin-store-channel.routes'

/**
 * 🏪 2026-08-27 — 매장 등록 채널(직접 / 대행사)을 **어드민이 확정**할 수 있어야 한다.
 *
 * ## 왜 이 가드가 있나
 * 채널은 요율을 정한다(직접 10% / 대행사 5%). 그런데 채널을 쓸 수 있는 사람이 **매장 소유자뿐**이라
 * 라이브 실측에서 **활성 매장 7곳 중 6곳이 미기록**이었다 — 대표가 확정한 가격 모델이 *적용될 수
 * 없는 상태*였다는 뜻이다. 값을 넣을 길이 없으면 규칙은 규칙이 아니다.
 *
 * ## 못 막는 것
 *   - 각 매장이 실제로 직접인지 대행인지(사실 판단 — 대표 몫).
 *   - 게이트를 켰을 때 요율이 실제로 그렇게 떨어지는지 → staging 실결제.
 */
const SRC = 'src/features/admin/api/admin-store-channel.routes.ts'
const IDX = 'src/worker/index.ts'

describe('경로가 실제로 살아 있다', () => {
  it('PATCH /sellers/:id/channel 이 404 가 아니다', async () => {
    const res = await adminStoreChannelRoutes.request('/sellers/7/channel', { method: 'PATCH' })
    expect(res.status, '라우트가 없다').not.toBe(404)
  })
  it('없는 경로는 404 다 (이 검사가 헛돌지 않는다는 증거)', async () => {
    const res = await adminStoreChannelRoutes.request('/sellers/7/nope', { method: 'PATCH' })
    expect(res.status).toBe(404)
  })
  it('어드민 라우터에 마운트돼 있다 — 파일만 만들고 배선을 잊으면 조용히 없는 기능이다', () => {
    const idx = codeOnly(readFileSync(IDX, 'utf-8'))
    expect(idx).toContain('adminStoreChannelRoutes')
    expect(idx, "adminApp 에 route 로 붙어야 requireAdmin 을 통과한다").toMatch(
      /adminApp\.route\(\s*'\/'\s*,\s*adminStoreChannelRoutes\s*\)/,
    )
  })
})

describe('요율이 바뀌는 결정이라 지켜야 할 것', () => {
  const src = readFileSync(SRC, 'utf-8')

  it('채널 값을 화이트리스트로만 받는다', async () => {
    // 자유 문자열을 받으면 요율 조회가 조용히 '미지정'으로 떨어져 종전 요율이 걷힌다.
    const res = await adminStoreChannelRoutes.request('/sellers/7/channel', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'DIRECT' }),   // 대문자 = 우리가 읽는 값이 아니다
    })
    expect(res.status, '정의 밖 채널이 통과했다').toBe(400)
  })

  it('감사 로그를 남긴다 (누가 언제 이 매장을 대행으로 바꿨나)', () => {
    expect(codeOnly(src)).toContain('writeAuditLog')
    expect(codeOnly(src), '무엇이 무엇으로 바뀌었는지 남겨야 추적이 된다').toMatch(/before:\s*\{\s*store_channel/)
  })

  it('게이트가 꺼져 있으면 그 사실을 응답에 밝힌다', () => {
    // 채널만 찍어 놓고 "요율이 적용됐겠지" 하는 오해가 이 도메인에서 제일 비싸다.
    expect(codeOnly(src)).toContain('channel_rates_active')
    expect(codeOnly(src)).toContain('fee_channel_rates_enabled')
  })

  it('없는 매장에는 안 심는다 (조용한 고아 메타 방지)', () => {
    expect(codeOnly(src)).toMatch(/FROM sellers WHERE id = \?/)
  })
})
