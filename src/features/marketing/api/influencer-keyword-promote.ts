/**
 * 🌱 **해시태그 자동확장 승격** — `influencer-auto-collect.ts` 에서 분리(2026-07-29, 600줄 래칫).
 *
 *   수집된 채널 소개글의 #태그를 후보로 적립하고, 서로 다른 채널 N곳이 쓴 태그를 활성 수집
 *   키워드로 승격한다(자가성장). 로직이 아니라 위치만 옮겼고, **적합성 게이트가 사는 자리**라
 *   여기가 제자리다(`influencer-keyword-store.ts`·`influencer-seed-keywords.ts` 와 같은 처방 —
 *   래칫을 리베이스라인으로 우회하지 않고 성격이 같은 덩어리를 모듈로 뺀다).
 *
 *   ⚠️ 서비스 분리: `ad_discovery_keywords` 만 접촉(소비자/도매 무관).
 */
import { classifyCategory, canAutoPromote } from './influencer-classify'
import { autoPromotionRoom, MAX_AUTO_KEYWORDS } from './influencer-keyword-rotation'

/** 🛡️ 2026-07-23: 채널 단위 dedupe 도입과 함께 3→5 — '서로 다른 채널 5곳'이 쓴 태그만 승격(단일 실행 폭주 승격 방지). */
export const AUTO_PROMOTE_HITS = 5

/**
 * 🏷️ 승격 태그의 업종 추론. 전부 `'자동'` 이면 ① 우선 풀(슬롯 3/4)에 영영 못 들고
 *   ② `resolveCategory` 가 NON_CATEGORIES 로 버려 그 리드가 카테고리 미분류(fit 0)가 된다.
 *   실측: 상위 후보 13/13 정확히 분류됨(서울맛집→맛집 …). 카페→맛집은 REGION_SEED 관례 그대로
 *   ('카페'는 CORE_CATEGORIES 에 없어 두면 fit 20→10).
 */
export function promoCategory(tag: string): string {
  const c = classifyCategory(tag)
  return !c ? '자동' : c === '카페' ? '맛집' : c
}

export interface PromoteResult {
  promoted: string[]
  kwAuto?: { active: number; room: number; cap: number }
}

/**
 * 후보 hits 적립 + 임계 도달 시 활성화(상한 내에서).
 *   ⚠️ 2026-07-20: 태그별 개별 쿼리(수백 subrequest)가 Free 한도 초과의 공범 → 상위 50개만 + DB.batch 2회.
 */
export async function promoteHashtagKeywords(
  DB: D1Database,
  hashtagFreq: Map<string, number>,
): Promise<PromoteResult> {
  const promoted: string[] = []
  const topTags = Array.from(hashtagFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50)
  if (!topTags.length) return { promoted }

  const upsertSql = `INSERT INTO ad_discovery_keywords (keyword, category, active, hits, source)
    VALUES (?, ?, 0, ?, 'auto')
    ON CONFLICT(keyword) DO UPDATE SET hits = hits + excluded.hits,
      -- 이미 쌓인 후보 790개는 전부 '자동' 이라, 다시 마이닝될 때 업종을 채워 준다(수동 지정은 보존).
      category = CASE WHEN category IS NULL OR category IN ('자동', '') THEN excluded.category ELSE category END`
  await DB.batch(topTags.map(([tag, freq]) => DB.prepare(upsertSql).bind(tag, promoCategory(tag), freq))).catch(() => null)

  // 🌱 자리는 **auto 쿼터** 기준(시드 수 무관) — 예전엔 활성 전체로 세서 시드만으로 상한에 닿아
  //   승격이 영구 0 이었다(`MAX_AUTO_KEYWORDS` 주석의 실측 참조).
  const autoRow = await DB.prepare("SELECT COUNT(*) AS n FROM ad_discovery_keywords WHERE active = 1 AND source = 'auto'")
    .first<{ n: number }>().catch(() => null)
  const room = autoPromotionRoom(autoRow?.n ?? 0)
  const kwAuto = { active: autoRow?.n ?? 0, room, cap: MAX_AUTO_KEYWORDS } // 자리 0 이면 발굴이 굶는 중 — 밖에서 보이게
  if (room <= 0) return { promoted, kwAuto }

  // 🚪 적합성 게이트(2026-07-29 대표 승인) — 승격 후보를 **거래가 일어나는 축**으로 좁힌다.
  //   근거·왜 "분류 가능 여부"만으론 부족한지는 `AUTO_PROMOTE_CATEGORIES` 주석(실측 수치 포함).
  //   ⚠️ SQL 이 아니라 여기서 거른다: 후보의 `category` 는 위 upsert 가 방금 채운 값이라
  //   같은 판정을 두 벌로 두지 않으려면 `promoCategory` 와 **같은 함수**를 써야 한다.
  const gated = topTags.filter(([t]) => canAutoPromote(promoCategory(t)))
  if (!gated.length) return { promoted, kwAuto }

  const ph = gated.map(() => '?').join(',')
  const cands = await DB.prepare(`SELECT id, keyword FROM ad_discovery_keywords
    WHERE active = 0 AND hits >= ? AND keyword IN (${ph}) ORDER BY hits DESC LIMIT ?`)
    .bind(AUTO_PROMOTE_HITS, ...gated.map(([t]) => t), room)
    .all<{ id: number; keyword: string }>().catch(() => null)
  const rows = cands?.results || []
  if (rows.length) {
    await DB.batch(rows.map(r => DB.prepare('UPDATE ad_discovery_keywords SET active = 1 WHERE id = ?').bind(r.id))).catch(() => null)
    promoted.push(...rows.map(r => r.keyword))
  }
  return { promoted, kwAuto }
}
