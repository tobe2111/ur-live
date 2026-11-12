/**
 * 🎛️ 손님 설정을 한 탭에 한 번만 받는다 (2026-11-12 대표 "응 그렇게 해줘" — 지도 첫 화면의 `/api/consumer-settings` ×2).
 * ⚠️ 못 보는 것: 실제 브라우저의 요청 수 — 그건 `check-duplicate-fetch.mjs`(CI `dup`)가 렌더해서 센다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { loadConsumerSettings, __resetConsumerSettingsForTest } from '@/lib/consumer-settings'

beforeEach(() => __resetConsumerSettingsForTest())

describe('손님 설정 한 번만', () => {
  it('두 곳이 동시에 불러도 요청은 하나', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: { shell_sw_enabled: false, map_highlight_discount_pct: 40 } })))
    vi.stubGlobal('fetch', f)
    const [a, b] = await Promise.all([loadConsumerSettings(), loadConsumerSettings()])
    expect(f).toHaveBeenCalledTimes(1)
    expect(a?.map_highlight_discount_pct).toBe(40)
    expect(b).toBe(a)
    vi.unstubAllGlobals()
  })
  it('실패하면 null — 부르는 쪽이 기본값을 쓴다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await loadConsumerSettings()).toBeNull()
    vi.unstubAllGlobals()
  })
  it('서비스 워커와 지도가 둘 다 이 모듈을 쓴다(직접 부르지 않는다)', () => {
    for (const p of ['src/lib/shell-sw.ts', 'src/pages/restaurant-map/useKakaoMap.ts']) {
      const s = readFileSync(p, 'utf8')
      expect(s, p).toContain('loadConsumerSettings')
      expect(stripComments(s), p).not.toMatch(/['"`]\/api\/consumer-settings/)
    }
  })
})
