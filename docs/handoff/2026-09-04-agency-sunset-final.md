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

## ② 매장 정리 — 도구 완성, **실행은 배포 후**

### 🔴 내 앞선 보고가 틀렸다 — 매장은 8곳이 아니라 **11곳**이다
앞 세션에서 대표에게 *"매장 8곳(3·6·7·8·9·10·11 + 14)"* 이라고 보고했다. 라이브를 다시 세니 **11곳**이고,
빠져 있던 3곳 중 하나는 **비어 있지 않다**:

| id | 상호 | 상태 | 상품 | 비고 |
|---|---|---|---|---|
| 3·6·7·8·9·10·11 | 테스트 상점 · 테스트상호4 · 최종테스트상호 · 테스트상호001 · 검증상호 · 최종확인상호 · 제아스컴퍼니 | 전부 suspended | **0** | 대표 승인 삭제 대상 |
| **5** | **UR Team** (tobe2111@naver.com) | approved | **9** (한우·참기름·명란젓 등 **6개 활성**) | ⚠️ 앞 보고 누락 |
| **12** | Lister Corporation | approved | 0 | ⚠️ 앞 보고 누락 |
| **13** | 주식회사 셀메이커스 | suspended | 0 | ⚠️ 앞 보고 누락 |
| 14 | 홍대돈까스 | approved | 1 | 유지(대표 지시) |

**대표에게 이 위험을 그대로 알리고 재확인받았다 → "홍대돈까스만 남기고 전부 삭제"(2026-09-04).**
⇒ 삭제 대상은 **10곳**(3·5·6·7·8·9·10·11·12·13), 유지는 **14 홍대돈까스**뿐.
매장 5 의 상품 9개(활성 6)도 함께 사라진다 — 되돌릴 수 없다. 실측으로 **돈은 안 걸려 있다**:
주문 0 · 주문항목 0 · 이용권 0 · 정산 0 · 원장 0. 딸린 것은 파생행뿐이다(리뷰 158 · 지역 1 · 위시 1).

### 만든 것 — `DELETE /api/admin/sellers/:id/purge` (빈 매장 완전 삭제)
기존 `DELETE /sellers/:id` 는 **soft delete(정지)** 이고 **이미 정지된 매장은 400** 이라, 승인된 7곳 중
6곳은 그 API 로 손댈 수 없었다. 그래서 하드 삭제를 새로 만들되 **안전을 서버에 박았다**:
- `requireAdminRole('super')` + `require2FA()`
- **머니 잔여물(주문·주문항목·이용권·정산·원장)은 절대 차단** — `cascade` 로도 못 지운다.
- `?cascade=1` 이면 상품·파생행(리뷰·지역·장바구니·위시리스트·옵션…)·운영자·유저연결까지 함께 삭제.
  cascade 없이는 그것들도 409 로 막는다(기본이 보수적).
- cascade 중 상품이 **하나라도 남으면 매장 삭제를 중단**한다 — 주인 없는 고아 상품을 만들지 않는다.
- 어드민 화면은 먼저 cascade 없이 시도하고, 409 가 상품·운영자·유저연결 때문이면 **한 번 더 물어본 뒤**
  cascade 로 재시도한다(파괴적 경로에 확인 2번).
- ⚠️ **count 조회 실패를 0 으로 읽지 않는다** — 테이블 부재만 0 이고, 그 외 오류는 "모른다"라 거부.
  (`.catch(() => 0)` 로 짰으면 DB 오류가 "잔여물 없음"으로 둔갑해 지워 버린다.)
- 감사 로그(`purge_seller`)를 **삭제 전에** 남긴다.
- 어드민 화면 `/admin/seller-approval` 에 '삭제' 버튼(빨강) 추가.
- 가드: `seller-purge-safety.test.ts` 8건 + 주입 2건(되돌려-검증 빨간불 확인).

### ⏭️ 실행 절차 (배포 후)
```
POST /api/admin/login  →  TOK
for id in 3 6 7 8 9 10 11:
  curl -X DELETE "https://live.ur-team.com/api/admin/sellers/$id/purge" \
       -H "Authorization: Bearer $TOK" -H "User-Agent: <브라우저 UA>"
```
또는 대표가 `/admin/seller-approval` 에서 '삭제' 버튼으로. **매장 14(홍대돈까스)는 건드리지 말 것.**

