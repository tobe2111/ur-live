/**
 * 🛡️ 2026-05-14: 공통 DurableObject broadcast helper.
 *   stream_status 이벤트를 LIVE_STREAM DO 에 publish — 시청자 WebSocket 즉시 알림.
 *
 *   사용처:
 *   - POST /live/:id/end (셀러 종료)
 *   - POST /live/:id/admin-force-end (어드민 강제 종료)
 *   - cron/scheduled-cleanup (idle 자동 종료 — 현재 admin_alerts 만)
 *   - cron/youtube-broadcast-end-detect (YouTube actualEndTime 감지)
 *   - admission transition (live 전환)
 *
 *   Tier S WebSocket 시퀀스 시스템과 함께 작동 — DO broadcast() 가 자동으로 seq 부여 + log.
 */

// 🛡️ 2026-05-14: any-compatible — Worker Env / Cron Env 모두 받기 (LIVE_STREAM property 만 사용).
export async function broadcastStreamStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  streamId: number,
  status: 'live' | 'ended' | 'scheduled',
  authUser: { type: 'seller' | 'admin' | 'system'; id: number | string } = { type: 'system', id: 0 },
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<void> {
  if (!env.LIVE_STREAM) return
  try {
    const doId = env.LIVE_STREAM.idFromName(String(streamId))
    const stub = env.LIVE_STREAM.get(doId)
    const broadcast = stub.fetch('https://internal/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': '1',
        'X-Auth-User-Type': authUser.type,
        'X-Auth-User-Id': String(authUser.id),
      },
      body: JSON.stringify({
        type: 'stream_status',
        data: { status, live_stream_id: streamId },
        timestamp: Date.now(),
      }),
    })
    if (waitUntil) {
      waitUntil(broadcast.then(() => {}).catch(() => {}))
    } else {
      await broadcast.then(() => {}).catch(() => {})
    }
  } catch (e) {
    console.warn(`[broadcastStreamStatus] stream ${streamId} → ${status} failed:`, (e as Error).message)
  }
}
