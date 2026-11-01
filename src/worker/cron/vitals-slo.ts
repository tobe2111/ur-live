/**
 * 📈 실사용 성능 SLO 감시 — 매일 09:25 KST, **어제까지 `WINDOW_DAYS` 일 누적** 표본을 판정한다.
 * 판정 규칙·근거·창을 쓰는 이유: `../utils/vitals-slo.ts` 머리말.
 *
 * ## 🪟 왜 하루가 아니라 창인가 (2026-10-15 — 라이브가 뒤집었다)
 *
 * 하루 단위로 돌린 첫 회차가 `"2026-10-14: 판정 0건(표본 부족 30)"` 을 남겼다 — **표본 20을 넘긴
 * 화면이 하나도 없어 판정을 한 번도 못 했다.** 7일 누적으로 재니 판정 가능 조합이 **0 → 6개**가 되고
 * 그중 하나가 실제 위반이었다(홈 LCP p75 3,532ms > 2,500). 자세한 측정은 유틸 머리말.
 *
 * 비용: 하루 1회 · KV list (지표 4 × `2 × WINDOW_DAYS` 일) + 키당 get — 하루 수백 읽기
 * (무료 한도 10만의 1% 미만). 쓰기 0 (알림은 D1 대시보드 알림 1행, 판정할 게 있을 때만).
 */
import type { Env } from '../types/env'
import { evaluateVitals, describeFinding, poolDays, MIN_SAMPLES, WINDOW_DAYS, VITALS_SLO } from '../utils/vitals-slo'
import { summarizeLcpParts, describeLcpParts } from '../utils/lcp-parts'
import { describeClsSources } from '../../shared/cls-source'

const DAY_MS = 86_400_000
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * 하루치를 읽는다. 🔑 **직렬로 읽지 않는다** — 창이 길어지면 KV 호출이 창 길이에 비례해 늘고
 * (14일 × 지표 4 × 키 ~30), 하나씩 await 하면 수백 번의 왕복이 그대로 벽시계 시간이 된다.
 * KV 는 I/O 라 묶어 던져도 CPU 를 더 쓰지 않는다.
 */
async function readDay(kv: KVNamespace, day: string): Promise<Record<string, Record<string, number[]>>> {
  const out: Record<string, Record<string, number[]>> = {}
  await Promise.all(Object.keys(VITALS_SLO).map(async (metric) => {
    const prefix = `vitals:${day}:${metric}:`
    const list = await kv.list({ prefix })
    const got = await Promise.all(list.keys.map(async (k) => [k.name, await kv.get(k.name)] as const))
    for (const [name, raw] of got) {
      if (!raw) continue
      try {
        const arr = JSON.parse(raw) as number[]
        if (Array.isArray(arr) && arr.length) (out[metric] ||= {})[name.slice(prefix.length)] = arr
      } catch { /* 깨진 표본은 건너뛴다 */ }
    }
  }))
  return out
}

/** `from` 일 전부터 `WINDOW_DAYS` 일(과거 방향)을 읽어 한 창으로 모은다. */
async function readWindow(kv: KVNamespace, nowMs: number, from: number) {
  const offsets = Array.from({ length: WINDOW_DAYS }, (_, i) => from + i)
  return poolDays(await Promise.all(offsets.map((d) => readDay(kv, ymd(nowMs - d * DAY_MS)))))
}

/** 🔬 2026-10-19: 경보가 난 화면의 LCP 쪼개기를 판정 창 그대로 모은다(없으면 빈 줄 — 경보를 막지 않는다). */
async function lcpPartsLine(kv: KVNamespace, nowMs: number, page: string): Promise<string> {
  try {
    const days = Array.from({ length: WINDOW_DAYS }, (_, i) => ymd(nowMs - (1 + i) * DAY_MS))
    const raws = await Promise.all(days.map((d) => kv.get(`vitals:${d}:LCPB:${page}`)))
    const rows = raws.flatMap((r) => { try { return r ? (JSON.parse(r) as number[][]) : [] } catch { return [] } })
    return describeLcpParts(summarizeLcpParts(rows))
  } catch { return '' }
}

