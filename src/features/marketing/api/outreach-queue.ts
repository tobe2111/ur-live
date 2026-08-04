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
 *     ③ 거절·바운스·스팸신고·브랜드 공식계정·**제안 거부 명시(opted_out)**·카페(커뮤니티) 제외
 *   정렬(④ 점수 높은 순, 미채점 후순위)은 `SEND_QUEUE_ORDER_BY` 로 함께 고정 — 프리필이 다른 순서로
 *   훑으면 사람이 실제로 먼저 만나는 상단이 아니라 엉뚱한 구간에 초안이 쌓인다.
 *
 *   ⚖️ [LEGAL] 이 모듈은 **목록 선별만** 한다. 발송은 사람이 1건씩(콜드 리드 자동발송 경로 없음).
 */

/** 플랫폼 필터 허용값 — 라우트 쿼리스트링과 프리필이 같은 목록을 쓰게 한다. */
export const SEND_QUEUE_PLATFORMS = ['youtube', 'naver_blog', 'tistory', 'instagram', 'tiktok'] as const

/**
 * 🧹 이름 기반 노이즈 — 개인 크리에이터가 아닌 게 거의 확실한 계정(뉴스·방송·기관·모집책·대행).
 *
 *   ⚠️ **목록 화면(`hideNoise=1`)과 같은 목록이어야 한다.** 두 벌로 두면 *화면에서 숨긴 사람이
 *   발송 큐에는 나오는* 모순이 생긴다 — 2026-07-29 실측에서 실제로 그 상태였다(큐는 `is_brand` 만 걸렀다).
 *   저장 시점에도 `isLikelyNoise` 가 거르지만 그건 **신규 저장분만**이고, 필터 도입 전에 쌓인
 *   기존 풀에는 남아 있다(그래서 목록에 `hideNoise` 옵션이 존재한다).
 *
 *   규모는 크지 않다(실측 ~43명 / 큐 대상 24,929명). 그래도 거르는 이유는 **하루 N명이 상한인
 *   수동 발송에서 그 한 자리가 곧 손실**이기 때문이다 — 뉴스 계정에 제휴 제안을 보내는 건 순수 낭비다.
 */
export const OUTREACH_NOISE_WORDS = [
  '뉴스', '신문사', '방송국', '연합뉴스', '체험단', '서포터즈', '기자단',
  '리뷰어 모집', '마케팅 대행', '광고 대행', '대행사', '구청', '시청',
] as const

/** ④ 점수 높은 순(미채점은 후순위) — score_hot 부터 소진. */
export const SEND_QUEUE_ORDER_BY = '(lead_score IS NULL) ASC, lead_score DESC, subscriber_count DESC, id DESC'

/**
 * 발송 큐 WHERE 절 + 바인드를 만든다.
 * @param poolAccountId 풀 계정 id (POOL)
 * @param platform      플랫폼 필터(허용목록 밖이면 무시)
 * @param opts.onlyWithoutDraft 초안이 아직 없는 리드만 — 프리필 레인 전용(사람이 쓴/기생성 초안 덮어쓰기 방지)
 * @param opts.category/region  📍 이행용 좁히기(2026-07-29) — 서비스몰이 파는 축이 **지역×업종**이라
 *   큐에서 바로 "강남 맛집 10명"을 뽑을 수 있어야 한다. 미지정이면 기존 동작 그대로.
 * @param opts.emailOnly        📧 이메일 보유만 — 대표 아웃리치 채널이 이메일 전용일 때.
 *   ⚠️ 기본값 아님. 쪽지/DM 경로도 실제로 쓰이므로(ch_note 기록) 기본을 좁히면 쓰던 흐름이 깨진다.
 */
