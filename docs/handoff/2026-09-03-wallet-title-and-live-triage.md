# 2026-09-03 — 지갑 제목 삭제 + 라이브 신고 2건 분류(429 · /map)

## 1. 한 것 — `/my-vouchers` 상단 "내 이용권" 문장 삭제 (대표 지시)

- `WalletHeader` 에 `hideTitle` 추가. **지우지 않고 `sr-only` h1 로 남긴다** — 제목이 아예 없으면
  보조기술·크롤러가 이 화면이 무엇인지 알 방법이 사라진다.
- 제목이 빠지면 그 줄에 금액만 남으므로 **금액이 왼쪽으로 붙는다**(오른쪽에 홀로 떠 있지 않게).
  `onBack` 이 있는 호출자(`/my-gifticons` — "내 교환권")는 **무접촉**: `hideTitle` 을 안 넘긴다.
- 가드: `wallet-and-slop.test.ts` 에 1건 추가 — **되돌려-검증 빨간불 확인**(`hideTitle` 제거 → FAIL).
- 검증: `npx tsc --noEmit` 0 · `npm run build` 0 · 하네스 렌더로 눈 확인
  (`node scripts/visual-preview.mjs --route=/my-vouchers --wallet --auth=user`).

## 2. 대표 신고 ① Sentry `429` + `reportAllChanges ... startTime` — **앱 결함 아님**

```
o…ingest.us.sentry.io/api/…/envelope/?…sentry_client=sentry.javascript.react%2F10.43.0  429
Uncaught TypeError: Cannot read properties of undefined (reading 'startTime')
    at et.reportAllChanges …  ← @sentry/react 안에 번들된 web-vitals 코드
```

- **429 = Sentry 가 우리 이벤트를 거절**(요금제 쿼터 소진 또는 순간 레이트리밋). 브라우저가
  우리 서버에 보낸 요청이 아니다 → **사용자 화면·결제·데이터에 영향 0.** SDK 는 `Retry-After`
  만큼 스스로 물러난다. 같은 사건이 2026-05-01 에도 있었고 그때 `tracesSampleRate` 를
  10% → 1% 로 줄였다(`src/lib/sentry.ts`). 지금은 **에러 이벤트에 샘플링이 없다**(100%).
- `startTime` TypeError 는 **Sentry 가 자기 번들 안에서 던지는 것**(브라우저 성능 항목이 비어
  있을 때 web-vitals 리포터가 마지막 entry 를 읽는다). `requestIdleCallback` 안이라 React 렌더와
  무관하다. 다만 **uncaught 라 Sentry 자신이 그것을 다시 이벤트로 올린다** → 쿼터를 스스로 태우는
  고리가 된다(429 와 같이 뜨는 이유).
- 제안(대표 판단 대기, 이번 PR 에 **미포함**): `sentry.ts` `ignoreErrors` 에 이 프레임 추가 +
  에러 `sampleRate` 도입. 잠금 파일은 아니지만 지시받은 범위 밖이라 손대지 않았다.

## 3. 대표 신고 ② `/map` 이용권 미표시 — **재현 실패. 서버는 정상.**

라이브에서 실측으로 배제한 것(전부 정상):

| 확인 | 결과 |
|---|---|
| `GET /api/group-buy/products?status=active` | 200 · 50건 · **50건 전부 `restaurant_lat/lng` 있음** |
| `…?near=37.5665,126.9780` / `&page=2` / `&category=meal_voucher` | 200 · 각 50건 |
| `…/map-clusters?bbox=…&cell=…` (줌아웃 집계) | 200 · 격자 반환 |
| `/map` HTML 이 참조하는 `/assets/*` 18개 | **전부 200**(배포-청크 404 클래스 아님) |
| Kakao Maps `sdk.js` (`Referer: urdeal.kr`) | 200 |
| `app-kakao-sdk` 청크 해시 | 로컬 빌드와 **동일** → 라이브 SDK 로더·키가 지금 코드와 같다 |
| 하네스 렌더(`--route=/map --deals`) | 시트에 "6곳" 정상 렌더 |

⚠️ **하네스가 못 본 것**: 하네스 시드 딜에는 좌표가 없어 `withCoords` 가 비고,
**핀·클러스터 생성 코드(`map-overlays`)가 한 번도 실행되지 않았다.** 카카오 SDK 도 차단된다.
즉 "지도 위" 는 이 환경에서 아직 한 번도 못 봤다.

