/**
 * 🌱 **회차 키워드 선택** — 회전 창 + 신규 우선 (2026-08-18, `company-collect.ts` 600줄 래칫으로 분리).
 *
 * ## 왜 신규 우선이 필요했나 (실측)
 * ```
 * 활성 4,555 중 **미실행 3,279**   ·   커서 1,276   ·   시간당 ~1.9칸  →  끝 도달까지 ≈ 72일
 * 대표가 요청한 체험단 9개 = 전부 `last_run_at IS NULL`, 그 줄 끝
 * ```
 * `tier` 우선 정렬은 **이미 있었다.** 그래도 부족한 이유는 새 키워드가 **같은 tier 안에서 id 가 뒤**라
 * 맨 끝에 서기 때문이다. 즉 "지금 이 업종을 수집해 달라"는 요청이 두 달 뒤에 반영된다.
 *
 * ## ⚠️ 정렬(ORDER BY)로 구현하지 않는 이유
 * `last_run_at IS NULL` 은 **키워드가 돌 때마다 바뀐다.** 그걸 정렬 키로 쓰면 OFFSET 창이
 * 회차마다 다른 지점을 가리켜 **건너뜀·중복**이 생긴다(회전 창 주석이 원래 경고하던 것).
 * ⇒ 정렬은 그대로 두고 **앞에 끼워 넣는다.** 커서도 안 건드린다 — 우선 픽은 커서 시퀀스 밖이라
 *   회전 진행분이 그대로 남는다.
 */
import { rotationWindow } from './company-keyword-grid'

export interface PickKeyword {
  id: number; keyword: string; category: string | null; subcategory: string | null; region: string | null; tier: number | null
  /**
   * 🧭 **회전 창 밖에서 뽑혔는가**(미실행 우선 픽). 커서 전진에 세면 안 되는 표시다.
   *
   * ## 왜 필요한가 — 2026-08-23 라이브에서 실제로 난 사고
   * 회전은 `batchSize - 우선픽` 칸만 읽는데 커서는 **돈 키워드 수 전체**만큼 전진했다.
   * 우선 자리가 4→9 로 넓어지자 회차마다 **9칸이 통째로 건너뛰어졌고**, 그 자리는 회전 경계에
   * 고정돼 **영영 조회되지 않는다**(company-collect 가 2026-08-02 에 당한 것과 같은 클래스).
   * 증상은 조용하다 — 백로그 감소가 14.6/h → 11.4/h 로 *느려졌을* 뿐 에러는 없었다.
   */
  fresh?: boolean
}

/**
 * 🌱 회차당 **미실행 키워드**에 내주는 자리 — 이제 하한이다(상한은 아래 `FRESH_MAX_SHARE`).
 *
 * 왜 전부가 아니라 일부인가: 전부 앞세우면 **회전이 몇 주 멈춘다**(이미 도는 키워드가 갱신을 못 받는다).
 */
export const FRESH_KEYWORD_SLOTS = 4

/**
 * 🔁 **스스로 기우는 신선도 배분** (2026-08-23 대표 *"자동으로 계속 가능하게"*).
 *
 * ## 왜 (라이브 실측 — 한 회차 안에서 이만큼 갈린다)
 * ```
 *   단양 소상공인 마케팅   found 48 → saved  0     ← 이미 훑은 키워드
 *   단양 상권분석          found 42 → saved  0
 *   성동 마케팅 대행사     found 10 → saved 10     ← 첫 실행 = 전부 신규
 *   회차 합계 found 204 → saved 16 (7.8%)  ·  미실행 백로그 2,843 / 활성 4,555 (62%)
 * ```
 * 자리가 4개로 **고정**이라 백로그를 다 훑는 데 30일이 걸렸다. 그동안 회전은 가장 마른 구간을 돈다.
 *
 * ## 어떻게 자동이 되나 — 노브가 아니라 **재고가 정한다**
 * 매 회차 미실행을 **상한(75%)까지 달라고 요청**하고, DB 가 있는 만큼만 준다.
 * 백로그가 크면 자연히 9개가 오고, 말라 가면 2개·0개가 오며, 나머지는 그대로 회전이 채운다.
 * ⇒ **카운트 쿼리도 임계값도 필요 없다**(서브리퀘스트 0 추가). 백로그가 0이 되면 이 경로는 스스로 사라진다.
 *
 * ⚠️ 25%는 회전 몫으로 남긴다 — 신선도만 쫓으면 이미 도는 키워드가 갱신을 못 받아 **다음 백로그**가 된다.
 * ⚠️ 두 레인(`collect-company`·`collect-webkr`)이 같은 미실행 줄을 본다. 동시각이면 겹칠 수 있으나
 *    `last_run_at` 이 즉시 갱신되고 저장은 도메인 dedup 이라 손해는 중복 호출 몇 건뿐이다.
 */
export const FRESH_MAX_SHARE = 0.75

const COLS = 'id, keyword, category, subcategory, region, tier'
const ORDER = 'ORDER BY (tier IS NULL) ASC, tier ASC, id ASC'

/**
 * 🧭 **커서를 얼마나 전진시킬 것인가** — 회전 창에서 온 것만 센다.
 *   우선 픽(미실행)은 커서 시퀀스 **밖**이라 세면 안 읽은 자리를 읽은 것으로 표시하게 된다.
 *   호출부가 각자 세면 또 갈리므로 여기 한 곳에 둔다.
 */
export function rotationAdvance(used: PickKeyword[]): number {
  return used.filter(k => !k.fresh).length
}

export async function pickCompanyKeywords(DB: D1Database, total: number, cursor: number, batchSize: number): Promise<PickKeyword[]> {
  const kws: PickKeyword[] = []
  // 하한(기존 동작) 과 상한(75%) 중 **큰 쪽**을 요청한다 — 열리는 방향으로만 움직인다.
  //   실재하는 미실행이 그보다 적으면 DB 가 적게 주고, 모자란 자리는 아래 회전이 그대로 채운다.
  const freshLimit = Math.max(0, Math.min(batchSize,
    Math.max(FRESH_KEYWORD_SLOTS, Math.floor(batchSize * FRESH_MAX_SHARE))))
  if (freshLimit > 0) {
    const fresh = await DB.prepare(`SELECT ${COLS} FROM ad_company_keywords WHERE active = 1 AND last_run_at IS NULL ${ORDER} LIMIT ?`)
      .bind(freshLimit).all<PickKeyword>().catch(() => null)
    kws.push(...(fresh?.results || []).map(k => ({ ...k, fresh: true })))
  }
  // id dedup — 우선 픽이 회전 창에도 들어 있으면 같은 키워드를 한 회차에 두 번 호출하게 된다.
  const seen = new Set(kws.map(k => k.id))
  for (const w of rotationWindow(total, cursor, Math.max(1, batchSize - kws.length))) {
    const rs = await DB.prepare(`SELECT ${COLS} FROM ad_company_keywords WHERE active = 1 ${ORDER} LIMIT ? OFFSET ?`)
      .bind(w.limit, w.offset).all<PickKeyword>().catch(() => null)
    for (const r of rs?.results || []) if (!seen.has(r.id)) { seen.add(r.id); kws.push(r) }
  }
  return kws
}
