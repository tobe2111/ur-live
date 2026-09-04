# 2026-09-04 — 에이전시 완전 일몰 + 매장 정리 + 매장↔중개사 권한 모델

## 대표 지시 (그대로)

> "그 에이전시는 없애자. 에이전시 대시보드도 안쓸거야. **더 이상 헷갈리지 말자 다른 세션에서도 그렇고.**
>  매장 홍대돈가스 말고는 다 삭제해."
>
> "에이전시 남은 잔재 다 삭제하고, **중개사가 5% 내에서 가져가는게 아니라 나머지 95%에서 매장이랑
>  거래를 하는거지. 5%는 중개사 일 때 유어딜의 수수료인거고.**"
>
> "**1,2번은 삭제하고 3번** 즉 매장과 중개사 간의 셀러대시보드에서 작업을 어떻게 해야할지
>  **정하고 나서 작업하자.** 체계적이고 가장 이상적으로"

⇒ ① 에이전시 잔재 삭제 · ② 매장 7곳 삭제 · ③ 권한 모델은 **설계 확정 후** 구현(이번 세션 구현 금지).

## 🔑 개념 정리 (다음 세션이 헷갈리지 말 것)

| | 무엇 | 코드 실체 | 유어딜 수수료 |
|---|---|---|---|
| **직접 입점** | 매장이 스스로 가입 | `seller_meta.store_channel='direct'` | **10%** |
| **중개(대행)** | 중개사가 매장을 데려와 대신 운영 | `store_channel='brokered'` + `seller_operators` | **5%** |

- **중개사는 에이전시가 아니다.** 별도 대시보드/테이블(`agencies`)이 아니라 **셀러 대시보드 계정**이고,
  매장과의 관계는 `seller_operators(seller_id, user_id, role)` 한 줄로 표현된다.
- **중개사의 보상은 유어딜 5% 안에서 나오지 않는다.** 5% 는 어디까지나 유어딜 몫이고,
  중개사는 **나머지 95%(매장 몫)** 에서 매장과 직접 거래해 공수 비용을 받는다.
  ⇒ 유어딜 장부에는 중개사 지급이 **아예 등장하지 않는다**(적자 구조가 생길 수 없다).
- 그래서 에이전시 1%·24개월(`agency_intro`)은 2026-08-31 에 폐지됐고, 이제 그 잔재까지 지운다.

## 라이브 실측 (삭제 근거 — 2026-09-04)

```
agencies                        4행 (유어딜 본사 · 인디아즈 · 제아스컴퍼니 · KONEX)  ← 껍데기만
sellers.introduced_by_agency_id 0명    ← 어느 매장도 에이전시에 붙어 있지 않다
store_agency_delegation         0행
agency_store_intro_commissions  0행    ← 이 경로로 돈이 나간 적이 **한 번도 없다**
```
⇒ 삭제해도 잃는 데이터가 없고, 되돌릴 정산도 없다.

## ① 에이전시 잔재 삭제 — 진행 상황

### 커밋 1 (머니/크론 정지) — 진행 중
- `cron/daily-lane.ts` — `agency-cron-batch` → **`growth-daily-batch`** 로 개명하고 에이전시 6종 삭제
  (campaigns 집계 · creator-eval · monthly-tasks · inactive-sellers · self-events(딜 지급) ·
  store-intro 월 보너스(현금)). **유지**: 틱톡 동기화 · 셀러 일일 리포트 · 광고 슬롯 낙찰.
- `scheduled.ts` — `agency-weekly-batch` → **`weekly-tier-batch`**, 에이전시 5종 삭제
  (auto-settle 송금 · incentives · tier-eval · monthly-invoices · monthly-report).
  **유지**: 셀러 등급 평가 · 판매사 도매 등급 평가.
- `order-refund.ts` · `returns.routes.ts` — `reverseAgencyStoreIntroOnRefund` 호출 삭제
  (적립은 08-31 폐지 + 대상 0행 = 구조적 no-op).
