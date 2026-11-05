# 2026-11-04 마이페이지 버벅임

대표: *"최적화가 필요하네 버벅임이 심하네 특히 마이페이지."* (스크린샷 3장 — 홈 정상 · 하드 로드 중 빈 화면 ·
'인터넷 연결이 끊겼습니다' 띠 아래 판매 판 없이 '매장 계산대' 카드 하나만 남은 마이)

서비스: **유어딜(소비자)** 마이 `/user/profile` · 머니 경로 접촉 없음(읽기 표시만) · 롤백: revert.

## 실측 (하네스 `visual-preview --cpu` · CPU 4배 느리게 = 중급 폰 · `--stores=1` 사장님)
| | 고치기 전 | 후 |
|---|---|---|
| 첫 1초 React 커밋 | **60회**(16ms 마다) — 홈은 9회 | 숫자 한 칸만 |
| 스크립트 시간 | 1,147ms (홈 641) | 952~970ms |
| React 작업 | 663ms | 448ms |
| 긴 작업(화면 멈춤) | 7개 | 4~5개 |

## 원인과 처방
1. **오늘 매출 숫자 올라가기**(`useCountUp`, 11-02 모션)가 `SellerSection` 본체에서 돌아 0.8초 동안 매 프레임
   판매 구역 전체를 다시 그렸다 → 숫자만 `TodayRevenueCount` 로 분리(움직임 동일).
2. **탭을 누를 때마다 빈손 재조회** — 페이지가 리마운트되며 `useMyStores`·'내 딜'이 매번 원본 DB 왕복을 기다렸고,
   회선이 끊기면 좌석 조회가 `failed` → 판매 판이 통째로 사라지고 폴백 '매장 계산대'만 남았다(스크린샷 3).
   → 같은 탭 재방문은 지난 값을 즉시 그리고 뒤에서 새로 받는다(메모리만 · 같은 user_id · 좌석 세대 같을 때 · 30분).
   좌석은 재조회 실패에도 그린 값을 유지. **'내 딜' 잔액은 실패하면 종전대로 `—`**(돈 숫자 위장 금지 가드 준수).

가드: `src/tests/unit/my-page-jank-2026-11-04.test.tsx`.

## 못 한 것 / 틀렸던 판단
- 스크린샷 2(빈 화면)는 HTML 자체가 아직 안 온 하드 로드 — 회선 문제라 앱 코드로는 못 줄인다.
- 프로파일의 `(program)` 1.6초(파싱·스타일·레이아웃)는 그대로다. 마이 화면 자체 크기가 원인이라 다음 후보.
- 하네스의 커밋 계측은 첫 판에서 손대지 않은 형제 fiber 까지 셌다(과대) — 판정은 CPU 시간으로 했다.
- 실제 폰·한국 회선 체감은 로그인 필요라 못 쟀다 → 대표 확인 대기.

## ✅ 1차 머지 — PR #2191 `d852e2b6` (E3 배포까지. 폰 체감 E4 는 대표 확인 대기)

## 2차 (대표 *"마이페이지도 리스터코퍼레이션 에이전시 명 그 부분이나 몇몇 부분만 유독 늦게 떠. 다른 페이지들도 다 봐줘. 손님 페이지들. 데이터가 느리고, 유저가 갑자기 많이 들어와도"* → *"가장 이상적인 최적화를 해줘"*)

서비스: 유어딜(소비자) · 에이전시 구역(마이 안) · 머니 경로 없음 · 롤백 revert.

### A. 마이 에이전시 구역 — 4단 줄서기 → 첫 렌더에 한꺼번에 출발
종전: 마이 그림 → 에이전시 화면 코드(lazy) → `/me·/staff·/payouts` → 매장 판 코드 → `/stores·/notifications`.
→ `warmAgencyZone()`(agency-doors) 가 마이 첫 렌더에서 코드 4조각 + 조회 5건을 출발. `agencyRequest` 는 같은 GET 을
처음 부를 때 한 번만 그 응답을 쓴다(같은 토큰 · 10초 · POST 제외). 에이전시 로그인이 없으면 아무것도 안 받는다.
가드 `agency-warm-2026-11-04.test.ts`. 앵커 재조준 2건(`agency-in-my`·`my-agency-merged` — lazy 선언 모양만 바뀜).
⚠️ 에이전시 이름(제목)은 여전히 '내 가게' 좌석 응답을 기다린다(`storeCount>0` 조건) — 첫 방문만. 재방문은 1차의 좌석 기억으로 즉시.