## ③ 매장 ↔ 중개사 권한 — **결정 → 구현 완료**

대표 결정을 받고(설계 후 구현 순서 준수) 그대로 만들었다. 상세: `store-operator-model.md` §7.7.

### ②-권한: 정산계좌·사업자정보는 주인만, 운영자에겐 마스킹
**발견한 실제 구멍**: 셀러 토큰이 `seller_id` 하나로 전부를 열어서 **중개사가 사장님 정산계좌를
갈아끼울 수 있었다.** PIN 게이트가 있었지만 그 PIN 은 *운영자 자신의* 것이라 못 막는다.

판별 SSOT `worker/utils/store-actor.ts` — 토큰의 **`operator_user_id`** 로만 판정.
🔴 **`resolveActorUserId`+`isStoreOwner` 를 쓰면 안 된다**: 소비자 세션이 없을 때
`sellers.linked_user_id`(= *매장 주인* id)로 폴백해 **운영자를 주인으로 오판**한다.

막은 것: 정산계좌 변경 403 · 사업자정보 쓰기 403 · 탈퇴 403 · 사업자정보 읽기 마스킹
(등록번호 끝 4자리 · 대표자명 첫 글자 · 주소/연락처 null). **시드 폴백 경로도 같은 마스킹**을 탄다.

### ③-화면: `/seller/operating` 운영 매장 요약
`GET /api/seller/operating-summary` — 스코프는 `listOperableStores`. 매장별 활성 상품·누적 매출/주문 +
**운영 시작 이후** 구간(위임 매장만). 확정 주문만 센다.

🔴 **정직함이 설계 제약**: 운영자별 귀속을 추적하지 않으므로 숫자는 **매장 총액**이고 화면이 그걸
문장으로 밝힌다. 방어 가능한 청구 근거는 `revenue_since_grant` 뿐이다.

가드: `store-operator-scope.test.ts` 14건 + 주입 5건 되돌려-검증 빨간불 확인.

## 다음 세션 첫 액션
1. **배포 후** 매장 10곳 purge 실행 — 위 §② 절차. 판정: `sellers` 11 → **1**(홍대돈까스만).
2. **③ 구현** — 대표 결정이 나왔다(아래).

## ③ 대표 결정 (2026-09-04) — 이제 구현 가능
| # | 질문 | 대표 확정 |
|---|---|---|
| 1 | 매장 5·12·13 | **홍대돈까스만 남기고 전부 삭제** (위험 고지 후 재확인) |
| 2 | operator 가 정산계좌·사업자정보를 보나 | **주인만. 단 마스킹해서 보여줌** — 뒤 4자리 정도만 보이고 수정 불가 |
| 3 | 중개사 실적 화면 | **운영 매장 요약 대시보드** — 내가 운영하는 매장들의 매출·이용권 판매를 한 화면에 |

## 이번에 틀렸던 판단
- (앞 세션) *"영입 2% 와 에이전시 2% 가 겹쳐 적자"* → **틀렸다.** 영입 2% 는 2026-08-31 부터
  `store_channel==='direct'` 전용이고 이미 구현돼 있다. 에이전시 1% 는 같은 날 폐지됐다.
- (앞 세션) *"5% 할인이 중개사의 몫"* → **틀렸다.** 대표 정정: 중개사는 95% 쪽에서 매장과 거래한다.
- (앞 세션) *"어느 에이전시인지 비어 있다"* → 반만 맞았다. 중개 관계는 `agencies` 가 아니라
  `seller_operators`(seller 14 · user 3 · role='operator') 한 줄에 기록돼 있었다.

---

## 🩸 CI 가 잡은 것 (내가 로컬에서 놓친 것)

PR #1352 의 Verify 가 **두 번** 빨간불이었다. 둘 다 진짜였고, 둘 다 같은 병이다 —
**"낡은 지도"**: 코드가 옮겨졌는데 그것을 가리키는 것이 안 따라왔다.

