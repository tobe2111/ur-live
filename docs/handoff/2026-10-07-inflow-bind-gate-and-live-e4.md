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

#### ✅ E4 판정 — 배포 후 라이브 (`2b61e663c`, `urdeal.kr/map`, 로그인 상태 `users.id=42`)
배포 워크플로 넷 전부 success(`Deploy to Cloudflare Pages` · `Deploy ur-wholesale` ·
`Deploy Worker (cron sync)` · **`Guard mutations (full)`** — 전수 주입 스윕 포함).

| 조건 | `POST inflow/bind` | `GET csrf-token` |
|---|---|---|
| 유입 기록 없음(그 계정의 실제 상태) | **0회** (종전 1회) | **0회** (종전 1회) |
| `ur_inflow_sent_v1` 시드(양성 대조) | **1회** | **1회** |

🔑 **양성 대조가 판정의 핵심이다** — 요청이 *없다*는 것만으로는 "게이트가 일한다" 와
"기능이 죽었다" 를 **구분할 수 없다**. 그래서 트리거 키(`ur_inflow_sent_v1='37'` +
`ur_anon_id_v1`)를 심고 같은 하네스를 다시 돌려 **요청이 돌아오는 것**을 확인했다.
나머지 우리 API 11건은 전부 그대로다(기능 손실 0).

⚠️ 같은 추적에서 **Sentry envelope POST 5건**을 봤다 — 게이트와 무관하고, 로그인 상태의
`/map` 에서 실제 JS 에러가 나고 있을 가능성이 있다. **미조사**(대표 판단 대기).

### ✅ 상태 변경 알림 문구 — 맵 두 벌이 서로 다르게 틀려 있었다
`ORDER_STATUS_NOTICE`(`src/shared/order-status-notice.ts`)로 **단건·일괄 한 벌**로 합쳤다.
종전엔 두 블록이 각자 맵을 들고 있었고 그래서 **각자 다르게** 틀려 있었다:

| 경로 | 종전 | 결과 |
|---|---|---|
| 단건 `PUT/PATCH /orders/:id/status` | `CONFIRMED` 키 보유(도달 불가) · `PREPARING` 키 없음 | 폴백이 **`주문 상태: PREPARING`**(영문 enum)을 한국 소비자에게 |
| 일괄 `PATCH /orders/bulk-status` | `PREPARING` 키 없음 · 폴백 없음 | 셀렉트에는 뜨는 상태인데 알림 **0건**(조용히 넘어감) |

- 🔴 **폴백(`|| \`주문 상태: ${s}\``)을 되살리지 말 것** — `VALID_STATUSES` 에 상태가 하나 늘면
  그 enum 이름이 그대로 새어 나간다. 문장이 없으면 **안 보내는 것**이 맞다(일괄이 원래 그랬다).
- `CONFIRMED` 가 도달 불가인 근거: `VALID_STATUSES`·`ORDER_TRANSITIONS` 어디에도 없어
  `statusesThatCanReach` 가 빈 배열 → 그 전에 400 이다. 반대로 폴백에 **실제로 걸리던** 값은
  `PREPARING`·`DONE`·`PAID` 셋이고, 화면이 보내는 것은 `PREPARING` 하나다
  (`statusHelpers.nextStatusOf` · `BulkActionBar` 의 `<option>`).
- 가드: `src/tests/unit/order-status-notice-2026-10-07.test.ts` 7건 + 주입
  `scripts/mutations/order-status-notice.mjs` 5건 **전부 빨간불 확인**.
  핵심은 ③ — **다른 파일**(`statusHelpers`·`BulkActionBar`)에서 화면이 보낼 수 있는 상태를
  읽어 전부 문장이 있는지 대조한다. 원래 결함 둘이 **이 교차 검사로만** 드러나는 모양이었다
  (한쪽 파일만 보면 둘 다 멀쩡해 보인다).
- 🩸 이 시험의 첫 판이 **주석을 앵커로 잡아 헛돌았다**(`// ── 유저에게 인앱 알림 발송 ──`).
  `readCode` 가 주석을 지우므로 빈 조각이 잡히고 그 아래 단언 셋이 통째로 무의미해진다
  — `source-text.ts` 머리말 ②가 경고한 바로 그 함정이다. 코드 앵커로 교체.
