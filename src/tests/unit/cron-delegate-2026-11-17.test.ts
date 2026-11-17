/**
 * 🔁 2026-11-17 — cron 워커에 비밀값이 없으면 같은 일을 웹사이트(Pages)에 맡긴다(대표 "2번으로 해줘").
 * 고정: 위임 판정(값이 있으면 직접 — dual-mode) · 받는 쪽 fail-closed 토큰 · 허용목록 · scheduled.ts 세 곳 배선.
 * ⚠️ 못 보는 것: 라이브에서 워커→Pages fetch 가 실제로 닿는지(하트비트·cron_failures 로 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { needsDelegation, delegateToPages } from '@/worker/utils/cron-delegate'
import { cronDelegateRoutes } from '@/worker/routes/cron-delegate.routes'

describe('cron 위임', () => {
  it('비밀값이 없을 때만 위임한다', () => {
    expect(needsDelegation({}, 'restaurant-geocode')).toBe(true)
    expect(needsDelegation({ KAKAO_REST_API_KEY: 'k' }, 'restaurant-geocode')).toBe(false)
    expect(needsDelegation({}, 'kt-alpha-catalog-sync')).toBe(true)
    expect(needsDelegation({ KT_ALPHA_AUTH_CODE: 'a' }, 'kt-alpha-catalog-sync')).toBe(false)
    expect(needsDelegation({ FIREBASE_PROJECT_ID: 'p' }, 'channel-watchdog')).toBe(true)
    expect(needsDelegation({ FIREBASE_PROJECT_ID: 'p', FIREBASE_PRIVATE_KEY: 'k', FIREBASE_CLIENT_EMAIL: 'e' }, 'channel-watchdog')).toBe(false)
  })
  it('토큰이 없으면 위임 자체를 실패로 던진다(조용히 skip 하지 않는다)', async () => {
    await expect(delegateToPages({}, 'restaurant-geocode')).rejects.toThrow(/INTERNAL_CRON_TOKEN/)
  })
  it('받는 쪽: 토큰 미설정 500 · 불일치 401 · 모르는 작업 404', async () => {
    const post = (env: object, tok?: string, job = 'restaurant-geocode') =>
      cronDelegateRoutes.request(`/api/_internal/cron-delegate/${job}`, { method: 'POST', headers: tok ? { 'X-Internal-Token': tok } : {} }, env)
    expect((await post({})).status).toBe(500)
    expect((await post({ INTERNAL_CRON_TOKEN: 's' }, 'x')).status).toBe(401)
    expect((await post({ INTERNAL_CRON_TOKEN: 's' }, 's', 'repair-schema')).status).toBe(404)
  })
  it('scheduled.ts 의 세 작업이 위임 분기를 거친다', () => {
    const s = readFileSync('src/worker/scheduled.ts', 'utf8')
    for (const j of ['channel-watchdog', 'kt-alpha-catalog-sync', 'restaurant-geocode']) {
      expect(s).toContain(`cd.needsDelegation(env, '${j}')) return cd.delegateToPages(env, '${j}')`)
    }
  })
  it('받는 쪽 라우트가 실제로 마운트돼 있다', () => {
    expect(readFileSync('src/worker/routes/internal-diagnostics.routes.ts', 'utf8')).toMatch(/internalDiagnosticsRoutes\.route\('\/', cronDelegateRoutes\)/)
  })
})
