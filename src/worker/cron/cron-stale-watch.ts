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
 * 통지 — 새 채널을 만들지 않고 `reportCronFailure` 를 재사용한다.
 *   severity 는 'warning' — 실패가 아니라 "안 돈 것 같다" 이므로.
 *
 * 🔴 **정정 (2026-08-04)**: 이 줄은 오래 *"cron_failures + 어드민 벨 + Discord"* 라고 적혀 있었는데
 *   **Discord 는 사실이 아니다.** `cron-reporter.ts` 는 console + `cron_failures` + `dashboard_notifications`
 *   **셋뿐**이다(그 파일 헤더가 스스로 그렇게 적고 있다). 즉 이 감시의 결과는 **전부 pull** 이고,
 *   대표가 어드민을 열지 않으면 영영 모른다. 실제로 유어애즈 레인 침묵이 그 상태였다 —
 *   `stale:ads:*` 가 `cron_failures` 에 쌓이는 동안 디스코드는 조용했다.
 *   ⚠️ 여기에 Discord 를 그냥 붙이지 **않는다**: 이 워커의 웹훅은 **유어딜 머니 경보 채널**이고,
 *   레인 하나하나를 12시간마다 쏘면 그 채널이 유어애즈 소음으로 덮인다. 유어애즈 침묵은
 *   **자기 채널로 일 1회 요약**해서 보낸다 → `worker-ads/silence-digest.ts`.
 *
 * 재알림 억제 — 같은 작업을 매시간 울리면 소음이 된다. 12시간에 한 번만.
 *   상태는 `platform_settings.cron_stale_alerts` 한 줄(JSON map)에 모아 둔다 — 이 작업이 유일한 writer 라 경합 없음.
 *
 * ⚠️ 한계(정직하게) — **자기 자신이 멈추면 이것도 못 알린다**(watchdog 의 고전적 한계).
 *   이 작업은 매시(`0 * * * *`)에 붙어 있어, 시간당 cron 자체가 죽으면 침묵한다.
 *   그 경우는 외부 관측(uptime 워크플로 / 사이트 다운)이 잡아야 한다.
 */
import { listCronHeartbeats, adsLanesPausedFrom, isPausedAdsBeat } from '../utils/cron-heartbeat'
import { classifyBeat, freshBaseNames } from '../utils/cron-beat-retirement'
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
  // 🪦 **은퇴/승계된 이름은 판정에서 뺀다** — 2026-08-04 에 만든 분류를 이 경로에도 적용한다.
  //
  //   그 수리는 `/api/_healthcheck/cron` 게이트에만 배선됐고 **여기엔 안 붙었다.** 그래서 사람에게
  //   실제로 닿는 채널(디스코드·`cron_failures`·어드민 벨)은 계속 유령을 신고하고 있었다 —
  //   2026-08-05 실측으로 24시간 `cron_failures` 의 `stale:*` 16건 중 대부분이 그것이었다:
  //   ```
  //     stale:ads:maintenance?phase=merge   79h   ← ads:maintenance 는 12분 전에 돌았다(승계)
  //     stale:ads:enrich-influencer-driver  58h   ← DO 알람 ads:enrich-influencer 가 인수(승계)
  //     stale:ads:sweep-kakao-phone        158h   ← sweep-kakao-chain 으로 개명(은퇴)
  //   ```
  //   ⚠️ 이게 나쁜 이유는 소음 자체가 아니라 **진짜를 덮기 때문**이다. 실제로 그 목록 안에 3일 멈춘
  //   레인 하나가 섞여 있었는데 유령 15건에 묻혀 있었다(같은 날 회전 오탐과 똑같은 병).
  //
  //   🔒 **지우는 게 아니다** — `retired`/`superseded` 만 빼고 판정 대상(`judge`)은 그대로 신고한다.
  //   판정 기준은 그 파일의 배수(8×)와 하한(24h)이라, 예산에 밀려 늦는 정상 레인은 숨지 않는다.
  const fresh = freshBaseNames(beats)
  // ⏸️ 유어애즈가 스위치로 멈춰 있으면(`ads:lanes-paused` 신선 + paused=true) `ads:*` 침묵은 신고하지 않는다 —
  //   표식 없이 멈춘 것과 구분한다(그건 여전히 경보다). 근거: `worker-ads/lane-pause.ts`.
  const adsPaused = adsLanesPausedFrom(beats)
  const stale = beats.filter(b =>
    b.stale === true && b.name !== SELF && !isPausedAdsBeat(b.name, adsPaused)
    && classifyBeat({ name: b.name, age_minutes: b.age_minutes, max_gap_min: b.max_gap_min }, fresh) === 'judge')

  // 🔴 2026-08-31 신설 — 이 감시가 못 보던 나머지 절반: **돌긴 하는데 아무것도 못 하는 것.**
  //
  //   위 판정은 "안 돌았다"(age)만 본다. 그런데 실제로 넉 달을 놓친 사고는 정반대 모양이었다:
  //   이미지 이관 cron 이 5분마다 **성실히 돌면서** `migrated=0` 을 반환했다. 바인딩이 없어서
  //   아무것도 못 한 건데, 하트비트에서는 "옮길 게 없었다"와 **글자 하나 다르지 않았다.**
  //   ok:true · age 정상 · stale=false → 이 감시가 볼 이유가 없었다.
  //
  //   ⇒ 이제 cron 이 **못 한 것을 못 했다고 말한다**(`skipped:'...'`). 그 한마디가 붙은 비트만
  //   고른다. 정상 회차는 이 필드를 아예 안 실으므로 **오탐이 구조적으로 0** 이고, 앞으로 만들
  //   어떤 cron 이든 같은 관례만 따르면 공짜로 감시된다.
  const blocked = beats.filter(b => b.name !== SELF && /(^|[\s,{])skipped[=:]/.test(b.result || ''))
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

  // 두 종류를 같은 억제 상태(12h)로 다룬다 — 알림 키가 다르므로 서로를 덮지 않는다.
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

  // 🚧 "돌긴 했는데 못 했다" — 알림 키를 `blocked:` 로 따로 둔다(같은 작업이 멈춤·차단 둘 다일 수
  //   있고, 키가 같으면 한쪽이 다른 쪽의 12h 억제에 묻힌다).
  for (const b of blocked) {
    const key = `blocked:${b.name}`
    const last = prev[key] ? Date.parse(prev[key]) : NaN
    if (Number.isFinite(last) && (now - last) < REALERT_HOURS * 3600_000) { next[key] = prev[key]!; continue }
    try {
      await reportCronFailure(
        env,
        key,
        new Error(
          `cron '${b.name}' 이(가) 돌긴 했지만 아무 일도 못 했습니다 — ${b.result}. `
          + '바인딩·게이트를 확인하세요. 실행은 성공으로 기록되므로 멈춤 감시로는 안 잡힙니다.',
        ),
        { job: b.name, cron: b.cron, last_run_at: b.at, result: b.result },
        'warning',
      )
      alerted.push(key)
      next[key] = new Date(now).toISOString()
    } catch { /* 통지 실패는 삼킨다 — 다음 회차 재시도 */ }
  }

  // 지금 정상으로 돌아온 작업은 상태에서 빼 둔다(다시 멈추면 즉시 알리도록).
  try {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(ALERT_STATE_KEY, JSON.stringify(next).slice(0, 4000)).run()
  } catch { /* fail-soft */ }

  return { checked: beats.length, alerted }
}
