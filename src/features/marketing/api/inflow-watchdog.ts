/**
 * 🐕 **유입량 감시** — "수집이 무너졌는데 아무도 몰랐다"를 구조적으로 끝내는 장치 (2026-08-18).
 *
 * ## 왜 (실측)
 * ```
 * 업체(B2B)  13,409(08-11) → 4,223(08-17)   −70%,  **6일간 아무 경보도 없었다**
 * 인플루언서  6,365(08-12) → 3,773(08-16)   −41%,  마찬가지
 * ```
 * 기존 경보(`collect-health-alert`)는 **인플루언서 전용**이고, 조건이
 * *"전 플랫폼 0건"* 또는 *"순환 정지"* 다. 위 두 하락은 **둘 다 아니었다** — 레인은 돌았고,
 * 건수도 0이 아니었다. 그냥 **반토막**이었을 뿐이라 경보가 울릴 수 없었다.
 * B2B 쪽은 아예 감시가 없었다.
 *
 * ⇒ 원인을 미리 알 수 없으므로 **증상을 직접 센다**: 하루 유입량이 자기 기준선 대비 얼마인가.
 *   다음에 무엇이 깨지든(내가 상상 못 한 원인이라도) 며칠이 아니라 몇 시간 안에 드러난다.
 *
 * ## 오경보를 피하는 세 가지 (이게 없으면 결국 무시당한다 = 감시 실패)
 * 1. **오늘을 뺀다.** 진행 중인 날은 항상 낮다 — 넣으면 매일 아침 경보가 울린다.
 * 2. **기준선은 중앙값.** 이 시스템의 일별 진폭은 **17배**다(CLAUDE.md 실측). 평균을 쓰면
 *    스파이크 하나가 기준선을 들어 올려 그 뒤 며칠이 전부 "하락"으로 보인다.
 * 3. **최근은 3일 평균.** 하루로 판정하면 정상 변동에 걸린다 — 이 세션이 사람으로서 저지른
 *    바로 그 실수(좁은 관측 창)를 기계에도 물려주지 않는다.
 *
 * ⚠️ **근거가 얇으면 침묵한다.** 기준선 일수가 모자라면 판정하지 않는다 — 새로 켠 축이나
 *   데이터가 끊긴 구간에서 "하락"을 외치면 그 경보는 신뢰를 잃는다.
 */

/** 하루치 표본. `d` 는 **KST 달력일**(`date(x,'+9 hours')`) 문자열. */
export interface InflowDay { d: string; n: number }

export type InflowLevel = 'ok' | 'warn' | 'down' | 'unknown'

export interface InflowVerdict {
  level: InflowLevel
  /** 최근/기준선. 근거가 없으면 null. */
  ratio: number | null
  recent: number
  baseline: number | null
  /** 사람이 읽는 판정 근거 — 경보 본문에 그대로 실린다. */
  reason: string
}

/** 최근 창(일). 하루로 보면 정상 변동에 걸린다. */
export const RECENT_DAYS = 3
/** 기준선 창(일). 중앙값을 쓰므로 홀수가 편하다. */
export const BASELINE_DAYS = 7
/** 이 아래면 '하락'. 반토막은 정상 변동으로 보기 어렵다. */
export const DOWN_RATIO = 0.5
/** 이 아래면 '주의'. */
export const WARN_RATIO = 0.7

const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * 날짜 구멍을 **0 으로 채운다.**
 *
 * 🩸 이게 없으면 **완전 정지를 못 잡는다** — 수집이 0이면 `GROUP BY` 결과에 그 날짜가 아예
 *   안 나오고, 그러면 최근 3일이 *예전 잘 되던 날들*로 채워져 판정이 "정상"이 된다.
 *   에러 없이 조용히 틀리는, 이 레포가 반복해 온 바로 그 모양이다.
 */
export function fillDays(rows: readonly InflowDay[], todayKst: string, span: number): InflowDay[] {
  const by = new Map(rows.map(r => [r.d, Number(r.n) || 0]))
  const base = Date.parse(`${todayKst}T00:00:00Z`)
  if (!Number.isFinite(base)) return []
  const out: InflowDay[] = []
  // 오늘(진행 중)은 제외하고 어제부터 과거로 span 일.
  for (let i = span; i >= 1; i--) {
    const d = new Date(base - i * 86_400_000).toISOString().slice(0, 10)
    out.push({ d, n: by.get(d) ?? 0 })
  }
  return out
}

