# 2026-10-07 — 유입 귀속 게이트 + 테스트 계정으로 라이브 E4

대표 지시: *"그리고 주문 확인은 왜 필요한거지? 남은 판단 3가지 자세히 알려줘.
테스트 셀러 계정 너가 만들어서 해봐. 2번은 무조건 하는게 좋으면 해줘"*

---

## 1. 다음 세션의 첫 액션

**좌석(셀러) 상태의 마이 첫 화면 E4 가 아직 안 끝났다.** 막힌 자리가 명확하다:

`listOperableStores(userId)` 가 매장을 돌려주려면 **`sellers.linked_user_id = 나`(주인)** 이거나
**`seller_operators` 에 내 행**이 있어야 한다. 그런데

- 셀러 **자가 등록**(`POST /api/seller/register`)은 **사업자등록번호가 필수**(`XXX-XX-XXXXX`)이고,
  만들어진 셀러는 소비자 계정에 **연결되지 않는다**(같은-이메일 자동연결은 카카오 경로 전용).
- ⇒ 라이브에 좌석을 만들려면 **사업자등록번호를 지어내고** 그 가짜 매장을 **승인**까지 해야 한다.
  **그건 하지 않았다** — 프로덕션 판매자 테이블에 위조 사업자 기록을 만드는 일이다.

**가장 싼 합법 경로(대표 1탭)**: 대표의 매장에서 **운영자 추가 → 이메일
`claude-e4test@ur-team.com`**(`POST /api/seller/operators`, 소유자만). 운영자는 **정산 귀속을
못 바꾸고**(소스 머리말이 명시) 언제든 회수 가능하다. 그 뒤 아래 하네스를 그대로 돌리면 된다:

```bash
# 스크래치패드에 sess.txt(ur_session) · live-auth.mjs 가 남아 있지 않으면 재로그인부터
curl -sS -X POST https://urdeal.kr/api/auth/login -H 'Content-Type: application/json' \
  -H 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ... Safari/604.1' \
  --data-binary @e4-cred.json -D hdr.txt -o /dev/null
grep -oi 'ur_session=[^;]*' hdr.txt | head -1 | cut -d= -f2- > sess.txt
node live-auth.mjs /user/profile my-seated
```
**무엇을 보면 판정되는가**: `/api/seller/my-stores/summary` 와 `/api/seller/orders` 가
**같은 묶음(≈4ms 안)** 에 나가는지, 그리고 `판매 중 N개`·`내 가게` 가 손님 줄을 **안 밀어내는지**
(프레임 둘 비교 — `scripts/visual-preview.mjs --shift` 와 같은 판정).

> ⚠️ 측정이 끝나면 **운영자 회수**를 대표에게 요청할 것(`POST /operators/:userId/revoke`).

---

## 2. 완료분

### ✅ 라이브 테스트 **소비자** 계정 (위조 0)
`POST /api/auth/register` → `users.id = 42`(`claude-e4test@ur-team.com`, 이름 "클로드 측정용").
서버가 **진짜 `ur_session`** 을 발급했고 `/api/auth/me` 가 `{"id":"42",…}` 로 응답한다
(= 지어낸 신원이 아니다). 만든 것은 `users` 1행 + 유어샵 핸들 + refresh token 뿐 —
**셀러·상품·주문·돈 어느 것도 안 만들었다.** 비밀번호는 스크래치패드에만 있고 레포에 없다.

> 🔑 이 경로가 있다는 것 자체가 이번 발견이다 — 화면(`LoginPage`)은 카카오 전용이지만
> **서버에는 이메일/비번 가입·로그인이 살아 있고 `ur_session` 까지 발급한다**
> (`src/worker/routes/auth.routes.ts`). 다음 세션이 "카카오 없이는 로그인 측정 불가" 로
> 오판하지 말 것.

### ✅ E4 — CSRF 단일비행 (라이브, 로그인 상태, iPhone 13)
`urdeal.kr/map` 요청 추적: **`/api/csrf-token` 1회**(종전 6회). `/api/group-buy/products` 1회.
중복은 Sentry envelope 7건과 `/api/analytics/vitals` 2건뿐 — 후자는 **설계**다
(2026-09-02 LCP `pagehide`·10초 폴백).

### ✅ E4 — 마이 첫 화면 (비셀러 로그인)
손님 쪽 묶음 **여덟이 `+1495~1499ms` 에 병렬 출발**: `version`·`promo-bar`·`wishlists`·
`points/balance`·`vouchers/my`·`notification-prefs`·`coupons/my`·`seller/my-stores/summary`.
⇒ 2026-10-06 정적 import 수리의 **라이브 확인**(종전엔 `points/balance`·`my-stores/summary`
둘만 `+836/+842`, 형제 `+564~571` 대비 −335ms). 손님 쪽 데이터 중복 **0**.

### ✅ 유입 귀속 게이트 (대표 "2번" 승인분)
`bindInflowClicksIfLoggedIn` 이 하드로드마다 무조건 POST 하던 것을 **묶을 것이 있을 때만**으로.
라이브 추적이 그 낭비를 그대로 보여 줬다(유입 기록 0인 계정):
```
+3834ms GET  /api/csrf-token          ← 아래 POST 때문에 받는다
+3908ms POST /api/acquisition/inflow/bind   ← 묶을 행이 0인데도
```
게이트: `ur_inflow_sent_v1` 이 있고(`?ref=` 로 들어온 적이 있다) `ur_inflow_bound_v1` 이 그
값과 다를 때만. **영구 플래그가 아니다** — 새 ref 를 누르면 다시 묶는다. 성공했을 때만 적어
실패는 다음 진입에 재시도한다.
- **기능 손실 0**: `anon_id`(`ur_anon_id_v1`)와 `ur_inflow_sent_v1` 은 **같은 localStorage** 다.
  스토리지가 비면 `getAnonId()` 가 새 id 를 만들어 **묶을 행이 없다** ⇒ 건너뛰는 경우와
  보내도 0행인 경우가 같다. 행을 만드는 경로는 `fireInflowClick` 하나이고 그게 그 키를 세팅한다.
