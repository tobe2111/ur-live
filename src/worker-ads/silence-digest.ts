/**
 * 🔔 **유어애즈 침묵 요약 — 하루 한 번, 자기 채널로** (2026-08-04 신설)
 *
 * ## 왜 (대표 질문: "다른 축 알림도 안 오는지 알려줘")
 * 실측 결과 **안 옵니다** 였다. 유어애즈에서 디스코드로 가는 건 4개뿐이고(수집 경보/회복 · 시트 동기화
 * 실패 · 팔로업 · 입장 요청), **B2B 29개 레인·정비·측정 레인은 죽어도 조용**했다. 침묵 감시
 * (`cron-stale-watch`)는 있었지만 그 결과는 `cron_failures` + 어드민 벨 — **전부 pull** 이다.
 *
 * 그 사이 실제로 이런 일이 있었다:
 * ```
 *   ads:sheets-sync           Worker exceeded CPU time limit.  ×16
 *   ads:reclassify-company    Worker exceeded CPU time limit.  ×9
 *   ads:collect-company       Worker exceeded CPU time limit.  ×6
 * ```
 * 전부 기록은 남았고 아무도 몰랐다.
 *
 * ## 설계 — 소음이 되지 않는 것이 이 파일의 절반이다
 * 오늘 하루에 **꺼질 수 없는 경보 두 건**을 고쳤다(순환 임계 · 은퇴 하트비트). 그래서 새 경보를 만들 때
 * 같은 병을 안 만드는 게 요구사항이다:
 *
 * 1. **일 1회만.** 레인별 12시간 재알림은 29개 레인이면 하루 수십 발이다 — 곧 안 읽힌다.
 * 2. **은퇴/인수된 이름 제외.** `cron-beat-retirement` 가 이미 가른 것을 그대로 쓴다(판정 두 벌 금지).
 * 3. **조용하면 아무것도 안 보낸다.** "정상입니다" 를 매일 보내면 그것도 소음이다.
 *    회복은 *직전에 울렸을 때만* 1회(수집 경보와 같은 관용구).
 * 4. **자기 채널로.** 이 워커의 `DISCORD_WEBHOOK_URL` = 유어애즈 채널. 메인 워커 웹훅은
 *    유어딜 머니 경보 채널이라 거기에 레인 소음을 섞지 않는다.
 *
 * ⚠️ **이 요약이 못 보는 것**: 워커가 통째로 죽으면 이 요약도 안 돈다(watchdog 의 고전적 한계).
 *   그 경우는 외부 프로브(`uptime.yml` → `/api/_healthcheck/cron`)가 잡는다 — 그래서 그 프로브의
 *   사이트-다운 판정을 cron 소음에서 **분리**하는 작업이 같은 PR 에 함께 있다.
 */
import type { Env } from '@/worker/types/env'
import { listCronHeartbeats } from '@/worker/utils/cron-heartbeat'
import { classifyBeat, freshBaseNames } from '@/worker/utils/cron-beat-retirement'
import { formatKSTShort } from '@/utils/date'

/** 마지막으로 '침묵 있음'을 알린 시각(ISO). 빈 값 = 직전이 조용했음. */
export const SILENCE_ALERT_KEY = 'ads_silence_digest_at'
/** 재알림 간격 — 하루. 같은 상태로 여러 번 울리지 않는다. */
export const DIGEST_INTERVAL_H = 24

/**
 * 🩸 **재표본 간격** — 이 요약은 **레인들과 같은 정각 회차**에 돈다(`gates.dailyAt(23)`, 워커의 유일한
 *   트리거가 매시 정각이다). 그런데 하트비트는 **묶어서 나중에 쓴다**(`beat-batch.ts` — 최대 대기
 *   `MAX_HOLD_MS` 3초 + 레인 자체 실행시간, 실측 최장 26초). 즉 요약이 스냅샷을 뜨는 순간
 *   **그 회차의 실행분은 아직 기록되지 않았다.**
 *
 *   2026-08-11 라이브 실측이 정확히 그 모습이었다:
 *   ```
 *     23:00:26Z 요약   ads:collect-maker  "3.0시간째 침묵"
 *     00:26Z   조회    ads:collect-maker  age 87분  → 마지막 실행 = 23:00Z (요약과 같은 회차)
 *   ```
 *   레인은 멈춘 적이 없다. **요약이 자기와 같은 회차를 못 본 것**이다.
 *   ⇒ 한 번의 순간값으로 지속 상태를 단정하지 않는다 — **두 번 떠서 둘 다 침묵인 것만** 신고한다.
 *   대기 중엔 CPU 를 안 쓰고(벽시계만), 이 요약은 일부러 한산한 회차에 있으므로 비용도 안전하다.
 */
