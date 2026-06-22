/** 🏭 distributor-admin: 플랫폼 사업자정보 + 채널 임계 공급률 (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { SUPPLY_CHANNELS, SUPPLY_CHANNEL_THRESHOLDS_KEY, parseChannelThresholds } from '@/shared/supply-channels'
import { COMPANY_KEYS, type Env } from './helpers'

export function registerSettingsRoutes(app: Hono<{ Bindings: Env }>) {
  app.get('/company-info', async (c) => {
    try {
      const ph = COMPANY_KEYS.map(() => '?').join(',')
      const { results } = await c.env.DB.prepare(`SELECT key, value FROM platform_settings WHERE key IN (${ph})`)
        .bind(...COMPANY_KEYS).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
      const company: Record<string, string> = {}
      for (const r of results || []) company[r.key] = r.value
      return c.json({ success: true, company })
    } catch (err) {
      return safeError(c, err, '사업자정보 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  app.put('/company-info', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
      // 형식 검증 — 세금계산서 다운스트림 깨짐 방지. (값이 있을 때만 검사)
      const bizNum = body.company_business_number != null ? String(body.company_business_number).trim() : null
      if (bizNum && !/^\d{3}-?\d{2}-?\d{5}$/.test(bizNum)) {
        return c.json({ success: false, error: '사업자등록번호 형식 오류 (000-00-00000)' }, 400)
      }
      const email = body.company_email != null ? String(body.company_email).trim() : null
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return c.json({ success: false, error: '이메일 형식 오류' }, 400)
      }
      const stmts = COMPANY_KEYS.filter(k => k in body).map(k =>
        c.env.DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(k, String(body[k] ?? '').slice(0, 200)))
      if (stmts.length) await c.env.DB.batch(stmts)
      return c.json({ success: true, saved: stmts.length })
    } catch (err) {
      return safeError(c, err, '사업자정보 저장 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 🏭 2026-06-12 (영업단 제안): 공급 채널 안내 기준 — 채널별 임계 공급률(%) 조회/저장.
  //   제조사 등록 폼의 "제안 가능 유통채널" 안내에 사용. 표시 전용(결제가/visibility 무영향).
  //   임계값 하드코딩 금지 룰 — platform_settings 저장, 영업단(어드민)이 조정.
  app.get('/channel-thresholds', async (c) => {
    try {
      const row = await c.env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
        .bind(SUPPLY_CHANNEL_THRESHOLDS_KEY).first<{ value: string }>().catch(() => null)
      return c.json({ success: true, thresholds: parseChannelThresholds(row?.value), is_default: !row })
    } catch (err) {
      return safeError(c, err, '채널 기준 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  app.put('/channel-thresholds', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
      const next: Record<string, number> = {}
      for (const ch of SUPPLY_CHANNELS) {
        const v = Number(body[ch.key])
        if (!Number.isFinite(v) || v < 1 || v > 100) {
          return c.json({ success: false, error: `${ch.label} 임계 공급률은 1~100 사이여야 합니다` }, 400)
        }
        next[ch.key] = Math.round(v * 10) / 10
      }
      await c.env.DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(SUPPLY_CHANNEL_THRESHOLDS_KEY, JSON.stringify(next)).run()
      return c.json({ success: true, thresholds: next })
    } catch (err) {
      return safeError(c, err, '채널 기준 저장 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
