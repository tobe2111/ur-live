# 공급사(제조사) 지급 — 원천징수 모델 결정 (PAY-5)

> 결론부터: **공급사 지급은 gross(세금계산서 기반) 정산이 맞다. 원천징수(3.3%/8.8%)를 적용하지 않는다.**
> 근거: B2B 거래 + 바로빌 전자세금계산서 와이어링. 공급사는 사업자 → 본인이 세금계산서를 발행하므로 원천징수 대상이 아니다.

---

## 1. 두 모델의 구분

유어딜에는 지급 대상에 따라 **서로 다른 세무 처리**가 공존한다. 섞으면 안 된다.

| 모델 | 대상 | 처리 | 강제 위치(SSOT) |
|---|---|---|---|
| **소득형 — 원천징수** | 인플루언서/셀러 정산, 교환권/딜 환급 | 사업소득 3.3%(default) / 기타소득 8.8% 차감 + 지급조서(`tax_withholding_log`) | `src/worker/utils/tax-withholding.ts` — `WITHHOLDING_RATES`, `withholdAndLog()`, `sellers.tax_type` |
| **gross — 세금계산서** | **공급사(제조사) B2B 정산** | 원천징수 **미적용**. 공급가 전액 지급. 부가세는 세금계산서로 정산 | `supplier_settlements` / `supplier_balances` / `payoutSupplier()` — withholding 호출 없음 |

### 왜 공급사는 gross 인가
- **거래 성격이 B2B**: 제조사 ↔ 유통스타트는 사업자 간 매입거래. 원천징수는 개인의 인적용역/사업소득에 대한 것이지, 사업자 간 재화 공급(도매)에 적용하지 않는다.
- **세금계산서 주체가 공급사**: `tax-documents.ts` 의 `direction='purchase'`(제조사→유통스타트) 모델 + 바로빌 와이어링(`distributor-admin.routes.ts` issue-nts)이 이를 전제로 설계됨. 공급사가 매출 세금계산서를 발행 → 부가세 10% 별도(`splitVat`). 플랫폼이 원천징수하면 이 구조와 충돌(이중 처리).
- **현재 코드도 gross**: `creditSupplierOnWholesaleOrder` / `creditSupplierOnOrder` 는 `calcSupplySplit` 의 `supplier_amount`(공급가) 를 그대로 적립하고, `matureSupplierSettlements` → `payoutSupplier` 가 전액 지급한다. **어디에도 `withholdAndLog` 호출이 없다.** 즉 코드는 이미 gross 로 동작 중 — 이 문서는 그 동작을 **명시적 결정으로 고정**한다.

---

## 2. 어디서 무엇이 강제되는가

- **gross(공급사)**: `supplier_settlements.supply_amount` = 공급가 전액. `payoutSupplier` 가 available 전액 지급. 원천징수/지급조서 없음. 세무는 별도 세금계산서(`tax_documents` purchase 방향 + `wholesale_purchase_invoices` 역발행 기록, TAX-1).
- **withheld(셀러/인플루언서)**: 정산 송금/교환권/딜 환급 시점에 `withholdAndLog()` 가 `sellers.business_registration_status`('verified'/'exempt' → 면제) + `tax_type` 으로 3.3%/8.8% 차감 후 `tax_withholding_log` 기록.

두 경로는 **테이블도 함수도 분리**되어 있어 교차 오염이 없다. 공급사 정산 경로에 `withholdAndLog` 를 끼워넣지 말 것.

---

## 3. 엣지 케이스

- **비사업자 공급자가 있다면?**
  현 설계는 공급사 = 사업자(세금계산서 발행 가능)를 전제한다. 만약 비사업자(사업자등록 없는) 개인이 공급사로 들어오면:
  - 그 개인은 세금계산서를 발행할 수 없어 gross 지급이 세무상 문제(원천징수 누락)가 될 수 있다.
  - 대응 옵션 (택1, 사용자 결정 필요):
    1. **입점 게이트**: 공급사 입점 시 사업자등록 필수화(현재 유통회원 가입은 사업자번호 필수 — 공급사도 동일 강제 권장). → gross 유지.
    2. **소득형 분기**: 비사업자 공급자에 한해 `withholdAndLog` 적용(인플루언서 모델 재사용). → 공급사 정산 경로에 분기 추가 필요(현재 미구현).
  - **권장**: 옵션 1(사업자 게이트) — 모델 단순 유지 + B2B 본질에 부합.
- **외국 공급사 / 면세 품목**: 현 범위 밖. 다국가/세율 추상화(SCALE-1)는 보류 영역.

---

## 4. 결정 + `[확인 필요]`

- ✅ **결정**: 공급사(제조사) 지급 = **gross(세금계산서 기반), 원천징수 미적용**. 코드 현 동작과 일치 — 변경 불필요(문서화로 고정).
- `[확인 필요]` **비사업자 공급자 허용 여부**: 허용하지 않고 **사업자등록 필수 게이트**로 갈지(권장), 아니면 비사업자에 한해 소득형 원천징수 분기를 추가할지. → 전자면 추가 코드 없음, 후자면 공급사 정산 경로에 withholding 분기 신설 필요.

> 작성: 2026-06-08. 본 결정은 `tax-withholding.ts`(원천징수율 hardcode 금지 룰)와 무관 — 공급사 경로는 애초에 원천징수를 호출하지 않으며, 인플루언서/셀러 경로의 3.3%/8.8% 는 그대로 유지된다.
