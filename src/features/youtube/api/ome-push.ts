/**
 * OME (OvenMediaEngine) REST API helpers.
 *
 * 🛡️ 2026-05-11 refactor: admission webhook lazy startPush + 60s 폴링을 제거하고
 *   `/create` 시점에 미리 등록 + admission 은 검증만 + transition 1회 호출하는 구조로 전환.
 *
 *   기존: 매 admission 마다 push 등록 → 폴링 60s → testing→live 전환
 *   현재: create 시점 push 등록 (RTMP 인입 즉시 fan-out) + admission delayed transition 1회
 *
 *   이점:
 *   - 폴링 제거 → Worker request lifetime 의존 X (CF Workers cancellation 회피)
 *   - broadcast.id 가 곧 video_id → /create 시점에 이미 DB 에 저장됨
 *   - Push registration 도 idempotent (Duplicate ID 자동 복구)
 */

import type { Env } from '@/worker/types/env'

export const omePushId = (streamId: number | string) => `youtube-${streamId}`

interface OmeResult {
  ok: boolean
  status: number
  body?: string
}

/**
 * OME push 를 등록한다. 이미 같은 id 가 있으면 (Duplicate ID 400) 정리 후 재시도.
 *
 * RTMP 신호가 아직 도착 안 했어도 등록 가능 — OME 가 인입 시점에 자동으로 fan-out 시작.
 */
export async function registerOmePush(
  env: Env,
  streamId: number,
  rtmpUrl: string,
  rtmpKey: string,
): Promise<OmeResult> {
  if (!env.OME_HOST || !env.OME_API_TOKEN) {
    return { ok: false, status: 0, body: 'OME not configured' }
  }
  const apiBase = `http://${env.OME_HOST}:8081/v1/vhosts/default/apps/app`
  const auth = btoa(env.OME_API_TOKEN)
  const id = omePushId(streamId)
  const streamName = `s${streamId}`
  const fullRtmp = rtmpUrl.endsWith('/') ? rtmpUrl : `${rtmpUrl}/`
  const body = JSON.stringify({
    id,
    stream: { name: streamName },
    protocol: 'rtmp',
    url: fullRtmp,
    streamKey: rtmpKey,
  })

  const post = (path: string, b: string) =>
    fetch(`${apiBase}:${path}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: b,
    })

  let res = await post('startPush', body)
  if (res.status === 400) {
    const errText = await res.clone().text().catch(() => '')
    if (/duplicate.*id/i.test(errText)) {
      // 기존 push 정리 후 재시도
      await post('stopPush', JSON.stringify({ id })).catch(() => undefined)
      await new Promise((r) => setTimeout(r, 500))
      res = await post('startPush', body)
    }
  }
  const responseText = res.ok ? '' : await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, body: responseText }
}

/**
 * OME 에 active push 목록 조회 — 진단용. push 가 정말 등록됐는지 확인.
 */
export async function getOmePushes(env: Env): Promise<Array<{ id: string; state?: string; url?: string }>> {
  if (!env.OME_HOST || !env.OME_API_TOKEN) return []
  const auth = btoa(env.OME_API_TOKEN)
  const res = await fetch(
    `http://${env.OME_HOST}:8081/v1/vhosts/default/apps/app:pushes`,
    { headers: { Authorization: `Basic ${auth}` } },
  ).catch(() => null)
  if (!res?.ok) return []
  const data = await res.json().catch(() => null) as { response?: Array<{ id: string; state?: string; url?: string }> } | null
  return data?.response || []
}

/**
 * OME push 를 중지한다 (best-effort). 이미 없으면 무시.
 */
export async function stopOmePush(env: Env, streamId: number): Promise<void> {
  if (!env.OME_HOST || !env.OME_API_TOKEN) return
  const apiBase = `http://${env.OME_HOST}:8081/v1/vhosts/default/apps/app`
  const auth = btoa(env.OME_API_TOKEN)
  await fetch(`${apiBase}:stopPush`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: omePushId(streamId) }),
  }).catch(() => undefined)
}
