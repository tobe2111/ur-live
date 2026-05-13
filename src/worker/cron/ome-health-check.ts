/**
 * OME (OvenMediaEngine) Health Check Cron
 *
 * 🛡️ 2026-05-13 (안정성 #3): 송출 인프라 단일 장애점 (SPOF) 감지.
 *   우리 자체 미디어 서버 OME 가 다운되면 모든 라이브 송출 중단.
 *   5분 cron 으로 OME API endpoint health 확인 → down 시 어드민에 알람.
 *
 * 알람 채널:
 *   - admin_alerts 테이블에 INSERT → AdminLiveMonitorPage 에서 폴링 시 표시
 *   - 비용 0 (cron 자체 free tier)
 *
 * Health check logic:
 *   - OME 의 /v1/stats/current API 호출 (가벼운 endpoint)
 *   - 응답 timeout 10s
 *   - 2회 연속 실패 → ALERT (flapping 방지)
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

const HEALTH_TIMEOUT_MS = 10_000
const ALERT_THROTTLE_MIN = 15  // 같은 알람 15분 이내 중복 차단

/** OME 가 down 상태일 때 ALERT 생성 (15분 throttle). */
async function ensureAdminAlert(env: Env, kind: string, title: string, body: string) {
  try {
    // admin_alerts 테이블 ensure (lazy create)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        resolved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    // 같은 kind 의 미해결 알람이 15분 이내에 있으면 skip
    const recent = await env.DB.prepare(`
      SELECT id FROM admin_alerts
      WHERE kind = ? AND resolved = 0 AND created_at > datetime('now', '-${ALERT_THROTTLE_MIN} minutes')
      LIMIT 1
    `).bind(kind).first()
    if (recent) return
    await env.DB.prepare(`
      INSERT INTO admin_alerts (kind, title, body) VALUES (?, ?, ?)
    `).bind(kind, title, body).run()
    logInfo(`[cron:ome-health] ALERT inserted: ${kind} — ${title}`)
  } catch (err) {
    logError('[cron:ome-health] ensureAdminAlert failed', { error: (err as Error).message })
  }
}

/** OME 가 정상 복귀 시 미해결 알람 resolved 처리. */
async function resolveAdminAlerts(env: Env, kind: string) {
  try {
    await env.DB.prepare(`
      UPDATE admin_alerts SET resolved = 1 WHERE kind = ? AND resolved = 0
    `).bind(kind).run()
  } catch { /* admin_alerts 없으면 skip */ }
}

/** 실패 카운터 — 2회 연속 fail 만 alert (transient flake 보호). */
async function getFailureCounter(env: Env): Promise<number> {
  try {
    const r = await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ome_health_state (k TEXT PRIMARY KEY, v INTEGER, updated_at DATETIME);
    `).run()
    void r
    const row = await env.DB.prepare(`SELECT v FROM ome_health_state WHERE k = 'fail_count'`).first<{ v: number }>()
    return row?.v ?? 0
  } catch { return 0 }
}

async function setFailureCounter(env: Env, n: number): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO ome_health_state (k, v, updated_at) VALUES ('fail_count', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = CURRENT_TIMESTAMP
    `).bind(n).run()
  } catch { /* ignore */ }
}

export async function handleOmeHealthCheck(env: Env): Promise<void> {
  if (!env.OME_HOST || !env.OME_API_TOKEN) return  // OME 미설정 환경 skip

  const apiBase = `http://${env.OME_HOST}:8081/v1`
  const auth = btoa(env.OME_API_TOKEN)
  let isHealthy = false
  let errorMsg = ''

  try {
    const res = await fetch(`${apiBase}/stats/current`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    isHealthy = res.ok
    if (!isHealthy) errorMsg = `HTTP ${res.status}`
  } catch (err) {
    errorMsg = (err as Error).message || 'fetch failed'
  }

  const prev = await getFailureCounter(env)
  if (isHealthy) {
    if (prev > 0) {
      // 복귀 — 알람 resolve + counter reset
      await setFailureCounter(env, 0)
      await resolveAdminAlerts(env, 'ome_down')
      logInfo('[cron:ome-health] OME recovered')
    }
    return
  }

  // 실패
  const newCount = prev + 1
  await setFailureCounter(env, newCount)
  logError('[cron:ome-health] OME health check failed', { count: newCount, error: errorMsg })

  if (newCount >= 2) {
    // 2회 연속 fail → 알람
    await ensureAdminAlert(
      env,
      'ome_down',
      'OME 미디어 서버 응답 없음',
      `OME (${env.OME_HOST}) health check ${newCount}회 연속 실패. 송출 장애 가능성 — 즉시 확인 필요. 마지막 에러: ${errorMsg}`
    )
  }
}
