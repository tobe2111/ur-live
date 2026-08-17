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
import { autoPromotionRoom, MAX_AUTO_KEYWORDS, PROMOTE_NOT_RETIRABLE_SQL } from './influencer-keyword-rotation'

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
  /**
   * 🌱 auto 키워드 캡 — **자동 조율기**(`planFreshnessCap`)가 정한 값. 미전달이면 종전 상수(행동 불변).
   *   ⚠️ 이 인자가 상수를 대체하는 이유: 발굴량이 떨어질 때 사람이 상수를 올려 주지 않으면
   *   신선도 공급이 멎는다(라이브 실측 08-12→08-16 −41%). 근거는 `influencer-freshness-control.ts`.
   */
  cap: number = MAX_AUTO_KEYWORDS,
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
  const room = autoPromotionRoom(autoRow?.n ?? 0, cap)
  const kwAuto = { active: autoRow?.n ?? 0, room, cap } // 자리 0 이면 발굴이 굶는 중 — 밖에서 보이게
  if (room <= 0) return { promoted, kwAuto }

  // 🚪 적합성 게이트(2026-07-29 대표 승인) — 승격 후보를 **거래가 일어나는 축**으로 좁힌다.
  //   근거·왜 "분류 가능 여부"만으론 부족한지는 `AUTO_PROMOTE_CATEGORIES` 주석(실측 수치 포함).
  //   ⚠️ SQL 이 아니라 여기서 거른다: 후보의 `category` 는 위 upsert 가 방금 채운 값이라
  //   같은 판정을 두 벌로 두지 않으려면 `promoCategory` 와 **같은 함수**를 써야 한다.
  const gated = topTags.filter(([t]) => canAutoPromote(promoCategory(t)))
  if (!gated.length) return { promoted, kwAuto }

  const ph = gated.map(() => '?').join(',')
  // 🧟 **즉시-재은퇴 클래스는 되살리지 않는다**(2026-08-09) — 은퇴는 active=0 만 쓰고 hits 는 계속 쌓이므로,
  //   이 가드가 없으면 은퇴자가 재채굴될 때마다 `hits DESC` 로 신선 큐를 제치고 재승격 → 다음 회차 시작의
  //   은퇴 batch 가 한 번도 안 돌리고 다시 은퇴 → 승격 슬롯만 태우는 livelock(근거·실측은
  //   `PROMOTE_NOT_RETIRABLE_SQL` docblock). 조각은 은퇴문과 같은 SSOT(rotation)라 갈라질 수 없다.
  const cands = await DB.prepare(`SELECT id, keyword FROM ad_discovery_keywords
    WHERE active = 0 AND hits >= ? AND ${PROMOTE_NOT_RETIRABLE_SQL} AND keyword IN (${ph}) ORDER BY hits DESC LIMIT ?`)
    .bind(AUTO_PROMOTE_HITS, ...gated.map(([t]) => t), room)
    .all<{ id: number; keyword: string }>().catch(() => null)
  const rows = cands?.results || []
  if (rows.length) {
    // 🕐 activated_at 스탬프 — 순환 건강 판정의 미실행 나이는 이 시각부터다(등록일 기준이면 몇 주 잠자던
    //   후보가 승격 즉시 "N주 굶음" 가짜 starved 경보를 낸다 — 2026-08-10, '댕댕이' 실측).
    await DB.batch(rows.map(r => DB.prepare("UPDATE ad_discovery_keywords SET active = 1, activated_at = datetime('now') WHERE id = ?").bind(r.id))).catch(() => null)
    promoted.push(...rows.map(r => r.keyword))
  }
  return { promoted, kwAuto }
}
