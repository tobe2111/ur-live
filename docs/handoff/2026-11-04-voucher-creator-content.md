# 2026-11-04 — 이용권 상세 '다녀온 사람들' (손님 2 + 사장님 2 + 블로그 창)

## 이 세션이 한 것
- 표 `store_creator_content`·`store_content_crawl`(런타임 ensure + repair-schema 등록), SSOT `src/shared/creator-content.ts`.
- API: 공개 `/api/creator-content/:productId`(10분 엣지 캐시) · 사장님 `/api/seller/creator-content/*`(소유권 `products.seller_id`) · 어드민 같은 모양.
- 수집 cron 매시 :45 `creator-content-collect` — 네이버 블로그 5곳 + 유튜브 1곳(하루 15회 몫), 전부 `candidate`.
- 유어애즈 `influencer-enrich-lane.ts` 의 유튜브 성과 상한이 그 몫(쓴 것 + 아직 안 쓴 것)을 비워 둔다(읽기는 기존 1회에 합침).
- 손님: `GroupBuyDetailPage` 가격 아래 lazy 칸 `CreatorContentRow` + `ContentViewer`(영상·블로그 창) + `PinnersSheet`.
- 사장님: `/seller/group-buy/:productId/content`(`SellerCreatorContentPage`), 이용권 줄 펼침 메뉴에 입구. 6개 언어.
- CSP `frame-src` 에 instagram·tiktok·m.blog.naver·blog.naver 추가.
- 시험 `creator-content-2026-11-04.test.tsx`(26건) + 주입 `scripts/mutations/creator-content-2026-11-04.mjs`(5건).

## 이 작업을 이어서 하라고 했을 때의 첫 액션
1. 배포 뒤 한 시간 안에 `store_content_crawl` 행 수와 `store_creator_content` 의 `status='candidate'` 수를 D1 에서 본다
   (`SELECT status, platform, COUNT(*) FROM store_creator_content GROUP BY 1,2`). 0이면 `cron_heartbeats` 의 `creator-content-collect` 를 본다.
2. 블로그 후보 `embeddable` 비율 — 네이버가 창 안 표시를 막는지가 여기서 판정된다(0% 면 전부 미리보기로 뜬다. 정상 동작).
3. 유튜브 `urdeal_content_yt_used` 가 하루 15를 안 넘는지, 유어애즈 `ads_yt_perf_units` 가 403 없이 도는지.

## 틀리기 쉬운 것
- 가게 키는 `seller_id:정규화한 가게 이름` — 판매 중 이용권 2,571개 중 seller_id 는 2개뿐이라(대부분 플랫폼이 올린 가게) **seller_id 만으로 묶으면 안 된다.**
- 유어딜 사람(체험단·유어쇼츠·담기)은 이 표에 원본이 없다. 표에는 **숨김 기록만**(`platform='urdeal_*'`).
- 유어애즈 **검색**(하루 최대 90회)은 이 몫을 모른다. 검색 90 + 우리 15 = 105회면 이론상 10,000점을 넘는다 — 실측 검색은 하루 22~66회라 지금은 여유. 검색 예산을 올릴 땐 같이 볼 것.

## 남은 것 / 대기
- 라이브 실측 전(E3 까지). 네이버 창 허락 여부·후보 질은 배포 뒤에만 안다.
- 인스타·틱톡은 자동 검색 공식 방법이 없어 주소 붙여 넣기만.
