# 상권 쿠폰(영수증 페이백) — 아키텍처 결정 + 견적 (2026-07-12)

> **상태**: ✅ **코어 구현 완료(PR #505, 2026-07-13)** — 계약 확정 + "서비스 범용 기능" 대표 승인으로 착수, 전수조사(적대적 감사) 통과. 이 문서 = 제안서 첨부 + 구현 SSOT.
> 잔여: WP2 원장→자동 payout(격리 PR + staging 실정산) · 부정방지 2단계(OCR).
> **read-only 검토 기반** — 3축 코드베이스 조사(만료·귀속·store_code / 원장·부정방지·업로드) 결과 인용 포함.

## 1. 사업 배경
골목형상점가(점포 ~200개) 영수증 페이백. 고객이 참여 점포에서 3만↑/5만↑ 구매 → 영수증 모바일 등록 → 어드민 승인 → 3천/1만 원권 모바일쿠폰 지급 → **상권 내 200개 점포 어디서든 사용** → 사용 매장으로 정산. 오프라인 부스 대체가 목적.

## 2. 확정 설계 방향 (전제)
- 리워드는 **딜 지급 금지** → 별도 **"상권 쿠폰"** 유형. (상권 외 유출·기프티콘 차단 / 유어딜 5% 자기잠식 방지 / 전금법 검토 전 딜 잔액 확대 금지 / 사업 종료 시 정산 마감)
- 쿠폰 = **무상 발행 · 매장 미지정 발급 → 사용 시점 매장 귀속 · 정산 수수료 0**.
- **만료 시 소멸**(기존 이용권 만료 100% 자동환불 로직이 절대 타면 안 됨) + 미집행액 리포트.
- 부정 방지 1단계 = 영수증 승인번호 유니크 + 계정당 지급 한도 + 수동 검수. (OCR·자동탐지 = 2단계)

## 3. 아키텍처 결정 — ✅ 병렬 엔티티 (2026-07-12 대표 승인)
**`district_coupons` + `district_stores` 신규 엔티티로 구축. 기존 `vouchers` retrofit 금지.**

**근거(승인 사유)**:
1. **잠긴 voucher 머니 경로 무접촉** — 현 voucher는 매장을 `product.seller_id`로 파생(발급=사용 매장 고정). "사용 시 매장 귀속"을 voucher에 retrofit 하면 정산·원장·clawback 다지점 변경 = 머니 회귀 리스크 HIGH. 병렬 엔티티는 이 위험을 구조적으로 제거.
2. **무상/유상 구조 분리 (전금법)** — 상권 쿠폰이 딜 지갑·유상 선불과 코드·원장 레벨에서 완전 분리. 무상 리워드가 유상 선불과 안 섞임을 유형 분리로 보장. (체험권 0원 유형이 `amount>0` 게이트로 정산·커미션·유어딜 5%를 구조적으로 우회하는 선례와 동형 철학.)
3. **만료=소멸** — 병렬 엔티티는 `handleExpiredVoucherRefunds`(auto-settlement.ts) 자동환불 cron에 **애초에 탑승하지 않음** → 소멸 정책이 사실상 무료.

**머니 규율**: WP2(정산 원장)는 **격리 PR + staging 실정산 검증** 규율 적용(플랫폼 5%·환불 대칭 가드와 동일 취급). 원장 SSOT(`ledger.ts`)·payout(`payouts-generate.ts`) 파일은 조합·호출만, 로직 무변경.

## 4. 데이터 모델 스케치 (구현 시 확정)
- `district_stores(id, name, store_code(6자리 PIN), bank_*, is_active)` — 어드민 일괄 등록. **셀러 로그인 계정 불요**(사용처리는 소비자 PIN 인증). 정산 수령용 계좌만.
- `district_coupons(id, campaign_id, user_id, code, face_value, status(unused/used/expired), redeemed_store_id NULL, expires_at, created_at)` — 발급 시 매장 미지정, **사용 시 `redeemed_store_id` 네이티브 기록**.
- `district_receipt_submissions(id, user_id, store_id, amount, card_approval_no UNIQUE, image_key, status(submitted/approved/rejected), reject_reason)` — 승인 시 쿠폰 자동발급.
- 원장 계정: `budget:campaignN`(예산풀, debit) → 사용 시 `credit seller:N/store:N`, `fee_amount=0`(액면 전액 net) → 기존 주간 payout `LIKE 'seller:%'` 자동 합류.

## 5. 질문 10개 — 재사용 / 신규 / 격리 난이도

| # | 항목 | 판정 | 근거(코드) |
|---|---|---|---|
| 1 | 상권쿠폰 코어(미지정 발급·사용 시 귀속) | 🔴 **유일한 진짜 신규** — 병렬 엔티티 신설 | vouchers엔 seller_id 없음, `products.seller_id` 파생 전제(auto-settlement.ts:64, group-buy-voucher.routes.ts:154) |
| 2 | 정산 원장(예산풀→매장 credit→payout) | 🟢 **레일 조합**(신규 배선 아님) + 풀 잔액 가드만 신규 | 계정 자유문자열(ledger.ts:40), fee_amount=0=액면 net(:474), payout seller:% 자동(payouts-generate.ts:46) |
| 3 | 만료=소멸 분리 | 🟢 **사실상 무료** — 병렬 엔티티는 환불 cron 미탑승 | 단일 루프 `handleExpiredVoucherRefunds`(auto-settlement.ts:169), 무결제=환불분기 미매칭 |
| 4 | 영수증 접수(업로드·카드번호·한도·폼) | 🟢 **복제** + card_approval_no UNIQUE 신규 | `/upload/business-cert` 비인증 업로드(upload.routes.ts:180), 매직바이트·R2 |
| 5 | 어드민 승인 큐 → 자동발급 | 🟢 **복제** | kakao_review_submissions 큐(review-bonus.routes.ts:156) + AdminKakaoReviewsPage + generateUniqueVoucherCode |
| 6 | 200점포 사용 최소경로 | 🟢 **셀러 로그인 불요** — 소비자 PIN self-redeem | store_code self-redeem 소비자 인증만(group-buy-public.routes.ts:895), R1 rate limit 완비. 신규=어드민 일괄등록 |
| 7 | 리포트(발급/사용/미사용·점포별·export) | 🟢 **복제** | 체험캠페인 리포트+CSV(수식 인젝션 가드), 세무 CSV, 원장 집계 |
| 8 | 부정방지(승인번호·한도·공모·나눠결제) | 🟢 **재사용 큼** | affiliate 일/월 캡(affiliate-credit.ts:192), UNIQUE+INSERT OR IGNORE, detectVoucherFastUse(공모), self-purchase 가드 |
| 9 | 무상/유상 분리(전금법) | 🟢 **구조 보장** — 별도 엔티티, 딜·유어딜5% 무접촉 | 체험권 0원 유형 정산 우회 선례 |
| 10 | 공수 총괄 | 아래 표 | — |

## 6. 러프 공수표 (v3 — 병렬 엔티티 기준)

| WP | 내용 | 판정 | 러프 |
|---|---|---|---|
| WP1 | district_coupons+district_stores 코어(미지정 발급·사용 시 귀속·지갑·QR) | 🔴 신규 | 2~2.5주 |
| WP2 | 정산 원장(예산풀→credit fee=0→payout) + 풀 잔액 소진 가드 · **격리 PR** | 🟢 조합 | 0.75주+검증 |
| WP3 | 만료=소멸 | 🟢 무료 | 0.2주 |
| WP4 | 영수증 접수(업로드·카드번호 UNIQUE·한도·폼) | 🟢 복제 | 0.75주 |
| WP5 | 어드민 승인 큐 + 자동발급 + 매장 일괄등록 | 🟢 복제 | 0.75주 |
| WP6 | store_code self-redeem + PIN 일괄 | 🟢 복제 | 0.4주 |
| WP7 | 리포트 + 재단 export | 🟢 복제 | 0.75주 |
| WP8 | 부정방지 1단계 | 🟢 재사용 | 0.4주 |
| — | 통합·QA·**staging 실정산 검증(머니)** | — | 1주 |
| **합계** | | | **~7~7.5주 (1인)** |

재사용률 ~75~80%. 진짜 신규 설계는 WP1 하나(예산풀 재원 + 사용 시 매장 귀속). 나머지는 기성 레일 복제·파라미터화·배선.

## 7. 대외 견적 판정 (500만 / 4~6주)
- **4주 비현실적. 6주 타이트하나 방어 가능**(1인 시니어 + 타이트 스코프). 실질 6~7.5주.
- **500만 = 방어 가능**(시장가 하단, 과소 아님) — 근거: 밑바닥이 아니라 **기성 정산·업로드·승인·발급 레일 재사용**.
- **제안서 방어 문구**:
  1. "500만 = 재사용 기반 코어(WP1~7) 6주. 유어딜 기성 레일 위에 상권 쿠폰 유형을 얹는 구조."
  2. "부정방지 1단계(승인번호 유니크+한도+수동검수) 포함. OCR 자동검증·자동탐지는 선례(llava) 있어 2단계 소액 추가."
  3. "만료=소멸·무상/유상 완전분리는 별도 엔티티로 구조 보장(딜·유어딜5%·전금법 무접촉)."
- **운영 100~150만/월 = 타당**: 실제 인건 = 영수증 수동 검수(부스 대체 본질) + 인프라 + 예산 정산 마감. OCR 2단계로 검수 절감 여지.

## 8. 착수 시 유의(계약 확정 후)
- WP2는 반드시 격리 PR + staging 실정산 검증(머니). 원장/payout 파일 로직 무변경(조합·호출만).
- 서비스 분리 규칙 부합(상권 쿠폰 = 딜·유상과 별개 무상 유형).
- 2단계(OCR 자동검증·자동탐지)는 별도 견적 — 1단계 안정화 후.

---

## 9. 경로 B — 온라인 결제 자동발급 (2026-07-13 구현, 게이트 OFF·별도 draft PR)

대표 확정 "(b) 전면 구현". 페이백을 **두 참여 경로**로 확장:

| | 경로 A (오프라인 방문) | 경로 B (온라인 유입) |
|---|---|---|
| 트리거 | 영수증 사진 등록 → **어드민 승인** | 유어딜 **결제 완료** 감지(승인 자리를 결제가 대체) |
| 발급 | 승인 시 쿠폰 발급 | 기준액 이상 + 행사기간 내 자동 발급 |
| 쿠폰 | 동일 엔티티(`district_coupons`) · 동일 지갑 · 동일 정산 | 좌동 |
| 데이터 모델 | `district_receipts` source='receipt' | source='online' **자동승인 영수증 행**(승인큐 안 탐) |

**핵심 설계 결정 (대표 승인 4제약)**:
1. **결제 성공 경로 영향 0** — `/confirm` 의 `_confirmSideFx`(waitUntil 후처리)에서 호출 + `autoIssueDistrictCouponForOrder` 완전 fail-soft(절대 throw 안 함). 발급 실패가 결제 롤백 못 함. `DISTRICT_AUTO_ISSUE_ENABLED`(env, 기본 OFF) 미설정 시 `/confirm` byte-동일.
2. **1인 한도 A/B 합산** — 경로 B 도 `district_receipts` 행(source='online', 자동 status='approved')을 만들어, 기존 월 캡 쿼리(`status IN('submitted','approved')`)가 **A·B 자동 합산**(한도 로직 무변경).
3. **결제건 1회 발급** — `source_ref = order_number` UNIQUE(campaign) 멱등 + 쿠폰 `UNIQUE(receipt_id)` 이중방어. `card_approval_no` 는 `PAY:{order}` 로 비충돌 유지(비파괴).
4. **재원 분리** — `district_campaigns.auto_issue_funding_source`('foundation'/'urteam') + 쿠폰 `funding_source` 스탬프 + 예산 가드 2풀(`budget_total`=재단 / `budget_urteam`=유어팀). **원장 무접촉 — 컬럼 태그 + 집계 GROUP BY**(WP2 원장→payout 은 여전히 격리 PR). 리포트에 경로 A/B × 재원 구분 지표(유입효과·재원 정산).

**행사 기간 게이트(상시 아님)**: `withinCampaignWindow(starts_at, ends_at, now)` — 기간 밖 비발급. 기준액은 경로 A 의 `reward_tiers` 재사용(서버 권위).

**활성 순서(대표 조건 ①)**: main 머지 금지 → staging 실결제 검증(파일럿 매장 결제 → 쿠폰 1장 + A/B 한도 합산 + 재원별 예산 가드 + 중복결제 재발급 0) → 통과 후 머지 → env `DISTRICT_AUTO_ISSUE_ENABLED=true` + 캠페인 `auto_issue_enabled`.
