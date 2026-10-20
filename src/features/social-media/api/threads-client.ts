/**
 * 🆕 2026-07-15 Threads(Meta) Graph API — 게시.
 *
 * 공식 2단계 흐름: ① 컨테이너 생성(/{user}/threads) → ② 발행(/{user}/threads_publish).
 * 텍스트 게시(선택적 이미지). 실패는 에러 반환(throw 안 함). 자격증명은 호출자가 전달.
 * docs: https://developers.facebook.com/docs/threads
 */
const BASE = 'https://graph.threads.net/v1.0'

export interface ThreadsPublishInput {
  userId: string        // Threads user id (account_ref)
  accessToken: string
  text: string
  imageUrl?: string     // 공개 URL(선택)
}

export interface PublishResult {
  ok: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

export async function publishToThreads(input: ThreadsPublishInput): Promise<PublishResult> {
  const { userId, accessToken, text, imageUrl } = input
  if (!userId || !accessToken) return { ok: false, error: '스레드 계정/토큰이 없습니다' }
  if (!text || !text.trim()) return { ok: false, error: '본문이 비어 있습니다' }

  // ① 컨테이너 생성
  const createParams = new URLSearchParams()
  createParams.set('access_token', accessToken)
  createParams.set('text', text.slice(0, 500))
  if (imageUrl) { createParams.set('media_type', 'IMAGE'); createParams.set('image_url', imageUrl) }
  else { createParams.set('media_type', 'TEXT') }

  const createRes = await fetch(`${BASE}/${encodeURIComponent(userId)}/threads`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: createParams.toString(),
  }).catch(() => null)
  if (!createRes) return { ok: false, error: '스레드 API 호출 실패(네트워크)' }
  const createData = (await createRes.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null
  if (!createRes.ok || !createData?.id) {
    return { ok: false, error: `스레드 컨테이너 생성 실패: ${createData?.error?.message || `HTTP ${createRes.status}`}` }
  }
  const creationId = createData.id

  // Threads 는 미디어 컨테이너의 경우 잠시 대기가 권장되나, 텍스트는 즉시 발행 가능.
  // ② 발행
  const pubParams = new URLSearchParams()
  pubParams.set('access_token', accessToken)
  pubParams.set('creation_id', creationId)
  const pubRes = await fetch(`${BASE}/${encodeURIComponent(userId)}/threads_publish`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: pubParams.toString(),
  }).catch(() => null)
  if (!pubRes) return { ok: false, error: '스레드 발행 호출 실패(네트워크)' }
  const pubData = (await pubRes.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null
  if (!pubRes.ok || !pubData?.id) {
    return { ok: false, error: `스레드 발행 실패: ${pubData?.error?.message || `HTTP ${pubRes.status}`}` }
  }
  return { ok: true, externalId: pubData.id }
}