/**
 * 유입량 판정. `days` 는 **오래된 → 최신** 순의 완전한 날짜열(구멍은 `fillDays` 가 0 으로 채운 것).
 *
 * ## 🩸 왜 기준선이 둘인가 — **서서히 새는 것은 창 비교를 빠져나간다**
 * 처음엔 "최근 3일 vs 직전 7일 중앙값" 하나였다. 그런데 실측 두 개를 넣어 보니 갈렸다:
 * ```
 * 업체   급락(6일 만에 −70%)   →  비율 34%   잡힌다
 * 인플루언서  완만한 하락        →  비율 76%   **못 잡는다**
 * ```
 * 이유는 단순하다 — **천천히 내려가면 기준선도 같이 내려간다.** 어제와 비교하면 어제도 나쁘다.
 * 그래서 **더 옛날(직전 창의 그 앞)** 과도 재고, **둘 중 나쁜 쪽**을 판정으로 쓴다.
 * 급락은 가까운 기준선이 잡고, 완만한 하락은 먼 기준선이 잡는다.
 *
 * ⚠️ 임계를 낮춰서 맞추지 **않았다.** 한 표본에 맞춰 임계를 흔들면 그건 과적합이고,
 *   오경보를 늘려 감시를 무력화한다. 고친 것은 임계가 아니라 **재는 방법**이다.
 */
