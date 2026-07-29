/**
 * 🚀 발송 큐 **선별 기준 SSOT** (2026-07-29 — 초안 프리필 레인 신설과 함께 추출).
 *
 *   왜 공유하는가: 이 술어를 두 벌 쓰면 **사람이 보는 큐**와 **초안을 미리 만들어 둔 대상**이 갈린다.
 *   그러면 프리필은 돌았는데 정작 화면에 뜨는 사람들은 초안이 비어 있는(= 아무것도 나아지지 않은)
 *   상태가 되고, 원인은 화면에서 안 보인다. 큐 라우트와 프리필 레인이 **같은 함수**를 부르게 한다.
 *
 *   선별 규칙(2026-07-29 라이브 실측 기준 — `send-queue` 라우트 주석에서 이관):
 *     ① 실제로 열 수 있는 채널 보유 — email · instagram · **스킴 있는 url**(쪽지/댓글 경로)
 *     ② 아직 접촉 안 함(status='new' AND contacted_at IS NULL) — 재접촉 사고 방지
 *     ③ 거절·바운스·스팸신고·브랜드 공식계정·카페(커뮤니티) 제외
 *   정렬(④ 점수 높은 순, 미채점 후순위)은 `SEND_QUEUE_ORDER_BY` 로 함께 고정 — 프리필이 다른 순서로
 *   훑으면 사람이 실제로 먼저 만나는 상단이 아니라 엉뚱한 구간에 초안이 쌓인다.
 *
 *   ⚖️ [LEGAL] 이 모듈은 **목록 선별만** 한다. 발송은 사람이 1건씩(콜드 리드 자동발송 경로 없음).
 */

/** 플랫폼 필터 허용값 — 라우트 쿼리스트링과 프리필이 같은 목록을 쓰게 한다. */
export const SEND_QUEUE_PLATFORMS = ['youtube', 'naver_blog', 'tistory', 'instagram', 'tiktok'] as const

/** ④ 점수 높은 순(미채점은 후순위) — score_hot 부터 소진. */
export const SEND_QUEUE_ORDER_BY = '(lead_score IS NULL) ASC, lead_score DESC, subscriber_count DESC, id DESC'

/**
 * 발송 큐 WHERE 절 + 바인드를 만든다.
 * @param poolAccountId 풀 계정 id (POOL)
 * @param platform      플랫폼 필터(허용목록 밖이면 무시)
 * @param opts.onlyWithoutDraft 초안이 아직 없는 리드만 — 프리필 레인 전용(사람이 쓴/기생성 초안 덮어쓰기 방지)
 */
export function buildSendQueueWhere(
  poolAccountId: number,
  platform?: string,
  opts?: { onlyWithoutDraft?: boolean },
): { where: string; binds: (string | number)[] } {
  const where = [
    'account_id = ?',
    "platform != 'naver_cafe'",
    "status = 'new'", 'contacted_at IS NULL',
    // ① 열 수 있는 채널 — url 은 **스킴이 있어야** 실제로 열린다(pickReach 와 동일 기준).
    "(email IS NOT NULL OR instagram IS NOT NULL OR url LIKE 'http%')",
    "COALESCE(email_status,'') NOT IN ('bounced','complained')",
    'COALESCE(is_brand, 0) = 0',
  ]
  const binds: (string | number)[] = [poolAccountId]
  const p = (platform || '').trim()
  if ((SEND_QUEUE_PLATFORMS as readonly string[]).includes(p)) { where.push('platform = ?'); binds.push(p) }
  // 프리필은 빈 초안만 채운다 — 이미 있는 초안(사람이 손봤을 수 있다)을 덮으면 작업물이 사라진다.
  if (opts?.onlyWithoutDraft) where.push("(outreach_draft IS NULL OR outreach_draft = '')")
  return { where: where.join(' AND '), binds }
}
