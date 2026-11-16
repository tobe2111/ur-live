/**
 * 🔎 지역 페이지 제목 본문 (2026-11-16 검색 유입 점검) — 서버 메타(`worker/utils/surface-ssr-meta.ts`)와
 * 클라 `pages/region/RegionPage.tsx` 가 **같은 함수**를 쓴다(갈리면 마운트 때 제목이 바뀐다).
 *
 * 종전 `서울 서초구 이용권·동네딜 할인` — 사람들은 '서초 맛집 할인' 으로 찾는데 제목에 '맛집' 이 없었다.
 * '이용권' 은 우리 명칭(SSOT)이라 남기고, 검색어(맛집·뷰티·할인)를 앞에 둔다. 가운뎃점은 한 줄에 하나(anti-slop).
 */
export function regionTitleCore(label: string): string {
  return `${label} 맛집·뷰티 할인 이용권`
}