- `fee-breakdown-record.ts` — `agencies` 를 읽어 만들던 per-agency 컨텍스트 삭제 → `ctx.agency = null`.
  ⚠️ **`fee-resolver.ts` 는 안 건드렸다** — 머니 SSOT 의 합계 불변식을 고치는 것보다 *공급을 끊어*
  슬라이스를 0 으로 만드는 쪽이 훨씬 되돌리기 쉽다. agency 필드/컬럼은 스키마 호환으로 남긴다.
- `feature-flags.ts` — `enable_agency_*` 6개 삭제(이제 읽는 곳이 없다).
- `seller-churn-detect.ts` — 에이전시 알림 분기 삭제(`sellers.agency_id` 전원 NULL = 실행된 적 없음).
- 가드: `agency-intro-retired.test.ts` 의 "환불 역전은 남는다" 를 **정반대**로 뒤집고
  (`agency-sunset-final` 방향), 주입 매니페스트 항목도 같이 뒤집어 **되돌려-검증 빨간불 확인**.

### 남은 것 (커밋 2~)
- 워커 API 언마운트: `/api/agency/*`(7개) · `/api/agency/transfers` · `/api/seller/transfers` ·
  `/api/agency/delegation` · `/api/agency-public` · 어드민 `/agencies`·`/agency-creator-approvals`.
  **유지**: `/api/invite`(셀러 가입이 공개 초대코드를 쓴다) · `/api/seller/promote-boosts`.
- 프론트 `src/routes/agency.routes.tsx` 16라우트 + 페이지 삭제.
- `src/features/agency/**` 중 에이전시 전용 파일 삭제 (⚠️ 일부 파일이 머니 심볼을 함께 export 한다 —
  `agency-incentives.routes.ts` 의 `computeCommission` 이 `order-commissions`·`commission-budget` 에
  쓰인다. **먼저 그 심볼을 중립 위치로 옮기고** 파일을 지울 것).
- `agencies` 4행: 코드가 사라지면 읽는 곳이 없다. **프로덕션 DELETE 는 하지 않는다**(일회성 SQL 금지 룰).

## ② 매장 7곳 삭제 — 대기

삭제 대상 `sellers.id` = **3, 6, 7, 8, 9, 10, 11** (유지: **14 홍대돈까스**).
전수 확인 완료: 7곳 모두 상품·주문·이용권 **0건**. 6곳은 이미 `suspended`, id 9(검증상호)만 `approved`.
⚠️ 어드민 기능으로 처리한다(프로덕션 raw DELETE 금지).

## ③ 매장 ↔ 중개사 권한 모델 — **설계 확정 후 구현** (대표 지시)

지금 상태: `seller_operators` 로 owner/operator 를 **설계는 했는데 강제를 안 한다**.
셀러 토큰이 `seller_id` 하나로 전부를 열어 주므로 **operator 도 정산계좌·사업자정보를 볼 수 있다.**
`isStoreOwner` 를 실제로 부르는 곳은 두 군데뿐: `seller-operators.routes.ts:156` · `seller-stores.routes.ts:537`.

⇒ 다음 세션 첫 액션: `docs/design/store-operator-model.md` §3 에 **owner 전용 범위**를 확정해 대표 승인.

## 다음 세션 첫 액션
1. `git log --oneline origin/main..claude/agency-sunset-final` 로 어디까지 왔는지 확인.
2. 커밋 2(워커 언마운트)부터 이어서. `npx tsc --noEmit` 이 유일한 배선 판정이다.
3. ③은 **설계 승인 전 구현 금지**.

## 이번에 틀렸던 판단
- (앞 세션) *"영입 2% 와 에이전시 2% 가 겹쳐 적자"* → **틀렸다.** 영입 2% 는 2026-08-31 부터
  `store_channel==='direct'` 전용이고 이미 구현돼 있다. 에이전시 1% 는 같은 날 폐지됐다.
- (앞 세션) *"5% 할인이 중개사의 몫"* → **틀렸다.** 대표 정정: 중개사는 95% 쪽에서 매장과 거래한다.
- (앞 세션) *"어느 에이전시인지 비어 있다"* → 반만 맞았다. 중개 관계는 `agencies` 가 아니라
  `seller_operators`(seller 14 · user 3 · role='operator') 한 줄에 기록돼 있었다.
