/**
 * 🔔 서버 5xx 자동 알림 — `worker/utils/server-error-alert.ts` (2026-09-21, 대표 "자동 알림 켜줘").
 *
 * 배경: 대표가 매장 등록 500 을 만났는데 흔적이 **어디에도 없었다**. `safeError` 는 Sentry 로만 보내고,
 * 그 Sentry 가 라이브에서 429(할당량 초과)였다. 대표가 브라우저 콘솔을 복사해 와야 원인을 볼 수 있었다.
 *
 * 이 시험이 지키는 것 둘 — ① 5xx 가 어드민이 보는 표에 남는다 ② **폭주해도 D1 을 같이 죽이지 않는다**.
 * 못 막는 것: 어드민 화면이 실제로 그 줄을 그리는지(다른 파일) · Sentry 할당량 자체.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  recordServerError,
  __resetServerErrorAlertMemo,
  ERROR_ALERT_WINDOW_MS,
  ERROR_BELL_WINDOW_MS,
} from '@/worker/utils/server-error-alert'
import { readCode } from '../helpers/source-text'

const bell = vi.fn(async () => {})
vi.mock('@/features/notifications/api/dashboard-notifications.routes', () => ({
  createDashboardNotification: (...a: unknown[]) => bell(...(a as [])),
}))

function fakeDb(fail = false) {
  const sql: string[] = []
  const binds: unknown[][] = []
  return {
    sql, binds,
    db: {
      prepare: (q: string) => ({
        bind: (...args: unknown[]) => ({
          run: async () => {
            sql.push(q); binds.push(args)
            if (fail) throw new Error('no such table: cron_failures')
            return { success: true }
          },
        }),
      }),
    } as unknown as D1Database,
  }
}

beforeEach(() => { __resetServerErrorAlertMemo(); bell.mockClear() })

describe('recordServerError', () => {
  it('5xx 한 건을 cron_failures 에 api:{태그} 로 적는다 (어드민이 이미 읽는 표)', async () => {
    const f = fakeDb()
    await recordServerError(f.db, '[seller-stores]', 'UNIQUE constraint failed', { method: 'POST', path: '/api/seller/stores' })
    expect(f.sql.length).toBe(1)
    expect(f.sql[0]).toContain('INSERT INTO cron_failures')
    expect(f.binds[0][0]).toBe('api:[seller-stores]')
    expect(String(f.binds[0][1])).toContain('UNIQUE constraint failed')
    expect(String(f.binds[0][2])).toContain('POST /api/seller/stores')
  })

  it('🌊 창 안에서 같은 태그가 또 나면 D1 을 아예 안 건드린다 (조회조차)', async () => {
    const f = fakeDb()
    const t = 1_000_000
    for (let i = 0; i < 50; i += 1) {
      await recordServerError(f.db, '[orders]', `boom ${i}`, {}, t + i * 100)
    }
    expect(f.sql.length).toBe(1)
  })

  it('창이 지나면 다시 적는다 — 두 번째 장애를 놓치지 않는다', async () => {
    const f = fakeDb()
    const t = 1_000_000
    await recordServerError(f.db, '[orders]', 'first', {}, t)
    await recordServerError(f.db, '[orders]', 'second', {}, t + ERROR_ALERT_WINDOW_MS + 1)
    expect(f.sql.length).toBe(2)
  })

  it('태그가 다르면 각각 적는다 (한 장애가 다른 장애를 가리지 않는다)', async () => {
    const f = fakeDb()
    const t = 1_000_000
    await recordServerError(f.db, '[orders]', 'a', {}, t)
    await recordServerError(f.db, '[seller-stores]', 'b', {}, t)
    expect(f.sql.length).toBe(2)
  })

  it('INSERT 가 실패해도 throw 하지 않고, 벨도 시도하지 않는다', async () => {
    const f = fakeDb(true)
    await expect(recordServerError(f.db, '[x]', 'boom')).resolves.toBeUndefined()
    expect(bell).not.toHaveBeenCalled()
  })

  it('DB 가 없으면 조용한 no-op', async () => {
    await expect(recordServerError(undefined, '[x]', 'boom')).resolves.toBeUndefined()
    expect(bell).not.toHaveBeenCalled()
  })

  it('첫 건은 어드민 벨까지 — 기록보다 드물게 운다', async () => {
    const f = fakeDb()
    const t = 1_000_000
    await recordServerError(f.db, '[orders]', 'first', {}, t)
    expect(bell).toHaveBeenCalledTimes(1)
    // 기록 창은 지났지만 벨 창은 아직 — 적히되 울리지 않는다
    await recordServerError(f.db, '[orders]', 'again', {}, t + ERROR_ALERT_WINDOW_MS + 1)
    expect(f.sql.length).toBe(2)
    expect(bell).toHaveBeenCalledTimes(1)
    expect(ERROR_BELL_WINDOW_MS).toBeGreaterThan(ERROR_ALERT_WINDOW_MS)
  })
})

describe('safeError 배선', () => {
  const code = readCode('src/worker/utils/safe-error.ts')
  it('5xx 블록 안에서만 부른다 — 4xx 는 사용자 입력이지 장애가 아니다', () => {
    expect(code).toContain("import('./server-error-alert')")
    const idx = code.indexOf("import('./server-error-alert')")
    const gate = code.lastIndexOf('if (status >= 500)', idx)
    expect(gate).toBeGreaterThan(-1)
  })
  it('응답을 막지 않는다 — waitUntil 또는 떠 있는 프라미스', () => {
    expect(code).toMatch(/waitUntil\(alert\)|void alert/)
  })
})
