/** 🏭 distributor-admin: BIZ-7 등급 자동화(GMV 기반 auto-grade) 설정 + 수동 실행 (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { DEFAULT_PLATFORM_COMMISSION_PCT } from '../wholesale-settlement'
import {
  evaluateWholesaleGrades,
  parseThresholds,
  DEFAULT_THRESHOLDS,
  AUTO_GRADE_ENABLED_KEY,
  AUTO_GRADE_THRESHOLDS_KEY,
  AUTO_GRADE_WINDOW_DAYS_KEY,
  AUTO_GRADE_LAST_RUN_KEY,
  type ThresholdRow,
} from '@/worker/cron/wholesale-grade-eval'
import { PLUS_FEE_KEY, DEFAULT_PLUS_ANNUAL_FEE } from '../wholesale-plus.routes'
import type { Env } from './helpers'

// ── 🏭 BIZ-7 (2026-06-08) 등급 자동화 (GMV 기반 auto-grade) 설정 + 수동 실행 ──────
//   cron(wholesale-grade-eval) 과 platform_settings 키를 공유. 가격 산식 불변 — distributor_grade 만 자동 승급.
//   설계: 승급 전용(promote-only). 자동 강등은 v1 없음(수동 PATCH /distributors/:id 으로만).

async function readSettingRaw(DB: D1Database, key: string): Promise<string | null> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(key).first<{ value: string }>().catch(() => null)
  return row?.value ?? null
}

async function writeSettingRaw(DB: D1Database, key: string, value: string): Promise<void> {
  await DB.prepare(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(key, value).run()
}

export function registerAutoGradeRoutes(app: Hono<{ Bindings: Env }>) {
  // GET /auto-grade/settings — enable 플래그 + 임계값 + 윈도우 + 마지막 실행시각
  app.get('/auto-grade/settings', async (c) => {
    try {
      const DB = c.env.DB
      const [enabledRaw, thresholdsRaw, windowRaw, lastRun, plusFeeRaw, commRaw] = await Promise.all([
        readSettingRaw(DB, AUTO_GRADE_ENABLED_KEY),
        readSettingRaw(DB, AUTO_GRADE_THRESHOLDS_KEY),
        readSettingRaw(DB, AUTO_GRADE_WINDOW_DAYS_KEY),
        readSettingRaw(DB, AUTO_GRADE_LAST_RUN_KEY),
        readSettingRaw(DB, PLUS_FEE_KEY),
        readSettingRaw(DB, 'wholesale_platform_commission_pct'),
      ])
      const enabled = enabledRaw === '1' || enabledRaw === 'true'
      const thresholds = parseThresholds(thresholdsRaw)
      const w = Number(windowRaw)
      const windowDays = Number.isFinite(w) && w >= 1 && w <= 365 ? Math.floor(w) : 90
      const pf = Math.floor(Number(plusFeeRaw))
      const plusAnnualFee = Number.isFinite(pf) && pf > 0 ? pf : DEFAULT_PLUS_ANNUAL_FEE
      const pc = Number(commRaw)
      const platformCommissionPct = Number.isFinite(pc) && pc >= 0 && pc <= 90 ? pc : DEFAULT_PLATFORM_COMMISSION_PCT
      return c.json({
        success: true,
        enabled,
        thresholds,        // [{ grade, min_gmv }] (min_gmv 내림차순)
        window_days: windowDays,
        plus_annual_fee: plusAnnualFee, // 🏅 프로 연 구독료(원) — 0 이하/미설정이면 기본 1,000,000
        platform_commission_pct: platformCommissionPct, // 🆕 플랫폼 수수료율(%) — 공급가에 포함된 플랫폼 마진. 기본 10.
        last_run: lastRun, // ISO 또는 null (한 번도 안 돌면)
        defaults: DEFAULT_THRESHOLDS,
      })
    } catch (err) {
      return safeError(c, err, '자동등급 설정 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // PATCH /auto-grade/settings — enable / 임계값 / 윈도우 갱신 (검증 + 감사)
  app.patch('/auto-grade/settings', async (c) => {
    try {
      const DB = c.env.DB
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))

      // 변경 전 값 캡처 (감사 before).
      const [prevEnabled, prevThresholds, prevWindow] = await Promise.all([
        readSettingRaw(DB, AUTO_GRADE_ENABLED_KEY),
        readSettingRaw(DB, AUTO_GRADE_THRESHOLDS_KEY),
        readSettingRaw(DB, AUTO_GRADE_WINDOW_DAYS_KEY),
      ])

      const stmts: D1PreparedStatement[] = []
      const after: Record<string, unknown> = {}

      if (body.enabled !== undefined) {
        const en = body.enabled === true || body.enabled === 1 || body.enabled === '1' || body.enabled === 'true' ? '1' : '0'
        stmts.push(DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(AUTO_GRADE_ENABLED_KEY, en))
        after.enabled = en === '1'
      }

      if (body.thresholds !== undefined) {
        // 클라이언트가 배열 또는 JSON 문자열로 보낼 수 있음 → 정규화 후 검증.
        let arr: unknown = body.thresholds
        if (typeof arr === 'string') { try { arr = JSON.parse(arr) } catch { return c.json({ success: false, error: '임계값 JSON 형식 오류' }, 400) } }
        if (!Array.isArray(arr)) return c.json({ success: false, error: '임계값은 배열이어야 합니다' }, 400)
        const ALLOWED = new Set(['A', 'B', 'C', 'D'])
        const clean: ThresholdRow[] = []
        const seen = new Set<string>()
        for (const r of arr as Array<Record<string, unknown>>) {
          const grade = String(r?.grade ?? '').toUpperCase()
          const minGmv = Number(r?.min_gmv)
          if (!ALLOWED.has(grade)) return c.json({ success: false, error: `등급은 A/B/C/D 만 가능합니다 (받음: ${grade || '빈값'})` }, 400)
          if (seen.has(grade)) return c.json({ success: false, error: `등급 ${grade} 가 중복되었습니다` }, 400)
          if (!Number.isFinite(minGmv) || minGmv < 0 || minGmv > 100_000_000_000) {
            return c.json({ success: false, error: `${grade}등급 최소 GMV 값이 올바르지 않습니다` }, 400)
          }
          seen.add(grade)
          clean.push({ grade, min_gmv: Math.floor(minGmv) })
        }
        if (!clean.length) return c.json({ success: false, error: '최소 1개 이상의 등급 임계값이 필요합니다' }, 400)
        clean.sort((a, b) => b.min_gmv - a.min_gmv)
        const json = JSON.stringify(clean)
        stmts.push(DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(AUTO_GRADE_THRESHOLDS_KEY, json))
        after.thresholds = clean
      }

      if (body.window_days !== undefined) {
        const w = Math.floor(Number(body.window_days))
        if (!Number.isFinite(w) || w < 1 || w > 365) return c.json({ success: false, error: '집계 기간(일)은 1~365 사이여야 합니다' }, 400)
        stmts.push(DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(AUTO_GRADE_WINDOW_DAYS_KEY, String(w)))
        after.window_days = w
      }

      // 🏅 프로 연 구독료 — 1,000 ~ 1,000만원. 0/미설정이면 기본값 적용(엔드포인트 fallback).
      if (body.plus_annual_fee !== undefined) {
        const f = Math.floor(Number(body.plus_annual_fee))
        if (!Number.isFinite(f) || f < 1000 || f > 10_000_000) return c.json({ success: false, error: '프로 연 구독료는 1,000원 ~ 1,000만원 사이여야 합니다' }, 400)
        stmts.push(DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(PLUS_FEE_KEY, String(f)))
        after.plus_annual_fee = f
      }

      // 🆕 2026-06-16 플랫폼 수수료율(%) — 공급가에 포함된 플랫폼 마진. 0~90. 제조사=공급가×(1−이값)(원가 하한), 플랫폼=공급가×이값.
      if (body.platform_commission_pct !== undefined) {
        const pc = Number(body.platform_commission_pct)
        if (!Number.isFinite(pc) || pc < 0 || pc > 90) return c.json({ success: false, error: '플랫폼 수수료율은 0~90% 사이여야 합니다' }, 400)
        stmts.push(DB.prepare(
          `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind('wholesale_platform_commission_pct', String(pc)))
        after.platform_commission_pct = pc
      }

      if (!stmts.length) return c.json({ success: false, error: '변경할 내용이 없습니다 (enabled / thresholds / window_days / plus_annual_fee / platform_commission_pct)' }, 400)
      await DB.batch(stmts)

      await writeAuditLog(c, {
        action: 'wholesale_auto_grade_settings_change',
        targetType: 'platform_settings',
        targetId: 'wholesale_auto_grade',
        before: {
          enabled: prevEnabled === '1' || prevEnabled === 'true',
          thresholds: parseThresholds(prevThresholds),
          window_days: prevWindow,
        },
        after,
      }).catch(() => { /* audit 실패해도 성공 처리 */ })

      return c.json({ success: true, ...after })
    } catch (err) {
      return safeError(c, err, '자동등급 설정 저장 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // POST /auto-grade/run — 수동 트리거 ("지금 평가 실행"). cron 과 동일 평가함수 호출 (force=true).
  //   rate-limited — 무거운 배치라 짧은 시간 연타 방지.
  app.post('/auto-grade/run', rateLimit({ action: 'wholesale-auto-grade-run', max: 5, windowSec: 60 }), async (c) => {
    try {
      const result = await evaluateWholesaleGrades(c.env, true)
      await writeAuditLog(c, {
        action: 'wholesale_auto_grade_manual_run',
        targetType: 'platform_settings',
        targetId: 'wholesale_auto_grade',
        before: null,
        after: { evaluated: result.evaluated, promoted: result.promoted, window_days: result.windowDays },
      }).catch(() => { /* audit 실패해도 성공 처리 */ })
      return c.json({ success: true, ...result })
    } catch (err) {
      return safeError(c, err, '자동등급 수동 실행 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
