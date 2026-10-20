# 데이터 수집·보존·보안 감사 (2026-07-13)

> 목적: 엑싯·성과분석의 핵심 자산이 될 **완결 고리(유입→방문→결제→재방문)** 데이터가
> "지금부터" 한 사용자 단위로 유실 없이 적재되는지 확인. read-only 전수조사 결과 + 단계별 정비 계획.
>
> 배경 지시(대표): 개인식별정보 최소·익명 행동데이터 최대 / 위치 원좌표는 법무 전까지 미적재 /
> 집계·분석 레이어는 나중, 지금은 **원천 이벤트 보존**이 목적.

---

## 1. 완결 고리 4개 이벤트 — 현황

| 이벤트 | 상태 | 근거 |
|---|---|---|
| **① 유입 소스** | 🔴 클릭 시점 이벤트 없음 | 인플루언서 링크(`?ref=`) 클릭은 서버 미적재 — 브라우저 localStorage/쿠키에만. `order_referrer_intents`·`affiliate_earnings`(affiliate-credit.ts)·`influencer_attributions`(0247)는 **전부 구매 시점 INSERT**. 전환 안 한 방문은 영구 유실. 유일한 클릭시점 행 `acquisition_landings`(acquisition.ts:31)는 익명 + `src` 자유문자열(인플루언서 user_id 아님). |
| **② 방문(QR)** | 🟡 이용권은 status flip | 이용권 사용 = `vouchers.status='used' + used_at`(group-buy-voucher.routes.ts:56). 60초 내 `cancel-redeem`(group-buy-public.routes.ts:1032)로 **되돌리기 가능**. 테이블에 **store_id/seller_id 컬럼 없음**(product.seller_id 파생만). 이벤트 로그 조각남: `voucher_use_logs`(seller_id+time, **user_id 없음**, PIN 경로만), `voucher_redemptions`(GPS만, store/user 없음), `ledger_entries`(seller+voucher_id, seller-scan 경로만·waitUntil). vs 교환권 `district_coupons`(district-coupon.routes.ts:81)는 `user_id+redeemed_store_id+redeemed_at` 제대로. |
| **③ 결제** | 🟢 온전 | `orders`(production-schema.ts:16, user_id NOT NULL)+`order_items`+`vouchers`에 durable. 게스트 결제 없음. |
| **④ 재방문** | 🟢 파생 가능 | 별도 테이블 없이 `orders`/`vouchers.used_at`를 `(user_id, seller_id)`로 group → 재구성. **단 user_id 일관 전제**(아래 §2). |

## 2. 최우선 구조 결함 — user_id 이중키 🔴

- 안정 키는 `users.id`(INTEGER PK)여야 하나, **Firebase 로그인 세션은 orders/vouchers/deal INSERT에 Firebase UID 문자열을 저장**.
- `payment.routes.ts:61`만 정규화(`firebase_uid` 역조회). `group-buy.routes.ts:67/1112`, `points.routes.ts` 등은 `String(user.id)` 그대로.
- 캐노니컬 헬퍼 **`resolveUserId(db, rawId, isDbId)`**(src/worker/utils/resolve-user-id.ts) 이미 존재 — 삽입 경로가 이걸 안 탐.
- 코드베이스가 이미 `CAST(id AS TEXT)=? OR firebase_uid=?`(auction.routes.ts:115, shipping-address.routes.ts:95) 우회로 이중키를 인정 중.
- 결과: 같은 사람 행이 두 키로 갈라져 **완결 고리 조인이 두 사람처럼 쪼개짐**. user_id는 never null이지만 값이 불안정.

## 3. 익명 행동로그 ↔ 개인정보 분리 — 없음

- 모든 행동 테이블이 raw `users.id`로 조인. `users` 행에 `name·email·phone·kakao_id·firebase_uid` 동거. 가명화 계층 없음. IP만 해시(`ip_hash`).
- 탈퇴(delete-account.service.ts)는 in-place 익명화 — user_id는 유지(FK NOT NULL). `product_views`·`search_history`는 익명화가 아니라 **통째 삭제**.

## 4. 저장·백업·보존