🚫 이 원격 환경에서는 **라이브를 브라우저로 열 수 없다** — 프록시 릴레이가 Chromium 의 TLS
터널을 끊는다(curl 은 통과). `--disable-http2` · ECH/QUIC 비활성 전부 실패
(`net::ERR_CONNECTION_RESET`, 프록시 `recentRelayFailures` 에 `ws_closed_mid_exchange`).

### 다음 세션의 첫 액션
대표에게 **딱 세 가지**를 받는다 — 그 전엔 코드를 고치지 말 것(추측 금지):
1. `/map` 하단 시트에 뜨는 숫자(`N곳`) — **0곳인가, 숫자는 있는데 지도에 핀만 없는가**.
   → 0곳이면 필터/데이터 경로, 핀만 없으면 SDK·오버레이 경로다. 갈림길이 여기서 갈린다.
2. 콘솔의 **Sentry 아닌 빨간 줄**(있으면 그대로).
3. 위치 권한 허용 여부 · 기기(모바일/PC) · 지도가 "지도를 불러올 수 없습니다" 를 띄우는지.

---

## 4. (후속) 지도 피드 전량 순회 제거 — 대표 "가장 이상적으로 하자. 모두 이상적으로 진행"

### 실측이 먼저였다
| | 값 |
|---|---|
| 활성 이용권 | **338건** |
| `/map` 진입 시 요청 | **7회 · 66KB(gzip)** — 클라가 50개씩 끝까지 걸어감 |
| 응답 엣지 캐시 | URL별 **15분**(새 URL 첫 요청엔 `age` 없음 → 두 번째부터 `age: 0`) |
| PC/모바일 홈 피드 | 이미 page1 + 무한스크롤 (같은 레포에 옳은 패턴이 있었다) |

🩸 **내가 대표에게 처음 보고할 때 틀린 것**: "모바일 홈(`/`)도 전량을 받는다" 고 했는데 **아니다.**
모바일 홈은 2026-08-19 부터 `MobileHomePage`(→`GroupBuyFeed`)라 이미 요청형이다. 전량 순회는
**`/map` · `/restaurant-map`(RestaurantMapPage)** 뿐이었다. CLAUDE.md 의 "홈=RestaurantMapPage"
서술이 낡아서 그대로 믿었다 — **문서보다 `HomeRoute.tsx` 를 먼저 볼 것.**

### 무엇을 바꿨나
- `useMapProducts`: 자동 순회 삭제 → page1 + `loadMore()`/`loadAll()`.
- 정렬을 서버로(`sort`), 거리순은 `near`. 서버 화이트리스트에 `price`·`rating` 추가.
- 응답에 `total` additive(`feed-total.ts`) → "N곳"이 로드된 수가 아니라 **전체 수**.
- 서버가 못 거르는 필터(지역 텍스트·반경·가격대·즐겨찾기) + **필터 시트를 여는 순간**에만 `loadAll()`.
- 리스트 센티넬이 로드분을 다 보여 준 뒤 서버 다음 페이지를 부른다.

### 검증 (하네스 실측 — 338건 가짜 카탈로그를 50개씩 서빙하고 요청을 셌다)
```
/map  진입 직후 요청 1회 (sort=discount)   ← 이전 7회
      화면 카운트 "338곳"                  ← 로드된 50이 아니다
      바닥까지 스크롤 → page2~7 그때 요청
      pageerror 0
```
tsc 0 · build 0 · 관련 유닛 186 pass · 주입 3건 되돌려-검증 빨간불 확인.

### 남은 것 (다음 세션)
1. **홈 피드(`GroupBuyFeed`)의 정렬도 로드된 것 안에서만 돈다.** 서버 화이트리스트엔 이미
   popular/newest/deadline/discount 가 있으니 `sort` 를 넘기면 되지만, **SSR 시드 캐시키 계약**
   (`queryKeys.groupBuyList('active', category)` + `__SSR_INITIAL_MAIN__`)을 건드려야 해 별건으로 뒀다.
2. 배포 후 라이브에서 확인할 것: `/map` 진입 시 `/api/group-buy/products` 요청이 **1회**인지,
   시트 카운트가 전체 수인지, 스크롤로 다음 페이지가 붙는지.
3. `/map` 이용권 미표시 신고(§3)는 그 뒤 대표가 "지금은 다 뜬다" 고 확인 — 원인 미규명(일시적).
   재발하면 §3 의 질문 3가지부터.
