# 2026-11-25 수수료 부가세 별도 (정산·세금계산서)

대표: *"1번 부가세 별도로 하자. 그렇게 구현도 해줘."* — 결재 `docs/decisions/2026-11-25-fee-vat-exclusive.md`.

## 한 것
- 규칙 SSOT `src/shared/fee-vat.ts` · 설정 읽기 `src/worker/utils/fee-vat-policy.ts`(조회 실패 = 기본 시작일).
- 이용권 사용 분개(`recordVoucherUsedLedger`)에 4번째 줄: 보관금 → `platform:vat_payable`(수수료 × 10%). 매장 몫이 그만큼 준다. 유어딜 수익 줄은 수수료 그대로. 사용 취소는 기존 `reverseVoucherUsedLedger` 가 같이 뒤집는다.
- 쇼핑 적립(`order-ledger-credit`)은 `fee_amount` 에 합치고 `metadata.fee_vat` 로 구분.
- 시작일 어드민 `fee_vat_exclusive_from`(기본 2027-01-01 KST · `off` = 끔) — 머니 스위치 칸·검증 추가.
- 매장 화면: `/api/seller/fee-context` 가 `fee_vat_from`·`fee_vat_on` 을 준다 → 마진 계산기·첫 이용권 화면이 적용 중이면 ×1.1, 전이면 안내 문장.
- 사전 안내: `worker/utils/fee-vat-notice.ts` — 시작일 전까지 매일(정산 cron), 승인 매장마다 한 번(`fee_vat_notices` UNIQUE).
- 월 회계 요약에 수수료 부가세 예수금 줄.
- 문구: 판매자 약관 정산 조항 · 파트너 사실표 `feeVatNote` · 랜딩 FAQ · 셀러/어드민 가이드(매장 역발행 안내 → 정발행 안내, 가이드 v81) · 블로그 정산 글(v18) · 사업계획서 · 플랫폼 모델 §5-2.
- 시험 `src/tests/unit/fee-vat-exclusive-2026-11-25.test.ts`(실 스키마 D1 로 분개·취소·안내·월 요약).

## 2단계 (같은 날, 대표 *"내가 해야하는거 말고 일단 너가 할 수 있는거 해줘"*)
- 매장 수수료 세금계산서 정발행 초안: `worker/utils/fee-tax-invoice.ts`(표 `fee_tax_invoices`, UNIQUE seller·period) — 매월 1일 요약(`sendMonthlyCloseSummary`)이 만들고 장수를 알린다. 시작 전(부가세 줄 없음) 건은 수수료를 부가세 포함으로 나눈다.
- 분기 판매·결제대행 명세 집계: `worker/utils/sales-agency-report.ts` — 1·4·7·10월 요약에 기한.
- 어드민 문: `features/admin/api/admin-fee-invoices.routes.ts`(세무 라우트에 등록) · 카드 `pages/admin-payouts/FeeInvoicesCard.tsx`.
- 시험 `fee-tax-invoice-2026-11-25.test.ts`.

## 이어받는 세션의 첫 액션 (대표가 이어서 하라고 했을 때만)
- 다음 단계 = 발행 사업자 API 어댑터(초안은 이미 자동 생성됨): `fee_tax_invoices` draft → 업체 API → `status='issued'`. 업체는 대표가 가입(볼타 정발행 90원/건 공개가 · 팝빌 200원/건). 기존 `tax-invoice-gateway.ts` 는 **역발행 전용**이라 정발행 어댑터를 새로 둔다.
- 사업자 인플루언서 소개비·에이전시 수수료는 역발행(또는 위수탁) — 대표 아이디어: 최초 1회 위임 동의 후 매월 10일 지급 때 자동 발행.

## 이번에 틀렸던 판단
- 셀러 가이드에 *"매장 정산금에 대해 유어딜이 매입세금계산서를 역발행"* 이 살아 있었다 — 중개 구조와 방향이 반대다(매장 대금은 유어딜 매입이 아님). 정발행 안내로 바꿨다.
- 처음엔 테스트가 어드민 가이드의 역발행 절(사업자 셀러 매입 — 다른 기능)까지 잡았다. 매장용 절 제목으로 좁혔다.

## 남은 결정
- 정산 기한(사용 후 20일 이내 등)은 대표 미답 — 다른 세션 결재 `2026-11-25-store-payout-thursday-vs-hold.md` 와 같은 주제라 그쪽과 겹친다(이 PR 은 손대지 않음).
- 간이지급명세서용 개인 인플루언서 주민등록번호 수집 — 미구현.
- 분기 판매·결제대행 명세(부가세법 제75조) 파일 — 미구현, 세무사 형식 확인 필요.

## 반영 커밋
(PR 에 기록)

## 3단계 — 매장 정산 최소 금액 · 월말 상한 (같은 날)
- `shared/store-payout-min.ts` — 어드민 `payout_min_krw`(기본 1만 원) · 그달 마지막 목요일 회차는 1원 이상이면 정산. `payouts-generate` 가 사용.
- 사장님 정산 화면 · FAQ(`minPayoutRule`) · 가이드 v83 · 머니 스위치 칸. 결재 `docs/decisions/2026-11-25-payout-min-monthend.md`.
- 세금계산서를 "정산한 달에만" 발행하는 안은 대표가 괜찮다고 했지만 공급시기 문제로 세무사 확인 대기(코드는 사용월 기준 유지).

## 5단계 — 볼타 보류 · 주민번호/간이지급명세서 (대표 *"일단 이건 보류하고 나머지 다른 할 일 하고"*)
- 볼타 연동(PR #2511)은 **보류** — PR 은 닫고 코드는 `docs/handoff/patches/2026-11-25-bolta-integration.patch` 로 보관(`git am` 으로 되살린다).
- 개인 소개자 주민번호: `worker/utils/payee-tax-id.ts`(키 없으면 저장 거부, `v1:` 암호문) · 인플루언서 정산 화면 "주민등록번호" 줄 · `PUT/GET /api/influencer-settlement/tax-id`.
- 간이지급명세서 집계 `worker/utils/simplified-payment-statement.ts` · 어드민 CSV `GET /api/admin/tax/simplified-statement`(2FA·감사) · 월 1일 요약에 대상·미등록 수.
- 결재 `docs/decisions/2026-11-25-payee-rrn-collection.md`. 남은 것: 개인정보 처리방침 문구 · 개인 에이전시 입력 화면(표는 지원).
