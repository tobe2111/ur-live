# 🏬 몰 관리 API 가 소비자 배포에 없었다 — `/api/admin/wholesale-malls` 404 (2026-08-03)

## 다음 세션의 첫 액션

배포 후 **한 줄로 판정**된다:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://urdeal.kr/api/admin/wholesale-malls \
  -H 'Content-Type: application/json' --data '{}'
```
- **401/403** → 고쳐졌다(라우트 존재, 인증에서 막힘 = 정상).
- **404** → 아직 배포 전이거나 배선이 되돌아갔다. `mall-admin-api-bundle.test.ts` 부터 볼 것.

그 다음이 **파일럿 몰 생성**(대표 요청 "파일럿 몰 하나 만들어줘"). `/admin/wholesale-malls` 에서
슈퍼관리자로: `slug`(3~30자 영소문자·숫자·하이픈, 예약어 아님) · `몰 이름` · **`소비자 공개` 체크
필수**(= `consumer_path=1`. 안 켜면 `urdeal.kr/{슬러그}` 는 **안 열린다** — fail-closed 가 기본값).
생성 후 `urdeal.kr/{슬러그}` 가 **최대 5분** 뒤 열린다(아래 "남은 것" ①).

## 무엇이 문제였나

대표 실측: `urdeal.kr/admin/wholesale-malls` 에서 몰을 만들면 `POST /api/admin/wholesale-malls` **404** (×3).

원인은 권한도 설정도 아니었다. 그 라우트가 `mount-wholesale.ts` 안에 있었고,
`mount-wholesale` 은 `worker/index.ts` 의 `if (__INCLUDE_WHOLESALE__)` 뒤에 있다.
소비자 빌드(`WHOLESALE_BUNDLE` 미설정 → `false`)에서는 **esbuild DCE 로 통째로 빠진다.**

그런데 **어드민 화면은 빠지지 않는다** — `dist/client` 는 ur-live·ur-wholesale 이 **같은 빌드**를
공유한다(`.github/workflows/deploy-wholesale.yml`: *"client 는 ur-live 와 동일"*).
⇒ **urdeal.kr 에 화면은 있고 그 화면이 부르는 API 만 없는** 상태였다. 눌러야만 알 수 있다.

같은 이유로 `AdminMallSelect`(여러 도매 어드민 화면의 몰 선택기)도 소비자 도메인에선 늘 비어 있었다.

## 판정 — 이건 어느 레일인가

몰 관리 API 가 지배하는 대상은 **도매몰이 아니라 소비자 표면**이다:
몰의 존재 · `consumer_path`(=`urdeal.kr/{슬러그}` 를 열지 말지) · 브랜드 색(라이트).
`lookupConsumerMall`(`worker/utils/mall-consumer.ts`)이 **읽는 그 행을 이 API 가 쓴다.**
파일 위치(`features/supply/api/`)는 2026-06-09 도매 멀티테넌시 때의 출신이지 현재 용도가 아니다.

**크로스-서비스 3줄 보고**(CLAUDE.md §두 서비스 분리 룰 4):
- **(a) 레일**: 양쪽. `src/worker/index.ts`(소비자) + `src/worker/mount-wholesale.ts`(도매) — 마운트 위치만.
- **(b) 머니 경로 접촉**: **없음.** 결제·정산·적립·환불·원장 무접촉. 라우트 핸들러 **byte-불변**.
- **(c) 롤백**: `index.ts` 의 마운트 1줄 + import 1줄 제거 → `mount-wholesale.ts` 에 1줄 환원.

## 한 것

| 파일 | 변경 |
|---|---|
| `src/worker/index.ts` | `adminWholesaleMallRoutes` import + **게이트 밖** 마운트(`/api/admin` 앞) |
| `src/worker/mount-wholesale.ts` | 같은 마운트 제거(중복 금지) — **왜 없는지** 주석으로 남김 |
| `src/tests/unit/mall-admin-api-bundle.test.ts` | 신규 6개 — R1 소비자 마운트·게이트 밖 / R2 도매로 복귀 금지 / R3 `/api/admin` 앞 / R4 도매 그래프 미유입 |
| `scripts/file-size-baseline.json` | `worker/index.ts` 2664 → 2682 (해당 항목만 손으로) |

**핸들러는 손대지 않았다** — 슬러그 예약어 차단·색 대비 검증(`validateMallColor`)·`consumer_path` fail-closed
전부 그대로다.

## 검증

- `tsc --noEmit` **0**
- 신규 가드 **6/6** + **되돌려-검증 2종**(CLAUDE.md 요구): 소비자 마운트 제거 → **3 빨강** ·
  `mount-wholesale` 로 되돌림 → **1 빨강** · 복원 → 초록
- **번들 실측**(`gzip -c dist/_worker.js | wc -c`):

  | 빌드 | gz | 비고 |
  |---|---:|---|
  | 소비자 (변경 전) | 1,006,487 | |
  | 소비자 (변경 후) | 1,009,564 | **+3,077 B (+3.0KB)** |
  | 도매 (`WHOLESALE_BUNDLE=1`) | 1,060,567 | 소비자 대비 +51KB = **도매 그래프는 여전히 DCE 로 빠진다** |

  즉 "몰 관리 라우트를 소비자에 넣으면 도매 200KB 가 되살아난다"는 우려는 **실측으로 기각**됐다 —
  이 라우트의 import 폐쇄는 `wholesale-malls.ts`(251줄) + 이미 소비자에 있는 공용 미들웨어·`shared/mall/*` 뿐이다.

## 이번에 틀렸던 판단

1. **번들 크기를 `dist/client/_worker.js` 로 쟀다.** `build-worker.js` 는 `dist/_worker.js` 에 쓰고
   `build:prepare` 가 나중에 옮긴다. 그래서 **세 빌드가 전부 같은 바이트**로 나왔고 하마터면
   "차이 없음"으로 보고할 뻔했다. **같은 값이 세 번 나오면 측정이 고장 난 것이다.**
2. **컨테이너에서 라이브를 못 찌른다.** `urdeal.kr`·`live.ur-team.com` 둘 다 이그레스 정책에서
   **403 (`Host not in allowlist`)** 이다 — CLAUDE.md §어드민 진단의 2026-07-29 정정
   (*"urdeal.kr 200 실측"*)은 **이 세션 기준으로 더는 사실이 아니다.** 정책은 세션마다 바뀐다.
   ⇒ 라이브 판정이 필요하면 **찔러보고 결정**하되, 막혔으면 대표 화면에 의존할 것.
3. `URDEAL_ADMIN_EMAIL`/`URDEAL_ADMIN_PASSWORD` **미주입 세션**이었다(env 79개 중 없음).
   그래서 이 세션은 **몰을 대신 만들어 줄 수 없었다** — CLAUDE.md 방침대로 값을 요청하지 않았다.

## 남은 것 / 대표 판단

1. **몰 캐시 5분** — `mall-consumer.ts` 의 isolate 캐시는 TTL 300s 다. 몰을 만든 직후엔
   `urdeal.kr/{슬러그}` 가 잠깐 404 일 수 있다(자가치유). 어드민 쓰기에서 소비자 캐시를 깨는 배선은
   **일부러 안 넣었다** — isolate 마다 캐시가 따로라 한 isolate 만 지워지고 *지워졌다는 착각*만 남는다.
   즉시성이 필요해지면 KV/버전 스탬프가 맞는 해법이다(별도 결정).
2. **대표 브라우저의 `ERR_CONNECTION_TIMED_OUT` / `ERR_CONNECTION_RESET`** (`/api/version`,
   `/api/dashboard-notifications`) — 이건 **HTTP 응답이 아예 없는** 것이라 위 404 와 다른 사건이다
   (404 는 서버가 응답은 했다). 네트워크/CF 구간이고 코드로 고칠 수 있는 게 아니다.
   재발하면 다른 네트워크(모바일 테더링 등)에서 한 번 확인해 주시면 범위가 갈린다.
3. **PR #1001** — #1011 이 머지되며 내용은 다 들어갔다. 중복이라 닫으면 된다.

## 🔴 같은 클래스가 **10개 더 있다** — 어드민 메뉴에서 숨겼다(삭제는 아직)

### ⚠️ 먼저, 이 문서의 앞선 판이 틀렸다 (2026-08-03 정정)

*"`buyer-pool`·`maker-pool` 도 도매 번들에만 있다"* 고 적었는데 **사실이 아니다.**
`worker/index.ts:1682·1684` 가 **소비자 번들에서 직접 마운트**한다(`[TEMP-TEST 2026-07-20]` —
*"도매 워커가 미배포라"*). urdeal.kr 에서 **정상 동작**한다. 철거 계획 §1(b) 가 요구한 보호가
이미 걸려 있었고, `supply-teardown-safety.test.ts` 가 그 마운트를 검사하고 있다.
⇒ 도매 번들 전용은 **10개**다: `wholesale`·`wholesale/integrity`·`wholesale-deposits`·
`wholesale-banners`·`wholesale-board`·`wholesale-proposals`·`wholesale-products`·
`wholesale-deposit-account`·`wholesale-overview`·`distributor`.
**열 개 다 진짜 도매 전용**이라 철거 대상이지 소비자로 올릴 것이 아니다.

> 🩸 왜 틀렸나: `mount-wholesale.ts` 에서 두 마운트를 보고 **거기에만 있다고 단정**했다.
> 두 곳에 다 있는 경우를 안 봤다. 마운트는 **양쪽 파일을 다 확인**해야 한다.

### 한 것 — A6 의 안전한 절반

`dist/client` 가 공유라 도매 어드민 화면이 urdeal.kr/admin 에 **다 실리는데** API 는 없다 ⇒
그 메뉴들은 **이미 죽은 링크**였다. 그래서 **소비자 도메인에서만 도매 밴드를 숨겼다**
(`withoutWholesaleOnConsumer` — `admin-nav-config.ts`). 기능을 끈 게 아니라 *없는 기능을 안 보이게* 했다.

🔴 **전역 플래그로 숨기지 않은 이유**: 철거 계획 §4 의 머니 게이트 확인 경로가
**`/admin/wholesale-overview`** 다. 전역으로 껐다면 **예치금을 돌려줄 경로까지** 껐을 것이다.
⇒ 도매 도메인(`utongstart.com` · `*wholesale*` 호스트 · `?wholesale=1`)에서는 **그대로 보인다.**

**몰 관리는 도매 밴드에서 빼서 `🏪 오프라인 공구` 로 옮겼다**(라벨 `운영자 몰 관리`).
안 옮겼으면 오늘 API 를 고쳐 놓고 **메뉴를 숨겨서 파일럿 몰을 못 만들 뻔했다.**
가드: `admin-nav-wholesale-teardown.test.ts`(13개, 되돌려-검증 2종).

### 안 한 것 — 화면·라우트 삭제 (계획 §5-3)

**머니 게이트 4항목**(판매사 예치금 · 미확인 충전요청 · 공급자 미지급 정산금 · plus 활성 구독)이
**전부 0** 이어야 삭제할 수 있다(계획 §4). 이 세션은 어드민 자격도 라이브 이그레스도 없어 **확인 불가**.
> 대표가 도매 도메인 `/admin/wholesale-overview` 에서 `deposit_liability`·`pending_charge_requests`
> 를 보고 0 이면 그때 **삭제 전용 PR**(대표 확정: *"삭제는 기능 구현과 섞지 말고 별도 PR 로 고립"*).

⚠️ 삭제 범위에 **문서 모순**이 하나 있다 — 계획 §2 는 `/api/admin/wholesale-*` 를 통째로 지우라 하고,
`operator-mall-saas-gap.md` §8 은 `wholesale-main`(배너)·`wholesale-board`·`wholesale-overview` 를
**존치**(운영자 몰 꾸미기에 재사용)라 한다. **삭제 PR 착수 전에 이 셋의 운명을 먼저 정할 것.**

---

## 🧨 도매 유입 진입점 제거 (2026-08-03 후속 — 대표 "도매몰은 잔재도 없애는거야")

접는 서비스로 **새로 들여보내는 문**을 소비자 표면에서 닫았다.

| 파일 | 지운 것 | 왜 |
|---|---|---|
| `BusinessLandingPage.tsx` | 상단 nav `'도매 공급사' → /supplier/login` | **sitemap 등재 공개 랜딩**이다. 접는 동안에도 신규 유입이 들어온다 |
| `SellerLoginPage.tsx` | `'도매 공급사이신가요? 도매몰 →'` | 셀러 로그인은 소비자 사업자 유저의 문이다. 갈림길을 여기 둘 이유가 없다 |

🔴 **라우트는 일부러 살려 뒀다.** 철거 계획 §4 가 *"예치금·미지급 정산금이 0 임을 확인한 뒤 삭제"* 라고
못박았고, 기존 제조사·판매사가 **잔액을 회수하려면 들어올 길이 있어야** 한다.
⇒ **문은 남기고 간판만 내린 것**이다. 외부에 이미 퍼진 링크·검색 결과는 그대로 도달한다(의도).

가드: `supply-teardown-safety.test.ts` 에 3개 추가(소비자 표면 링크 0 + 라우트 생존).
되돌려-검증: 크로스링크 복구 주입 → 빨강 · 복원 → 초록.

⚠️ i18n 키 `seller.areYouSupplier`·`seller.goWholesale` 는 **지우지 않았다** — 6개 로케일 churn 대비
얻는 게 없고, 되살릴 때 그대로 쓴다.

---

## 🏪 매장 ↔ 몰 연결 — 파일럿 개설의 **빠진 조각** (2026-08-03 후속)

몰을 만들어도 **매장을 붙일 방법이 없었다.** 상품의 몰 귀속은 서버가 `sellers.mall_id` 를 읽어 찍는데
(`sellerMallIdOf`), 그 값은 **가입 시 호스트로만** 정해지고 기본이 `1`(본진)이다.
⇒ 몰을 만들고 공구를 등록해도 **본진에 붙어** `urdeal.kr/{슬러그}` 는 계속 빈 화면이었다.
`UPDATE sellers SET mall_id` 를 하는 코드가 **레포 전체에 하나도 없었다**(실측).

| 추가 | 무엇 |
|---|---|
| `GET /api/admin/wholesale-malls/:id/sellers` | 이 몰의 매장 목록(+몰 스코프 상품 수) |
| `POST .../:id/sellers` | `{seller}` = **숫자 id 또는 로그인 아이디**. 매장 + **그 매장 상품까지** 이동 |
| `DELETE .../:id/sellers/:sellerId` | 본진(1)으로 되돌림 — **삭제가 아니라 이동**이라 가역 |
| `MallSellersPanel.tsx` | 몰 목록의 `매장` 버튼 → 인라인 패널(연결/해제) |

전부 **`requireSuperAdmin` + rateLimit**. 🔴 **머니 경로 무접촉** — 정산율·예치금·원장 안 건드리고
`mall_id` 한 컬럼만 옮긴다(그 컬럼이 정하는 건 *어느 몰 홈에 보이는가* 뿐).

⚠️ **상품을 같이 옮기는 게 핵심**이다. 매장만 옮기면 기존 상품은 등록 시점 `mall_id`(=1)로 남아
**"매장은 옮겼는데 몰 홈은 비어 있는"** 절반 상태가 된다 — 가장 헷갈릴 실패 모드라 가드로 고정했다.
⚠️ 상품 이동은 **원래 몰에 있던 것만**(`COALESCE(mall_id,1) = from`) — 다른 몰에 흩어진 것까지 쓸어오면
남의 몰이 빈다.

가드: `mall-seller-attach.test.ts` 13개 + 되돌려-검증 2종(상품 동반이동 제거 → 빨강 / super 가드 제거 → 빨강).

### 파일럿 개설 3단계 (이제 전부 어드민에서 됨)

1. `🏪 오프라인 공구 → 운영자 몰 관리` → **몰 추가**(`소비자 공개` 체크 필수)
2. 그 몰의 **`매장`** 버튼 → 매장 로그인 아이디 입력 → **연결**
3. 그 매장이 셀러 대시보드 `/seller/products/quick` 에서 **3분 공구 등록**(픽업일·장소·보관구분)

⇒ `urdeal.kr/{슬러그}` 에 그 공구가 뜬다. 그 전엔 *"진행 중인 공동구매가 없어요"* 빈 화면이 정상이다.
(몰 홈은 `mall_id` 일치 + `is_active=1` + **gb 세션이 살아 있는** 상품만 보여준다 — `mall-public.routes`.)

---

## 🔗 손님 링크를 어드민에 노출 — "왜 안 열리는지"까지 (2026-08-03 대표 지시)

> 대표: *"매장 만들었으면 매장 링크를 `/admin/wholesale-malls` 에서도 볼 수 있게끔 해줘야지."*

몰 목록엔 슬러그가 **모노 글씨로만** 있었다. 대표가 주소를 직접 조립해야 했고, 안 열려도
**왜 안 열리는지 알 방법이 없었다**(그게 "계속 404" 의 절반이다).

`MallLinkRow.tsx` 신설 — 각 몰 행에 `urdeal.kr/{슬러그}` 를 **클릭 가능한 링크 + 복사 버튼**으로 띄운다.
안 열리는 상태면 링크 대신 **이유**를 적는다:

| 상태 | 화면 문구 |
|---|---|
| 슬러그가 경로 규칙 밖 | `영소문자·숫자·하이픈 3~30자, 예약어 불가` |
| `active ≠ 1` | `비활성 몰이에요 — 활성화하면 열려요` |
| `consumer_path ≠ 1` | `'소비자 공개' 가 꺼져 있어요 — 수정에서 켜세요` |

🔴 **판정은 서버와 같은 셋이다.** 워커 `pickConsumerMall` 이 fail-closed 로 보는 세 조건을 그대로 비춘다.
화면이 "열려요" 라는데 404 면 그게 더 나쁘므로, `mall-link-open-state.test.ts`(18개)가 **두 판정을
같은 입력으로 나란히 돌려 대조**한다(10 케이스). 되돌려-검증: `consumer_path` 조건 삭제 → 3개 빨강 → 복원.

### ⏱️ 몰 조회 캐시 TTL 300초 → **60초**

`mall-consumer.ts` 의 인메모리 캐시가 5분이라 **방금 만든 몰이 최대 5분간 404** 였다. 이게 "만들었는데
안 열린다" 의 나머지 절반이다. 60초로 낮췄다 — 몰 행은 몇 개뿐이고 조회는 슬러그 후보 경로에서만 도는
가벼운 쿼리라, 5배 잦아져도 부담이 없다. 화면에도 **"만든 직후엔 1분쯤 뒤에 열려요"** 를 미리 적었다.

⚠️ 캐시는 **isolate 별**이다 — 콜로/isolate 가 다르면 각자 만료된다. "1분" 은 상한이 아니라 눈금이다.

### 🧭 대표용 404 분별법

| 무엇이 404 인가 | 원인 | 확인 |
|---|---|---|
| `urdeal.kr/admin/wholesale-malls` 화면은 뜨는데 **몰 목록이 안 불러와짐** | 이번 배포가 아직 안 내려감(몰 API 가 소비자 번들에 없던 상태) | GitHub Actions 초록 확인 후 강력 새로고침 |
| `urdeal.kr/{슬러그}` 가 404 | `소비자 공개` 미체크 / 슬러그 규칙 밖 / 캐시 창 | 이제 **몰 목록의 링크 줄이 이유를 직접 말한다** |

⚠️ **이 세션은 라이브 판정을 못 했다** — `urdeal.kr`·`live.ur-team.com` 이 이 환경에서 403
(`Host not in allowlist`), `api.github.com` 은 미인증 레이트리밋, `CLOUDFLARE_*`/`URDEAL_ADMIN_*` 미주입.
**배포 도달 여부는 대표 화면이 유일한 ground truth 다.**

---

## 🛑 도매몰 — **존치 확정** (2026-08-03 대표)

> 대표: *"C는 남의 돈은 걸려있지 않아. 아예 사업을 안했거든. 대신 존치하자."*

`wholesale-teardown-plan.md` 의 §4 머니 게이트는 **무의미**하다(실사업 시작 자체가 없었다).
그렇다고 **지우지 않는다** — §2·§5-3 삭제 작업은 **보류**다. 삭제 PR 은 만들지 않았다.

⚠️ **다음 세션에게**: 그 문서의 §2·§5 를 보고 삭제를 시작하지 말 것. 문서 상단에 확정 블록을 박아 뒀다.
이번에 한 것은 **잔재 정리**(소비자 도메인에서 도매 nav 숨김 + 소비자 표면의 도매 유입 링크 제거)뿐이고,
라우트·API·데이터는 **전부 살아 있다**.

---

## 🔎 "계속 404" 재진단 — 배포가 아니라 **데이터 상태**였다 (2026-08-04)

대표가 보낸 스크린샷은 **소비자 404 화면**(액자 거터 레일 + `바로가기` 패널)이었다. 어드민 화면이 아니다 —
`ConsumerFrameRails` 는 소비자 표면에만 붙고 어드민은 `AdminLayout` 이다. ⇒ **실패한 URL 은
`urdeal.kr/{슬러그}`** 이고, `MallHomePage.tsx:139` 의 `if (state === 'notfound' || !mall)` 가 그린 것이다.

### 배포·번들 가설은 **기각**(실측)

| 확인 | 결과 |
|---|---|
| `/:mallSlug` 라우트 | **있다** — `App.tsx:1057` → `MallHomePage` |
| `/admin/wholesale-malls` 라우트 | **있다** — `routes/admin.routes.tsx:449`(App.tsx:38 에서 `AdminRoutes` 마운트) |
| `/api/mall` 소비자 번들 | **있다** — `worker/index.ts:1974`, `if (__INCLUDE_WHOLESALE__)` **밖** 최상위 마운트 |
| 그 마운트가 main 에 있나 | **있다** — `#953` 부터(이번 세션 변경 아님) |

⇒ 어드민 API 404(이번 세션이 고친 것)와 **다른 문제**다. 몰 공개 API 는 원래부터 소비자 번들에 있었다.
남는 원인은 셋뿐이고 전부 데이터다: **몰 행이 없음** · **`consumer_path=0`** · **`active=0`/슬러그 규칙 밖**.

### 🔴 가장 유력한 원인 — 만들기 폼의 **기본값 footgun**

`EMPTY.consumer_path = false`(`AdminWholesaleMallsPage.tsx:80`) + 서버도 `Number(body.consumer_path) === 1`
이 아니면 `0`. 즉 **체크를 안 하면 만들자마자 죽은 몰**이 된다.

기본 OFF 자체는 **의도된 fail-closed** 다(켜면 B2B 도매몰이 소비자 도메인 경로로 샌다 — 소스 주석에 명시).
그래서 **기본값은 뒤집지 않았다.** 진짜 결함은 **그 결과가 화면 어디에도 없었다**는 것 —
만든 사람은 주소를 눌러 404 를 맞고 나서야 안다. ⇒ 체크가 꺼져 있으면 폼에서 **미리 경고**한다:

> ⚠️ 지금 상태로 만들면 **손님 링크가 열리지 않습니다** — `urdeal.kr/{주소}` 는 404 가 됩니다.

가드: `mall-link-open-state.test.ts` R4(2개) — 조건부 블록 존재 + 경고문이 **`404` 라는 결과를 명시**할 것
(모호한 "확인하세요"로 끝나면 빨강). 되돌려-검증: 조건을 `true` 로 바꿔 주입 → 2개 빨강 → 복원 → 20개 초록.

### 다음 세션의 첫 액션 — 대표에게 물어볼 것 없이 판정된다

브라우저에서 **`urdeal.kr/api/mall/{슬러그}`** 를 연다(공개 API, 로그인 불필요):
- `{"success":true,...}` → 몰은 살아 있고 공개 상태다. 그럼 404 는 **다른 원인**이니 슬러그 오타부터 볼 것.
- 404 / `success:false` → 몰이 없거나 `consumer_path=0`. 어드민 몰 목록의 링크 줄이 이유를 말해 준다.

⚠️ **이 세션도 라이브를 못 봤다** — `urdeal.kr`·`live.ur-team.com` 둘 다 **403**,
`URDEAL_ADMIN_*`·`CLOUDFLARE_*` **미주입**(실측). D1 을 직접 못 봐서 "몰 행이 실제로 있는지"는 확인 불가다.
⇒ **다음 세션에 자격이 주입돼 있으면 `SELECT id,slug,active,consumer_path FROM wholesale_malls` 한 방으로 끝난다.**

---

## ⚙️ 몰 만들기 폼 단순화 + 기본 공개 (2026-08-04 대표 지시)

> 대표: *"소비자 공개 체크 했어. 이거 그냥 체크 없이도 열리게 해줘. 기능 토글이며 이런거 복잡해.
> 카테고리도 입력하는게 불편해 복잡하고."*

### 1) `consumer_path` 기본값 **꺼짐 → 켜짐**

앞 절에서 나는 기본 OFF 를 **의도된 fail-closed 라 뒤집지 않았다**(도매몰이 소비자 도메인으로 새는 걸
막는 장치). 대표가 그 위에서 **명시로 뒤집으라고 지시**했고, 근거가 맞다 —
**이 화면으로 지금 만드는 건 공구 몰이고, 공구 몰의 존재 이유가 `urdeal.kr/{슬러그}` 다.**
안전 기본값이 실사용에선 **"만들면 404"** 로 나타났다.

- `mall-form.ts` `EMPTY.consumer_path = true` — **새 폼의 초기값만** 바뀐다.
- ⚠️ **기존 몰 행은 안 건드렸다.** 이미 `consumer_path=0` 으로 저장된 몰은 여전히 수정에서 켜야 하고,
  그건 목록의 링크 줄이 이유를 말해 준다(앞 절).
- 스위치 자체는 **고급 설정에 남겼다** — 도매몰을 새로 만들 일이 생기면 거기서 끈다.

### 2) 폼을 **기본 / 고급**으로 갈랐다

이 폼은 도매몰 시절 설계라 **카테고리 JSON · 기능 토글 JSON · 인허가 · 예치금 계좌 · 수수료율 ·
회사 정보 11칸 · 호스트**가 전부 첫 화면에 펼쳐져 있었다. 공구 몰에 필요한 건 넷뿐이다.

| 기본(항상 보임) | 고급(접힘, `MallAdvancedFields`) |
|---|---|
| 몰 이름 · 주소(slug) · **손님 링크 미리보기** · 로고 · 브랜드 색 · 활성 | 소비자 공개 스위치 · 호스트 · 브랜드명 · 카테고리 JSON · 예치금/수수료 · 인허가 · 기능 토글 JSON · 회사 정보 |

🔴 **지우지 않고 접었다.** 도매몰은 존치(2026-08-03 대표 확정)라 **기존 몰을 수정할 때 이 값들에
도달할 수 있어야 한다** — 지우면 그 몰의 푸터·인허가 설정을 영영 못 고친다.
고급이 접혀 있어도 `consumer_path` 가 꺼져 있으면 헤더에 **`손님 링크 꺼짐`** 배지가 뜬다
(안 펴는 게 기본이라, 접힘 상태에서 404 를 모르면 안 된다).

**파일 분해**(god 파일 룰): `AdminWholesaleMallsPage.tsx` **453 → 321줄**
+ `wholesale-malls/mall-form.ts`(타입·EMPTY·회사필드 56줄) + `MallAdvancedFields.tsx`(138줄).

가드: `mall-link-open-state.test.ts` R4 를 4개로 확장 — 기본값 true · 스위치 생존 · 경고 존재 ·
경고가 `404` 명시 · 접힘 배지. 되돌려-검증: `consumer_path: true → false` 주입 → 빨강 → 복원 → 171 초록.

⚠️ **가드가 헛돌 뻔했다**: 경고 검사를 `{!form.consumer_path` 로 앵커했더니 **접힘 배지**(소스에서 먼저
나온다)를 잡아 경고문에 못 닿았다 — 빨강을 보고 문구 자체로 앵커를 옮겼다. 이 레포가 반복해 만난
*"검사가 실패할 수 없다"* 클래스와 같은 함정이다.

### ⚠️ 다음 세션이 알아야 할 것 — audit-gate RED 1건은 **내 것이 아니다**

`파일 크기 래칫` RED = `src/features/marketing/api/influencer-auto-collect.ts` **601줄**(한 줄 초과).
`origin/main` 에 **이미 그 상태로 들어와 있고**(다른 세션 머지분) 이번 브랜치는 그 파일을 안 건드렸다.
유어애즈 도메인이라 서비스 분리 룰상 여기서 고치지 않았다 — **그쪽 세션이 분리하거나 rebaseline 해야 한다.**