export function buildSendQueueWhere(
  poolAccountId: number,
  platform?: string,
  opts?: { onlyWithoutDraft?: boolean; category?: string; region?: string; emailOnly?: boolean },
): { where: string; binds: (string | number)[] } {
  const where = [
    'account_id = ?',
    "platform != 'naver_cafe'",
    "status = 'new'", 'contacted_at IS NULL',
    // ① 열 수 있는 채널 — url 은 **스킴이 있어야** 실제로 열린다(pickReach 와 동일 기준).
    "(email IS NOT NULL OR instagram IS NOT NULL OR url LIKE 'http%')",
    "COALESCE(email_status,'') NOT IN ('bounced','complained')",
    'COALESCE(is_brand, 0) = 0',
    // 🚫 소개글에 제안 거부를 명시한 사람 제외 — 노이즈(낭비)와 달리 이건 **거부 의사 무시**라
    //   보내면 안 된다. 태깅은 `declinesOutreach`(저장 시점 + 야간 품질 패스).
    'COALESCE(opted_out, 0) = 0',
  ]
  const binds: (string | number)[] = [poolAccountId]
  // 🧹 이름 기반 노이즈 제외 — 목록 화면(`hideNoise=1`)과 **같은 기준**(위 상수 주석 참조).
  for (const w of OUTREACH_NOISE_WORDS) { where.push('name NOT LIKE ?'); binds.push(`%${w}%`) }
  const p = (platform || '').trim()
  if ((SEND_QUEUE_PLATFORMS as readonly string[]).includes(p)) { where.push('platform = ?'); binds.push(p) }
  // 프리필은 빈 초안만 채운다 — 이미 있는 초안(사람이 손봤을 수 있다)을 덮으면 작업물이 사라진다.
  if (opts?.onlyWithoutDraft) where.push("(outreach_draft IS NULL OR outreach_draft = '')")
  const cat = (opts?.category || '').trim()
  if (cat) { where.push('category = ?'); binds.push(cat.slice(0, 20)) }
  const reg = (opts?.region || '').trim()
  if (reg) { where.push('region = ?'); binds.push(reg.slice(0, 20)) }
  if (opts?.emailOnly) where.push('email IS NOT NULL')
  return { where: where.join(' AND '), binds }
}

/**
 * 🧹 **같은 주소에 두 번 보내지 않는다** (2026-08-04 — 대표 승인 "2,3 진행").
 *
 * ## 실측
 * 발송 가능(이메일 보유·수신거부 아님) 리드 중 **중복 주소 그룹 130개 / 262행** —
 * 즉 그대로 두면 **132통이 같은 사람에게 두 번째로 나간다.**
 * 한 사람이 유튜브와 블로그를 같이 하거나, 소속 대행사 대표메일이 여러 채널에 적혀 있으면 생긴다.
 * 중복 통합(`mergeDuplicatePool`)은 **같은 채널의 중복 행**을 합치는 것이라 이 경우는 안 잡는다 —
 * 서로 다른 채널이고 각각 정당한 리드다. 지우면 안 되고, **보낼 때만 하나로** 묶는 것이 맞다.
 *
 * ## 왜 SQL 이 아니라 여기서
 * 발송 목록은 이미 **좋은 순서로 정렬**돼 있다(점수·구독자). `GROUP BY email` 을 걸면 그 순서가
 * 흔들리고 어느 행이 남는지가 D1 구현에 맡겨진다. 정렬을 신뢰하고 **먼저 나온 것을 남기는** 편이
 * 결과가 결정적이고, 페이지 단위로 읽는 내보내기와도 같은 규칙으로 맞출 수 있다.
 *
 * ⚠️ 이메일이 없는 행은 **그대로 통과**시킨다 — 빈 값끼리 묶으면 이메일 없는 리드가 한 명만 남는다
 *   (내보내기 전체 목록은 이메일 없는 리드도 담는다).
 */
export function dedupeByEmail<T extends { email?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of rows) {
    const e = String(r?.email ?? '').trim().toLowerCase()
    if (!e) { out.push(r); continue }
    if (seen.has(e)) continue
    seen.add(e)
    out.push(r)
  }
  return out
}

/** 발송 큐 한 페이지가 읽는 컬럼 — 화면(붙여넣기 문안 포함)이 쓰는 것만. */
const SEND_QUEUE_COLS = 'id, platform, name, url, email, instagram, status, outreach_draft, lead_score, subscriber_count, category, region, email_status'

/**
 * 🚀 **발송 큐 한 페이지** — 라우트에서 분리(2026-08-04, 600줄 래칫). 조회·중복제거·자르기를 한 자리에.
 *
 *   ⚠️ `limit` 이 아니라 **`limit * 2` 를 읽는다** — 중복을 걸러낸 뒤에도 요청한 인원을 채우기 위해서다.
 *     그대로 `limit` 을 읽고 거르면 "20명 주세요" 가 17명이 되고, 매일 쓰는 화면이라 바로 체감된다.
 *   ⚠️ 상한 200 은 D1 응답 크기 안전선(초안 본문이 실려 행이 크다).
 */
export async function fetchSendQueuePage<T extends { email?: string | null }>(
  DB: { prepare(sql: string): { bind(...v: unknown[]): { all<R>(): Promise<{ results?: R[] } | null> } } },
  where: string, binds: (string | number)[], limit: number,
): Promise<T[]> {
  const fetchN = Math.min(200, Math.max(1, limit) * 2)
  const rows = await DB.prepare(`SELECT ${SEND_QUEUE_COLS} FROM ad_influencer_leads WHERE ${where}
    ORDER BY ${SEND_QUEUE_ORDER_BY} LIMIT ?`).bind(...binds, fetchN).all<T>().catch(() => null)
  return dedupeByEmail((rows?.results || []) as T[]).slice(0, limit)
}