- 🧭 **맵을 공용 모듈로 뺀 것은 file-size 래칫이 시킨 일이다.** 처음엔 라우트 파일 안에 두고
  긴 사유 주석을 달았는데 `1406 → 1422줄` 로 **pre-push 게이트가 막았다**(17.7초). `[SKIP_SIZE]`
  로 넘기지 않고 꺼내니 `1401줄` 이 되면서 **설계도 더 나아졌다** — 이 레포가 래칫을 둔 이유가
  정확히 이것이다(god 파일은 "일단 여기에 한 블록 더" 로 자란다).
- ⚠️ **E2 까지다** — 알림이 실제로 어떻게 보이는지는 셀러 좌석이 있어야 라이브로 못 잰다
  (주문이 있는 가게에서 [주문 확인] 을 눌러야 한다). §1 의 운영자 1탭과 같은 블로커.

### ✅ Sentry envelope 5건 조사 — JS 에러는 없고, 경고 중복이 있었다
어제 *"로그인 상태 `/map` 에서 envelope POST 5건"* 을 미조사로 남겨 뒀던 것을 뜯어봤다.

```
5건 전부 → o4510992097935360.ingest.us.sentry.io/api/.../envelope/
  session × 3   (에러 아님)
  event   × 2   → 둘 다 message/warning:
                  "Slow LCP on app: 3524ms"   ← 같은 한 번의 로드다
                  "Slow LCP on app: 4140ms"
pageErrors 0 · 예외 0 · 화면 정상(`359곳`)
```
**⇒ JS 에러는 없다. 그 의심은 닫힌다.**

**대신 찾은 결함**: `lib/performance-monitor.ts` 가 `captureMessage` 를 **옵저버 콜백마다**
쏘고 있었다 — LCP 는 entry 마다, **CLS 는 레이아웃 시프트마다**(0.1 을 넘긴 뒤로는 시프트 하나가
경고 1건 — 넷 중 가장 심하다), INP 는 배치마다. FID 만 명세상 1회라 무사했다. 느린 화면일수록
이슈 트래커가 같은 경고로 묻히고, **중간값**이 가서 읽는 사람이 최종값보다 작은 숫자를 본다.
🔑 형제 파일 `lib/web-vitals-report.ts` 는 **이미 올바른 모양**(마지막 값 · `sent` 가드 ·
`disconnect` · `pagehide`+10초 폴백)이었다 — 같은 지표의 리포터가 두 벌인데 한쪽만 맞던 상태다.
그 모양을 가져와 **지표마다 최종값 1건**으로. breadcrumb 은 **일부러 entry 마다** 남긴다
(로컬 흔적이라 중복이 비용이 아니고 변화 과정을 보여 준다).
- 가드: `web-vitals-warn-once-2026-10-07.test.ts` 9건(**동작**을 잰다 — 가짜 `PerformanceObserver`
  로 entry 를 여러 번 먹이고 호출 횟수를 센다) + 주입 `web-vitals-warn-once.mjs` 6건 **전부 빨간불**.
- ⚠️ **ms 값(3.5s·4.1s)은 실사용자 수치가 아니다** — 하네스가 모든 요청을 중계해 부풀려져 있다.
  판정 대상은 **횟수**다. 실제 LCP 는 `web-vitals-report` 가 보내는 표본으로 봐야 한다.

---

## 3. 이번에 틀렸던 판단

1. **"테스트 셀러 계정을 만들면 마이 E4 가 풀린다" 는 틀렸다.** 막고 있던 것은 셀러 쪽이
   아니라 **소비자 세션**이라고 생각했는데, 실제로는 소비자 세션은 10분이면 만들 수 있었고
   (이메일 가입이 살아 있다) **진짜 막는 것은 좌석 = 사업자등록번호**였다. 블로커의 위치를
   반대로 짚고 있었다.