- **저장**: 단일 D1 `toss-live-commerce-db`(binding `DB`, wrangler.toml:31)에 PII+행동+돈 전부. R2 `MEDIA_BUCKET`(이미지·사업자등록증) — **D1에 R2 키 색인 테이블 없음**(URL 문자열만 → 컬럼 삭제 시 고아 blob). biz-cert 공개버킷 노출(16자 랜덤키).
- **백업**: 확실 = **Time Travel 30일뿐**. R2 주간백업 cron(d1-backup.ts, `0 20 * * 0`)은 `BACKUP_BUCKET` 주석 처리 → binding 없으면 **throw = 미작동**. GitHub Actions 주간 export(d1-backup.yml, R2 독립, 90일 아티팩트)는 코드 완성이나 **실행·복원 리허설 0회**(D1_RESTORE_RUNBOOK.md:30 "미실시"). → **30일 초과 복구 미보장**.
- **퍼널 분석**: `ANALYTICS_KV`만(1~5% 샘플링, 90일 TTL) → 원천 이벤트 아님·소급 불가·D1 덤프에 미포함.
- **파기**: 탈퇴 정책 존재 + 30일 후 hard-purge cron(scheduled-cleanup.ts:856) 작동.

## 5. 보안·접근통제

- **PII 평문** — phone·email·name·주소·계좌·사업자번호 cleartext. `encryptAtRest`(data-crypto.ts:37)는 OAuth 토큰에만, 키(`DATA_ENCRYPTION_KEY`) 없으면 평문 fallback.
- **어드민 read 무제한** — RBAC(admin-rbac.ts:118)이 GET 전부 통과. `viewer`·`finance`도 전 사용자 PII 조회. 마스킹은 bulk-email 프리뷰 1곳만.
- **PII 조회 audit 없음** — admin-security.ts:111이 GET 무시. 전 회원 페이징 조회 흔적 0.
- **대량조회 rate-limit/alert 없음** — 로그인만 제한. 유출 탐지 미비. `ADMIN_IP_WHITELIST` 기본 OFF(allow-all).
- **⚠️ 위치 원좌표 적재 중** — `voucher_redemptions.used_lat/used_lng`(voucher-redemption.ts:12) self-redeem 경로가 원좌표 저장. 법무 전 미적재 원칙과 충돌.
- **⚠️ CSV 인젝션 사각** — admin-orders.routes.ts:209 export가 `csvEscape` 미사용(hand-rolled join). 린트가 함수명으로만 검사해 미탐지.

---

## 정비 계획 (대표 승인 2026-07-13 — 순서·격리 준수)

### 1단계 (진행 중): user_id 정규화 단독 + 위치 원좌표 하향
- 머니/인증 경로 → **단독 PR + staging 검증**.
- 모든 order/voucher/deal/stay INSERT를 `resolveUserId` 경유로 통일. 읽기 측 정합(기존 firebase_uid 행 호환) 확인.
- `voucher_redemptions` GPS 원좌표 적재 중단(상권/매장 단위만) — 법무 답변 전까지.

### 2단계 (대표 "2단계도 함께 지원" — 1단계와 병행 착수): 유입 클릭 이벤트 + 방문 통합 이벤트 (additive)
- 인플루언서 링크 진입 시 익명 이벤트(`anon_id, ref_id, campaign, path`, user_id는 로그인 후 바인딩) 서버 적재.
- 이용권 사용 시 방문 이벤트(`user_id, seller_id/store, ts`) — `district_coupons` 모델 이식, 전 경로 공통.
- **구현 완료** — 아래 구현 로그 참조.

### 3단계 (대표 "진행 가장 이상적으로"): 백업 + 보안 5종 + off-live backfill
- **코드로 완료**(안전·additive): off-live backfill(guarded)·PII 조회 audit·bulk rate-limit+alert·목록 마스킹·CSV 인젝션 fix.
- **설계+수동조치 필요**(라이브 전체/대시보드 리스크): PII 평문 암호화·백업 실행/바인딩·ADMIN_IP_WHITELIST. → 아래 "잔여 수동 조치".

---

## 잔여 수동 조치 (코드로 안전하게 끝낼 수 없는 항목 — 대표/운영 결정)

이 환경은 배포·테스트 미실행(npm 403)이라 아래는 blind 적용 금지. 각각 별도 staged 진행 권장.

1. **off-live user_id backfill 실행** — 코드는 완료(dry-run 엔드포인트). live 는 대상 0. off-live 데이터가 있으면:
   `GET /api/_internal/backfill-user-id`(dry-run 카운트 확인) → `POST` `{ "confirm": true }`(적용). user_points 충돌(conflict)은 자동 병합 안 함 — 있으면 수동 검토.
