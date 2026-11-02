# 2026-11-02 부분 로딩 느림 — 생활 표 확인 · 유어샵 주인 물결

대표: *"로딩이 긴 것들이 페이지에서 부분적으로 있어. 유어샵 … 마이페이지 … 홈 맨 위 … 생활 카테고리 … 유어쇼츠도 느리더라"*
→ *"부분적으로 느린 경우들이 많아서 유저들이 헷갈려해"*

## 실측(미국 동부 서버에서 — 한국 체감은 이보다 길다. DB 원본은 ENAM)
| 화면 | 느린 것 | 값 |
|---|---|---|
| 생활 `/life`, `/life/request/*` | `/api/home-service/config` | 서버 시간 1,424ms · 같은 서버 재요청 42ms |
| 유어샵(남이 봄) | `/api/curator/:handle` | 0.13s (엣지 캐시) — 문제 없음 |
| 유어샵(주인이 봄) | 같은 요청, `no-store` + 원본 DB | 코드상 직렬 7물결(로그인 실측 못 함) |
| 홈 맨 위 | 지역 사진 `region-hero/*.webp` | 카드 사진 0.5~0.6s vs 사진 1.26s + 페이드 0.5s (의도된 `lazy`·`fetchPriority=low`) |
| 유어쇼츠 | 우리 API 0.1s | 느린 건 유튜브 재생기(이 환경은 유튜브 차단 — 못 잼) |
| 마이 | 로그인 필요 — 못 잼 | 개인 데이터라 캐시 불가 · 원본 DB |

## 이번에 고친 것
1. **생활 — `ensureHomeServiceTables`**: 서버가 새로 켜질 때마다 DDL 34문장을 하나씩(ALTER 13개는 매번 실패) 보냈다.
   → 표·칸·색인 "다 있나" 를 **batch 1회**로 묻고 다 있으면 건너뜀(`buildSchemaProbe` — `HS_TABLES_SQL` 에서 자동 생성).
   라이브 D1 에 확인 질문 다섯을 읽기로 돌려 전부 통과 확인(표+색인 20/20). 빠지면 종전대로 DDL 전부.
   생활의 **모든** 요청(35곳)이 이 함수를 거치므로 전부 같이 빨라진다.
2. **생활 `/config`** — 엣지 캐시 30초(엣지 90) + 두 읽기 나란히. 운영 중지 스위치는 최대 90초 뒤 반영.
3. **유어샵 주인 보기** — 직렬 7물결 → 3(사용자 → 여섯 읽기 한 물결 → 셀러 페이로드·상품 나란히). 응답 모양 무변경.

가드: `home-service-schema-probe-2026-11-02.test.ts`(진짜 SQLite · 주입 2) · `ushop-owner-waves-2026-11-02.test.ts`(주입 1).
`linkshop-products-seed.test.ts` 한 줄 재조준(동봉은 그대로, 나란히 받도록 바뀐 모양).

## 2차 (대표 *"모두 순서대로 해줘"*) — 같은 PR
4. **마이 '내 가게'** — `listOperableStores` 소유·위임 두 읽기 나란히(요약·목록 모두 지난다).
5. **마이 '내 이용권'** — `/api/vouchers/my` 가 매 요청 색인 DDL → isolate 당 1회.
   로딩 잠금 파일 — 대표 *"허가 — 고쳐줘"*, 기록 `docs/locks/loading/2026-11-02-vouchers-my-ddl-memo.md`.
6. **홈 맨 위 사진** — 대표 확정 *"중간 — 늦추기만 풀기"*: `lazy`·`low` 해제(기본 우선순위 = 카드 `high` 다음) ·
   페이드 0.5→0.2초 · 이미 받은 사진은 페이드 없이.
7. **유어쇼츠** — 홈 레일 카드가 `window.location.href` 로 **앱 전체를 다시 불러왔다**(목록 카드는 앱 안 이동이었다).
   앱 안 이동으로 통일 + `pointerdown` 에 뷰어 청크·유튜브 API 미리 받기(`pages/videos/warm-viewer.ts`).
   가드: `partial-slow-round2-2026-11-02.test.ts` + 주입 4.

손대지 않은 것: 마이 '내 딜'(`/api/points/balance`)의 두 번째 직렬 읽기 — 딜·환급 경로라 결재 대상으로 남김.
`seller/orders` 가 요약을 기다리는 2단 — 좌석 확인 뒤에 불러야 남의 가게 숫자를 안 그린다(의도된 순서).

