# 2026-11-04 — 쇼핑(/browse) 폐기 · /join 시안 B

1. **/browse → /vouchers 301** — 대표 *"쇼핑 페이지가 살아있네? 없애줄 수 있나? 구글에서도 쇼핑 안 떴으면"*.
   쇼핑 탭은 2026-06-10 부터 숨김인데 주소는 200 이었고 sitemap 이 제출해 구글 결과에 '쇼핑' 줄이 떴다.
   `consumer-redirects`(서버 301) · App.tsx `<Navigate>` · sitemap 에서 뺌 · 표 행 `noindex`(crumb 는 상품 상세 빵부스러기가 써서 남김 — 시험에 예외 명시).
   ⚠️ 남은 것: 상품 상세(`/products/:id`) 빵부스러기 가운데 단계가 아직 `/browse`(301) 를 가리킨다 — 별건.
   BrowsePage 파일·SSR 시드·예열은 로딩 잠금표 항목이라 손대지 않았다(301 이 먼저라 실행되지 않는다).
2. **/join 시안 B** — 대표 *"B가 낫겠네"*. (구현 기록은 아래에 이어 적는다)
   구현: `JoinChoicePage` 다시 씀 — 손님(세 줄 + 실제 인기 이용권 3장 `usePopularPassFeed` + 카카오로 시작 + 로그인 없이 둘러보기) ·
   사업자라면(가게 등록 `/store/new` · 에이전시 `/agency/signup`). 사이트 테마 따름. SEO 설명·크롤러 문구(surface-copy) 같이 갱신.