2. **PII 평문 암호화** — 대표 확정(2026-07-13): **인프라·플래그는 코드로 지금(완료), 라이브 실제 암호화 스위치는 staging 검증 후**(flip·경로 B 패턴).
   - ✅ **지금 완료(라이브 무영향)**: `pii-crypto.ts`(encryptPii/decryptPii dual-read + `blindIndex` HMAC 조회키) + 마스터 스위치 env `PII_ENCRYPTION_ENABLED`(기본 OFF, 키 없으면 강제 OFF). 어떤 라이브 읽기/쓰기 경로도 **미배선** — 순수 인프라.
   - ⏳ **staging 활성화 게이트**(별도 세션): 조회키 컬럼(email/kakao_id/phone) blind index dual-mode 배선 → 표시지점 decryptPii 배선 → 기존 평문 backfill → `PII_ENCRYPTION_ENABLED='true'`. 상세 순서·필드·지점: `docs/design/pii-encryption-rollout.md`.
3. **백업 파이프라인 실행·검증** — `d1-backup.ts` 코드는 견고(커서 덤프+알림)하나 `BACKUP_BUCKET` 미바인딩이라 미동작(의도적 throw 로 표면화 중). GitHub Actions `d1-backup.yml`(R2 독립, 주간 export→아티팩트)이 가장 안전한 경로 → **workflow_dispatch 로 1회 실제 실행 + 복원 리허설 1회**(D1_RESTORE_RUNBOOK.md "미실시" 해소). R2 백업 원하면 `ur-live-backups` 버킷 생성 후 대시보드 바인딩.
4. **ADMIN_IP_WHITELIST 켜기** — 코드 지원됨(기본 allow-all). 운영 IP 확정되면 대시보드 env 설정.

## 구현 로그
- 2026-07-13 — 조사 완료, 감사 문서 저장.
- 2026-07-13 (1단계 구현) — **user_id 정규화 + 위치 원좌표 하향**:
  - **핵심 발견**: live(카카오 세션)는 `isDbId=true`+숫자 `users.id` → orders/vouchers 이미 숫자 키 = **완결고리 조인 live 에선 이미 작동**. 분열은 off-live(Firebase/beta) 한정. → 모든 정규화는 **live 무동작(회귀 0)**, off-live 교정.
  - 신규 헬퍼 `resolveUserIdString`(resolve-user-id.ts) — 정규화 실패 시 raw 폴백(결제 무중단).
  - `group-buy.routes.ts` `/join`·`/confirm-toss`: `userId`=`resolveUserIdString`(핸들러가 이미 `users WHERE id=?` 로 숫자 가정 → 정합). `/confirm-toss`는 지갑 미접촉(카드).
  - `points.routes.ts` `/pay`: **주문 클러스터만** `orderUserId`(멱등 조회+INSERT 2곳)로 정규화, **지갑(user_points/point_transactions/coupon_uses)은 raw 유지** — off-live 잔액 stranding 방지 + 멱등 read↔write 일치(이중발급 0).
  - `group-buy-public.routes.ts` `/vouchers/my` 읽기: `WHERE v.user_id IN (정규화, raw)` dual-key — backfill 없이 전환기 이력 유실 0. KT-Alpha 조인도 정규화 id 매칭.
  - `voucher-redemption.ts`: self-redeem GPS 를 소수 2자리(≈1.1km 상권 격자)로 양자화 저장 + 기존 정밀 행 일회성 하향. **정밀좌표 원본 미보존**(법무 후 재결정). 분쟁 뷰는 상권 단위로 그대로 동작.
  - 검증(이 원격환경): sql-bind/column/table/money 가드 GREEN. tsc/build/vitest 는 npm 403 로 CI 에서(deps 미설치). ⚠️ **staging 실결제 필수**: (1) 카카오 공구 참여/카드결제/딜결제 → 주문·이용권 정상 + 내 이용권 노출, (2) 셀프 사용처리 → 위치 상권격자 저장 확인.
  - **off-live/과거 이력 backfill(firebase_uid→숫자, orders/vouchers/user_points/point_transactions)** 은 3단계에서. off-live 지갑 완전 정합은 backfill 후 완성.
  - 미포함(현행 유지, 판단): stays(Firebase=401 이라 분열 안 만듦)·experience-campaign(저볼륨)·points 지갑 키 — live 이미 숫자라 완결고리 영향 0.