### B. 손님 페이지 전수 — **`CDN-Cache-Control` 은 아무것도 캐시하지 않는다**
라이브 실측: 모든 API 응답이 `cf-cache-status: DYNAMIC`(Pages Functions). 원본을 막는 것은 코드 안 `publicCache`/`edgeCache` 뿐이고,
헤더만 붙인 공개 API **12곳**이 같은 URL 세 번에 세 번 다 원본이었다(사람이 몰리면 그대로 D1·KV 직행):
`promo-bar`(모든 페이지) · `feature-flags` 둘(매 요청 KV 목록 전체) · `seeding/offer/:id`(이용권 상세마다) · `seeding/open` ·
`consumer-settings`(지도) · 유어샵 `sns-posts`(index.ts app.use) · `region/label` · `regions` · `public/new-openings` ·
`public/area-report` · `home-service/deal-subcats` → 전부 `publicCache`. 핸들러가 로그인 정보를 안 읽는 것을 하나씩 확인.
가드 `public-edge-cache-real-2026-11-04.test.ts`(고친 12곳 + "헤더만 캐시" 공개 GET 신규 0 래칫, 기준선 13).
잠금 파일(`public-utility.routes.ts`) 추가 기록: `docs/locks/loading/2026-11-04-public-cache-real.md`.

### 측정했지만 고칠 게 아니었던 것
- 손님 화면 HTML: 서버 안 처리 **18~62ms**(`Server-Timing`) — 0.2~1.6초 들쭉날쭉은 측정 회선(IAD 경유) 몫.
- 홈·교환권·이용권 상세·유어샵·숙소·지도·유어쇼츠의 주요 API 는 이미 `*-HIT`.
- `region/resolve`(GPS 동네 찾기 1.3초)는 사용자가 버튼을 누를 때만 · 좌표마다 달라 캐시 효과 작음 → 그대로.

### 이번에 틀렸던 판단
- 첫 측정기가 "첫 요청 직후 바로 두 번째" 를 보내 캐시 저장(waitUntil)이 끝나기 전에 물었다 → `search/popular` 등을 캐시 없음으로 오판.
  간격을 두고 세 번째로 판정하니 HIT. **캐시 판정은 세 번 · 간격을 두고.**
- `map-clusters` NONE 은 bbox 없는 400 응답이었다(2xx 만 캐시) — 잘못된 URL 로 잰 것.

### 남은 것
- `/store/scan`(사장님 계산대) 실사용 LCP 5.2초(표본 1) — 손님 화면 밖이라 이번 범위 밖. 다음 후보.

## 3차 (대표 *"사람들이 대부분 처음 진입하는걸텐데 캐시 데이터베이스가 의미가 있어? … 데이터가 느릴 때 많이 느리던데"* → 선택 *"1+2+3 순서대로"*)

### 0. 실측 — 첫 진입이 느린 구조적 이유
- RUM `TTFB colo:*` 1주(10-29~11-04): 한국 손님은 **HKG·NRT·LAX** 로만 붙었다 — **ICN 0건**. 무료 요금제의 한국 통신사 경로 문제. 코드로 못 바꾼다 → 유료 옵션 조사·결재 대상(미작성 — 다음 할 일).
- D1 원본 `ENAM`, `read_replication.mode=auto`(켜져 있음). 사본은 세션 API(`publicReadDb`/`userReadDb`)를 쓰는 9파일에서만.
- 1차의 "지난 값 기억"은 재방문 전용, 2차 엣지 캐시는 colo 별 공용이라 저트래픽에선 대부분 빈다 — 첫 방문 해결책이 아님을 대표에게 정직하게 보고.
- **판정 장치**: 홈 섹션 응답에 `Server-Timing: d1;desc="replica:APAC"` → 브라우저가 세션당 1건 `D1` 표본(`d1:<primary|replica>[:지역]@<colo>`)으로 보낸다. 어드민 `/api/analytics/summary?day=` 의 `vitals:…:D1:` 로 **한국 손님 질의를 어느 지역이 답하는지** 판정(배포 다음 날부터).

