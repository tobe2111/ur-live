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

/** 마지막으로 '침묵 있음'을 알린 시각(ISO). 빈 값 = 직전이 조용했음. */
export const SILENCE_ALERT_KEY = 'ads_silence_digest_at'
/** 재알림 간격 — 하루. 같은 상태로 여러 번 울리지 않는다. */
export const DIGEST_INTERVAL_H = 24

export interface SilentLane {
  name: string
  age_min: number
  gap_min: number
}

/**
 * 침묵 레인 추리기 — **순수함수**(유닛으로 고정).
 *
 * ⚠️ `ads:` 접두만 본다. 유어딜 본체 cron 은 이 채널의 관심사가 아니고, 섞으면 두 서비스의
 *   할 일이 한 목록에 섞이는 사고(`CLAUDE.md` 서비스 분리 절)를 경보에서 재현하게 된다.
 * ⚠️ 나이 큰 순으로 정렬 — 잘릴 때 **오래된 것이 남아야** 한다(짧게 자르는 건 표시 상한 때문이다).
 */
export function pickSilentLanes(
  beats: ReadonlyArray<{ name: string; age_minutes?: number | null; max_gap_min?: number | null; stale?: boolean | null }>,
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
    out.push({ name: b.name, age_min: Math.round(age), gap_min: Math.round(gap) })
  }
  return out.sort((a, b) => b.age_min - a.age_min)
}

/** 사람이 읽는 한 줄. 시간 단위는 KST 표기와 무관한 *경과*라 그대로 쓴다. */
function line(l: SilentLane): string {
  const h = l.age_min / 60
  const age = h >= 24 ? `${(h / 24).toFixed(1)}일` : `${h.toFixed(1)}시간`
  return `• ${l.name} — ${age}째 침묵 (임계 ${Math.round(l.gap_min / 60)}시간)`
}

/**
 * 하루 1회 침묵 요약. **절대 throw 하지 않는다** — 경보가 레인을 죽이면 본말전도다.
 *
 * @returns 무엇을 했는지(테스트·하트비트 요약용). 보낸 게 없으면 `sent: false`.
 */
export async function runAdsSilenceDigest(env: Env): Promise<{ silent: number; sent: boolean; recovered: boolean }> {
  const out = { silent: 0, sent: false, recovered: false }
  try {
    const DB = (env as unknown as { DB?: D1Database }).DB
    const webhook = (env as unknown as { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
    if (!DB || !webhook) return out

    const silent = pickSilentLanes(await listCronHeartbeats(DB))
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
