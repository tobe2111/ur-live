# 2026-11-18 alias 없는 SELECT 의 없는 칸 — 42건 발견 · 사람 쓰는 기능 10곳 수리

대표 *"남은 과제도 다 해주고 개선할 것들 더 찾아줘"*. 라이브 텔레메트리 조사(5xx 1위 `GET /api/seller/public/:id`)에서 출발.

## 무엇이 고장이었나 (전부 라이브 D1 `EXPLAIN` 으로 `no such column` 확인)
| 곳 | 없는 칸 → 라이브 칸 | 사람에게 보인 것 |
|---|---|---|
| `worker/utils/order-refund.ts` `refundOrderFully` | `orders.amount` → 삭제 | **전액 환불이 매번 실패**(손님·어드민·셀러) — 라이브 주문에 REFUNDED 0건. 대표 승인 "고침" · S-REFUNDCOL |
| `seller-management.routes.ts` ×2 | `kakao_chat_link` → `kakao_chat_url AS …` | 셀러 공개 API 언제나 500 |
| `auth.routes.ts` ×2 | `users.avatar_url` → `profile_image AS …` | 전화번호 입력창: 저장은 되고 응답 500 |
| `products.routes.ts` 옵션 | `stock_quantity` → `stock AS …` | 상품 옵션 늘 빈 목록 |
| `group-buy.routes.ts` 영수증 | `users.display_name` → `name AS …` | 공구 영수증 메일 0통 |
| `experience-campaign.routes.ts` | `voucher_validity_days` → `NULL AS …` | 조회 전체 null(셀러 id 까지) |
| `faq-bot.routes.ts` | `title/content` → `section_title/content_md` | FAQ 봇이 DB 를 못 읽음 |
| admin 유저 쿠폰 · 후원 자기차단 · 후원 정산 정렬 | 각 라이브 칸 | 어드민 화면 빈칸 등 |

## 가드
`check-sql-column-exists.mjs` 에 `scanSelectBare`(alias 없는 단일 표 SELECT, 라이브 사진 표만, 목록에 괄호·점·따옴표 있으면 건너뜀) 추가.
남은 17건은 `live-columns-baseline.json` 에 동결 — tiktok·sse-realtime(라이브커머스 중단)·wholesale(철거)·`deleted_accounts`(0행, 복구 규칙이 제품 결정)·`seller-tier-limits`(고치면 셀러 월 한도가 실제로 걸리기 시작 — 결정 필요)·`webhook.routes.ts` 추천 회수(잠금 파일 · **고치면 안 된다**: `refundOrderFully` 가 `beneficiary_id` 로 이미 회수하므로 살리면 이중 차감).
시험 `bare-select-columns-2026-11-18.test.ts` · 주입 2건(`bareselect`).

## 틀렸던 판단
- 처음엔 5xx 1건짜리 버그로 봤다. 같은 모양을 전수로 찾자 환불 전체가 죽어 있었다 — **하나를 고치면 같은 클래스를 전수로 볼 것.**

## 이어서 (같은 날, 텔레메트리 조사 후속) — 머지 #2417 = `c4ab9ec`
- 교환권 사진 옮기기: 연속 3회 0장이면 24시간 쉰다(`voucher_rehost_lane`). 판정: 하트비트가 `paused=LANE_BLOCKED` 로 바뀌는지.
- 쿼리 플래너 통계: 매일 청소 28번 `PRAGMA optimize=0x10002`(거절 시 ANALYZE). 판정: 배포 다음 날 메인 D1 `SELECT tbl, idx, stat FROM sqlite_stat1 WHERE tbl='products'` 의 첫 숫자가 2,000 이상 · 결과 `stats_refresh` 값(1=optimize, 2=ANALYZE, -1=둘 다 거절).
- 리뷰 이름 백필 부분 색인 `idx_product_reviews_name_missing`. 판정: sqlite_master 에 생겼는지.
- 남은 것: `/api/home/bundle` 예열 제거(쓰는 화면 0 · 로딩 잠금 → 대표 승인 필요) · KT 충전 잔액 7,680원(운영) · `seller-tier-limits` 등급 조회 고장(고치면 월 한도가 걸리기 시작 — 결정 필요) · 원격에 남은 실수 브랜치 `fix-seller-public-500`(삭제 403).

## 이어서 ② — 머지 #2419 = `cc3f51e8c` · 다음 PR: 서버 타입 검사 strict · SSR 파일럿·스크래퍼 의존성
- **서버 타입 검사 348 → 0**, verify.yml `Type check (worker)` 의 `continue-on-error` 제거. 워커 전역 선언은 `types-worker/`(src 밖 — 안에 두면 브라우저 검사가 DOM 과 겹친다). 워커 첫 화면은 `sheet-geometry.ts`·`voucher-labels.ts`(순수 모듈)를 읽는다.
- **SSR 파일럿**(`apps/ssr`, ur-ssr-pilot workers.dev): react-router 7.18.5 · vite 6.4.6 · 안 쓰던 `@cloudflare/vite-plugin` 제거. 운영 의존성 취약점 1 → 0, 전체 높음 19 → 5(picomatch ReDoS, 고친 판 없음). 머지되면 `ssr-pilot.yml` 이 자동 배포 + 스모크 4경로.
- **스크래퍼**: `npm audit fix`(호환 범위)로 운영 의존성 높음 0. 남은 34건은 jest 안쪽(큰 버전 변경 필요).
- `docs/business/proposals` 높음 2건은 sharp 큰 버전 변경 필요 — 두었다.

### 틀렸던 판단 ②
- `npx tsc … | grep -c "error TS"` 가 0 이어서 통과로 봤는데, pre-commit 이 같은 코드에서 오류 1건을 냈다. **exit code 를 같이 볼 것**(재실행하니 exit 0 · 오류 0 은 고친 뒤 값이다). CLAUDE.md 3-1 과 같은 클래스.
## 이어서 ③ — 대표 답 "2번은 영구적으로 고쳐줘 · 3번은 로딩 잠금 승인"
- **셀러 등급별 이용권 월 한도**: 진실을 `sellers.tier`(등급 cron 의 영어 코드) 하나로. `TIER_CODE_TO_NAME` 이 한글 한도 표와 잇는다.
  ⚠️ **앞 보고 정정**: "한도가 아예 안 걸린다"고 했는데 틀렸다 — 조회가 던지면 `limit ?? 5` 라 **모두 브론즈 5개**로 막혀 있었다.
  지금 라이브 셀러는 전부 new·bronze 라 고친 뒤에도 한도는 그대로 5다(실버 이상이 생기면 그때부터 제 한도).
- **홈 묶음 예열 제거** `[UNLOCK_LOADING]` — `docs/locks/loading/2026-11-18-drop-home-bundle-prewarm.md`.
- 🔴 **새로 찾은 머니 경로(고치지 않음, 대표 판단)**: `cron/seller-tier-eval.ts` 가 매주 활성 셀러 `sellers.commission_rate` 를
  등급표 값(전부 5%)으로 **덮어쓴다**. 채널 미지정 매장은 이 값으로 수수료를 뗀다 → 어드민이 셀러별로 바꾼 수수료가 다음 월요일에 되돌아간다.
  라이브: 활성 14곳 전부 5 · 등급 갱신 기록이 없는(비활성) 2곳만 10.
