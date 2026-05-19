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
  if (_done_ensureAdminAlert.has(env)) return
  _done_ensureAdminAlert.add(env)
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
  } else {
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
      // 🛡️ 2026-05-13: 진행 중 (status='live') 셀러에게도 알림 — OME 다운 시 셀러가 즉시 인지하고 대처
      try {
        const activeSellers = await env.DB.prepare(`
          SELECT DISTINCT seller_id, title FROM live_streams
          WHERE status = 'live' AND seller_id IS NOT NULL
          LIMIT 50
        `).all<{ seller_id: number; title: string }>()
        for (const s of activeSellers.results || []) {
          await env.DB.prepare(`
            INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
            SELECT (SELECT user_id FROM sellers WHERE id = ?), 'seller',
                   'ome_down_alert', '⚠️ 송출 서버 장애 가능성',
                   ?, '/seller/live-broadcast', CURRENT_TIMESTAMP
            WHERE NOT EXISTS (
              SELECT 1 FROM notifications
              WHERE user_id = (SELECT user_id FROM sellers WHERE id = ?)
                AND type = 'ome_down_alert'
                AND created_at > datetime('now', '-30 minutes')
            )
          `).bind(
            s.seller_id,
            `방송 송출 서버 응답 지연이 감지됐어요. "${s.title}" 라이브가 끊기면 새로 시작해주세요.`,
            s.seller_id,
          ).run().catch(() => { /* skip */ })
        }
      } catch (e) {
        logError('[cron:ome-health] seller alert insert failed', { error: (e as Error).message })
      }
    }
    return  // OME down 시 zombie 감지 skip
  }

  // 🛡️ 2026-05-13: 좀비 스트림 자동 정리 — stream 79 사고 (DB status='live' 인데 OME 에 stream 없음).
  //   시나리오: 셀러가 BrowserBroadcaster 시도 → WHIP admission 까지는 OK → 실제 stream 인입 실패 (ICE / 페이지 떠남).
  //             closing webhook 안 와서 DB 영영 'live' 좀비. iframe 검은 화면.
  //   감지 조건: status='live' AND started_at < (now - 5min) AND OME 에 해당 stream 없음
  //   조치: status='scheduled' 로 reset (셀러가 다시 송출 가능), last_error 기록, 알림 발송, OME push 정리
  try {
    const zombieCandidates = await env.DB.prepare(`
      SELECT id, seller_id, title, started_at FROM live_streams
      WHERE status = 'live'
        AND started_at IS NOT NULL
        AND datetime(started_at) < datetime('now', '-15 minutes')
      LIMIT 20
    `).all<{ id: number; seller_id: number; title: string; started_at: string }>()

    if (!zombieCandidates.results || zombieCandidates.results.length === 0) return

    // OME 의 현재 활성 stream 목록 1회 조회
    const streamsRes = await fetch(`http://${env.OME_HOST}:8081/v1/vhosts/default/apps/app/streams`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    const streamsData = streamsRes.ok ? await streamsRes.json() as { response?: string[] } : { response: [] }
    const liveOmeStreams = new Set(streamsData.response ?? [])

    for (const z of zombieCandidates.results) {
      const expectedName = `s${z.id}`
      if (liveOmeStreams.has(expectedName)) continue  // 실제 송출 중 — skip

      // 🛡️ 2026-05-13 v3 (사용자 정책): 자동 reset 제거. 어드민 강제 종료만 가능.
      //   대신 admin_alerts 에 INSERT → 어드민 대시보드 (/admin/youtube-quota) 에 노출.
      //   어드민이 보고 판단 후 강제 종료.
      logInfo(`[cron:ome-health] zombie suspect (admin 알림만) — stream ${z.id} (${z.title}) — DB live but no OME stream`)

      // admin_alerts 에 INSERT (15분 throttle — 같은 stream 중복 알림 방지)
      try {
        await env.DB.prepare(`
          INSERT INTO admin_alerts (kind, title, body, created_at)
          SELECT ?, ?, ?, CURRENT_TIMESTAMP
          WHERE NOT EXISTS (
            SELECT 1 FROM admin_alerts
            WHERE kind = ? AND resolved = 0
              AND created_at > datetime('now', '-15 minutes')
          )
        `).bind(
          `zombie_stream:${z.id}`,
          '좀비 의심 라이브 stream 감지',
          `Stream #${z.id} "${z.title}" — DB.status='live' 인데 OME 에 송출 신호 15분+ 없음. 어드민 대시보드에서 강제 종료 검토 필요.`,
          `zombie_stream:${z.id}`,
        ).run()
      } catch (e) {
        logError('[cron:ome-health] admin alert insert failed', { error: (e as Error).message })
      }
    }
  } catch (e) {
    logError('[cron:ome-health] zombie scan failed', { error: (e as Error).message })
  }
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureAdminAlert = new WeakSet<object>()