2. 🩸 **Sentry 조사에서 같은 자리를 두 번 헛짚었다.** 1차는 matcher 를 `/sentry|envelope/i` 로
   써서 **sentry 청크 파일 GET**(`/assets/sentry-*.js`)을 "에러 보고" 로 셌고, 그걸 `{}` 로
   fulfill 해서 **모듈 로드를 내가 깨뜨렸다**(그래서 `MIME type ""` 에러가 났다 — 라이브 결함이
   아니다). 그 결과 `sentryItems: []` 를 보고 **"5건은 측정 오류였다" 고 대표에게 정정 보고까지
   했는데 그 정정이 틀렸다** — POST 5건은 실재한다. 3차에서 **POST 이고 경로가 `envelope`/`store`
   인 것만** 세고서야 진짜 내용이 나왔다. ⇒ **파일명에 든 단어로 요청의 성격을 판정하지 말 것.**
   (403 아홉 건도 사이트가 아니라 **컨테이너 이그레스**다 — `static.cloudflareinsights.com`·
   `googletagmanager.com`. 실사용자 브라우저에서는 정상 로드된다.)
3. 🩸 **파이프라인 종료코드를 판정에 썼다.** `npx tsc … | tail -4; echo "TSC=$?"` 는 **`tail` 의
   종료코드**를 찍는다 — 테스트 파일에 TS2345 가 있는데도 `TSC=0` 이 나왔다. 파일로 받아 다시 재야
   한다. CLAUDE.md 의 *"명령 실패와 판정 결과를 섞지 말 것"* 과 같은 클래스다.
4. 🩸 **중복 방어를 세 겹 깔았다가 주입 검증에 잡혔다.** `if (flushed) return` + `pending.clear()`
   + `warnOnce` 안의 `!flushed` — 한 겹을 빼도 나머지가 막아 **어느 줄도 자기가 무엇을 막는지
   증명할 수 없었다.** 겹을 늘리는 쪽이 안전해 보이지만 실제로는 *어느 겹이 일하는지 모르는 상태*를
   만든다 ⇒ 한 겹으로 줄였다(두 번째 안전판은 코드가 아니라 **flush 가 옵저버를 끊는다**는 사실이고
   시험 ⑥ 이 그것을 따로 잠근다).
5. 🩸 **"두 번 flush" 를 흉내 내지 못하는 픽스처.** `pagehide` 를 두 번 쏘았는데 그 리스너가
   `{ once: true }` 라 두 번째가 아무 일도 안 했고, `visibilitychange` 도 jsdom 의
   `visibilityState`('visible') 때문에 그냥 반환했다 — **flush 가 두 번 불린 적이 없는데**
   "두 번 불러도 1건" 을 단언했다. 실제 경로는 **서로 다른 트리거 둘**(10초 폴백 → 그 뒤
   `pagehide`)이다. 고치면서 `visibilitychange→hidden` 경로가 시험에서 **한 번도 돈 적이 없다**는
   것도 드러나 ④-2 를 추가했다(폴백 셋 중 둘만 검증되고 하나는 죽어 있었다).
   🧭 오늘 이 클래스가 **세 번**이다(`--only` 부분일치로 0건 실행 · 주석 앵커로 빈 조각 검사 ·
   `{ once: true }`). 셋 다 사람이 아니라 **주입 러너**가 잡았다.
6. **`주문 확인`(PREPARING) 이 정산·출금을 여는 줄 알았다 — 아니다.** 그 상태를 쓰는 11곳이
   전부 `'PAID','DONE','PREPARING',…` 를 **함께** 묶는다(환불 가능 집합·출금 보류·위탁 정산·
   어드민 집계). PAID 에 머물러도 판정이 같다 ⇒ **확인을 눌러도 돈은 한 푼도 안 움직인다.**

---

## 4. 남은 결정 / 대기

### ① `주문 확인` 에 붙어 있던 결함 둘 — **둘 다 수리됨**
- **ⓐ 구매자가 받던 알림이 `주문 상태: PREPARING`** 이었다 → **이 PR 에서 수리**(아래 §2 참조).
- **ⓑ 이용권 주문이 그 줄에 쌓이던 것** → **#1644 에서 수리됨**(`671daa4a0`, main). 종류별
  단계 판정 SSOT `src/shared/order-stage.ts` 가 생겨 이용권은 `unused`/`done`,
  교환권은 `done` 으로 가고 `needsSellerConfirm` 은 **배송 주문만** 센다.
  ⇒ 지금 [주문 확인] → `PREPARING` 은 **배송 주문에만** 쓰이고 그게 의미상 맞다.

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
