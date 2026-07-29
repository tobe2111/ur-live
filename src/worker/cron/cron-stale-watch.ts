/**
 * 🚨 cron 멈춤 감시 — "안 돌았다"를 **알려준다** (2026-07-28 신설)
 *
 * 하트비트(#826)가 "안 돌았다"를 *보이게* 만들었다면, 이 작업은 그걸 *알려준다*.
 * 어드민 화면을 누가 열어봐야만 아는 상태로는 오늘 같은 사고(07-26~07-28 무음 정지)가 반복된다.
 *
 * 판정 — 손으로 관리하는 주기 표를 두지 않는다(68개짜리 표는 금방 낡는다).
 *   하트비트에 함께 저장된 **실행 당시 cron 식**으로 기대 주기를 계산한다(expectedMaxAgeMinutes).
 *   기준은 기대주기 × 2 + 30분 — 배포·지연으로 한두 번 밀리는 것까지 울리면 아무도 안 보게 된다.
 *
 * 통지 — 새 채널을 만들지 않고 `reportCronFailure`(cron_failures + 어드민 벨 + Discord)를 재사용한다.
 *   severity 는 'warning' — 실패가 아니라 "안 돈 것 같다" 이므로.
 *
 * 재알림 억제 — 같은 작업을 매시간 울리면 소음이 된다. 12시간에 한 번만.
 *   상태는 `platform_settings.cron_stale_alerts` 한 줄(JSON map)에 모아 둔다 — 이 작업이 유일한 writer 라 경합 없음.
 *
 * ⚠️ 한계(정직하게) — **자기 자신이 멈추면 이것도 못 알린다**(watchdog 의 고전적 한계).
 *   이 작업은 매시(`0 * * * *`)에 붙어 있어, 시간당 cron 자체가 죽으면 침묵한다.
 *   그 경우는 외부 관측(uptime 워크플로 / 사이트 다운)이 잡아야 한다.
 */
import { listCronHeartbeats } from '../utils/cron-heartbeat'
import { reportCronFailure } from '../utils/cron-reporter'
import type { Env } from '../types/env'

const ALERT_STATE_KEY = 'cron_stale_alerts'
const REALERT_HOURS = 12

/** 이 감시 작업 자신은 판정에서 제외(자기 하트비트로 자신을 경보하는 것은 의미 없음). */
const SELF = 'cron-stale-watch'

export async function handleCronStaleWatch(env: Env): Promise<{ checked: number; alerted: string[] }> {
  const DB = (env as unknown as { DB?: D1Database }).DB
  if (!DB) return { checked: 0, alerted: [] }

  const beats = await listCronHeartbeats(DB)
  const stale = beats.filter(b => b.stale === true && b.name !== SELF)
  if (!beats.length) return { checked: 0, alerted: [] }

  // 이전 알림 시각 (없거나 깨졌으면 빈 맵 — 처음이면 알린다)
  let prev: Record<string, string> = {}
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(ALERT_STATE_KEY).first<{ value: string }>()
    if (row?.value) prev = JSON.parse(row.value) as Record<string, string>
  } catch { /* 상태 유실 시 최대 1회 중복 알림 — 침묵보다 낫다 */ }

  const now = Date.now()
  const alerted: string[] = []
  const next: Record<string, string> = {}

  for (const b of stale) {
    const last = prev[b.name] ? Date.parse(prev[b.name]) : NaN
    const recentlyAlerted = Number.isFinite(last) && (now - last) < REALERT_HOURS * 3600_000
    if (recentlyAlerted) { next[b.name] = prev[b.name]!; continue }

    const hours = b.age_minutes != null ? Math.round(b.age_minutes / 60) : null
    try {
      await reportCronFailure(
        env,
        `stale:${b.name}`,
        new Error(
          `cron '${b.name}' 이(가) ${hours != null ? `${hours}시간` : '오래'} 실행되지 않았습니다`
          + `${b.cron ? ` (등록 주기 '${b.cron}')` : ''}. 마지막 실행 ${b.at ?? '기록 없음'}.`,
        ),
        { job: b.name, cron: b.cron, last_run_at: b.at, age_minutes: b.age_minutes },
        'warning',
      )
      alerted.push(b.name)
      next[b.name] = new Date(now).toISOString()
    } catch {
      // 통지 실패는 삼킨다 — 다음 회차에 다시 시도된다(상태를 안 남기므로).
    }
  }

  // 지금 정상으로 돌아온 작업은 상태에서 빼 둔다(다시 멈추면 즉시 알리도록).
  try {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(ALERT_STATE_KEY, JSON.stringify(next).slice(0, 4000)).run()
  } catch { /* fail-soft */ }

  return { checked: beats.length, alerted }
}
