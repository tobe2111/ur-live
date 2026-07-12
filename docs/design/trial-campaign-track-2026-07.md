# 체험 캠페인 + 조건부 우대 커미션 트랙 — 설계 SSOT (2026-07-12)

> 대표 신규 트랙(체험단 시장 전환). flip 검증과 **완전 별개 PR**(`claude/trial-campaign-track`). 전부 **게이트 OFF·additive**, 머니 계산 파일 diff 0. 목표 시점 = 서초 온보딩~8월 캠페인 전. 3축 병렬 지형조사(2026-07-12) 기반.

## 완료 기준 (대표 명시)
- [x] 전부 게이트 OFF (`platform_settings` 키, 기본 미설정=비활성) — WP-A 어드민 대행생성/응모/추첨/0원발급, WP-B opt-in 체크박스(미체크=현행)
- [x] 머니 계산 파일 diff 0 — WP-A#4 0원 발급이 정산·커미션 구조적 우회(§A-4), WP-B 발효=기존 status='active' 게이트 재사용([INV-CB] green 유지)
- [x] 캠페인 1회 왕복 스모크 시나리오 문서화(§스모크)

**진행(전 WP 구현 완료 · draft PR #499, 머지 전 스모크 검증 대기)**:
- WP-A: 백엔드+어드민 대행생성(1순위)+소비자 응모 `/experience`+리포트/CSV(campaign/1~4) · promo-ledger 0원 비정산 패널(campaign/8) · 셀러 셀프생성 UI(2순위·게이트 `experience_campaign_seller_create` 뒤, campaign/9).
- WP-B: 백엔드+셀러/인플 UI(campaign/6~7).
- WP-C: TTL 24h→7d(campaign/5).
- 머지 전: §스모크 1회 왕복 + WP-B 발효 전후 요율 비교(staging/파일럿).

---

## WP-A. 매장 체험 캠페인 모듈

### A-0. 재사용 기반 = 기존 FCFS 모듈 (거의 그대로)
`fcfs.routes.ts` 가 이미 **B2G 체험단 증빙 목적**으로 만들어져 있음(주석 명시):
- `fcfs_applications` `UNIQUE(product_id, user_id)` — 응모 중복차단 ✅
- `fcfs_draw_logs`(admin_id·method·pool_snapshot·winners 영구보관) + CSPRNG 추첨(`cryptoInt` rejection-sampling + `cryptoShuffle` Fisher-Yates) — 공정추첨·조작불가 증명 ✅
- 선정 endpoint `POST /api/admin/fcfs/:productId/select`
**델타(신규)**: FCFS 는 선정 시 **알림만** 주고 이용권 자동발급이 없음 → "선정 → 0원 이용권 자동발급"만 추가.

### A-1~3. 캠페인 생성·응모·추첨
- **campaigns 테이블**(신규): seller_id, product_id(제공 이용권), slots(모집인원), apply_start/end, mission(선택 콘텐츠 미션 텍스트), status, seed_recorded 등. FCFS 확장 or 별도. feature-ensure(WeakSet) + repair-schema `tables` 배열 양쪽 등록(기존 관례).
- **응모**: `campaign_entries` `UNIQUE(campaign_id, user_id)` — fcfs_applications 패턴 복사(로그인 기반, 중복 차단).
- **추첨**: `fcfs_draw_logs` 패턴 확장 — **시드 컬럼 additive 추가**(현재 pool_snapshot+winners 는 있으나 명시 seed 컬럼 없음 → CSPRNG 시드/타임스탬프 영구기록으로 B2G 조작불가 증명 강화). CSPRNG 헬퍼 재사용.

### A-4. ⚠️ 0원 체험권 자동발급 — 정산 구조적 우회 (머니 핵심)
**발급**: 카드 confirm 의 voucher 발급(`group-buy.routes.ts:1226-1248`)을 복제 — **0원 orders 행**(`payment_method='experience'` 전용값) + vouchers(`applied_price=0`). `generateUniqueVoucherCode` 재사용.

**우회가 구조적으로 성립하는 근거(2중)**:
1. **사용시점 원장/커미션 = 자동 no-op**: 이용권 사용(`status='used'`) 시 `recordVoucherUsedLedger`·`recordAgencyCommissionShare`·`recordIntroductionCommissionShare`·`debitOwnerPromoForOrder` 는 전부 `const amount = applied_price || 0; if (merchantId && amount > 0){...}` 게이트 안(`group-buy-voucher.routes.ts:156-157, :347-348`). **0원 → 4개 전부 skip.** `matureAffiliateForOrder`도 holding 행 없으면 no-op. → **유어딜 5%·promo·커미션 전부 무접촉(요구사항 그대로).**
2. **⚠️ 유일한 필수 방어 = auto-settlement 제외**: `auto-settlement.ts handleAutoSettlement` SELECT(`:63-73`)는 **금액 필터가 없고**, 매출 계산이 `applied_price>0 ? applied_price : price(정가)`(`:99`) → **0원 체험권이 정가로 매장에 정산 지급되는 사고**. `applied_price=0`만으론 불충분.
   - **수리(additive·게이트드)**: 체험권 마킹(권장: `vouchers.is_experience` 컬럼 or 사이드테이블) → auto-settlement SELECT 에 `voucher_disputes` 제외(`:71`)와 **동일 패턴**으로 `AND NOT (체험권)` 절 추가. **머니 계산 로직 무변경 — SELECT 대상에서 구조적으로 제외만.** 만료환불 cron 도 `payment_method='experience'` 라 자연 skip(환불은 deal_points/toss 한정 `:215,:252`).
   - 이 파일(`auto-settlement.ts`)은 **정산 실행 파일**이라 diff 발생 — 단 "제외절 1개"만(금액/분배 계산식 무변경). 대표 확인 필요: "머니 계산 파일 diff 0" 을 *계산식 불변*으로 해석하면 통과, *정산파일 무접촉*으로 해석하면 이 제외를 별도 게이트 함수로 뺄지 결정.

### A-5~6. 성과 연결 + 리포트
- **성과**: 선정자 user_id 목록 ⋈ `affiliate_earnings.referrer_id`(+캠페인 기간) — **신규 집계 테이블 불필요**. 캠페인별 응모수/선정/체험권사용(실방문, `voucher_use_logs`+`vouchers.used_at`)/이후 링크판매 전환.
- **QR 방문데이터**: 정상 기록(`voucher_use_logs`·`voucher_redemptions`) — 0원이어도 사용확인은 정상(요구사항 "방문 데이터 수집" 그대로).
- **B2G 리포트 export**: 캠페인별 CSV(응모·선정·사용·전환 + 추첨 시드/스냅샷). `csvEscape`(수식인젝션 가드) 재사용.

---

## WP-B. 조건부 우대 커미션 (C5 확장 — 새 요율 로직 0)

**발효 = 단일 UPDATE**: 판매 시점 쿼리가 이미 `seller_influencer_deals.status='active' AND ends_at` 게이트(`group-buy.routes.ts:457-460`, `helpers.ts:343`). status='active' 로 올리는 UPDATE 전 판매=기본율, 후=우대율 → **소급 없음 구조적 보장**(attribution 은 판매시점 확정 INSERT). `calcInfluencerCommissionPct` 무변경(deal 행 active면 자동 반영).

**마침 빈 자리**: 매장→인플 제안(`proposed_by='seller'`)을 **인플이 수락하는 API 가 현재 없음**(`UPDATE seller_influencer_deals` 는 marketing.routes:369 seller-respond 한 곳뿐). "인증 시 발효"가 이 구멍에 자연 안착.

**구현(3조각, 전부 기존 패턴)**:
1. **컬럼 ALTER**(repair-schema 관례): `requires_content_proof`(0/1) + `proof_url` + 필요시 `proof_status`. seller propose body 에 조건 체크박스 1개.
2. **인플 수락+콘텐츠 링크 제출 라우트**(influencerApp): `gb-proposals.routes.ts:113-140`(인플 respond) + `review-bonus`(URL 도메인 검증) 패턴 복사. 조건부 딜은 수락해도 바로 active 아님 → `proof_status='submitted'` 로.
3. **매장 승인 라우트**(sellerApp): `review-bonus` adminApp approve/reject **CAS 패턴**(`WHERE ... AND status='submitted'` + `meta.changes`) → 승인 시 `status='active'` UPDATE(발효). 거절 시 proposed 유지.
- **캡 가드**: 제안 시점 `max_influencer_commission_pct` 검증(marketing.routes:333-337) 그대로. 조건부 딜도 이 경로.
- **UI**: 셀러 `SellerInfluencerDealsPage.tsx` propose 폼에 조건 체크박스, 인플 `InfluencerSettlementPage.tsx:119-132` deal 항목에 "수락+링크제출" 버튼.

### ✅ WP-B 구현 완료 (campaign/6 백엔드 `c796f55d` + campaign/7 UI `389aeead`)
실제 엔드포인트(마운트: seller `/api/seller-marketing`, influencer `/api/influencer-settlement`):
- `POST /seller-marketing/deals/propose` — body 에 `requires_content_proof` 수용. 1이면 `status='proposed'` 유지 + `proof_status='pending'`(propose 만으로 발효 안 됨).
- `POST /influencer-settlement/deals/:id/submit-proof` — 인플 https 링크 제출. CAS `WHERE influencer_id=me AND proposed_by='seller' AND requires_content_proof=1 AND status='proposed' AND proof_status IN(pending,rejected)` → `'submitted'`.
- `POST /seller-marketing/deals/:id/approve-proof` — 매장 승인 시 CAS `WHERE seller_id=me AND requires_content_proof=1 AND proof_status='submitted'` → `status='active'`(**발효 트리거**) + `proof_status='approved'`. reject → `proof_status='rejected'`(재제출 대기).
- `GET /influencer-settlement/deals` — 인플이 자기에게 온 제안 목록(신규, submit 대상 노출용).
- 컬럼(repair-schema): `seller_influencer_deals.{requires_content_proof(INT DEFAULT 0), proof_url(TEXT), proof_status(TEXT)}`.
- UI: 셀러 propose 폼 체크박스(opt-in) + 인증상태 라인 + 승인/반려 버튼; 인플 `influencer-settlement/ConditionalDealsSection.tsx`(조건부 제안만, 대상 없으면 미렌더) 링크 제출.
- **머니**: 계산 파일 diff 0. 발효는 기존 `status='active'` 게이트 재사용 — 새 요율 로직 0, 인증 전 판매분 기본율(소급 없음). opt-in 미체크 = 현행 무조건부 흐름 byte-동일.

---

## WP-C. QA — 네이버 블로그 → 링크샵 ref 생존 (전제조건 = **성립**)

**핵심 시나리오 생존 확인**: 네이버 블로그 본문 링크 → `/u/handle`(?ref 유무 무관) → 결제 시, 인플(=링크샵 주인) 귀속이 **URL ref 파라미터와 무관하게 진입 씨딩으로 생존**. `CuratorPage.tsx:97-101` 이 진입 순간 주인 user_id 를 `affiliate_ref`(24h)로 씨딩(2026-07-07 진입=세션귀속). 로그인 왕복(safe-internal-path ref 보존 + wipe KEEP)·네이버 인앱→외부전환(쿼리 보존)·재진입 재씨딩 모두 방어됨.

**실질 리스크 3 (블로거 영입 전 고려)**:
1. **24h 윈도우가 블로그 롱테일에 짧음** ← **최대 리스크**. 최소수정: TTL 상수 24h→7d(`affiliate-track.ts:20-21`, `ProductDetailPage.tsx:56-58` 4곳). 비-머니(어트리뷰션 타이밍).
2. **교환권/공구 결제의 서버측 intent 부재**(클라 발사 의존 — 탭종료/track 실패 시 유실). 최소수정: `/join`·`/confirm-toss` 성공 시 쿠키/헤더 ref 를 `saveReferrerIntent`(order.routes 패턴 이식).
3. **제3자 ref(남의 링크샵 홍보)**: `/u/` 가 URL ?ref 를 안 읽고 주인 id 로 덮음. 정책 결정 필요(자기 링크샵 홍보 모델이면 무관).

→ WP-C 자체는 **수정 없이도 전제 성립**. (1) TTL 연장만 블로거 트랙에 권장(작고 안전).

---

## 스모크 시나리오 (캠페인 1회 왕복 — staging/파일럿)

1. **생성**: 매장이 체험 캠페인 개설(이용권 지정, 모집 3명, 응모기간, 미션="블로그 후기")
2. **응모**: 소비자 A·B·C 응모 → 중복 응모 시 차단 확인
3. **추첨**: 어드민 추첨 실행 → `fcfs_draw_logs`에 시드/풀스냅샷/당첨자 영구기록, 조회화면 노출
4. **발급**: 당첨자 A에게 0원 이용권 자동발급 → **원장에 정산/커미션 0행**(비정산 마킹 확인)
5. **사용**: A가 매장서 QR 사용 → `voucher_use_logs`·`used_at` 기록(방문데이터) + **auto-settlement cron에 안 잡힘**(정가 정산 사고 0 확인)
6. **성과**: A의 링크샵 ref 판매 → 캠페인 리포트에 전환 집계
7. **리포트**: 캠페인 CSV export(응모/선정/사용/전환 + 추첨 증빙)
8. **WP-B**: 매장이 A에게 우대커미션 제안(조건=콘텐츠 인증) → A 수락+블로그링크 제출 → 매장 승인 → 이후 A 판매분만 우대율(이전 기본율 확인)

## 게이트 (전부 기본 OFF)
- `experience_campaign_enabled`(WP-A 표면 노출) · 체험권 마킹은 발급 자체가 신규 경로라 캠페인 미개설 시 0
- `conditional_commission_enabled`(WP-B) — OFF면 조건필드 미노출, 기존 딜 흐름 불변

## 머니 파일 접촉 판정
- **무접촉(계산식 불변)**: `commission-budget.ts`·`order-commissions.ts`·`owner-promo.ts`·`fee-resolver`·`ledger.ts` 분배식·`calcInfluencerCommissionPct`.
- **접촉(제외절/발효 1줄, 계산식 불변)**: `auto-settlement.ts`(체험권 SELECT 제외) · `seller_influencer_deals` status UPDATE(WP-B 발효). ⚠️ 대표 확인: 이 둘을 "계산식 불변이면 OK"로 볼지, 게이트 함수로 더 격리할지.
