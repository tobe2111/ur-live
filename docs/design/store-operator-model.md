# 🏪 매장 운영 주체 모델 — 소유(owner) ↔ 운영(operator) 분리

> **상태**: 1·2단계 구현 완료(2026-08-19) · **3단계는 설계 박제(미구현)**
> **결정자**: 대표 (2026-08-19 — "에이전시 대시보드를 없애고 셀러 대시보드가 여러 매장을 운영하게" → "모두 하자")
> **선행 설계**: `vendor-commission-passthrough.md` §4.3(3단 위임) · `urdeal-platform-model.md` §2
> **서비스 축**: 유어딜(소비자) 레일. 도매몰·공구 서비스(운영자 몰)·유어애즈와 무관.

---

## 0. 한 줄 요약

에이전시 *대시보드*는 없앤다. 하지만 **"누가 이 매장을 운영하는가"를 계정 소유권이 아니라 *관계*로 두는
뼈대는 남긴다.** 그래야 중개자가 올린 식당을 사장님이 직접 이어받을 때 **데이터 수술이 아니라 권한 한 줄
변경**이 된다.

---

## 1. 왜 지금 — 라이브 실측 (2026-08-19)

에이전시 대시보드는 페이지 9,349줄 + API 7,025줄 · 라우트 39개인데 **관계가 0건**이었다.

| 항목 | 실측 |
|---|---|
| `agencies` | 4 (1개는 '유어딜 본사') |
| `agency_sellers` | **0행** |
| `store_agency_delegation` | **0행** |
| `sellers.introduced_by_agency_id IS NOT NULL` | **0명** |
| `sellers` 전체 | 10 (승인 9 · 정지 1) |
| 한 유저가 2개 이상 매장 소유 | **0건** |
| `agency_invites`/`coupons`/`incentives`/`messages`/`notices`/`targets` | **테이블 없음** |

마지막 줄이 특히 중요하다. 이 레포는 **지연 생성**(`CREATE TABLE IF NOT EXISTS`) 패턴이라
**테이블이 없다 = 그 코드가 프로덕션에서 한 번도 실행된 적 없다**는 뜻이다. 페이지는 있는데 뒤가 비어 있었다.

남은 상당수(`pk`·`schedule`·`calendar`·`ranking`·`promote-boosts`)는 `LIVE_COMMERCE_SUSPENDED`
(영구 중단) 의존 — **이미 죽은 기능의 대시보드**였다.

### 전략과의 정합
2026-07-08 대표 확정: 에이전시는 유어딜이 커미션을 주는 대상이 아니라 **매장 promo 마진에서 스스로
가져가는 독립 사업자**다. 독립 사업자라면 유어딜이 그들에게 전용 SaaS 를 지어 줄 이유가 약하다 —
그들이 필요한 건 **자기가 맡은 매장에 접근할 권한**이지 별도 대시보드가 아니다.

---

## 2. 축이 다르다 — 이걸 놓치면 사고가 난다

"셀러 대시보드에서 여러 매장 운영"은 **한 사람이 자기 매장 3개를 가진 경우**를 푼다.
에이전시는 **남의 매장을 대신 운영하는 제3자**다. 그냥 합치면 이 사고가 난다:

> 중개자가 식당 A 를 셀러 대시보드에 올려 운영한다 → 사장님이 "이제 내가 직접 할게요" 라고 한다.

`sellers` 테이블(100컬럼)이 왜 문제인지 보면 명확하다:

```
로그인 정체성 :  username · password_hash · linked_user_id
매장 실체     :  business_number · bank_account · business_registration_file
                 settlement_frequency · settlement_day · commission_rate · 링크샵 username
```

**한 행에 같이 있다.** 중개자 계정이 매장을 만들면 **그 식당의 사업자등록증과 정산 통장이 중개자 소유**가
된다. 승계 방법이 **계정 비밀번호 넘기기**밖에 없고, 주문이력·정산·리뷰·링크샵 URL 이 전부 얽힌 채 넘어간다.

