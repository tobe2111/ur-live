/**
 * 🔁 cron 위임 판정·호출 — 워커에 비밀값이 없으면 같은 일을 웹사이트(Pages)에 맡긴다.
 *   받는 쪽: `routes/cron-delegate.routes.ts` · 머리말에 이유가 있다(2026-11-17).
 */
export const CRON_DELEGATE_JOBS = ['restaurant-geocode', 'kt-alpha-catalog-sync', 'channel-watchdog'] as const
export type CronDelegateJob = (typeof CRON_DELEGATE_JOBS)[number]

type DelegateEnv = {
  INTERNAL_CRON_TOKEN?: string
  FRONTEND_URL?: string
  KAKAO_REST_API_KEY?: string
  KT_ALPHA_AUTH_CODE?: string
  FIREBASE_PROJECT_ID?: string
  FIREBASE_PRIVATE_KEY?: string
  FIREBASE_CLIENT_EMAIL?: string
}

/** 이 워커에 그 일에 필요한 비밀값이 없는가 — 있으면 위임하지 않고 직접 돈다(dual-mode). */
export function needsDelegation(env: DelegateEnv, job: CronDelegateJob): boolean {
  if (job === 'restaurant-geocode') return !env.KAKAO_REST_API_KEY
  if (job === 'kt-alpha-catalog-sync') return !env.KT_ALPHA_AUTH_CODE
  return !(env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL)
}

/** 웹사이트에 맡긴다. 실패는 throw — `safeCron` 이 하트비트·실패 기록에 남긴다(조용히 삼키지 않는다). */
export async function delegateToPages(env: DelegateEnv, job: CronDelegateJob): Promise<unknown> {
  if (!env.INTERNAL_CRON_TOKEN) throw new Error(`cron-delegate ${job}: INTERNAL_CRON_TOKEN 없음 — 위임 불가`)
  const origin = String(env.FRONTEND_URL || 'https://live.ur-team.com').replace(/\/+$/, '')
  const res = await fetch(`${origin}/api/_internal/cron-delegate/${job}`, {
    method: 'POST',
    headers: { 'X-Internal-Token': env.INTERNAL_CRON_TOKEN, 'User-Agent': 'urdeal-cron-delegate' },
  })
  const body = (await res.json().catch(() => null)) as { success?: boolean; result?: unknown } | null
  if (!res.ok || !body?.success) throw new Error(`cron-delegate ${job}: HTTP ${res.status}`)
  return body.result
}
