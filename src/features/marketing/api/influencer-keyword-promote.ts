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
import { autoPromotionRoom, MAX_AUTO_KEYWORDS, PROMOTE_NOT_RETIRABLE_SQL, PROMOTE_COOLDOWN_SQL } from './influencer-keyword-rotation'

/** 🛡️ 2026-07-23: 채널 단위 dedupe 도입과 함께 3→5 — '서로 다른 채널 5곳'이 쓴 태그만 승격(단일 실행 폭주 승격 방지). */
export const AUTO_PROMOTE_HITS = 5

/** 🚰 대기 큐에서 넉넉히 뽑아 업종 게이트로 거른다 — 배수는 아래 `QUEUE_SCAN_MAX` 로 상한. */
export const QUEUE_OVERFETCH = 5
/** 한 회차가 훑는 대기 후보 상한. 승격은 드문 일이라 크게 잡을 이유가 없다(D1 한 번, 행만 늘어남). */
export const QUEUE_SCAN_MAX = 200

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

  const upsertSql = `INSERT INTO ad_discovery_keywords (keyword, category, active, hits, source)
    VALUES (?, ?, 0, ?, 'auto')
    ON CONFLICT(keyword) DO UPDATE SET hits = hits + excluded.hits,
      -- 이미 쌓인 후보 790개는 전부 '자동' 이라, 다시 마이닝될 때 업종을 채워 준다(수동 지정은 보존).
      category = CASE WHEN category IS NULL OR category IN ('자동', '') THEN excluded.category ELSE category END`
  // ⚠️ 이번 회차에 태그가 없어도 **여기서 돌아가지 않는다** — 아래 대기 큐 배수는 이번 회차와 무관하게
  //   돌아야 한다(그게 "큐"의 뜻이다). 예전엔 여기서 조기 반환해 빈 회차엔 자리가 비어도 아무도 안 들어갔다.
  if (topTags.length) await DB.batch(topTags.map(([tag, freq]) => DB.prepare(upsertSql).bind(tag, promoCategory(tag), freq))).catch(() => null)

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
  const ph = gated.map(() => '?').join(',')
  // 🧟 **즉시-재은퇴 클래스는 되살리지 않는다**(2026-08-09) — 은퇴는 active=0 만 쓰고 hits 는 계속 쌓이므로,
  //   이 가드가 없으면 은퇴자가 재채굴될 때마다 `hits DESC` 로 신선 큐를 제치고 재승격 → 다음 회차 시작의
  //   은퇴 batch 가 한 번도 안 돌리고 다시 은퇴 → 승격 슬롯만 태우는 livelock(근거·실측은
  //   `PROMOTE_NOT_RETIRABLE_SQL` docblock). 조각은 은퇴문과 같은 SSOT(rotation)라 갈라질 수 없다.
  // 🕊️ 쿨다운(`PROMOTE_COOLDOWN_SQL`): 에폭 은퇴는 자가치유라 영구 차단이 아니고, `hits DESC` 가 옛 활성
  //   키워드를 대기 큐 앞에 세우는 탓에 생기는 승격↔은퇴 churn 만 막는다(근거는 그 상수 docblock).
  const cands = gated.length ? await DB.prepare(`SELECT id, keyword FROM ad_discovery_keywords
    WHERE active = 0 AND hits >= ? AND ${PROMOTE_NOT_RETIRABLE_SQL} AND ${PROMOTE_COOLDOWN_SQL} AND keyword IN (${ph}) ORDER BY hits DESC LIMIT ?`)
    .bind(AUTO_PROMOTE_HITS, ...gated.map(([t]) => t), room)
    .all<{ id: number; keyword: string }>().catch(() => null) : null
  const rows = cands?.results || []
  // 🕐 activated_at 스탬프 — 순환 건강 판정의 미실행 나이는 이 시각부터다(등록일 기준이면 몇 주 잠자던
  //   후보가 승격 즉시 "N주 굶음" 가짜 starved 경보를 낸다 — 2026-08-10, '댕댕이' 실측).
  // 🔄 에폭 리셋 — 재도전은 **백지에서** 시작해야 한다(안 하면 옛 에폭 그대로라 다음 회차에 즉시 재은퇴 = livelock).
  // ⚠️ 두 승격 경로(이번 회차 태그 · 대기 큐)가 **같은 문장**을 써야 한다 — 두 벌이면 한쪽만 고쳐진다.
  const activate = async (list: { id: number; keyword: string }[]) => {
    if (!list.length) return
    await DB.batch(list.map(r => DB.prepare("UPDATE ad_discovery_keywords SET active = 1, activated_at = datetime('now'), epoch_runs = 0, epoch_saved = 0 WHERE id = ?").bind(r.id))).catch(() => null)
    promoted.push(...list.map(r => r.keyword))
  }
  await activate(rows)

  // 🚰 **대기 큐 배수** (2026-08-18) — 남은 자리를 *이번 회차에 안 나온* 후보로도 채운다.
  //   그전엔 승격 후보가 `keyword IN (이번 회차 해시태그 top 50)` 으로 묶여 있었다. 즉 대기 중인
  //   11,720개는 **큐가 아니었다** — 같은 태그가 우연히 다시 채굴될 때만 뽑혔다.
  //
  //   실측이 그 대가를 보여 준다(2026-08-18, 에폭 카운터가 처음으로 신선 수확을 보여 준 날):
  //   ```
  //   신규 테마(협찬·체험단)  39.8 저장/회차      기존 16.4/회차     ← 2.4배
  //   그런데 그 테마의 후보 34개가 active=0 · last_run_at NULL 로 대기 중이었다
  //   ```
  //   자리가 열리는 순간(캡 상향 등) 그 자리를 **그 회차에 우연히 섞인 태그**가 가져간다.
  //   대기 큐에 더 좋은 후보가 있어도 못 들어온다.
  //
  //   ⚠️ 게이트는 위와 **완전히 동일**하다(hits · 재은퇴 · 쿨다운 · 업종). 넓히는 것은 *후보 범위*뿐이다.
  //   ⚠️ 업종 게이트는 SQL 이 아니라 JS(`canAutoPromote`)라 넉넉히 뽑아 거른 뒤 자른다 —
  //     LIMIT 을 남은 자리에 딱 맞추면 게이트에 걸린 만큼 자리가 빈 채로 끝난다.
  const left = room - rows.length
  if (left > 0) {
    const q = await DB.prepare(`SELECT id, keyword FROM ad_discovery_keywords
      WHERE active = 0 AND hits >= ? AND ${PROMOTE_NOT_RETIRABLE_SQL} AND ${PROMOTE_COOLDOWN_SQL}
      ORDER BY hits DESC LIMIT ?`)
      .bind(AUTO_PROMOTE_HITS, Math.min(QUEUE_SCAN_MAX, left * QUEUE_OVERFETCH))
      .all<{ id: number; keyword: string }>().catch(() => null)
    await activate((q?.results || []).filter(r => canAutoPromote(promoCategory(r.keyword))).slice(0, left))
  }
  return { promoted, kwAuto }
}
