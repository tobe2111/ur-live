/**
 * 📈 2026-10-15 공급 모으기 마케터 — "어느 글이 실제로 매장·소개 파트너를 데려왔나".
 *
 * 대표: *"직접 유어딜로 하여금 돈을 벌어다 주면 좋겠어."* 그러려면 게시물 수가 아니라
 * **게시물이 만든 결과**를 세야 하고, 다음 글은 그 결과를 보고 골라야 한다(되먹임 루프).
 *
 * 사슬 (전부 기존 장치 — 가입 흐름은 한 줄도 안 바꿨다):
 *   게시물 링크 `?src=sns-th-12`
 *     → 랜딩(acquisition_landings, first-touch 30일)
 *     → 로그인·가입 귀속(user_acquisition)
 *     → 그 유저가 **매장 주인**이 됨(seller_operators role='owner', 랜딩 이후 생성)
 *     → 또는 비로그인 **소개 파트너 신청**(acquisition_conversions kind='creator_apply')
 *
 * ⚠️ 못 세는 것 (숨기지 않는다):
 *   - 인스타그램은 게시물 단위가 아니다(캡션 링크가 안 눌려 프로필 링크 하나로 들어온다 → `sns-ig` 한 줄)
 *   - first-touch 30일이라, 다른 경로로 먼저 들어온 사람은 이 글에 안 잡힌다(과소집계 쪽으로 틀린다)
 *   - 링크를 안 누르고 검색해서 들어온 사람
 */
export interface FunnelRow { src: string; landings: number; signups: number; stores: number; creatorApplies: number }

/** 순수 — 소스별 원천 집계들을 한 표로 합친다(테스트가 이 함수를 직접 잰다). */
export function mergeFunnel(parts: {
  landings: Array<{ src: string; n: number }>
  signups: Array<{ src: string; n: number }>
  stores: Array<{ src: string; n: number }>
  applies: Array<{ src: string; n: number }>
}): FunnelRow[] {
  const map = new Map<string, FunnelRow>()
  const row = (src: string) => {
    let r = map.get(src)
    if (!r) { r = { src, landings: 0, signups: 0, stores: 0, creatorApplies: 0 }; map.set(src, r) }
    return r
  }
  for (const x of parts.landings) row(x.src).landings += Number(x.n) || 0
  for (const x of parts.signups) row(x.src).signups += Number(x.n) || 0
  for (const x of parts.stores) row(x.src).stores += Number(x.n) || 0
  for (const x of parts.applies) row(x.src).creatorApplies += Number(x.n) || 0
  return [...map.values()].sort((a, b) =>
    (b.stores + b.creatorApplies) - (a.stores + a.creatorApplies) || b.landings - a.landings || a.src.localeCompare(b.src))
}

/** 공급 전환 점수 — 매장 1곳과 소개 파트너 신청 1건을 같은 무게로 센다(둘 다 지금 가장 부족한 쪽). */
export function supplyScore(r: Pick<FunnelRow, 'stores' | 'creatorApplies'>): number {
  return r.stores + r.creatorApplies
}

const SNS = "src LIKE 'sns-%'"

/**
 * 원천 집계 SQL — 테이블이 아직 없으면(첫 랜딩 전) 그 항목만 비운다. 전부 읽기 전용.
 * 매장은 **랜딩 이후에 생긴 주인 좌석**만 센다 — 원래 사장님이던 사람이 글을 보고 들어온 것을
 * 이 글의 성과로 치지 않기 위해서다.
 */
export const FUNNEL_SQL = {
  landings: `SELECT src, COUNT(*) AS n FROM acquisition_landings WHERE ${SNS} GROUP BY src`,
  signups: `SELECT src, COUNT(*) AS n FROM user_acquisition WHERE ${SNS} GROUP BY src`,
  stores: `SELECT ua.src AS src, COUNT(DISTINCT so.seller_id) AS n
             FROM user_acquisition ua
             JOIN seller_operators so
               ON so.user_id = CAST(ua.user_id AS INTEGER)
              AND so.role = 'owner' AND so.revoked_at IS NULL
              AND datetime(so.created_at) >= datetime(COALESCE(ua.landed_at, ua.claimed_at))
            WHERE ua.${SNS}
            GROUP BY ua.src`,
  applies: `SELECT src, COUNT(*) AS n FROM acquisition_conversions WHERE ${SNS} AND kind = 'creator_apply' GROUP BY src`,
} as const

export async function loadFunnel(DB: D1Database): Promise<FunnelRow[]> {
  const q = async (sql: string) =>
    (await DB.prepare(sql).all<{ src: string; n: number }>().catch(() => ({ results: [] as { src: string; n: number }[] }))).results || []
  const [landings, signups, stores, applies] = await Promise.all([
    q(FUNNEL_SQL.landings), q(FUNNEL_SQL.signups), q(FUNNEL_SQL.stores), q(FUNNEL_SQL.applies),
  ])
  return mergeFunnel({ landings, signups, stores, applies })
}

/**
 * 주제별 성과 → 다음 주제 고르기(되먹임). 순수.
 *   1) 아직 안 쓴 주제가 있으면 그것(탐색) — 써 보기 전엔 좋은지 모른다
 *   2) 다 썼으면 게시물당 공급 전환이 가장 높은 주제(활용), 동률이면 덜 쓴 주제
 * 성과가 하나도 없으면 2) 는 "덜 쓴 순" 이 되어 자연히 순환한다.
 */
export function pickTopicByPerformance<T extends { slug: string }>(
  topics: readonly T[],
  usage: Record<string, { posts: number; score: number }>,
): T {
  const fresh = topics.find((t) => !usage[t.slug] || usage[t.slug].posts === 0)
  if (fresh) return fresh
  let best = topics[0]
  let bestRate = -1
  let bestPosts = Infinity
  for (const t of topics) {
    const u = usage[t.slug]
    const rate = u.posts > 0 ? u.score / u.posts : 0
    if (rate > bestRate + 1e-9 || (Math.abs(rate - bestRate) <= 1e-9 && u.posts < bestPosts)) {
      best = t; bestRate = rate; bestPosts = u.posts
    }
  }
  return best
}
