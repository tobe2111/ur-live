/**
 * 🛡️ 2026-05-25 (migration 0279): tracker.delivery 무료 GraphQL API client.
 *
 * 무료 공개 API — API key 불필요. 한국 택배사 20+ 지원.
 * 엔드포인트: https://apis.tracker.delivery/graphql
 * 문서: https://tracker.delivery
 *
 * 사용 흐름:
 *   1. 어드민/셀러가 송장 입력 (`PUT /api/seller/orders/:id/tracking`)
 *   2. cron 6시간마다 `syncShippingStatus()` 호출 → tracker.delivery 조회
 *   3. 결과 → shipping_tracking_events INSERT + orders.tracking_status 갱신
 *   4. delivered 상태 감지 시 → orders.status='DELIVERED' + push 알림
 *   5. tracker.delivery 실패/미지원 시 → 외부 URL fallback (사용자 클릭)
 *
 * 보호:
 *   - timeout 5s
 *   - 1회 실패 retry 1회
 *   - rate limit: cron 에서 batch 50개씩 + 100ms 간격
 */

import { SHIPPING_DEFAULTS } from '../../shared/constants/policy'

export interface TrackerProgress {
  time: string         // ISO 8601
  status: { id: string; text: string }
  location: { name: string | null } | null
  description: string | null
}

export interface TrackerResult {
  ok: boolean
  /** 정규화된 status — 우리 시스템 enum */
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'error' | 'unknown'
  /** 마지막 이벤트 */
  lastProgress: TrackerProgress | null
  /** 전체 progresses (audit 용) */
  progresses: TrackerProgress[]
  /** raw 에러 메시지 (있다면) */
  error?: string
}

/**
 * tracker.delivery status.id → 우리 시스템 enum.
 * tracker.delivery 의 status.id 값:
 *   information_received / at_pickup / in_transit / out_for_delivery
 *   / attempt_fail / delivered / available_for_pickup / exception
 */
function normalizeStatus(id: string): TrackerResult['status'] {
  const v = String(id || '').toLowerCase()
  if (v === 'delivered') return 'delivered'
  if (v === 'out_for_delivery') return 'out_for_delivery'
  if (v === 'in_transit' || v === 'at_pickup') return 'in_transit'
  if (v === 'information_received') return 'pending'
  if (v === 'exception' || v === 'attempt_fail') return 'error'
  if (v === 'returned') return 'returned'
  return 'unknown'
}

const TRACK_QUERY = `
query Track($carrierId: ID!, $trackingNumber: String!) {
  track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
    lastEvent {
      time
      status { id name }
      description
    }
    events {
      time
      status { id name }
      location { name }
      description
    }
  }
}
`

/**
 * tracker.delivery API 호출.
 * carrierId: 'kr.cjlogistics' 같은 표준 코드 (courier-codes.ts 의 trackerCode).
 */
export async function fetchTrackerDelivery(
  carrierId: string,
  trackingNumber: string,
  options: { timeoutMs?: number } = {},
): Promise<TrackerResult> {
  if (!carrierId || !trackingNumber) {
    return { ok: false, status: 'error', lastProgress: null, progresses: [], error: 'invalid_input' }
  }

  const timeout = options.timeoutMs ?? 5000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(SHIPPING_DEFAULTS.TRACKER_DELIVERY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        query: TRACK_QUERY,
        variables: { carrierId, trackingNumber: trackingNumber.replace(/\s+/g, '') },
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { ok: false, status: 'error', lastProgress: null, progresses: [], error: `HTTP ${res.status}` }
    }

    const data = await res.json().catch(() => null) as any
    if (!data) {
      return { ok: false, status: 'error', lastProgress: null, progresses: [], error: 'invalid_json' }
    }

    if (data.errors) {
      const msg = (data.errors[0]?.message || 'graphql_error') as string
      return { ok: false, status: 'error', lastProgress: null, progresses: [], error: msg.slice(0, 100) }
    }

    const track = data?.data?.track
    if (!track) {
      return { ok: false, status: 'unknown', lastProgress: null, progresses: [] }
    }

    // events 가 schema 마다 progresses 일 수도 — fallback.
    const eventsRaw = (track.events ?? track.progresses ?? []) as Array<{
      time: string
      status: { id: string; name?: string; text?: string }
      location?: { name?: string | null } | null
      description?: string | null
    }>

    const progresses: TrackerProgress[] = eventsRaw.map(ev => ({
      time: ev.time,
      status: { id: ev.status?.id || '', text: ev.status?.name || ev.status?.text || '' },
      location: ev.location ? { name: ev.location.name ?? null } : null,
      description: ev.description ?? null,
    }))

    const last = (track.lastEvent ?? eventsRaw[eventsRaw.length - 1]) as any
    const lastProgress: TrackerProgress | null = last
      ? {
          time: last.time,
          status: { id: last.status?.id || '', text: last.status?.name || last.status?.text || '' },
          location: last.location ? { name: last.location.name ?? null } : null,
          description: last.description ?? null,
        }
      : null

    const status = lastProgress ? normalizeStatus(lastProgress.status.id) : 'unknown'

    return { ok: true, status, lastProgress, progresses }
  } catch (err: any) {
    clearTimeout(timer)
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch_failed')
    return { ok: false, status: 'error', lastProgress: null, progresses: [], error: String(msg).slice(0, 100) }
  }
}
