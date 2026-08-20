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

export interface PickKeyword { id: number; keyword: string; category: string | null; subcategory: string | null; region: string | null; tier: number | null }

/**
 * 🌱 회차당 **미실행 키워드**에 내주는 자리.
 *
 * 왜 전부가 아니라 일부인가: 미실행이 3,279개라 전부 앞세우면 **회전이 몇 주 멈춘다**(이미 도는
 * 키워드가 갱신을 못 받는다). 기본 배치(12)의 3분의 1이면 신규는 즉시 첫 회를 받고 회전도 계속 돈다.
 */
export const FRESH_KEYWORD_SLOTS = 4

const COLS = 'id, keyword, category, subcategory, region, tier'
const ORDER = 'ORDER BY (tier IS NULL) ASC, tier ASC, id ASC'

export async function pickCompanyKeywords(DB: D1Database, total: number, cursor: number, batchSize: number): Promise<PickKeyword[]> {
  const kws: PickKeyword[] = []
  const freshLimit = Math.max(0, Math.min(batchSize, FRESH_KEYWORD_SLOTS))
  if (freshLimit > 0) {
    const fresh = await DB.prepare(`SELECT ${COLS} FROM ad_company_keywords WHERE active = 1 AND last_run_at IS NULL ${ORDER} LIMIT ?`)
      .bind(freshLimit).all<PickKeyword>().catch(() => null)
    kws.push(...(fresh?.results || []))
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
