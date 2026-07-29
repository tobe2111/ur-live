import type { D1Database } from '@cloudflare/workers-types'
import { readSetting, writeSetting } from './influencer-settings'

/**
 * 📍 수집 키워드에서 활동 지역 추출 (2026-07-29 신설).
 *
 * 배경: 서비스몰이 **"지역·업종 맞춤 인플루언서 협찬 매칭"**(15,000원/명)을 파는데, 인플루언서 풀에는
 *   지역 필드가 **아예 없었다**(40개 컬럼 전수 확인). 광고주가 "강남 맛집 인플루언서 10명"을 주문하면
 *   이행이 통째로 수작업이 된다 — 쿼리로 못 고른다.
 *
 * 그런데 정보는 이미 있다. 수집 키워드가 `"강남 맛집"`·`"영등포 카페"` 처럼 **지역명으로 시작**한다
 *   (연락 대상 2,285명 중 401명=17% 가 지역 키워드로 수집됨). 그 값을 수집 시점에 컬럼으로 남긴다.
 *
 * ⚠️ 추정이지 확정이 아니다 — "강남 맛집"으로 발굴된 블로거가 강남 거주자란 뜻은 아니고,
 *   **그 지역을 다루는 콘텐츠를 쓴다**는 뜻이다. 매칭 후보를 좁히는 신호로만 쓸 것(단정 금지).
 */

/** 지역 토큰 — 값은 `@/shared/ads/region-tokens`(어드민 필터와 공유하는 SSOT). 여기서 재수출해 기존 import 경로 유지. */
import { REGION_TOKENS } from '@/shared/ads/region-tokens'
export { REGION_TOKENS }

/**
 * 📐 **규칙 버전** — 아래 `regionFromKeyword` 의 판정 규칙을 바꾸면 **반드시 +1** 할 것.
 *
 *   왜 필요한가: 미매칭은 `''`(확인했지만 지역 없음)로 **확정 저장**된다. 재검사를 막아 비용을 아끼는
 *   설계인데, 그 대가로 **규칙을 고쳐도 기존 행은 영영 안 고쳐진다.** 2026-07-29 에 실제로 그랬다 —
 *   `'방배동 맛집'`(누적 241명)이 `동` 접미 미지원으로 전부 지역 없음이었고, 매처만 고쳤다면 새로 수집되는
 *   행만 맞고 기존 241명은 틀린 채 남았을 것이다(에러 없이 조용히).
 *   ⇒ 버전이 오르면 `''` 행을 **한 번만** 재판정한다(아래 `recheckBlankRegions`).
 *
 *   v2: `동/군/읍/면/리` 접미 지원 추가(기존 `구/시` 에 더해). 이 레포의 시드·수기 키워드가 실제로
 *       `'방배동 맛집'` 처럼 행정동 이름을 쓴다 — 대표의 8월 방배 시딩이 정확히 그 형태였다.
 */
export const REGION_RULES_VERSION = 2
const REGION_RULES_VERSION_KEY = 'ads_region_rules_v'

/** 지역 토큰 뒤에 올 수 있는 행정 단위 접미(빈 문자열 = 접미 없이 바로 공백). */
const ADMIN_SUFFIXES = ['', '동', '구', '시', '군', '읍', '면', '리'] as const

/**
 * 키워드에서 지역 추출 — **접두 일치만** 인정한다.
 *   `"강남 맛집"` → `'강남'` · `"방배동 맛집"` → `'방배'` · `"수원시 카페"` → `'수원'`
 *   `"맛집 강남"` → null (어순이 다르면 지역 의도가 아닐 수 있다)
 *   `"강남스타일"`·`"제주항공"`·`"성수기"`·`"고양이"` → null
 *     (토큰 + 선택적 행정단위 접미 **다음에 공백**이 와야 지역 수식으로 본다 — 고유명사 오탐 차단)
 * 못 찾으면 null. 호출부는 null 을 '확인했지만 지역 없음'으로 저장해 재검사를 막는다.
 * ⚠️ 이 규칙을 바꾸면 위 `REGION_RULES_VERSION` 을 +1 할 것 — 안 올리면 기존 `''` 행이 안 고쳐진다.
 */
