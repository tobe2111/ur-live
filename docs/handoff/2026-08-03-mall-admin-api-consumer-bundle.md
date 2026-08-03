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