export function judgeInflow(days: readonly InflowDay[]): InflowVerdict {
  if (days.length < RECENT_DAYS + BASELINE_DAYS) {
    return { level: 'unknown', ratio: null, recent: 0, baseline: null, reason: `근거 부족(${days.length}일)` }
  }
  const recent = days.slice(-RECENT_DAYS).reduce((a, r) => a + (Number(r.n) || 0), 0) / RECENT_DAYS
  const win = (from: number, to: number) => median(days.slice(from, to).map(r => Number(r.n) || 0))
  const near = win(-(RECENT_DAYS + BASELINE_DAYS), -RECENT_DAYS)
  // 먼 기준선은 있을 때만 — 없으면 가까운 것만으로 판정한다(근거 없이 더 엄해지지 않는다).
  const far = days.length >= RECENT_DAYS + BASELINE_DAYS * 2
    ? win(-(RECENT_DAYS + BASELINE_DAYS * 2), -(RECENT_DAYS + BASELINE_DAYS))
    : null
  // **높은 쪽**을 기준선으로 — 그래야 완만한 하락에서 비율이 실제 손실을 반영한다.
  const baseline = Math.max(near ?? 0, far ?? 0) || null
  // 기준선이 0 이면 비율이 무한대가 된다 — 원래 안 돌던 축이라 판정 대상이 아니다.
  if (baseline == null || baseline <= 0) {
    return { level: 'unknown', ratio: null, recent, baseline, reason: '기준선 0(원래 유입 없음)' }
  }
  const ratio = recent / baseline
  const level: InflowLevel = ratio < DOWN_RATIO ? 'down' : ratio < WARN_RATIO ? 'warn' : 'ok'
  const which = far != null && far > (near ?? 0) ? `${BASELINE_DAYS * 2}일 전` : `직전 ${BASELINE_DAYS}일`
  return {
    level, ratio, recent, baseline,
    reason: `최근 ${RECENT_DAYS}일 평균 ${Math.round(recent).toLocaleString()} / 기준선(${which} 중앙값) ${Math.round(baseline).toLocaleString()} = ${(ratio * 100).toFixed(0)}%`,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 실행부 — 축별로 재고, 무너졌으면 알리고, 회복하면 한 번 해제한다.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 감시 대상 축.
 * ⚠️ **B2B 가 여기 있는 것이 이 모듈의 존재 이유다** — 기존 경보는 인플루언서만 봤고,
 *   정작 −70% 로 무너진 건 B2B 였다.
 */
export const INFLOW_AXES = [
  { key: 'influencer', label: '인플루언서', table: 'ad_influencer_leads', col: 'collected_at', where: '' },
  { key: 'company', label: '업체(B2B)', table: 'ad_company_leads', col: 'collected_at', where: ' AND merged_into IS NULL' },
] as const

const STATE_KEY = 'ads_inflow_watch'        // { day: 'YYYY-MM-DD', alerts: { axis: 'warn' | 'down' } }
/** 조회 창 — 먼 기준선까지 덮으려면 두 배가 필요하다(`judgeInflow` docblock). */
const SPAN = RECENT_DAYS + BASELINE_DAYS * 2

interface WatchState { day?: string; alerts?: Record<string, InflowLevel> }

const readState = async (DB: D1Database): Promise<WatchState> => {
  const r = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATE_KEY)
    .first<{ value: string }>().catch(() => null)
  try { return r?.value ? JSON.parse(r.value) as WatchState : {} } catch { return {} }
}

/**
 * 축 하나의 최근 유입을 잰다. 실패하면 `null` — **모르는 것을 하락으로 보고하지 않는다.**
 */
export async function sampleAxis(DB: D1Database, axis: typeof INFLOW_AXES[number]): Promise<InflowVerdict | null> {
  // ⚠️ 오늘(KST)도 SQL 에서 받는다 — 워커 TZ 는 UTC 라 JS 로 만들면 9시간 어긋난다(CLAUDE.md 시각 룰).
  const rows = await DB.prepare(
    `SELECT date(${axis.col}, '+9 hours') AS d, COUNT(*) AS n, date('now', '+9 hours') AS today
       FROM ${axis.table}
      WHERE ${axis.col} >= datetime('now', '-${SPAN + 1} days')${axis.where}
      GROUP BY 1 ORDER BY 1`,
  ).all<{ d: string; n: number; today: string }>().catch(() => null)
  if (!rows) return null
  const list = rows.results || []
  // 행이 하나도 없으면 오늘 날짜를 모른다 → 판정 불가(침묵). 완전 정지는 아래 fillDays 가 0 으로 잡는다.
  const today = list[0]?.today
  if (!today) return null
  return judgeInflow(fillDays(list.map(r => ({ d: r.d, n: Number(r.n) || 0 })), today, SPAN))
}

/**
 * 하루 1회 판정 + Discord 경보(축별 중복 억제 · 회복 시 1회 해제).
 *
 * ⚠️ **fail-soft 전면** — 감시가 수집을 멈추게 하면 감시가 사고다. 어떤 실패도 바깥으로 안 던진다.
 * ⚠️ **하루 1회지만 매시간 시도**한다 — 일 1회 레인은 그 회차를 놓치면 그날이 통째로 비는데,
 *   이 레포는 그 사고를 이미 겪었다(`daily-batch` 주석). 매시간 들여다보고 날짜 도장으로 한 번만 판정한다.
 */
export async function maybeAlertInflow(env: { DISCORD_WEBHOOK_URL?: string }, DB: D1Database): Promise<{ ran: boolean; verdicts?: Record<string, InflowVerdict> }> {
  try {
    const st = await readState(DB)
    const todayRow = await DB.prepare("SELECT date('now','+9 hours') AS d").first<{ d: string }>().catch(() => null)
    const today = todayRow?.d
    if (!today) return { ran: false }
    if (st.day === today) return { ran: false }   // 오늘 이미 판정함

    const verdicts: Record<string, InflowVerdict> = {}
    const alerts = { ...(st.alerts || {}) }
    const lines: string[] = []
    let worst: InflowLevel = 'ok'
    // 🎯 **발송 가능 리드**(대표가 정한 유일한 지표)도 같은 판정을 받는다 — 총량이 늘어도 이게 안 늘면
    //   진척이 아니다. 누계 스냅샷의 증분으로 재므로 보강 지연에 안 속는다(위 docblock).
    const sendable = await judgeSendable(DB, today).catch(() => ({} as Record<string, InflowVerdict>))
    const axes: { key: string; label: string; v: InflowVerdict | null }[] = []
    for (const axis of INFLOW_AXES) axes.push({ key: axis.key, label: axis.label, v: await sampleAxis(DB, axis) })
    axes.push({ key: 'sendable_influencer', label: '발송가능(인플루언서)', v: sendable.sendable_influencer || null })
    axes.push({ key: 'sendable_company', label: '발송가능(업체)', v: sendable.sendable_company || null })
    for (const axis of axes) {
      const v = axis.v
      if (!v) continue
      verdicts[axis.key] = v
      const prev = alerts[axis.key]
      if (v.level === 'down' || v.level === 'warn') {
        // 🔕 **상태가 바뀔 때만 알린다.** 무너진 동안 매일 같은 경보를 보내면 그 채널은 곧 무시당하고,
        //   무시당한 감시는 없는 것과 같다. 악화(warn → down)는 새 정보라 다시 알린다.
        const escalated = prev !== v.level && !(prev === 'down' && v.level === 'warn')
        alerts[axis.key] = v.level
        if (!escalated) continue
        if (v.level === 'down') worst = 'down'
        else if (worst === 'ok') worst = 'warn'
        lines.push(`${v.level === 'down' ? '🔻' : '⚠️'} **${axis.label}** — ${v.reason}`)
      } else if (v.level === 'ok' && prev) {
        delete alerts[axis.key]
        lines.push(`✅ **${axis.label}** 회복 — ${v.reason}`)
      }
    }
    // 날짜 도장은 **경보 전송 여부와 무관하게** 찍는다(전송 실패로 매시간 재판정하면 그게 폭주다).
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(STATE_KEY, JSON.stringify({ day: today, alerts })).run().catch(() => null)

    // 🩺 **왜 줄었는지까지 실어 보낸다** — "줄었다"만 말하는 경보는 받는 사람에게 숙제를 넘기는 것이다.
    //   실패한 레인이 있을 때만 붙는다(정상이면 한 줄도 안 늘어난다).
    if (lines.length) {
      try {
        const { summarizeLaneHealth, reportLines } = await import('./lane-health-report')
        const bad = reportLines(await summarizeLaneHealth(DB))
        if (bad.length) lines.push('', '**레인 상태**', ...bad)
      } catch { /* 관측 실패가 경보를 막지 않는다 */ }
    }
    const webhook = env.DISCORD_WEBHOOK_URL
    if (webhook && lines.length) {
      // ⚠️ 상대경로 — 워커 런타임엔 `@/` alias 가 없다(2026-08-04 에 이 줄이 alias 라 경보가 못 나갔다).
      const { sendDiscordAlert } = await import('../../../worker/utils/discord-alert')
      lines.push('• 회차 수부터 볼 것 — 수확이 아니라 회차가 무너지는 것이 이 시스템의 실제 고장 모양이다.')
      await sendDiscordAlert(webhook, '유어애즈 유입량 경보', lines.join('\n'), worst === 'down' ? 'error' : 'warn')
        .catch(() => undefined)
    }
    return { ran: true, verdicts }
  } catch {
    return { ran: false }   // 감시가 수집을 못 멈추게 한다
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 🎯 **발송 가능 리드** — 대표가 정한 유일한 성공 지표를 직접 감시한다.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * ## 왜 총량 감시로는 부족한가 (2026-08-18 실측)
 * ```
 * 인플루언서  118,933 중 이메일  28,339 (23.8%)      측정은 96.5% 완료 — 병목이 아니다
 * 업체        334,949 중 이메일  38,914 (11.6%)      소스가 도메인을 안 줘 크롤 여지 1.3%
 * 수율 차이   youtube 38.3%  ·  naver_blog 22.9%  ·  webkr 27.3%  ·  commerce 13.2%
 * ```
 * ⇒ 총량이 늘어도 **발송 가능 리드는 안 늘 수 있다**(수율 낮은 축만 늘면). CLAUDE.md 가 못 박은
 *   *"총계로 진척을 보고하지 말 것 — 유일한 성공 지표는 제안 보낼 수 있는 리드 수"* 가 바로 이것이다.
 *
 * ## 🩸 왜 "수집일별 이메일 보유 건수"로 세면 안 되는가
 * 이메일은 **수집 이후에** 채워진다(측정·보강). 그래서 최근 며칠은 항상 낮아 보이고,
 * 그걸 그대로 재면 **매일 "하락" 경보가 뜬다** — 이 파일이 이미 한 번 피한 함정(오늘 제외)과 같은 모양이다.
 *
 * ⇒ 그래서 **날짜별 누계 스냅샷을 저장**하고, 그 **증분**을 본다. 언제 수집됐는지와 무관하게
 *   *"오늘 발송 가능 리드가 몇 개 늘었나"* 를 정확히 센다.
 */
const TOTALS_KEY = 'ads_sendable_totals'   // { 'YYYY-MM-DD': { influencer: n, company: n }, ... }
/** 보관 일수 — `judgeInflow` 가 먼 기준선까지 쓰려면 최근+기준선×2 만큼은 있어야 한다. */
export const TOTALS_KEEP_DAYS = SPAN + 2

export interface SendableTotals { influencer: number; company: number }

/** 저장된 일별 누계. 깨진 값은 빈 것으로 — 감시가 죽으면 안 된다. */
export function parseTotals(raw: string | null | undefined): Record<string, SendableTotals> {
  try {
    const o = raw ? JSON.parse(raw) : null
    return o && typeof o === 'object' && !Array.isArray(o) ? o as Record<string, SendableTotals> : {}
  } catch { return {} }
}

/** 오래된 날짜를 버린다 — 안 버리면 이 칸이 무한히 자란다. */
export function pruneTotals(all: Record<string, SendableTotals>, keep = TOTALS_KEEP_DAYS): Record<string, SendableTotals> {
  const days = Object.keys(all).sort().slice(-keep)
  const out: Record<string, SendableTotals> = {}
  for (const d of days) out[d] = all[d]
  return out
}

/**
 * 누계 시계열 → **증분** 시계열. 어제 값이 없는 날은 건너뛴다(증분을 지어내지 않는다).
 *
 * ⚠️ 음수 증분은 0 으로 — 반송 억제(`ad_email_suppress`)로 이메일이 비워지면 누계가 줄 수 있는데,
 *   그건 "발굴이 멈췄다"가 아니라 "정리했다"이다. 그걸 하락으로 세면 청소할 때마다 경보가 뜬다.
 */
export function totalsToDaily(all: Record<string, SendableTotals>, key: keyof SendableTotals): InflowDay[] {
  const days = Object.keys(all).sort()
  const out: InflowDay[] = []
  for (let i = 1; i < days.length; i++) {
    const prev = Number(all[days[i - 1]]?.[key]), cur = Number(all[days[i]]?.[key])
    if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue
    out.push({ d: days[i], n: Math.max(0, cur - prev) })
  }
  return out
}

/** 현재 누계를 잰다. 실패하면 null — 모르는 값을 0 으로 적으면 다음 날 증분이 거짓 급등이 된다. */
export async function readSendableTotals(DB: D1Database): Promise<SendableTotals | null> {
  const r = await DB.prepare(
    `SELECT (SELECT COUNT(*) FROM ad_influencer_leads WHERE email IS NOT NULL AND email <> '') AS influencer,
            (SELECT COUNT(*) FROM ad_company_leads WHERE merged_into IS NULL AND email IS NOT NULL AND email <> '') AS company`,
  ).first<SendableTotals>().catch(() => null)
  if (!r || !Number.isFinite(Number(r.influencer)) || !Number.isFinite(Number(r.company))) return null
  return { influencer: Number(r.influencer), company: Number(r.company) }
}

/** 오늘 누계를 기록하고, 증분 시계열로 두 축을 판정한다. */
export async function judgeSendable(DB: D1Database, today: string): Promise<Record<string, InflowVerdict>> {
  const cur = await readSendableTotals(DB)
  if (!cur) return {}
  const raw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(TOTALS_KEY)
    .first<{ value: string }>().catch(() => null)
  const all = pruneTotals({ ...parseTotals(raw?.value), [today]: cur })
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(TOTALS_KEY, JSON.stringify(all)).run().catch(() => null)
  return {
    sendable_influencer: judgeInflow(totalsToDaily(all, 'influencer')),
    sendable_company: judgeInflow(totalsToDaily(all, 'company')),
  }
}
