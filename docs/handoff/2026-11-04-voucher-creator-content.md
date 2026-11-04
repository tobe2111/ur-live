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

## 2차 (같은 날 저녁) — 수집이 사실상 0이던 것 수리 + 확실한 글은 자동 공개
머지(#2187) 뒤 라이브 실측: 수집 대상 **가게 2곳 · 후보 0건**. 원인 둘(둘 다 이 세션의 오판):
1. **가게 키를 `seller_id + 이름` 으로 잡았다** — 판매 중 이용권 2,444개 중 약 2,200개가 **교환권**(KT 기프티콘 등, 가게 없음)이고,
   이용권 가게 171곳 중 사장님 계정이 붙은 곳은 2곳뿐(나머지는 플랫폼 데모 매장 `seller_id IS NULL`). ⇒ 키 = **이름 + 구**, 교환권 제외.
2. **수집을 메인 cron 워커(`ur-live`)에 달았다** — 그 워커엔 네이버·유튜브 검색 키가 **없다**(Pages·ur-ads 에만 있다). 검색이 조용히 빈손.
   ⇒ 대표 *"2번은 가 로"* — **ur-ads 레인 `/__ads/creator-content`**(자기 인보케이션 · 매시간 레인이라 바쁘면 디스패처가 미룸 · 킬스위치 `ADS_CREATOR_CONTENT_DISABLED`).
- 대표 *"네이버 쪽은 토큰 많잖아 … 많이 활용해봐"* → 가게당 검색 2회(관련도·최신, 각 30건), 회차당 6곳(서브리퀘스트 ~43/50).
- 대표 *"자동으로 이용권들에 업로드가 기본적으로 되게끔"* → **이름 + 동네가 둘 다 있는 글은 바로 `visible`**(`confidentMatch`), 이름만 맞는 글은 후보.
- 사장님 계정이 없는 가게(데모)는 관리 화면을 어드민만 쓸 수 있다(어드민 화면은 아직 없음 — API 만).
### 이어받는 세션의 첫 액션
배포(ur-ads) 뒤 다음 정각 이후: `SELECT status, platform, COUNT(*) FROM store_creator_content GROUP BY 1,2` 와
`SELECT COUNT(*), SUM(naver_at IS NOT NULL) FROM store_content_crawl` — 가게 수가 ~170 이고 naver_at 이 회차마다 6씩 늘면 정상.
ur-ads 하트비트 `ads:creator-content` 가 있는지도 본다.
### 틀렸던 판단
- "판매 중 이용권 2,571개 · 가게 258곳" 을 대표께 그대로 보고했다 — 그 숫자는 **교환권이 섞인** 값이었다. 이용권 가게는 171곳.
- 수집기를 키가 있는지 확인하지 않은 워커에 붙였다. ⇒ 외부 API 를 부르는 cron 은 **그 워커의 바인딩 목록부터** 볼 것.