export const RECHECK_DELAY_MS = 30_000

export interface SilentLane {
  name: string
  age_min: number
  gap_min: number
  /** 마지막 실행 시각(ISO, UTC). 사람에게는 KST 로 보여 준다 — 없으면 null. */
  at?: string | null
}

/**
 * 침묵 레인 추리기 — **순수함수**(유닛으로 고정).
 *
 * ⚠️ `ads:` 접두만 본다. 유어딜 본체 cron 은 이 채널의 관심사가 아니고, 섞으면 두 서비스의
 *   할 일이 한 목록에 섞이는 사고(`CLAUDE.md` 서비스 분리 절)를 경보에서 재현하게 된다.
 * ⚠️ 나이 큰 순으로 정렬 — 잘릴 때 **오래된 것이 남아야** 한다(짧게 자르는 건 표시 상한 때문이다).
 */
export function pickSilentLanes(
  beats: ReadonlyArray<{ name: string; age_minutes?: number | null; max_gap_min?: number | null; stale?: boolean | null; at?: string | null }>,
): SilentLane[] {
  const fresh = freshBaseNames(beats)
  const out: SilentLane[] = []
  for (const b of beats) {
    if (!String(b?.name || '').startsWith('ads:')) continue
    const age = Number(b.age_minutes), gap = Number(b.max_gap_min)
    if (!Number.isFinite(age) || !Number.isFinite(gap) || gap <= 0) continue
    if (age <= gap) continue
    // 은퇴/인수는 고장이 아니다 — 판정은 한 곳(`classifyBeat`)에서만 한다.
    if (classifyBeat({ name: b.name, age_minutes: age, max_gap_min: gap }, fresh) !== 'judge') continue
    out.push({ name: b.name, age_min: Math.round(age), gap_min: Math.round(gap), at: b.at ?? null })
  }
  return out.sort((a, b) => b.age_min - a.age_min)
}

/**
 * 경과 시간 문구. **반올림으로 임계를 왜곡하지 않는다.**
 *
 * 🩸 종전엔 임계를 `Math.round(gap/60)시간` 으로 찍었다. 임계 **150분**이 `Math.round(2.5)` = **3시간**
 *   으로 나와, 메시지가 *"3.0시간째 침묵 (임계 3시간)"* — **넘지도 않은 것처럼** 읽혔다(대표 신고
 *   2026-08-11 "알람이 부정확한가봐"). 경보가 자기 근거를 틀리게 말하면 다음부터 안 읽힌다.
 *   ⇒ 60분 미만은 분으로, 그 이상은 소수 한 자리로. 반올림 오차가 판정을 뒤집을 수 없게 한다.
 */
export function fmtDur(min: number): string {
  if (!Number.isFinite(min)) return '?'
  if (min < 60) return `${Math.round(min)}분`
  const h = min / 60
  return h >= 24 ? `${(h / 24).toFixed(1)}일` : `${h.toFixed(1)}시간`
}

/**
 * 사람이 읽는 한 줄. 경과는 *기간*이라 시간대와 무관하지만, **마지막 실행 시각은 KST 로 적는다**
 * (대표 보고는 KST 만 — `CLAUDE.md`). 그 한 조각이 있어야 "정말 멈춘 건가"를 메시지만 보고 판단한다.
 */
export function line(l: SilentLane): string {
  const last = l.at ? ` · 마지막 실행 ${formatKSTShort(l.at)}` : ''
  return `• ${l.name} — ${fmtDur(l.age_min)}째 침묵 (임계 ${fmtDur(l.gap_min)})${last}`
}

/**
 * 두 표본에서 **둘 다 침묵인 것만** 남긴다 — 순수함수(유닛으로 고정).
 *
 * ⚠️ 값은 **두 번째(더 최신) 표본**의 것을 쓴다. 첫 표본의 나이를 그대로 보고하면, 그 사이에 늘어난
 *   경우 낮게 말하고 줄어든 경우 높게 말한다 — 둘 다 "부정확한 알람"이다.
 * ⚠️ 교집합이지 합집합이 아니다. 합집합이면 재표본의 의미가 사라진다(한 번이라도 걸리면 신고).
 */
export function confirmSilent(first: readonly SilentLane[], second: readonly SilentLane[]): SilentLane[] {
  const firstNames = new Set(first.map(l => l.name))
  return second.filter(l => firstNames.has(l.name))
}