export function regionFromKeyword(keyword?: string | null): string | null {
  const k = String(keyword || '').trim()
  if (!k) return null
  for (const t of REGION_TOKENS) {
    for (const suf of ADMIN_SUFFIXES) if (k.startsWith(`${t}${suf} `)) return t
  }
  return null
}

/**
 * 📍 기존 리드 지역 백필 — `source_keyword` 는 이미 있으므로 **외부 호출 0**(DB 만, 수집 예산 무관).
 *   틱마다 조금씩 채워 자연 수렴한다(38k 행 ≈ 이틀). 지역이 없는 키워드는 `''` 로 표시해 재검사하지 않는다.
 *   ⚠️ 예산(`FetchBudget`)을 건드리지 않는다 — 발굴 수확을 줄이지 않기 위한 설계상의 핵심.
 */
export async function backfillRegions(DB: D1Database, poolId: number, max = 400): Promise<number> {
  const rows = (await DB.prepare(`SELECT id, source_keyword FROM ad_influencer_leads
      WHERE account_id = ? AND region IS NULL AND source_keyword IS NOT NULL AND source_keyword != '' LIMIT ?`)
    .bind(poolId, max).all<{ id: number; source_keyword: string }>().catch(() => null))?.results || []
  if (!rows.length) return 0
  const stmts = rows.map(r => DB.prepare('UPDATE ad_influencer_leads SET region = ? WHERE id = ?')
    .bind(regionFromKeyword(r.source_keyword) ?? '', r.id))
  for (let i = 0; i < stmts.length; i += 100) await DB.batch(stmts.slice(i, i + 100)).catch(() => null)
  return rows.length
}

/**
 * 🔁 규칙 버전이 오르면 `''`(지역 없음으로 확정된) 행을 **한 번만** 재판정한다.
 *
 *   왜 이 모양인가: 행을 하나씩 다시 훑으면 3만+ 행이라 비싸다. 대신 **구별되는 키워드**만 뽑아
 *   (수백 개 수준) JS 에서 새 규칙으로 재판정하고, *새로 매칭된 키워드에 대해서만* UPDATE 한 방씩 쏜다.
 *   현재 이득은 키워드 1개(`방배동 맛집`)뿐이라 실제 발행 쿼리는 [SELECT DISTINCT 1 + UPDATE 1 + 버전쓰기 1].
 *
 *   멱등: 버전을 저장한 뒤에는 조건이 거짓이라 다시 안 돈다. 실패하면 버전을 안 써서 다음 틱이 재시도한다.
 *   ⚠️ 이 함수가 **버전을 올리는 유일한 소비자**다 — 상수만 올리고 이걸 안 부르면 아무 일도 안 일어난다.
 */
export async function recheckBlankRegions(DB: D1Database, poolId: number): Promise<number> {
  const stored = parseInt((await readSetting(DB, REGION_RULES_VERSION_KEY).catch(() => null)) || '0', 10) || 0
  if (stored >= REGION_RULES_VERSION) return 0
  const rows = (await DB.prepare(`SELECT DISTINCT source_keyword AS k FROM ad_influencer_leads
      WHERE account_id = ? AND region = '' AND source_keyword IS NOT NULL AND source_keyword != '' LIMIT 2000`)
    .bind(poolId).all<{ k: string }>().catch(() => null))?.results || []
  // 타입 명시 — 튜플 구조분해는 D1 제네릭 추론에 기대면 깨지기 쉽다(빌드 환경마다 다르게 읽힌다).
  const now: Array<{ k: string; t: string }> = []
  for (const r of rows) { const t = regionFromKeyword(r.k); if (t) now.push({ k: r.k, t }) }
  let fixed = 0
  for (let i = 0; i < now.length; i += 50) {
    const slice = now.slice(i, i + 50)
    const res = await DB.batch(slice.map(({ k, t }) => DB.prepare(
      "UPDATE ad_influencer_leads SET region = ? WHERE account_id = ? AND region = '' AND source_keyword = ?",
    ).bind(t, poolId, k))).catch(() => null)
    for (const r of res || []) fixed += (r?.meta as { changes?: number } | undefined)?.changes || 0
  }
  // 성공한 회차에만 버전을 올린다 — 실패하면 다음 틱이 같은 일을 다시 시도한다(멱등이라 안전).
  await writeSetting(DB, REGION_RULES_VERSION_KEY, String(REGION_RULES_VERSION))
  return fixed
}