### 이 원칙은 이미 코드에 있다
`seller-transfer.routes.ts` TD-016 기록:
> *"기존 `/:id/seller-approve` 는 from_agency 가 셀러 동의를 대행하는 위험 endpoint. agency 가 셀러
> 행세 가능 → 셀러 동의 없이 다른 에이전시로 강제 이전 가능했음. **410 Gone 으로 차단.** 셀러 본인은
> `/api/seller/transfers` 에서 직접 응답해야 함."*

**매장의 최종 동의권은 절대 대리인에게 주지 않는다.** §4.3 위임의 3대 불변원칙(투명성 · 회수권 ·
유어딜은 캡만)도 같은 얘기다. 새 모델은 이 원칙을 **깨지 않는 방향으로만** 확장한다.

---

## 3. 3층 모델

```
① 매장 (sellers)          = 사업자 실체. 사업자번호·통장·정산·주문이력·리뷰·링크샵 핸들의 앵커.
                            ↑ 절대 안 움직인다.
② 운영 권한 (관계)         = seller_operators(seller_id, user_id, role). 계정 ↔ 매장 N:M.
                            중개자든 사장님이든 같은 셀러 대시보드에서 매장을 전환한다.
③ 승계                     = ②의 role 변경. 데이터는 1바이트도 안 움직인다.
```

### 이미 있는 부품 (새로 만들 게 적다)

| 부품 | 위치 | 무엇 |
|---|---|---|
| 한 매장 ↔ 여러 로그인 | `wholesale_sub_accounts(parent_seller_id, email)` + `worker/utils/dashboard-session.ts` 시트(seat) 파생 | **도매 레일에 이미 구현돼 있다.** 반대 방향(한 로그인 ↔ 여러 매장)만 추가하면 된다 |
| 위임 관계 | `store_agency_delegation(seller_id, agency_id, mode)` | §4.3 3단(self/approval/full) |
| 승계 상태머신 | `shared/utils/seller-transfer-logic.ts` | 신청 → 상대 수락 → **매장 본인 동의** → 완료 + 30일 쿨다운 |
| 영입 보상 | `sellers.introduced_by_agency_id` + per-agency 24개월 | 관계와 분리 가능 |

---

## 4. 2단계 — `seller_operators` ✅ **구현 완료 (2026-08-19)**

```sql
CREATE TABLE IF NOT EXISTS seller_operators (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,          -- users.id (카카오 소비자 정체성)
  role        TEXT NOT NULL DEFAULT 'operator',  -- 'owner' | 'operator'
  granted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked_at  DATETIME,
  UNIQUE(seller_id, user_id)             -- 멱등: INSERT OR IGNORE (머니 룰 #3)
);
CREATE INDEX IF NOT EXISTS idx_seller_operators_user ON seller_operators(user_id);
```

UI 는 **셀러 대시보드 상단 매장 전환 셀렉터** 하나가 전부다. 이게 대표가 말한 "여러 매장 운영"의 실체다.
매장이 1곳이면 **아무것도 렌더하지 않는다** — 대부분의 사장님에게 "전환할 곳이 하나뿐인 드롭다운"은 소음이다.

### 🔐 보안 급소는 딱 한 곳이다 (구현하며 확정)
셀러 대시보드의 모든 라우트는 `seller_token` 의 `seller_id` 로 **자동 스코프**된다.
⇒ **다른 매장 토큰을 받는 순간 그 매장의 주문·정산·상품이 전부 열린다.**
그래서 `POST /api/seller/stores/:sellerId/token` 의 `canOperateStore` 검사가 **유일한 방어선**이고,
이 파일 밖에서 `seller_token` 을 새로 mint 하면 안 된다.

주체(`users.id`)는 **세션 쿠키 또는 seller_token 에서만** 나온다 — 클라이언트가 보낸 user_id 는 안 쓴다.

### 🪑 좌석(seat) 분리 — 구현하며 발견한 함정
단일 세션 강제(`dashboard_sessions`)는 시트별로 동작한다. 운영자 토큰을 그냥 발급하면 시트가
`('seller', 매장id)` 라 **운영자가 들어가는 순간 그 매장 사장님이 튕긴다**(SESSION_SUPERSEDED).
⇒ 위임(`source === 'grant'`)일 때만 payload 에 `operator_user_id` 를 넣어 시트를
`('seller_operator', 운영자 user id)` 로 分리했다. 소유자 본인은 기존 시트 그대로(회귀 0).