## 3차 (대표 *"가장 이상적인 상태이면 돼. 유저 화면 대표 5개 모두 확인 … 세부 페이지들도"* · *"지도도 늦게 뜨네"*)
실측 도구: 실제 브라우저(아이폰 13)로 화면별 시간표(LCP·글자 첫 표시·스켈레톤 끝·전체 로더 횟수·API 서버 시간) +
어드민 `/api/analytics/summary`(실사용 LCP·CLS·원인 요소, 읽기 전용).
8. **이용권 상세 팔아보기** — `ensureSeedingTables` 도 같은 직렬 DDL(19문장, 재방문에도 `/api/seeding/offer/:id` 683ms).
   확인 질문을 공용으로(`worker/utils/schema-probe.ts`) — 생활·팔아보기가 같이 쓴다. 라이브 D1 읽기로 17/17 통과 확인.
9. **마이 PC** — 실사용 CLS: `div.ur-account-pane` 폭 519→909 · 602→1050(2.7~3.3초). 좌석 조회 전엔 "가게 없음"(820px)으로
   그렸다가 도착하면 두 칸으로 튀었다 → 조회 중엔 판매 구역이 지난번에 잰 높이(`seller-reserve.ts`)가 있으면 두 칸으로(`hasSeats`).
10. **지도(홈 알약으로 진입)** — 지도는 타일 한 벌을 위해 첫 목록을 기다려 생성되는데 SPA 진입엔 시드가 없어 한 왕복을 더 기다렸다
   → 홈이 지도 화면 코드를 데운 뒤 그 모듈이 내보내는 `prefetchMapSeedFirstPage()` 로 첫 목록을 미리 받는다.
11. **유어쇼츠 미리받기 재조준** — 첫 판은 홈이 `import('../VideosPage')` 를 직접 써서 CI `surface-budgets` 12화면 +1.5KB 로 빨갰다
   (`lib/route-preload` 머리말의 함정 그대로). App.tsx 등록부 `'videos'` + `VideosPage` 모듈 최상단이 유튜브 재생기를 출발.
   지도 쪽도 같은 함정이라 같은 방식. 남은 증가는 홈 +0.1KB → main 이 이미 +1.4KB 라 넘어서 홈만 rebaseline(사유 파일 `surface-budgets-history/2026-11-02-home.json`).

측정했지만 고칠 것이 아니었던 것: `/api/fcfs/active`·`/api/search/popular` 는 캐시 정상(짧은 TTL 미스) · 숙소 카드의 상세 요청은 누르기 전 미리받기 ·
PC 배너 245,600 은 바이트가 아니라 LCP **면적** · 홈 HTML 서버 시간 37~169ms(나머지는 회선 — 한국 손님이 HKG/NRT/LAX 로 붙는다, 실사용 colo 표).
안 한 것: 서버 첫 화면에 지역 사진 넣기 — 홈 머리는 같은 날 다른 세션(#2117·#2121)이 작업한 자리라 겹치지 않게 뒀다.

## 이어받는 세션의 첫 액션(대표가 이어서 하라고 했을 때)
배포 후:
```bash
UA='Mozilla/5.0 (iPhone)'; for i in 1 2 3; do curl -sS -o /dev/null -A "$UA" -D - https://urdeal.kr/api/home-service/config | grep -i -E 'server-timing|x-cache-status'; done
```
→ 두 번째부터 `x-cache-status: public-HIT`, 첫 번째도 서버 시간이 수백 ms 이하면 E4.

## 이번에 틀렸던 판단
- 처음엔 생활의 원인을 "업체 수 집계 질의" 로 의심했다. `/pros/abc`(질의 없이 표 확인만 하고 404)도 0.45~0.6초가 걸려 표 확인이 원인이었다.
- `npx tsc` 는 기본 힙에서 죽는다(`Aborted`) — `NODE_OPTIONS=--max-old-space-size=8192`.
- 홈에서 화면 모듈을 `import()` 로 직접 데우면 묶음기가 봉투를 다시 짜 **전 화면** 첫 화면 무게가 는다 — 등록부 이름(`preloadRoute`/`loadRoute`)으로.
- 주입의 `replace` 글자가 정상 코드에 이미 있으면 잔재 검사가 "주입이 남았다" 로 오판하고 다른 시험의 종료값이 바뀐다(guard-mutations-zero-match 빨간불).
- "PC 배너 245KB" 는 LCP `size`(면적)를 바이트로 읽은 오독이었다.

## 남은 것(대표 판단·별건)
- 마이페이지는 로그인 실측을 못 했다 — 배포 후 대표 폰에서 체감 확인 필요.
- '내 딜' 두 번째 읽기 병렬화는 딜·환급 경로(결재 C)라 손대지 않음.
