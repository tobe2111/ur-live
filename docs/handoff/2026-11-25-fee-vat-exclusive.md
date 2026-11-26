# 2026-11-25 수수료 부가세 별도 (정산·세금계산서)

대표: *"1번 부가세 별도로 하자. 그렇게 구현도 해줘."* — 결재 `docs/decisions/archive/2026-11-25-fee-vat-exclusive.md`.

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
- 사장님 정산 화면 · FAQ(`minPayoutRule`) · 가이드 v83 · 머니 스위치 칸. 결재 `docs/decisions/archive/2026-11-25-payout-min-monthend.md`.
- 세금계산서를 "정산한 달에만" 발행하는 안은 대표가 괜찮다고 했지만 공급시기 문제로 세무사 확인 대기(코드는 사용월 기준 유지).

## 5단계 — 볼타 보류 · 주민번호/간이지급명세서 (대표 *"일단 이건 보류하고 나머지 다른 할 일 하고"*)
- 볼타 연동(PR #2511)은 **보류** — PR 은 닫고 코드는 `docs/handoff/patches/2026-11-25-bolta-integration.patch` 로 보관(`git am` 으로 되살린다).
- 개인 소개자 주민번호: `worker/utils/payee-tax-id.ts`(키 없으면 저장 거부, `v1:` 암호문) · 인플루언서 정산 화면 "주민등록번호" 줄 · `PUT/GET /api/influencer-settlement/tax-id`.
- 간이지급명세서 집계 `worker/utils/simplified-payment-statement.ts` · 어드민 CSV `GET /api/admin/tax/simplified-statement`(2FA·감사) · 월 1일 요약에 대상·미등록 수.
- 결재 `docs/decisions/2026-11-25-payee-rrn-collection.md`. 남은 것: 개인정보 처리방침 문구 · 개인 에이전시 입력 화면(표는 지원).

## 6단계 — 처리방침 · 개인 에이전시 (대표 *"일단 그건 보류. 다른 할 것들을 해줘"*)
- 개인정보 처리방침 ⑤ 소개비·에이전시 수수료 지급(개인): 실명·주민등록번호·정산 계좌 + 보관 5년(국세기본법) · 최종 개정 2026-11-25.
- 개인 에이전시 주민번호: `GET/PUT /api/agency-console/tax-id`(저장은 관리자) · 에이전시 정산 시트 버튼 · `TaxIdSheet` 에 저장 함수 주입.
- 어드민 가이드 v84 간이지급명세서 안내. 송금 완료 자동 기록(거래내역 조회)은 대표 보류.

## 7단계 — 정산 안전장치 3종 (대표 *"응 모두 해줘"*)
- 토스 입금 대사 `worker/utils/toss-settlement-recon.ts` — 매일(정산 cron) 3일 전 결제분, `GET /v1/settlements`(읽기) ↔ `orders`. 표 `toss_settlement_recon`(day UNIQUE). 토스에 없는 결제·금액 불일치면 어드민 알림 `toss_settlement_mismatch`. ⚠️ 토스 실응답 형식은 문서 기준 — 첫 실행 로그(`toss_recon day=… toss=… ours=…`)로 판정할 것.
- 주민번호 미등록 개인(사업자번호 없음): cron 송금 대기에서 빼고 본인 알림(`tax_id_required`) · 어드민 지급 `PAYOUT_NO_TAX_ID` 409.
- 정산 건 생성 시 매장에 `payout_scheduled`(목요일 입금 예정). 송금 완료 알림은 기존 `payout-sent-notify`.
- 결재 `docs/decisions/archive/2026-11-25-settlement-safety-guards.md` · 시험 `settlement-safety-2026-11-25.test.ts` · `payout-cycle-full` 에 주민번호 단계 추가.
## 4단계 — 볼타 연동 (대표 *"일단 볼타 서비스를 쓸까 해"*)
- `worker/utils/bolta-invoice.ts` — `POST https://xapi.bolta.io/v1/taxInvoices/issue`, Basic(키:), `Bolta-Client-Reference-Id = urdeal-fee-{seller}-{period}`, 영수·과세. 응답 `issuanceKey` → 상태 `requested`.
- 키: env `BOLTA_API_KEY` 우선, 없으면 `platform_settings.bolta_api_key`(어드민 설정 연동 자격 칸). 자동 발행 스위치 `fee_invoice_auto_send`(기본 false).
- 어드민 카드 [볼타로 발행] · 실패 사유 표시. 시험 `fee-tax-invoice-2026-11-25.test.ts` ⑤.
- ⚠️ **docs.bolta.io 는 이 작업 환경 프록시가 막아 원문을 못 읽었다**(검색 요약으로 확인). supplier/supplied 안의 상호·대표자·담당자 필드 이름은 추정 — 대표가 **테스트 키(test_)** 를 넣고 [볼타로 발행] 한 번 → 실패 사유가 카드에 뜨면 `boltaIssueBody` 만 고친다.
- 아직 없는 것: 국세청 결과 웹훅/조회(지금은 접수까지 → [발행 완료] 수동).

## 8단계 — 팝빌 연동 (대표 2026-11-26 *"팝빌로 할 것 같아. 일단 너가 할 수 있는거 더 없어?"*)
- 볼타 대신 **팝빌**. 보관했던 볼타 패치(삭제)를 바탕으로 연결부만 `worker/utils/popbill-invoice.ts` 로 바꿨다.
- 프로토콜 출처: developers.popbill.com 은 이 환경에서 막혀 **공식 SDK 를 받아 읽었다**(npm `popbill` 1.64.2 · `linkhub` 1.8.2 TokenBuilder 서명 식, Maven `popbill-sdk` 1.71.4 `Taxinvoice`/`TaxinvoiceDetail` 클래스 필드). 서명 식은 시험이 node:crypto 로 따로 계산해 대조한다.
- 즉시 발행(ISSUE) → 응답 승인번호로 바로 `issued`. 문서번호 `UD{yyyymm}-{매장id}` — 팝빌이 중복을 거부하므로 같은 달 두 번 발행되지 않는다(거부 문구면 issued 로 맞춤).
- 자격: env `POPBILL_LINK_ID`/`POPBILL_SECRET_KEY` 또는 어드민 연동 자격 칸 · 서버 `popbill_is_test`(기본 true) · 자동 발행 `fee_invoice_auto_send`(기본 false) · 절차 `S-POPBILL`.
- ⚠️ 값 표기(정과금·정발행·영수·과세·사업자)는 팝빌 표기 기억에 기댄 부분이 있다 — 테스트 서버 1장으로 확인(S-POPBILL 2).

## 9단계 — 팝빌 문서 대조 보정 (2026-11-26 대표가 인증 문서 공유)
- X-LH-Date 를 `yyyy-MM-ddTHH:mm:ssZ`(밀리초 없음)로 · 토큰 요청 Content-Type `application/json` · scope `["110","member"]`(문서 순서) · 품목 serialNum 문자열.
- 팝빌 필수 칸(공급받는자 상호·대표자 성명)이 비면 보내기 전에 사유를 남기고 초안으로 둔다(`sellers.representative_name`).
- 이번에 틀렸던 판단: SDK 의 `toISOString()`(밀리초 포함)을 그대로 옮겼다 — 문서 형식은 밀리초가 없다.

## 10단계 — 플랫폼 설정 저장이 통째로 막히던 것 (2026-11-26 대표 *"fee_vat_exclusive_from: 숫자 값만 허용됩니다 라는데?"*)
- 원인: 화면 저장 전 검사가 선택지 없는 머니 스위치 칸을 전부 숫자로 봤다 → 날짜 칸(기본 2027-01-01) 때문에 **무엇을 저장하든** 실패. 1단계에서 날짜 칸을 넣으며 서버 검증만 날짜로 바꾸고 화면 검사는 안 봤다(이번에 틀렸던 판단).
- 고침: 칸에 `pattern`(형식) · 화면이 숫자 검사 전에 본다 · 시험 `money-switch-save-validation-2026-11-26.test.ts`(모든 칸의 기본값이 검사를 통과 — 되돌려 빨간불 확인).

## 11단계 — 팝빌 키 Cloudflare 등록 · 연결 확인 (2026-11-26 대표 *"다 넣었어"*)
- 키는 대표가 Cloudflare 비밀값으로 넣었다(어드민 저장 대신 — 대표 *"cloudflare 에 등록하는게 더 안전하고 정확하지 않아?"*). Pages `ur-live` · Worker `ur-live`(cron) 두 곳 모두 `POPBILL_LINK_ID`·`POPBILL_SECRET_KEY` 존재 확인(이름만).
- `checkPopbill()` + `POST /api/admin/tax/popbill/check` + 카드 [팝빌 연결 확인] — 인증·공동인증서(CertCheck)·포인트, 테스트 서버면 가짜 공급받는자(8888888888) 1장. 초안 무관.
- 테스트 서버로 [팝빌로 발행] 해도 초안은 **초안 그대로**(종전: `issued`/`popbill_test` 로 바뀌어 실제 발행이 빠질 뻔). 오류 문구에 팝빌 코드 붙임.
- 이번에 틀렸던 판단: 8단계에서 테스트 서버 성공을 `issued` 로 기록하게 만들었다 — 국세청에 안 간 것을 발행 완료로 적는 것.

## 12단계 — 팝빌 테스트 서버 라이브 확인 (2026-11-26 KST 16:00 경)
- 실측(`POST /api/admin/tax/popbill/check {sample:true}`, 라이브): 인증 정상 · 공동인증서 "유효성 확인" · 테스트 포인트 0 · 가짜 공급받는자 시험 발행 **성공**(승인번호 받음). ⇒ 서명·헤더·본문 형식이 팝빌과 맞는다(E4, 테스트 서버).
- 남은 것(대표): 팝빌 운영전환 신청 → 운영 사이트 공동인증서·포인트 충전. 그 뒤 세션이 `popbill_is_test=false` → 운영 연결 확인 → `fee_invoice_auto_send=true`.

## 13단계 — 오래 써도 조용히 멈추지 않게 (2026-11-26 대표 *"안정적으로 영구적으로 설계했지?"*)
- `checkPopbill` 에 공동인증서 만료일(cfg=CERT)·발행 단가(cfg=UNITCOST) · `popbillHealthWarnings()` — 인증 실패 / 인증서 문제·만료 45일 전 / 포인트 < 발행 예정×단가 / 자동 발행인데 테스트 서버 / 자동 발행인데 자격 없음.
- 매월 1일 회계 요약에 위 경고를 싣는다(자동 발행 여부와 무관하게 자격이 있으면 점검). 시험 `fee-tax-invoice` ⑥(만료 경고 끄면 빨간불 확인).
- 세무사 질문지 `docs/business/tax-advisor-questions-2026-11.md`(7항목) · 결재 `docs/decisions/2026-11-26-partner-tax-invoice.md`(open — 위수탁 접고 직접 발행→역발행).

## 14단계 — 서류가 조용히 틀리지 않게 (2026-11-26 대표 *"가장 이상적인 형태가 되어야 해"*)
- 🛰️ 국세청 전송 결과: 팝빌 즉시 발행은 승인번호를 바로 주지만 국세청 전송은 다음 날. 매일 cron 이 최근 40일 발행분 `GetInfo`(`/Taxinvoice/SELL/{문서번호}`) → 304 끝 · 305 반려면 `nts_state`·사유 기록 + 어드민 알림 `fee_invoice_nts_failed`. `checkIssuedInvoiceStates`.
- 🔁 달을 넘긴 사용 취소: 그 달 순수수료가 마이너스인 매장은 종전 `total > 0` 필터에 걸려 조용히 사라졌다 → `computeFeeInvoiceNegatives` 로 잡아 월 요약에 "수정세금계산서 필요" 경고. 수수료가 없어진 매장의 묵은 초안은 삭제(초안만).
- 시험 `fee-tax-invoice` ⑦(두 기능 각각 꺼서 빨간불 확인).
- 이번에 틀렸던 판단: 처음 묵은 초안 삭제를 `NOT IN (…)` 동적 바인드로 썼다 — D1 바인드 한도 가드 클래스라 행별 삭제로 바꿨다.
