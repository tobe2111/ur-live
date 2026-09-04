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

### 커밋 2 (전면 삭제) — 완료
- **워커 언마운트**: `/api/agency/**`(7) · `/api/agency-public` · `/api/agency/transfers` +
  `/api/seller/transfers` · `/api/agency/delegation` · `/api/seller/delegation` ·
  `/api/invite/:code`(에이전시 초대코드) · 어드민 `/agencies`·`/agency-creator-approvals` ·
  `/api/seller/promote-boosts` · 봇 보호 `/api/agency/login|forgot-password`.
- **화면**: `/agency/**` 16라우트 · `/a/:slug` · `/agency-partner` · `/terms/agency` ·
  어드민 2화면 · `/seller/agency-delegation` · `/seller/promote-boosts` · `/agency/prospects` 별칭.
- **파일**: `src/features/agency/**` · 에이전시 크론 10개 · `agency-store-intro-commission.ts` ·
  `lib/agency-shared.ts` · `shared/utils/{agency-tier,invite-code-logic,seller-transfer-logic,message-template}.ts` ·
  페이지 21개 + `AgencyLayout` + `components/agency/` · `guide-seed-agency.ts` · `docs/AGENCY_POLICY.md`.
- **머니 추가 정리**: `recordAgencyCommissionShare`(이용권 사용 시 플랫폼 수수료의 **30%** 를
  영입 에이전시에 원장 분개) 삭제 — 대표 확정 원칙("5%는 온전히 유어딜")과 **정반대**였다.
  `agency_share_pct` 설정·어드민 입력·정책표도 함께 제거.
- **플래그/상수**: `AGENCY_DASHBOARD_SUNSET`(되살릴 대상이 없다) · `enable_agency_*` 6개 ·
  `AGENCY_SHARE_PCT`/`AGENCY_OWN_RATE`/`AGENCY_STORE_INTRO_PCT`.
- **문서**: `store-operator-model.md` §7 신설 · `urdeal-platform-model.md` 행위자표·경로 갱신 ·
  사업계획서 C-2 **전면 개정**(있지도 않은 에이전시 대시보드 도구 9종을 자랑하고 있었다) ·
  가이드 시드(어드민 `agency-ops` 섹션 교체 + 셀러 문구 정정) + `GUIDE_SEED_VERSION` 24→25.

### 🩸 문서가 코드보다 더 틀려 있었다
셀러 가이드가 *"수수료 차액(10%−5%)이 대행사 몫"* 이라고 적고 있었다. **대표 정정과 정반대**다 —
차액은 유어딜이 **덜 받는** 것이지 중개사에게 주는 것이 아니다. 사업계획서 C-2 는 더했다: 이미 삭제된
에이전시 대시보드의 도구 9종(매칭 제안·인센티브·캠페인·쿠폰·PK배틀·멤버·캘린더…)을 대외 제안서에서
자랑하고 있었다. **둘 다 이번에 고쳤다.**

### 가드
- **낡은 지도 4건을 함께 고쳤다** — 가드가 삭제된 파일을 지목하면 그 불변식은 *조용히* 검사되지 않는다:
  `check-commission-budget`(에이전시 적립 파일 2개 · R3 마커 기대 2→1 · R4b 앵커 이동) ·
  `check-dashboard-login-session-coexist`(AgencyLoginPage) · `check-internal-links`(agency.routes).
  🩸 R4b 앵커를 옮기고 **첫 주입이 초록불**이었다 — `const debitAcct = 'platform:revenue'` 로 심었는데
  가드는 `debit_account: 'platform:revenue'` **리터럴**을 본다. 같은 결함인데 형태가 달라 못 봤다.
  주입을 가드가 실제로 보는 형태로 고쳐 빨간불 확인.
- 신규 `src/tests/unit/agency-sunset-final.test.ts` 12건 — 파일 부재 · 마운트 부재 · 라우트 부재 ·
  역전 부재 · 커미션 축 부재 · fee-resolver 공급 차단 + **일몰이 삼키면 안 되는 것 3건**
  (referral `/api/invite` · 사람 영입 2% · `seller_operators`).
- 주입 매니페스트 4건 **되돌려-검증 빨간불 확인**. 그중 하나는 방향이 **뒤집힌** 항목이다
  (08-31 "역전은 남긴다" → 09-04 "역전도 없앤다").
- 낡아진 단언 3건을 뒤집었다: `mypage-cleanup`(에이전시 대시보드 바로가기 유지→제거) ·
  `point-credit-ledger-row`(signup_bonus 모듈 존재→부재) · `voucher-nav-reachability`(promote-boosts 유지→삭제).

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