- 2026-07-13 (2단계 구현 — 대표 "2단계도 함께 지원") — **유입 클릭 이벤트 + 방문 통합 이벤트**(전부 additive, 머니 로직 무변경):
  - **방문 통합 이벤트** `voucher_visits`(신규 사이드테이블, `voucher-visit.ts`): `voucher_id`(PK·멱등), `user_id`(=vouchers.user_id 동일 키), `seller_id`(매장=consigned_from ?? seller), `product_id`, `amount`, `path`, `created_at` + user/seller 인덱스. **3개 사용처리 경로 전부** 배선(PIN `/:code/use` · 셀러스캔 `/use-by-seller` · 셀프 `/vouchers/:code/self-redeem`) = best-effort waitUntil, INSERT OR IGNORE(이중 0). cancel-redeem(오스캔 60초 정정)은 `removeVoucherVisit` 로 되돌림. → "누가 어느 매장 언제 사용" 한 행 조인(재방문 = user_id group by).
  - **유입 클릭 이벤트** `inflow_clicks`(신규, `inflow-clicks.ts`): `anon_id`(클라 UUID `ur_anon_id_v1`, `anon-id.ts`), `ref_id`(인플루언서 users.id), `ref_type`, `campaign`, `landing_path`, `user_id`(로그인 후 바인딩) + UNIQUE(anon_id, ref_id) first-touch. 서버 `POST /api/acquisition/inflow`(공개·rl 20/60s) + `/inflow/bind`(인증, user_id=정규화). 클라: `storeAffiliateRef`(affiliate-track.ts)가 ref 캡처 즉시 클릭 발사(ref별 1회 dedup) + App.tsx 부트스트랩이 로그인 시 bind(멱등). → **전환 안 해도 인플루언서→방문자 유입 서버 보존**(구매 전 유실 0). acquisition(?src=)·affiliate 적립 로직 **미변경**(격리).
  - 개인정보 원칙 준수: 로그는 **가명 키(anon_id / 숫자 user_id)** 만, PII(이름/전화)는 users 분리 유지. 위치 미포함.
  - 검증(이 원격환경): sql-bind/column/table(373→375)/not-null/money 가드 GREEN. tsc/build/vitest 는 CI. ⚠️ staging: (1) `?ref=` 링크 진입 → `inflow_clicks` 1행 + 로그인 후 user_id 바인딩, (2) 이용권 3경로 사용 → `voucher_visits` 1행 + cancel 시 삭제.
- 2026-07-13 (3단계 구현 — 대표 "진행 가장 이상적으로") — **보안 하드닝 + off-live backfill**(안전·additive만; 高리스크는 설계+수동조치로 분리 — 위 "잔여 수동 조치"):
  - **off-live backfill**(`user-id-backfill.ts` + `/api/_internal/backfill-user-id` GET dry-run / POST confirm): firebase_uid→숫자 users.id 이력 수렴. orders/vouchers/point_transactions 안전 relabel, user_points 는 충돌(숫자 잔액행 존재) 회피+보고. 멱등·admin 전용·live 대상 0.
  - **어드민 PII 조회 감사로그**: `/users` 목록(read_user_list — 검색어·건수), `/users/:id`(read_user_detail), `/users/:id/full-state`(read_user_full_state) — GET 은 audit 미들웨어가 안 잡던 사각 해소(누가 언제 무엇을 봤나).
  - **대량 열람 방어**: `/users` 목록 rate-limit(60/60s) + 깊은 페이지네이션(offset≥2000) `sendAlert` 경보.
  - **목록 PII 마스킹**(`pii-mask.ts`): 목록 응답 이메일/전화 기본 마스킹(enumeration 유출 최소). 검색은 서버 raw LIKE 라 기능 불변. 단건 상세는 원문(감사로그).
  - **CSV 수식 인젝션 fix**(`csv-safe.ts`): 어드민 주문 export 의 hand-rolled join → `buildCsv`(= + - @ 선행 무력화). 서비스 중립 유틸(도매 supply-csv 미변경).
  - 검증: sql-bind/table(375)/column/csv-injection/money 가드 GREEN. tsc/build/vitest CI.
