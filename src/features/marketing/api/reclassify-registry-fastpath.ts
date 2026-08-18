/**
 * ⚡ **등록부 행 벌크 전진** — 한 바퀴 38일을 2일로 (2026-08-18).
 *
 * ## 무엇이 낭비였나 (실측)
 * ```
 * 풀 334,949  ·  회차당 250~500행  ·  시간당 1회   →  한 바퀴 38일
 * 그중 등록부 소스(정부 신고 업태)가 대부분이고, 그 행들의 판정 변화율은 **0.0%(0/2,250)**
 * ```
 * 즉 재분류 랩의 대부분은 **분류기를 돌리고 UPDATE 를 쳐서 똑같은 값을 다시 쓰는 일**이다.
 * 그 사이 정작 규칙 수정이 필요한 행(webkr·local)은 다음 랩까지 기다린다.
 *
 * ## 어떻게 안전하게 건너뛰나 — **표본으로 매 회차 확인한다**
 * "등록부는 안 바뀐다"를 **상수로 믿지 않는다.** 앞으로 규칙이 등록부 판정을 건드릴 수도 있고,
 * 그때 조용히 건너뛰면 이 레포가 반복해 온 *"에러 없는 부재"* 가 된다.
 *
 * ```
 * 매 회차:  ① 평소대로 250행을 진짜 분류기로 처리한다(이게 표본이다)
 *          ② 그 회차의 등록부 표본이 충분하고 **한 건도 안 바뀌었으면** 벌크 전진
 *          ③ 한 건이라도 바뀌었으면 벌크 없음 — 그 회차는 평소 속도로만 간다
 * ```
 * 규칙이 등록부를 흔드는 순간 ②가 저절로 꺼진다. **판단 근거를 매번 새로 만든다.**
 *
 * ## 🔒 절대 건너뛰지 않는 것
 * - **첫 분류**(`classify_confidence` 가 'registry' 가 아닌 행) — 한 번도 판정 안 된 행을
 *   도장만 찍고 넘기면 그 행은 영영 분류되지 않는다. 벌크 대상은 **이미 같은 분기로 판정된 행**뿐이다.
 * - `category` 가 빈 행 — 등록부 분기 자체가 `!!r.category` 를 요구한다(조건이 다르면 결과도 다르다).
 * - 우선순위 티어(webkr·local) — 애초에 소스가 다르다.
 */
import { REGISTRY_CATEGORY_SOURCES } from './company-classify'

/** 이만큼은 진짜로 분류해 본 회차여야 벌크를 허용한다(표본이 얇으면 "안 바뀌었다"가 근거가 못 된다). */
export const FASTPATH_MIN_SAMPLE = 150
/**
 * 한 회차에 벌크 전진할 행 수. 279,041행 ÷ 5,000 ÷ 24회 ≈ **2.3일** — 목표(38일 → 2일)의 근거.
 * ⚠️ 올리기 전에 회차 소요시간을 볼 것. 이 레인은 마감선이 있고, 넘기면 커서가 안 저장돼
 *   다음 회차가 같은 자리를 다시 훑는다(이 레포가 겪은 "영원히 전진 0").
 */
export const FASTPATH_BULK = 5_000

export interface FastPathDecision { allow: boolean; reason: string }

/**
 * 이번 회차에 벌크 전진을 해도 되는가. **순수 함수** — 근거는 그 회차의 실측 표본뿐이다.
 *
 * @param regSeen    이번 회차에 진짜 분류기를 통과한 등록부 행 수
 * @param regChanged 그중 판정이 달라진 행 수
 */
export function decideRegistryFastPath(regSeen: number, regChanged: number): FastPathDecision {
  if (!(regSeen >= FASTPATH_MIN_SAMPLE)) return { allow: false, reason: `표본 부족(${regSeen}/${FASTPATH_MIN_SAMPLE})` }
  if (regChanged > 0) return { allow: false, reason: `등록부 판정이 바뀌는 중(${regChanged}/${regSeen}) — 전수 재판정 유지` }
  return { allow: true, reason: `등록부 표본 ${regSeen}건 전부 불변 — 벌크 전진` }
}

/** 등록부 소스 목록을 SQL IN 절로. 목록이 비면 벌크 자체를 못 한다(호출부가 막는다). */
export const registrySourcesSql = (): string =>
  Array.from(REGISTRY_CATEGORY_SOURCES).map(s => `'${String(s).replace(/'/g, "''")}'`).join(', ')

/**
 * 벌크 대상 행을 고르는 조건.
 *
 * ⚠️ `classify_confidence = 'registry'` 가 **이 설계의 안전핀**이다 — 이미 등록부 분기로 판정된 행만
 *   골라, 우리가 건너뛰는 것이 *재판정*이지 *첫 판정*이 아님을 보장한다.
 */
export const fastPathWhere = (sources: string): string =>
  `merged_into IS NULL AND source IN (${sources}) AND classify_confidence = 'registry'`
  + ` AND category IS NOT NULL AND COALESCE(classified_v, 0) < ? AND id > ?`

/**
 * 벌크 전진 실행 — 판단(`decideRegistryFastPath`)과 SQL 을 한 자리에 둔다.
 *
 * @returns `cursor` 는 **성공했을 때만** 앞으로 간다. 실패했는데 옮기면 그 구간이 영영 미분류로 남는다.
 */
export async function advanceRegistryFastPath(
  DB: D1Database, rulesVersion: number, cursor: number, regSeen: number, regChanged: number,
): Promise<{ cursor: number; reason: string }> {
  const d = decideRegistryFastPath(regSeen, regChanged)
  const sources = registrySourcesSql()
  if (!d.allow || !sources) return { cursor, reason: d.reason }
  const where = fastPathWhere(sources)
  // 먼저 **어디까지 갈지** 본다 — UPDATE 뒤엔 조건이 거짓이 되어 그 범위를 다시 못 구한다.
  const span = await DB.prepare(`SELECT MAX(id) AS m, COUNT(*) AS n FROM (SELECT id FROM ad_company_leads WHERE ${where} ORDER BY id LIMIT ?)`)
    .bind(rulesVersion, cursor, FASTPATH_BULK).first<{ m: number | null; n: number }>().catch(() => null)
  if (!span?.m || !(Number(span.n) > 0)) return { cursor, reason: `${d.reason} · 대상 없음` }
  const done = await DB.prepare(`UPDATE ad_company_leads SET classified_v = ? WHERE id IN (SELECT id FROM ad_company_leads WHERE ${where} ORDER BY id LIMIT ?)`)
    .bind(rulesVersion, rulesVersion, cursor, FASTPATH_BULK).run().catch(() => null)
  if (done) { return { cursor: Number(span.m), reason: `${d.reason} · ${span.n}행` } }
  return { cursor, reason: `${d.reason} · 벌크 실패(다음 회차 재시도)` }
}