### 1. 첫 방문 코드 −184KB(로그인 손님 마이 실측 868 → 684KB, 긴 작업 9 → 4)
- 공용 부품 봉투 `app-components`(109KB)를 끌어오던 문 둘:
  ① 번호 필수 창(오늘 #2177) — 마운트 조건이 "이 기기에 user_phone 없음"이라 새 기기·번호 없는 손님마다. → `lib/phone-gate-door` 가 서버 `phone_required` 일 때만 창 코드를 받고, 아니면 user_id 별 표시(`user_phone_ok`)를 남겨 다음엔 묻지도 않는다.
  ② 푸시 설정 부품 — granted 가 아니면 아무것도 안 하는데 로그인만 보면 마운트. → `Notification.permission === 'granted'` 일 때만.
- 가드 `phone-gate-door-2026-11-04.test.tsx`.

### 2. 차례 묻기 줄이기(조사 에이전트 표 — 마이 계열 13 엔드포인트)
- **내 이용권 버그**: `ensureVoucherGiftTable` 의 WeakSet 이 사본 세션(요청마다 새 객체)을 키로 써 DDL 2문장이 **매 요청 미국 원본**으로 갔다 → `dbKey` + 선물 두 조회 나란히(−3 왕복). 되돌려-검증 빨간불 확인.
- 찜(2→1) · 유어샵 대시보드 가게 없는 손님(3→1, 이메일 매칭을 첫 Promise.all 로).
- 가드 `first-visit-roundtrips-2026-11-04.test.ts`.
- ⚠️ **안 한 것(다음 후보, 표 근거)**: 내 이용권 나머지 직렬(잠금표 파일 `group-buy-public.routes.ts` — 6→1 가능) · `seller/orders` 8→2~3 · 에이전시 `/me`(가드 행 재조회)·`/staff`·`/stores`·`/notifications` 각 −1 · `my-stores/summary` 서브쿼리 2→1.

### CI surface-budgets
main(b673c0e) 자체가 이미 초과(linkshop +1.8)였다. 이 PR 몫은 화면당 +0.1~0.3KB(에이전시 +0.9) — 사유와 함께 rebaseline
(`scripts/surface-budgets-history/2026-11-04-home-linkshop-vouchers-and-3.json`). 에이전시 미리받기 코드는 `lib/agency-presence`(app-utils)
에서 `pages/agency-console/agency-warm.ts` 로 옮겨 손님 공용 묶음 증가를 없앴다.

### 틀렸던 판단
- 2차에서 에이전시 미리받기 코드를 "의존성 없는 작은 모듈"에 넣은 것 — 그 모듈이 모든 화면 공용 묶음(app-utils)에 있어 손님 전원이 받았다.
- 실행 중 git 기록을 `reset --soft HEAD~1` 로 꼬았다(머지 커밋을 날림) → reflog 로 복구, 패치로 다시 적용.

## ✅ 3차 머지 — PR #2193 `67d33548` (E3)

## 4차 (대표 *"또 더 최적화해 대기업급으로 해야해"*)
- 내 이용권 `/vouchers/my`: 이용권·KT·선물 세 조회 한 물결 — [UNLOCK_LOADING] 대표 *"허가 — 고쳐줘"* (`docs/locks/loading/2026-11-04-vouchers-my-one-wave.md`).
  `voucher-gift.ts` 를 `loadGiftState`(조회) + `applyGiftState`(표시) 로 분리, `withGiftState` 계약 유지.
- 사장님 주문 목록 `/seller/orders`: 8 → 3 왕복(개수 같은 물결 · 부가정보 4단 → 2물결).
- 에이전시 `/me`: 가드가 같은 JOIN 으로 표시 칸까지 싣고 `/me` 는 재조회 안 함(2 → 1).
- 가드 `serial-waves-round4-2026-11-04.test.ts`.
- 남은 후보: 에이전시 `/staff`·`/stores`·`/notifications`(가드 + 본 조회 직렬 — 미들웨어 구조라 이득 1왕복씩) · `my-stores/summary` 서브쿼리(2→1, 사장님 매출이라 신중) ·
  한국 연결(ICN) 유료 옵션 결재 문서.
- (4차 추가) 대표 *"잠금파일도 모두 허가해줄게"* → `vite.config.ts` 지갑 부품 다섯을 `app-wallet` 으로: 내 이용권 첫 방문 870→741KB.
  기록 `docs/locks/loading/2026-11-04-wallet-chunk.md`. 홈 지도 미리받기(`map-warmup`)는 `load`(사진까지) 뒤라 그대로 — 하네스가 사진을 막아 일찍 뜬 것처럼 보였을 뿐.
  ⚠️ 결제(Toss) 잠금 파일은 속도와 무관해 손대지 않았다.

## ✅ 4차 머지 — PR #2197 (E4: 라이브 MyVouchersPage 청크가 app-components 정적 import 0 · app-wallet 사용 확인)

## 5차 (대표 *"최적화 계속"*)
- 상세 머리줄(`DetailFloatingHeader`): 스크롤마다 `offsetHeight` → ResizeObserver + rAF. 가드 `detail-header-scroll-2026-11-04.test.ts`.
- **실측했지만 기각한 가설**(다시 시도하지 말 것):
  - `content-visibility:auto` 를 홈 피드 카드에 — 라이브 3회 A/B 에서 배치 시간 변화 없음(364~409 vs 370~471ms @CPU×4) + 문서 높이 추정이 어긋남(14,585→15,425px, 스크롤 튐 위험).
  - 마이 "숫자 올라가기"가 배치 54회의 주범 — 횟수는 맞지만(동작 줄이기 시 11회) 시간은 403→344ms 로 작다. 배치 비용은 초기 몇 번이 크다.
  - 홈 피드 42장 일괄 렌더 — 이미 `useProgressiveCap`(6장부터)로 점진 렌더 중.
- 라이브 측정 도구(재사용): `/tmp` 아닌 저장소엔 없음 — 실서비스에 playwright + `--proxy-server=$HTTPS_PROXY --ssl-version-max=tls1.2` + CDP `Performance.getMetrics`(LayoutDuration·LayoutCount·RecalcStyle*) 로 잰다.
- (5차 추가) 💾 마이 '내 딜'·'내 가게'를 **기기에도** 기억(localCache — 주인 바뀌면 통째로 지움): 앱 재시작에도 즉시 그림.
  내 가게는 '오늘 매출'이 있어 **같은 KST 날짜 · 2시간 이내**만. 잔액 실패는 종전대로 `—`.
- 🔬 첫 `D1` 표본(11-04): `d1:primary:ENAM@HKG` 411ms — 홍콩 손님의 홈 섹션 질의를 **미국 원본**이 답했다(표본 1, 엣지 캐시 라벨일 수 있음).
  APAC 사본 존재 여부는 표본이 더 쌓여야 판정 — `/api/analytics/summary?day=YYYY-MM-DD` 의 `vitals:…:D1:`.

## 6차 (대표 *"대기업급 안정성을 보여주는 최적화가 필요해"*)
- 🛟 공개 캐시 stale-if-error(`edge-cache.ts`): 원본 5xx·예외 → 24시간 예비 사본을 `*-STALE` 로. 기록 `docs/locks/loading/2026-11-04-stale-if-error.md`.
  🩸 첫 구현은 미들웨어에서 `return new Response()` 했는데 Hono 가 확정된 응답 뒤 반환값을 버려 시험 ②③이 빨갰다 → `c.res` 교체 + 헤더 재기입.
- (6차 추가) 🛟 React Query 전역: 조회는 **일시적 실패만**(네트워크·시간 초과·5xx·429·408) 최대 2번 · 지수 간격(0.6s→1.8s), 4xx 는 즉시.
  쓰기(mutation)는 **자동 재시도 0** — 응답 지연 때 다시 보내면 장바구니 2개·토글 원복이 된다(쓰는 곳 10곳, 결제는 이 훅 미사용). 가드 `query-retry-2026-11-04.test.ts`.

## 7차 (대표 *"계속 최적화"* · *"이 세션에서 작업 전과 후 차이가 얼마나 나지?"*)
- 전후 비교(세션 시작 `8800771` 과 main 을 각각 빌드 · 같은 하네스 CPU×4 · 2회 평균): 마이 받은 JS 865→685KB · 스크립트 1,018→816ms · TBT 239→178ms.
  이용권 탭·상세는 main 에서 오히려 +14/+43KB — **같은 날 다른 세션 기능(#2196·#2200 등)** 이다(청크 목록은 전후 동일, 청크 안 내용 증가).
- 상세 갤러리(`DetailGallery`): 마운트 때 `scrollLeft/clientWidth` 강제 레이아웃(66ms@CPU×4) → 첫 진입·첫 사진이면 안 잰다. 하네스 TBT 0.83~1.05s → 0.51~0.59s.
- 측정법(재사용): CPU 프로파일을 소스맵으로 **원본 파일별** 집계(node + source-map-js) — 앱 코드 중 큰 것을 바로 찾는다.
- (8차) 🩹 `markDegraded` — 실패를 빈 목록(200)으로 숨기는 핸들러가 캐시·예비 사본을 덮던 빈틈. 홈 섹션·선착순 목록에 적용.
  🩸 교체한 응답에 옛 헤더(X-Ur-Degraded)가 따라붙었다(Hono 의 c.res setter 가 옛 헤더를 옮긴다) — 시험 ⑥이 잡음 → 교체 뒤 삭제.

## 2026-11-05 — 에이전시 콘솔 왕복 줄이기 (대표 "손님 페이지들, 에이전시 마이페이지들 최우선")
- `/stores`: 목록 → 그 id 로 오늘 숫자(왕복 2) ⇒ 오늘 숫자를 **같은 판정의 하위 질의**(`activeStoreScopeSql`)로 매장을 골라 목록과 **동시에**. 운영 중 앞 60곳 안의 매출 0 매장은 0, 밖은 종전처럼 null.
- `/notifications`: 매장 목록 → 판매 기록 ⇒ 셋(목록·판매·읽음 위치) 동시. 목록에 `ORDER BY l.id DESC` 추가(하위 질의와 같은 60곳을 고르게).
- `/payouts`(읽기): 순차 5왕복 → 최대 3(켜짐+정산일 동시 · 잔액+내역 동시). 돈 움직임 없음(GET).
- 시험: `agency-multi-store-scope` ⑤(진짜 SQLite — 하위 질의 = id 목록 같은 숫자, 남의 에이전시 0, 배정제 직원) · `agency-console-plate` ② 재조준. 주입: 하위 질의에서 배정 판정 제거 → 빨간불 확인.
- ⚠️ 못 보는 것: D1 이 IN(하위 질의 + LIMIT) 계획을 빠르게 세우는지(라이브 Server-Timing 으로만).

## 2026-11-05 11:35 판정 — 한국 D1 표본
- 표본 **1건뿐**(11-04 `d1:primary:ENAM@HKG` 411ms · 11-05 0건). 섹션 응답은 대개 캐시 HIT 라 `Server-Timing d1` 이 안 붙어 표본이 거의 안 쌓인다 ⇒ **판정 불가**(사본 확대도, 사본 없음 결론도 아직 근거 없음).
- CF API: `read_replication.mode = auto` · 원본 ENAM.
- 판정 중 찾은 원인 후보: `ensureBannerColumns` 가 isolate 마다 ALTER 2번을 **사본 세션 안에서** 무조건 보냈다(쓰기 → 원본). 읽기(LIMIT 0)로 먼저 확인하고 없을 때만 ALTER 하게 고침. 시험 `replica-session-no-ddl-2026-11-05`.
- 같은 클래스 전수(탐색 에이전트): 사본 세션 위 isolate 당 DDL 5곳 더 — `ensureCuratorTables`(유어샵 공개, 6문장) · `ensureVoucherGiftTable`(내 이용권) · `ensureSellerMetaTable`(공구 목록·상세) · `ensureSupplyMetaTable`(상세) · `ensureReviewScoreTable`(리뷰 레벨). 공용 `schemaPresent()`(sqlite_master + LIMIT 0 읽기)로 먼저 확인 → 없을 때만 DDL. 원본 쪽 DDL(블로그·쿠폰·알림설정·`idx_vouchers_user_created`)은 세션을 안 잡아 이번엔 손대지 않음(각 isolate 1왕복 — 다음 후보).