### 구현 목록
| 항목 | 파일 |
|---|---|
| SSOT 유틸 | `src/worker/utils/seller-operators.ts` (ensure/list/can/isOwner/grant/revoke) |
| API | `src/features/seller/api/seller-operators.routes.ts` (`/api/seller` 마운트) |
| 좌석 분리 | `src/worker/utils/dashboard-session.ts` (`seller_operator` 시트 추가) |
| 스키마 | `repair-schema/column-repairs.ts` (테이블 + UNIQUE/보조 인덱스) |
| UI | `src/components/seller/StoreSwitcher.tsx` · `src/pages/SellerOperatorsPage.tsx` (`/seller/operators`) |
| 가드 | `src/tests/unit/seller-operators-invariants.test.ts` 20건 + 주입 3건 |

### 💰 돈은 안 움직였다 (설계 문서의 이전 서술을 정정한다)
이 문서는 2단계를 "머니 경로"라고 적었는데, 구현해 보니 **정산 목적지는 `sellers.bank_account` 그대로**다.
운영자는 볼 수 있는 매장이 늘 뿐 정산 귀속을 못 바꾼다. **진짜 위험은 돈이 아니라 인가(IDOR)** 이고,
그 기준으로 가드를 짰다. (정산 계좌·사업자정보 편집을 소유자 전용으로 좁히는 것은 3단계다.)

**설계 규칙 3가지:**
1. `owner` 는 매장당 **최대 1명**. 0명(대리 등록 상태)은 허용 — 사장님이 아직 안 왔을 뿐이다.
2. 링크샵 핸들·사업자정보·정산계좌 편집은 **`owner` 만**. `operator` 는 상품·주문·공구 운영만.
   (위임 모드 `full` 이면 promo 세팅까지 — §4.3 표 그대로.)
3. `revoked_at` 은 **행 삭제 대신**. 누가 언제 운영했는지가 분쟁 시 유일한 근거다.

⚠️ **배포 후에만 판정 가능한 것**: 마운트가 실제로 붙었는지(Workers 라우팅) · D1 권한 쿼리의 실제 판정.
단위테스트는 **배선**만 본다. 확인 절차는 인계 문서.

---

## 5. 3단계 — 사장님이 직접 오는 경로 (대표 질문의 답)

### (a) 사업자등록번호가 열쇠
중개자가 만든 매장은 `owner_verified = 0`(대리 등록). 사장님이 가입하며 사업자등록증을 올리면
그 **사업자번호로 기존 매장을 찾아** "이 매장의 실소유자로 등록" 요청 → 승인되면 `owner` 승격,
중개자는 `operator` 로 강등. **상품·주문·리뷰·정산이력 전부 유지.**

> 이미 `sellers.business_registration_status` / `business_registration_verified_at` /
> `business_registration_verified_by` 가 있다 — 검증 파이프라인을 새로 만들 필요가 없다.

### (b) owner 는 언제든 회수 가능
§4.3 불변원칙 #2 그대로. 회수해도 중개자가 만들어 둔 것은 매장에 남는다.
회수 시 진행 중인 에이전시 설정은 **매장 승인 대기로 강등**(자동 발효 중단).

### (c) 🔑 회수돼도 영입 보상은 계약기간까지 유지 — **이게 설계의 핵심이다**

관계가 끊기면 수입도 끊긴다고 하면, **중개자는 사장님이 직접 계정 만드는 걸 막는다.** 실제로 그렇게 된다.
사장님을 플랫폼에서 숨기고, 자기가 유일한 창구로 남으려 한다. 그러면 우리는 매장과 직접 관계를 영영 못 갖는다.

⇒ **영입 실적(`introduced_by_agency_id`)과 운영 관계(`seller_operators`)를 분리한다.**
운영권을 회수당해도 영입 커미션은 계약기간(현행 per-agency 24개월)까지 지급.
중개자에게는 "사장님을 올려도 손해가 없다"가 되고, 그래야 우리 쪽으로 매장이 올라온다.

---