/** 🔬 2026-10-20: 경보가 난 화면의 CLS 원인(무엇이 밀렸나)을 판정 창 그대로 모은다(없으면 빈 줄). */
async function clsSourcesLine(kv: KVNamespace, nowMs: number, page: string): Promise<string> {
  try {
    const days = Array.from({ length: WINDOW_DAYS }, (_, i) => ymd(nowMs - (1 + i) * DAY_MS))
    const raws = await Promise.all(days.map((d) => kv.get(`vitals:${d}:CLSS:${page}`)))
    const rows = raws.flatMap((r) => { try { return r ? (JSON.parse(r) as string[]) : [] } catch { return [] } })
    return describeClsSources(rows)
  } catch { return '' }
}

export async function runVitalsSlo(env: Env, nowMs = Date.now()): Promise<string> {
  const e = env as Env & { ANALYTICS_KV?: KVNamespace; SESSION_KV?: KVNamespace }
  const kv = e.ANALYTICS_KV || e.SESSION_KV
  // 관측이 안 되는 것을 '이상 없음' 으로 기록하지 않는다 — 하트비트에 그대로 남긴다.
  if (!kv) return 'skip: ANALYTICS_KV 미바인딩 — 실사용 수치를 판정할 수 없다'

  const until = ymd(nowMs - DAY_MS)
  const since = ymd(nowMs - WINDOW_DAYS * DAY_MS)
  const span = `${since}~${until}`
  const current = await readWindow(kv, nowMs, 1)
  const baseline = await readWindow(kv, nowMs, 1 + WINDOW_DAYS)

  const { findings, judged, thin, samples } = evaluateVitals(current, baseline)

  // 🔔 판정 0건은 '통과' 가 아니다 — 창을 쓴 뒤로는 비정상이다(유틸 머리말). 조용히 반환하면
  //    감시가 '이상 없음' 과 구분되지 않는다. 원인은 섞지 않는다: 표본 0 ≠ 표본 부족.
  const alarm = findings.length > 0 || judged === 0
  const blindReason = samples === 0
    ? `표본 0 — 수집이 멎었다(web-vitals 보고 또는 ANALYTICS_KV 확인)`
    : `표본 ${samples}개는 모였는데 화면별로 전부 ${MIN_SAMPLES} 미만(${thin}조합) — 트래픽 부족`

  if (alarm) {
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    const title = judged === 0
      ? `실사용 성능 감시가 판정을 못 했다 (${span})`
      : `실사용 성능 기준 ${findings.length}건 벗어남 (${span})`
    const bodyLines = judged === 0
      ? [blindReason, `창 ${WINDOW_DAYS}일 · 화면별 최소 표본 ${MIN_SAMPLES}`]
      : (await Promise.all(findings.slice(0, 8).map(async (f) => {
          const line = describeFinding(f)
          if (f.metric === 'CLS') {
            const src = await clsSourcesLine(kv, nowMs, f.page)
            return src ? [line, src] : [line]
          }
          if (f.metric !== 'LCP') return [line]
          const parts = await lcpPartsLine(kv, nowMs, f.page)
          return parts ? [line, parts] : [line]
        }))).flat().concat(findings.length > 8 ? [`…외 ${findings.length - 8}건`] : [])
    await createDashboardNotification(
      env.DB, 'admin', null, 'perf_slo', title, bodyLines.join('\n'), '/admin/system-monitoring',
    // intentional: 알림 실패가 판정 기록(하트비트 out)을 막으면 안 된다 — 결과는 아래 반환값에 남는다
    ).catch(() => {})
  }

  if (judged === 0) return `${span}: 판정 0건 — ${blindReason}`
  return `${span}: 판정 ${judged} · 위반 ${findings.filter((f) => f.kind === 'breach').length} · 회귀 ${findings.filter((f) => f.kind === 'regression').length} · 표본부족 ${thin} · 표본 ${samples}`
}
