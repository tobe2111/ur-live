import type { D1Database } from '@cloudflare/workers-types'

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
 * 키워드에서 지역 추출 — **접두 일치만** 인정한다.
 *   `"강남 맛집"` → `'강남'` / `"맛집 강남"` → null(어순이 다르면 지역 의도가 아닐 수 있다)
 *   `"강남스타일"` → null(토큰 뒤에 공백이 와야 지역 수식으로 본다 — 오탐 방지)
 * 못 찾으면 null. 호출부는 null 을 '확인했지만 지역 없음'으로 저장해 재검사를 막는다.
 */
export function regionFromKeyword(keyword?: string | null): string | null {
  const k = String(keyword || '').trim()
  if (!k) return null
  for (const t of REGION_TOKENS) {
    // 토큰 + 공백(또는 '구/시' + 공백) 으로 시작할 때만 — '강남스타일'·'제주항공' 같은 고유명사 오탐 차단.
    if (k.startsWith(`${t} `) || k.startsWith(`${t}구 `) || k.startsWith(`${t}시 `)) return t
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