/** 대기 — 테스트에서 주입해 실제로 30초를 안 기다린다. */
type Sleep = (ms: number) => Promise<void>
const realSleep: Sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * 하루 1회 침묵 요약. **절대 throw 하지 않는다** — 경보가 레인을 죽이면 본말전도다.
 *
 * @returns 무엇을 했는지(테스트·하트비트 요약용). 보낸 게 없으면 `sent: false`.
 */
export async function runAdsSilenceDigest(env: Env, sleep: Sleep = realSleep): Promise<{ silent: number; sent: boolean; recovered: boolean }> {
  const out = { silent: 0, sent: false, recovered: false }
  try {
    const DB = (env as unknown as { DB?: D1Database }).DB
    const webhook = (env as unknown as { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
    if (!DB || !webhook) return out

    // 1차 표본. 비어 있으면 재표본이 필요 없다(있던 게 없어지진 않는다 — 판정은 보수적으로).
    const first = pickSilentLanes(await listCronHeartbeats(DB))
    // 🩸 **한 번 더 뜬다** — 이 요약은 레인들과 같은 회차에 돌고 하트비트는 늦게 쓰인다(RECHECK_DELAY_MS 주석).
    //   두 번째에서 사라진 레인은 "그 회차에 돌고 있던 것"이지 침묵이 아니다.
    let silent: SilentLane[] = []
    if (first.length) {
      await sleep(RECHECK_DELAY_MS)
      silent = confirmSilent(first, pickSilentLanes(await listCronHeartbeats(DB)))
    }
    out.silent = silent.length

    const prev = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(SILENCE_ALERT_KEY).first<{ value: string }>().catch(() => null)
    const prevAt = prev?.value ? Date.parse(prev.value) : NaN
    const now = Date.now()
    const { sendDiscordAlert } = await import('@/worker/utils/discord-alert')

    if (!silent.length) {
      // 회복은 **직전에 울렸을 때만** 1회 — "정상입니다"를 매일 보내면 그것도 소음이다.
      if (prev?.value) {
        await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
          .bind(SILENCE_ALERT_KEY, '').run().catch(() => null)
        await sendDiscordAlert(webhook, '유어애즈 레인 정상 재개', '침묵 중인 레인이 없습니다.', 'info').catch(() => null)
        out.recovered = true
      }
      return out
    }

    if (Number.isFinite(prevAt) && now - prevAt < DIGEST_INTERVAL_H * 3600_000) return out  // 하루 1회

    // 🔢 **원인을 추측으로 두지 않는다** — 같은 창의 CPU 한도 사망을 실제로 센다.
    //   종전 문안은 *"원인 후보: … CPU 한도"* 였는데, 그건 대표에게 **또 다른 확인 숙제**를 주는 것이다
    //   (오늘 고친 수집 경보가 정확히 그 실패였다 — 확인처만 알려 주고 그 확인처가 비어 있었다).
    //   D1 읽기 1회로 숫자를 붙이면 "유료 전환이 필요한가"를 이 메시지만 보고 판단할 수 있다.
    const cpu = await DB.prepare(`SELECT COUNT(*) AS n, COUNT(DISTINCT job_name) AS lanes
      FROM cron_failures
      WHERE created_at > datetime('now','-1 day')
        AND job_name LIKE 'ads:%' AND error_message LIKE '%CPU time limit%'`)
      .first<{ n: number; lanes: number }>().catch(() => null)
    const shown = silent.slice(0, 12)
    const body = [
      `⚠️ 유어애즈 레인 ${silent.length}개가 임계를 넘겨 침묵 중입니다.`,
      ...shown.map(line),
      silent.length > shown.length ? `… 외 ${silent.length - shown.length}개` : '',
      cpu && cpu.n > 0
        // 이게 있으면 원인은 예산 배분이 아니라 **플랫폼 천장**이다 — 코드로 못 푼다.
        ? `🔴 지난 24시간 CPU 한도 사망 **${cpu.n}회**(레인 ${cpu.lanes}종) — 부모 인보케이션이 자식을 끌고 죽는다. `
          + '레인 재배치로는 한계이고 Workers 유료 전환이 근본 해결이다.'
        : '원인 후보: 디스패치 예산에 밀림(CPU 한도 사망은 지난 24시간 0회).',
      '어드민 → 시스템 모니터링 → 게이트·하트비트 에서 상세 확인.',
    ].filter(Boolean).join('\n')
    await sendDiscordAlert(webhook, '유어애즈 레인 침묵 요약', body, 'warn').catch(() => null)
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(SILENCE_ALERT_KEY, new Date(now).toISOString()).run().catch(() => null)
    out.sent = true
    return out
  } catch { return out }   // fail-soft — 경보 실패가 레인을 막지 않는다
}