### ① `check-beat-name-retirement` — 크론 개명의 잃어버린 후임
`agency-cron-batch` → `growth-daily-batch`, `agency-weekly-batch` → `weekly-tier-batch` 로 개명하면서
`src/worker/utils/cron-beat-retirement.ts` 의 `BEAT_RENAMED_TO` 에 후임을 안 적었다.
그러면 **옛 이름의 하트비트 행이 영원히 빨갛고, 그 하나가 경보 채널 전체를 침묵시킨다**(#1056 이 21일).
⇒ 크론 레인 이름을 바꾸면 **그 지도도 같은 커밋에서** 갱신할 것.

### ② 파일 분리가 만든 낡은 지도 4개
file-size 래칫에 걸려 3개를 분리했는데(아래), 그 코드를 가리키던 **테스트 3개 + 주입 4개**가
옛 파일을 계속 읽고 있었다. 테스트는 "파일이 없다"가 아니라 **조용히 아무것도 못 보게** 된다.

| 분리 | 어디로 |
|---|---|
| `/business-info` 3핸들러 (seller-profile.routes 720줄) | `seller-profile/business-info.ts` |
| 매장 purge 라우트 (admin-sellers.routes 1,079줄) | `admin-sellers/purge-seller.ts` |
| 매장 삭제 액션 (AdminSellerApprovalPage 605줄) | `admin-seller-approval/purge-seller-action.ts` |

같이 고친 것: `check-dashboard-api-crossrole` 이 삭제된 `src/pages/agency-page/` 를 그룹으로 가리키고 있었다.

### ③ 형태를 본 단언이 행동을 못 따라갔다
`business-info-from-registration` 이 `seeded ? … : 'Not found'` **삼항 형태**를 단언했는데,
운영자 마스킹을 붙이며 `if (!seeded) return … 'Not found'` 로 바뀌었다. **행동은 같다.**
형태가 아니라 규칙("채울 게 없으면 404")을 보도록 고쳤다.

### 🧭 다음 세션이 가져갈 것
- **파일을 분리하면 그 파일을 읽는 테스트·주입 매니페스트를 같은 커밋에서 따라가게 하라.**
  `grep -n "<옛 경로>" src/tests scripts/check-guard-mutations.mjs` 한 번이면 끝난다.
- **커밋 전 전체 유닛을 돌려라.** 나는 관련 테스트만 돌리고 커밋했다가 CI 에서 2건을 받았다
  (`business-info-from-registration` 은 내가 건드린 파일의 *다른* 테스트였다).

---

## 🌇 2026-09-05 — 잔재 2차: **쓰는 쪽**이 살아 있었다

main 머지(`ad4fa7a`) 를 하다가 발견했다. main 의 #1350(`dfb99a7`)이 **가입 시점에 매장 채널을 확정**
하는 기능을 넣었는데, 그 판정 근거가 하필 **에이전시 초대 코드**였다:

> "이 폼은 이미 에이전시 초대 코드를 받아 `introduced_by_agency_id` 를 채운다. 붙었으면 brokered, 없으면 direct."

맞는 말이었다 — 1차 일몰이 **읽는 쪽**(대시보드·커미션·크론·원장)만 지우고 **쓰는 쪽**을 남겨 뒀기
때문이다. 그래서 아무도 발급할 수 없는 코드가 **요금(직접 10% / 중개 5%)을 계속 가르고 있었다.**
정작 그 값을 읽어 돈을 주던 코드(`agency-store-intro-commission.ts`)는 이미 삭제된 뒤였다.

### 막은 문 셋 (전부 *쓰기* 경로)
| 문 | 무엇이었나 | 지금 |
|---|---|---|
| `POST /register-from-user` | `agency_intro_code` → `agencies` 조회 → `introduced_by_agency_id` + `?agency=` 프리필 입력칸 | 삭제. 이 문은 **언제나 `direct`** |
| `POST /api/prospects/:id/invite-link` | 초대 링크에 `?agency=CODE` 동봉 · prospect 를 `agencies.id` 로 정규화 | 삭제. 영업자는 **영입자(users.id)** 하나 |
| `PATCH /api/admin/sellers/:id/reassign-agency` | 화면이 없는데 살아 있던 어드민 쓰기 경로 | 삭제(UI 는 원래 `reassign-influencer` 만 불렀다) |

### 채널 판정이 어떻게 바뀌었나
`channelFromSignup(introducedAgencyId)` → **`channelFromSelfSignup()` = 언제나 `direct`**.
추측이 아니라 **그 문의 정의**다 — `/register-from-user` 는 카카오 user 세션 전용이라 로그인한
본인이 자기 가게를 올리는 자리이고, 가입 즉시 `linked_user_id` 로 그 사람에게 묶인다.

⇒ **`brokered` 를 만들 수 있는 문은 이제 `/store/new` 의 `StoreRegisterModal` 하나뿐이다**
("③ 누가 운영하나요?" 필수 선택). 그 강제가 풀리면 채널 미지정 매장이 다시 생기고 조용히 5% 로
떨어진다 — 그래서 그 가드를 주입 매니페스트에 넣었다.

### 가드
`signup-store-channel-2026-09-04.test.ts` 를 새 규칙으로 다시 씀(① direct ② 퍼널에 `brokered` 없음
③ 모달 강제 ④ `agency_intro_code` 부활 금지) + `agency-sunset-final.test.ts` 에 "쓰는 문 셋" 3건 추가.
**주입 6건 전부 되돌려-검증 빨간불 확인.**

### ⚠️ 남긴 것 — 일부러
- `sellers.introduced_by_agency_id` **컬럼·인덱스·repair-schema** (스키마 호환. 라이브 0명)
- 어드민 **표시**(`AdminPendingSellersPage`·`AdminMerchantCommissionsPage`)와 진단 쿼리 — 읽기뿐
- `agencies` **4행** — 프로덕션 raw DELETE 는 레포 룰상 금지(코드 경로로만)
- `matchProspectOnSignup` 의 `'agency'` 반환 타입 — 레거시 행이 있어도 **귀속을 건너뛰도록** 남김
  (지우면 옛 행이 `introduced_by_influencer_id` 로 잘못 흘러간다)

### 🧭 다음 세션이 가져갈 것
- **"일몰"은 읽는 쪽만 지우면 절반이다.** 쓰는 쪽이 남으면 아무도 못 켜는 스위치가 요금을 가른다.
  다음에 무언가를 일몰할 땐 `grep -rn "<개념>" src/` 를 **INSERT/UPDATE 기준으로 한 번 더** 훑을 것.

---

## 🔎 2026-09-05 배포 전 라이브 재실측 (읽기 전용)

머지 직전에 D1 을 다시 읽어 **purge 실행 계획의 숫자를 굳혔다.** 하루 전 보고와 동일하다.

```
매장 11곳 — 삭제 대상 10 · 남길 1(14 홍대돈까스)
  3 테스트 상점 · 6 테스트상호4 · 7 최종테스트상호 · 8 테스트상호001 · 9 검증상호
  10 최종확인상호 · 11 제아스컴퍼니 · 12 Lister Corporation · 13 주식회사 셀메이커스   ← 상품 0, 그냥 삭제
  5 UR Team ← 상품 9(활성 6) + linked_user_id=3  ⇒ **cascade 필요**
```

**머니 잔여물 0 을 표가 아니라 테이블로 확인했다:**
- `orders` 에 셀러가 붙은 행 없음(6행이 있지만 `seller_id = ''` — **NULL 이 아니라 빈 문자열**이라 어느 매장에도 안 붙는다)
- `settlements` 0행 · `vouchers` 1건이지만 그 상품의 `seller_id` 가 NULL(어느 매장 것도 아님)
- `ledger_entries` 의 seller 계정 행은 **1건뿐이고 `credit_account = 'seller:null'`** — 문자열 그대로다(2026-05-24 데이터 버그). purge 쿼리는 `'seller:' || ?` 에 숫자 id 를 넣으므로 **어떤 매장도 이걸로 막히지 않는다.** 고아 행이라 남겨 둔다.
- `seller_operators` 는 **14번(남길 매장) 한 줄뿐** — 삭제 대상엔 운영자 위임이 없다.

🔑 **그리고 blocker 가 헛돌지 않는지 확인했다** — purge 가 세는 테이블 7개(`orders`·`order_items`·`vouchers`·`settlements`·`ledger_entries`·`seller_operators`·`seller_meta`)가 **전부 라이브에 실재**한다.
`countOr` 는 *테이블 부재*만 0 으로 읽으므로, 이름이 하나라도 틀렸으면 그 blocker 는 **영원히 0** 이 되어
"돈이 걸린 매장도 통과"시킨다. (실제로 이 조사에서 `group_buy_vouchers` 라는 이름은 **없고** `vouchers` 가
맞다는 것을 확인했다 — 코드가 쓰는 이름이 맞았다.)

✅ **cascade 는 `users` 를 건드리지 않는다**(코드 재확인): 상품 + 그 자식행 → `seller_operators` → `seller_meta` → `sellers` 순이고
`users` DELETE 가 없다. 5번의 `linked_user_id=3` 은 *"진짜 계정에 붙은 매장인데 확실하냐"* 는 확인용 blocker 일 뿐이고,
**user 3 은 남길 매장 14번의 운영자**이므로 지워지면 안 된다 — 지워지지 않는다.

### 배포 후 실행 순서 (어드민 화면)
1. 빈 매장 9곳 삭제 → 확인창 없이 통과해야 정상
2. **5 UR Team** → 409(상품 9 · 연결된 유저) 뜬 뒤 cascade 재확인 → 삭제
3. 판정: `SELECT COUNT(*) FROM sellers` **11 → 1**

---

## 🌇 2026-09-05 — 잔재 4차: **대외 소개서**가 없는 서비스를 팔고 있었다

main 을 세 번째로 머지하다 소개서 생성기 출력에서 걸렸다: `에이전시: 9 pages, 29 endpoints` +
`[추출실패—수동확인]`. 열어 보니 `docs/proposals/agency-brief.md` 가 그대로 있었다 —
**디자인 AI 에게 넘길 슬라이드 덱의 원천 자료**이고, 머리말이 인용하는 SSOT 가 전부 삭제된 파일이다
(`agency-store-intro-commission.ts` · `agency-settlements.routes.ts` · `pk-battles.routes.ts` …).

**대표가 사업계획서 C-2 에서 지적한 것과 정확히 같은 클래스다** — 그때는 고쳤는데 이 덱은 놓쳤다.

- `docs/proposals/agency-brief.md` **삭제** (5개 소개서 → 4개)
- `generate-proposal-refs.mjs` — `agency` 도메인·라벨·`agencyRows()`·`features/agency/api` 스캔 제거.
  **살아남은 것만 `linkshop` 으로 승계**: `/influencer` · `/seller/prospects` · `/i/offer` ·
  `/seller/castings` · `/admin/influencer-{disputes,payouts}` · `/admin/castings` +
  `/api/{influencer-discover,influencer-rankings,influencer-settlement,seller-marketing,admin-payouts,admin/influencer,admin/castings,seller/castings}`.
  ⚠️ **죽은 경로는 목록에서 뺐다**(`/api/agency*`·`/api/pk*`·`/api/seller/promote-boosts` …) —
  남겨 두면 커버리지 매트릭스가 **있지도 않은 기능을 셈한다.**
  라벨도 `링크샵 / 큐레이터` → `유어샵 / 담기·소개`(명칭 SSOT).
- `check-proposal-sync.sh` — 에이전시 트리거 블록 + 정책 fan-out 목록에서 제거.
- 마스터 `00-service-overview-and-coverage.md` 머리말에 정정 note. **§E·§5 의 "5개 소개서" 서술은
  2026-06-07 당시 기록이라 소급 수정하지 않는다**(이 레포의 audit log 관례와 동일).
- 가드: `agency-sunset-final.test.ts` 에 "덱 부재 + 생성기에 agency 도메인 없음" 1건 + 주입 매니페스트
  1건 — **되돌려-검증 빨간불 확인.**

### 🧭 교훈 (3차와 같은 모양이다)
3차는 *"읽는 쪽만 지우고 쓰는 쪽이 남았다"* 였고, 4차는 *"코드만 지우고 **그 코드를 설명하는 대외 자료**가
남았다"* 다. **일몰 체크리스트에 `docs/proposals/**` 와 `docs/business/**` 를 넣을 것** — 생성기가
`[추출실패]` 를 내고 있었는데도 나흘간 아무도 안 봤다.

### 🔢 머지에서 또 걸린 것 — 시드 버전 충돌
`GUIDE_SEED_VERSION` 을 **양쪽이 각자 25 를 잡았다**(내 브랜치 = 에이전시 가이드 삭제 / main #1358 =
추천 적립 5%→2% 정정). 안 합치면 재시드가 **무음 스킵**된다 → **26 으로 올리고 두 사유를 모두 기록**했다.
`check-seed-version-monotonic` 이 정확히 이걸 막으려고 있는 가드다(세션이 여럿이면 계속 난다).