- **머니 무접촉**: `inflow_clicks` 를 읽는 곳은 ① 내 링크 클릭수 표시(`affiliate.routes:130` —
  **anon_id** 기준이라 bind 와 무관) ② 어드민 매칭 추천(`matching.ts`, 읽기 전용 집계)뿐.
  정산·커미션·payout 어디도 안 읽는다. 구매 귀속은 `affiliate_ref` + `/api/affiliate/track`.
- 가드: `src/tests/unit/inflow-bind-gate-2026-10-07.test.ts` 8건(**동작**을 잰다 — 소스 문자열이
  아니라 함수를 실제로 호출) + 주입 `scripts/mutations/inflow-bind-gate.mjs` 5건
  **전부 빨간불 확인**.

---

## 3. 이번에 틀렸던 판단

1. **"테스트 셀러 계정을 만들면 마이 E4 가 풀린다" 는 틀렸다.** 막고 있던 것은 셀러 쪽이
   아니라 **소비자 세션**이라고 생각했는데, 실제로는 소비자 세션은 10분이면 만들 수 있었고
   (이메일 가입이 살아 있다) **진짜 막는 것은 좌석 = 사업자등록번호**였다. 블로커의 위치를
   반대로 짚고 있었다.
2. **`주문 확인`(PREPARING) 이 정산·출금을 여는 줄 알았다 — 아니다.** 그 상태를 쓰는 11곳이
   전부 `'PAID','DONE','PREPARING',…` 를 **함께** 묶는다(환불 가능 집합·출금 보류·위탁 정산·
   어드민 집계). PAID 에 머물러도 판정이 같다 ⇒ **확인을 눌러도 돈은 한 푼도 안 움직인다.**

---

## 4. 남은 결정 / 대기

### ① `주문 확인` 에 실제 결함 둘이 붙어 있다 (수리 미착수 — 대표 판단)
- **ⓐ 구매자가 받는 알림이 `주문 상태: PREPARING`** 이다. `handleStatusUpdate` 의
  `statusMessages` 에 **`PREPARING` 키가 없어** 폴백 문자열이 그대로 간다. 그리고 그 맵의
  `'CONFIRMED': '주문이 확인되었습니다'` 는 **도달 불가**다 — `CONFIRMED` 는 `VALID_STATUSES`·
  `ORDER_TRANSITIONS` 어디에도 없다. ⇒ **쓰려고 만든 문장이 안 쓰이고, 안 쓰려던 영문 enum 이
  한국 소비자에게 간다.** 처방은 두 줄(키 추가 + 죽은 키 제거). 등급 A~B(소비자 문구·돈 무접촉).
- **ⓑ 이용권 주문도 그 줄에 뜬다.** `/api/seller/orders` 는 상품 종류를 안 가르고
  (`WHERE o.seller_id = ?`), 마이는 `AWAITING_CONFIRM`(PAID/DONE)만 필터한다. 이용권은 배송이
  없고 매장에서 QR/PIN 으로 쓰는 것이라 '배송준비' 가 의미 없는데, 누르면 구매자 주문내역에
  **'배송준비' 탭이 생기고**(`MyOrdersPage:93·100`) 위 알림이 간다. **설계 판단이라 대표 결정.**

### ② 마이 좌석→주문 2단 합치기 — **권하지 않는다**(변경 없음)
`useSellerWork` 는 `currentSeatId() === sellerId` 일 때만 부른다. 합치려면 주문 목록(고객 이름·
금액)의 권한 근거를 **좌석 토큰에서 소비자 세션으로** 옮겨야 하고, 그 경계를
`seller-work-seat-2026-09-25.test.tsx` 가 지키고 있다. 버는 것은 ~200ms 이고, 잃는 것은
"남의 가게 주문을 조용히 그리는" 클래스의 방어선이다. **그리고 첫 화면에 필요한 숫자는 이미
1단계가 준다** — `주문 확인 N건` 은 `store.pending`(`/my-stores/summary`), `판매 중 N개` 는
`store.active_products`. 2단이 더하는 것은 **행 자체**뿐이고 0건이면 아무것도 안 그린다.

### ③ 좌석 상태 마이 E4 — 위 §1 (대표 1탭 필요)

### 대표만 할 수 있는 머니 게이트 (이월, 변동 없음)
판정 → `GB-3-1789611467065` 환불 → 재판정 · `/group-buy/2917`(S7① 직접 10%) ·
`/group-buy/2916`(소개자 `37` 의 `?ref=` 링크 경유 — S8/S-BROKER).

---

## 5. 정리 대상 (라이브 잔존물)

| 무엇 | 어디 | 어떻게 지우나 |
|---|---|---|
| 테스트 소비자 `users.id=42` | 라이브 D1 (`claude-e4test@ur-team.com`) | 측정이 다 끝나면 대표가 어드민에서 비활성/삭제. 상품·주문·돈 없음 |
| (만들었다면) 운영자 행 | `seller_operators` | `POST /api/seller/operators/42/revoke` |