## 6. 3단계를 아직 짓지 않는 이유

2단계는 **관계 뼈대**라 지금 넣어도 행이 0이면 동작이 0이다(자연스럽게 무해). 반면 3단계는
**사업자등록증 검증 파이프라인 + 소유권 승계 + 보상 분리**라 훨씬 크고, 아직 대리 등록 매장이 0건이다.
**수요가 0인 걸 정교하게 지으면 또 빈 코드가 남는다 — 에이전시 대시보드가 정확히 그렇게 생긴 물건이다.**

### 착수 조건 (둘 중 하나면 3단계 시작)
1. 한 사람이 **매장 2개 이상**을 실제로 운영해야 하는 상황이 생김, 또는
2. 중개자/대행사가 **남의 매장**을 올려 운영하기 시작함(= `owner_verified=0` 매장 발생).

판정 쿼리:
```sql
-- ① 다중 매장 수요
SELECT linked_user_id, COUNT(*) c FROM sellers
 WHERE linked_user_id IS NOT NULL GROUP BY linked_user_id HAVING c > 1;
-- ② 대리 등록 수요 (사업자번호는 있는데 대표자 계정이 따로 있는 매장)
SELECT COUNT(*) FROM sellers WHERE business_number IS NOT NULL AND linked_user_id IS NULL;
-- ③ 2단계가 실제로 쓰이기 시작했는가 (위임 관계 발생)
SELECT COUNT(*) FROM seller_operators WHERE revoked_at IS NULL;
```

---

## 7. 1단계 구현 로그 (2026-08-19 — 완료)

| 항목 | 내용 |
|---|---|
| 플래그 | `AGENCY_DASHBOARD_SUNSET = true` (`src/shared/feature-flags.ts`) |
| 신규 가입 차단 | 클라(`/agency/register`·`register/business` → `AgencySunsetPage`) + 서버(`signupClosedResponse` 403 `AGENCY_SIGNUP_CLOSED`) **한 쌍** |
| 라우트 | **39 → 16** (`src/routes/agency.routes.tsx`) |
| 페이지 삭제 | 고아 23개 / **5,137줄** |
| API 언마운트 | 13개 네임스페이스 (`src/worker/index.ts`) — **파일은 보존** |
| nav | 4그룹 30항목 → 3그룹 10항목. 기존 죽은 링크(`/agency/streams`)도 제거 |
| cron | `handleAgencySellerMatch` 정지 (없어진 화면으로 알림 링크를 보냈다) |
| 가드 | `src/tests/unit/agency-sunset-invariants.test.ts` 17건 + `check-guard-mutations` 주입 3건 |

### 남긴 것과 그 이유
`delegations`(위임) · `introduced-stores`(영입 보상 근거) · `transfers`(승계 동의) ·
`settlements`/`ledger`(남은 채무) · `sellers`(로스터) · `profile` · `guide` · 로그인.
**전부 위 3층 모델의 뼈대이거나, 기존 4개 계정에 대한 채무다.**

### ⚠️ API 파일을 지우지 않은 이유 (지우면 깨진다)
- `agency-incentives.routes.ts` → `computeCommission` 을 **머니 경로**가 import
  (`order-commissions.ts` · `commission-budget.ts`)
- `agency-invites.routes.ts` → `consumeInviteCode` 를 **셀러 가입**이 import
- `promote-boosts.routes.ts` → 셀러측 라우터를 함께 export
- `agency-members.routes.ts` → `effectivePermissions`/`ROLE_DEFAULTS` 를 `agency-role-guard.ts` 가 import

### 일몰 ≠ 축출
기존 4개 계정의 **로그인·정산·위임은 막지 않았다.** 정산 채무가 남아 있는 상대의 접근을 끊는 건
별개 판단이고, 대표 지시 없이 할 일이 아니다.

### 롤백
`AGENCY_DASHBOARD_SUNSET = false` → 가입 즉시 복원.
라우트/nav/마운트는 각각 독립: `src/routes/agency.routes.tsx` 복원 · `worker/index.ts` 의 주석 해제 ·
`scheduled.ts` 의 cron 한 줄 해제. **삭제한 23개 페이지만 git 복원이 필요하다.**
