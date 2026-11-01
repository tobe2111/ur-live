# 2026-11-01 — 에이전시 몫 유어딜 지급(결재 3단계) · 게이트 OFF

대표: *"모두 진행해줘. 4번 승인도 해줄게."*(10-31) → 중단된 세션을 이어받아 진행 →
`AskUserQuestion` 답: 매장 이전 **"대표 계정을 에이전시로 (추천)"** · 지급 시점 **"지금 만들고 꺼 두기 (추천)"**.

## 먼저 확인한 것 (10-31 PR #2049 의 E4)
- #2049(직원 카톡 보내기 · 여러 매장 · 카톡 카드) 는 main 에 머지·배포됨(`1f4504a`).
- 라이브: 없는 초대 토큰 → **404 + `noindex, follow`** + og:title "에이전시가 매장 운영을 맡겠다고 해요 - 유어딜" ✅
- 살아 있는 초대 링크는 **라이브에 0개**(`agency_store_invites` 0행, 에이전시 계정 0곳) → 에이전시 이름이 든 카드는 실제 링크가 생겨야 판정된다(대표 몫).

## 라이브 실측 (읽기 전용 D1)
- `broker_share_enabled=false` · 에이전시 계정 0 · `agency_store_links`/`agency_share_terms` 0행 · broker_share attribution 1행.
- 중개 매장(seller_meta `broker_user_id`): **user 3(대표 본인)** → 20 청룡갈비(10%)·25 오레노라멘(0%)·26 달빛한스푼(2%) /
  **user 35(테스트)** → 15 클로드분식(suspended)·16 클로드카페·17 클로드미용실(각 10%). 14 는 brokered 인데 중개사 메타 없음.

## 한 것 (PR — 게이트 `agency_share_payout_enabled` 기본 OFF)
- SSOT `src/worker/utils/agency-share-payout.ts` — 적립(`creditAgencyShare`) · 회수(`clawbackAgencyShare`) · 규칙 1(`isOwnAgencyReferral`) ·
  잔액(권위 = `agency_share_credits` 합) · 정산 분기(`planAgencyPayout`: 사업자=세금계산서/공제 0, 개인=3.3% `WITHHOLDING_RATES`) · 신청·지급·반려(CAS).
- 배선: `creditBrokerShare` 가 **먼저** 에이전시 몫을 시도하고, 에이전시 판매면 중개사 몫을 안 붙인다(호출 2곳 무수정) ·
  `voucher-clawback.ts` 가 인플 조기 반환 **앞에서** 회수 · 규칙 1 은 두 결제 경로의 `influencerActive` 에.
- API: 에이전시 `GET /api/agency-console/payouts` · `POST /payouts/request`(관리자) / 어드민 `GET /api/admin/agency-payouts` ·
  `POST /:id/paid` · `/:id/reject`(super·finance) · `POST /api/admin/agency-accounts/migrate-broker`(super, **dry_run 기본**).
- 어드민 손잡이 `/admin/platform-settings`(money-switch-fields) · OPS_GATES · `STAGING_CHECKLIST.md` **S-AGENCYSHARE** 6건.
- 가드 `agency-share-payout-2026-11-01.test.ts` 22건(실제 SQLite) + 주입 `scripts/mutations/agency-share-payout-2026-11-01.mjs` **12건 전부 빨간불 확인**.

## 🩸 이번에 잡은 것 · 틀린 판단
- **원장 계정 이름**: 처음 `agency:{id}` 로 썼다. 그런데 주간 자동 정산(`payout-account.ts` `payoutCreditWhere`)이 `agency:%` 를 **집계해 지급**하고,
  그 N 은 일몰된 옛 `agencies` 번호다 → 같은 몫이 두 번 나가거나 **남의 계좌**로 간다(에러 0). `agencyacct:{id}` 로 바꾸고, 자동 정산 SQL 을 실제로 돌려 안 잡히는지 시험으로 고정.
- `ensureAgencyShareTables` 가 원장 UNIQUE 인덱스를 같은 batch 에 넣어, 원장 표가 없는 DB 에선 **적립 표까지 통째로 안 생겼다** → `ensureLedgerTable` 먼저.
- 주입 3건이 처음 헛돌았다(겹친 잠금 · 최소 금액 검사가 성숙 검사를 가림 · 라우트 대신 함수만 시험) → 시험이 그 경우를 직접 담게 고침.

## 다음 세션의 첫 액션
1. **staging 실결제 S-AGENCYSHARE 1~6** (머니 — 단독 세션). 통과 전 프로덕션 ON 금지.
2. 통과 뒤 이전(대표 승인 "대표 계정을 에이전시로"):
   `POST /api/admin/agency-accounts/migrate-broker {"broker_user_id":3}` (dry_run) → 결과 확인 →
   `{"broker_user_id":3,"agency_name":"<대표가 정할 이름>","kind":"business|individual","dry_run":false}`. 테스트 계정(35)도 같은 방식.
   ⚠️ 에이전시 이름·사업자/개인 구분은 **대표에게 물어서** 넣을 것(세금 분기가 이걸로 갈린다).
3. 화면: 에이전시 마이 '정산' 줄 · 어드민 지급 목록 화면은 아직 없다(API 만) — 게이트를 켜기 전에 만들 것.

## 남은 결정
- 게이트 ON 시점(대표). · 에이전시 이름·사업자 여부(이전 실행 전).
