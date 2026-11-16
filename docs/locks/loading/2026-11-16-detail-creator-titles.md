# [LOADING_ADDITIVE] 2026-11-16 이용권 상세 API — '다녀온 사람들' 제목 5개(크롤러 본문 재료)

- 대상: `src/features/group-buy/api/group-buy-public.routes.ts` `GET /products/:id` — `buildDetailMeta` 호출 인자 + 응답 spread **기존 줄 안에서**(줄 수 1139 불변).
- 대표 지시: *"응 계속 진행해줘"* — 검색 유입 점검(실 방문자 하루 ~11명 · 봇 제외 실측 2026-11-14).
- 왜: `/pass/2919` 크롤러 본문 173자(설명 = 상품명이라 반복 제거). 가게별로 이미 모은 공개 후기 제목이 가장 큰 고유 텍스트.
- 무엇: `detail-meta-enrich.buildDetailMeta` 가 `store_creator_content`(공개 · 고정 먼저 · 5개) 한 번 읽어 `creator_titles` 로 싣고,
  `buildDetailNoscript` 가 `다녀온 사람들: 제목(작성자), …` 한 줄을 크롤러 본문에 더한다(사람 화면 무변 — noscript).
- **불변으로 지킨 잠금 항목**: `Cache-Control` max-age=60 / `CDN-Cache-Control` 900 분리 · `group_buy_tiers` 서버 parse — 무접촉.
  비용: 상세 API D1 읽기 +1(엣지 캐시 900초 뒤라 상품당 15분에 1회) · 응답 +~0.5KB(제목 5개).
- 가드: `crawler-creator-titles-2026-11-16.test.ts` 4 + 주입 3.
- E4 판정: 배포 뒤 `curl -A 'Mozilla/5.0 (compatible; Yeti/1.1)' https://urdeal.kr/pass/2919` 본문에 '다녀온 사람들:' 줄. 순위 효과는 수주 뒤.
- 롤백: `creatorLine(d.creator_titles)` 제거(데이터는 남아도 무해).
