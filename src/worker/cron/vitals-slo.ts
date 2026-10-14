/**
 * 📈 실사용 성능 SLO 일일 감시 — 매일 09:25 KST, **어제(UTC 날짜)** 표본을 판정한다.
 * 판정 규칙·근거: `../utils/vitals-slo.ts`.
 *
 * 비용: 하루 1회 · KV list (지표 4 × 8일) + 키당 get — 수백 읽기/일(무료 한도 10만의 1% 미만). 쓰기 0
 * (알림은 D1 대시보드 알림 1행, 위반이 있을 때만).
 */
import type { Env } from '../types/env'
import { evaluateVitals, describeFinding, p75, MIN_SAMPLES, VITALS_SLO } from '../utils/vitals-slo'

const DAY_MS = 86_400_000
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10)

async function readDay(kv: KVNamespace, day: string): Promise<Record<string, Record<string, number[]>>> {
  const out: Record<string, Record<string, number[]>> = {}
  for (const metric of Object.keys(VITALS_SLO)) {
    const prefix = `vitals:${day}:${metric}:`
    const list = await kv.list({ prefix })
    for (const k of list.keys) {
      const raw = await kv.get(k.name)
      if (!raw) continue
      try {
        const arr = JSON.parse(raw) as number[]
        if (Array.isArray(arr) && arr.length) (out[metric] ||= {})[k.name.slice(prefix.length)] = arr
      } catch { /* 깨진 표본은 건너뛴다 */ }
    }
  }
  return out
}

export async function runVitalsSlo(env: Env, nowMs = Date.now()): Promise<string> {
  const e = env as Env & { ANALYTICS_KV?: KVNamespace; SESSION_KV?: KVNamespace }
  const kv = e.ANALYTICS_KV || e.SESSION_KV
  // 관측이 안 되는 것을 '이상 없음' 으로 기록하지 않는다 — 하트비트에 그대로 남긴다.
  if (!kv) return 'skip: ANALYTICS_KV 미바인딩 — 실사용 수치를 판정할 수 없다'

  const target = ymd(nowMs - DAY_MS)
  const today = await readDay(kv, target)
  const history: Record<string, Record<string, number[]>> = {}
  for (let d = 2; d <= 8; d++) {
    const day = await readDay(kv, ymd(nowMs - d * DAY_MS))
    for (const [metric, pages] of Object.entries(day)) {
      for (const [page, samples] of Object.entries(pages)) {
        if (samples.length < MIN_SAMPLES) continue
        ;((history[metric] ||= {})[page] ||= []).push(p75(samples) as number)
      }
    }
  }

  const { findings, judged, thin } = evaluateVitals(today, history)
  if (judged === 0) return `${target}: 판정 0건(표본 부족 ${thin}) — 수집이 멎었는지 확인`
  if (findings.length) {
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    const lines = findings.slice(0, 8).map(describeFinding)
    await createDashboardNotification(
      env.DB, 'admin', null, 'perf_slo',
      `실사용 성능 기준 ${findings.length}건 벗어남 (${target})`,
      lines.join('\n') + (findings.length > 8 ? `\n…외 ${findings.length - 8}건` : ''),
      '/admin/system-monitoring',
    ).catch(() => {})
  }
  return `${target}: 판정 ${judged} · 위반 ${findings.filter((f) => f.kind === 'breach').length} · 회귀 ${findings.filter((f) => f.kind === 'regression').length} · 표본부족 ${thin}`
}
