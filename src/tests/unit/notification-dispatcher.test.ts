import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getChannelSettings, dispatchNotification } from '@/lib/notification-dispatcher'

/**
 * 🛡️ 2026-04-29: notification-dispatcher 단위 테스트
 *
 * 검증:
 *   1. getChannelSettings — DB row 변환 (0/1 → boolean)
 *   2. getChannelSettings — row 없으면 DEFAULT_CHANNELS
 *   3. dispatchNotification — DB 미설정 시 즉시 빈 결과
 *   4. dispatchNotification — settings 와 payload 만 매칭하는 채널 시도
 */

interface MockDB {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T>(): Promise<T | null>
      run(): Promise<{ meta: { changes: number } }>
    }
    run(): Promise<{ meta: { changes: number } }>
  }
}

function makeDB(rowMap: Record<string, unknown> = {}): MockDB {
  return {
    prepare: vi.fn((_sql: string) => ({
      bind: vi.fn((..._args: unknown[]) => ({
        first: vi.fn(async <T>() => {
          // notification_type 인자에 따라 row 반환
          const type = _args[0] as string
          return (rowMap[type] ?? null) as T | null
        }),
        run: vi.fn(async () => ({ meta: { changes: 0 } })),
      })),
      run: vi.fn(async () => ({ meta: { changes: 0 } })),
    })),
  }
}

describe('notification-dispatcher', () => {
  describe('getChannelSettings', () => {
    it('DB row 의 0/1 INTEGER → boolean 변환', async () => {
      const db = makeDB({
        new_order: {
          dashboard_enabled: 1,
          email_enabled: 0,
          alimtalk_enabled: 1,
          push_enabled: 1,
        },
      })
      const settings = await getChannelSettings(db as never, 'new_order')
      expect(settings).toEqual({
        dashboard: true,
        email: false,
        alimtalk: true,
        push: true,
      })
    })

    it('row 없으면 DEFAULT_CHANNELS (dashboard+push only)', async () => {
      const db = makeDB({})
      const settings = await getChannelSettings(db as never, 'unknown_type')
      expect(settings).toEqual({
        dashboard: true,
        email: false,
        alimtalk: false,
        push: true,
      })
    })

    it('DB throw 시 DEFAULT 반환 (graceful degradation)', async () => {
      const db = {
        prepare: vi.fn(() => {
          throw new Error('DB connection failed')
        }),
      }
      const settings = await getChannelSettings(db as never, 'new_order')
      expect(settings).toEqual({
        dashboard: true,
        email: false,
        alimtalk: false,
        push: true,
      })
    })
  })

  describe('dispatchNotification', () => {
    it('DB 미설정 (env 에 DB 없음) → 빈 결과 즉시 반환', async () => {
      const result = await dispatchNotification({} as never, 'new_order', {
        dashboard: { recipientType: 'admin', recipientId: '1', title: 't' },
      })
      expect(result.channels_attempted).toEqual([])
      expect(result.channels_succeeded).toEqual([])
      expect(result.channels_failed).toEqual([])
    })
  })
})
