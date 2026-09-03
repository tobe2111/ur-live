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

---

## 5. (마무리) 홈 피드 서버 정렬 + Sentry 자기증식 고리 차단 — 대표 "마저 다 해줘"

### ① 홈 피드 정렬
- **문제**: 홈은 이미 요청형이었지만 정렬을 **로드된 것 안에서만** 했다 → "인기순" = *최근 50개 중 인기순*.
- 더 나쁜 것: **서버와 화면의 정렬 정의가 달랐다.** 서버 `popular`=`group_buy_current`, 클라 `soldOf`=`sold_count ?? group_buy_current`. 서버가 고른 상위 50이 클라가 원하는 상위 50이 아니었다.
- **수정**: 서버 정의를 클라 SSOT 로 맞추고(**실제 SQLite 로 6종 ORDER BY 실행 검증** — 문법·순서 둘 다), 피드가 page1·loadMore 모두 `sort`(거리순은 `near`)를 넘기게. 캐시키는 정렬별로 분리, 전환 시 직전 결과 유지.
- **SSR 0-RTT 는 그대로**: 시드는 여전히 `initialData`, 화면 최종 순서는 종전대로 클라 `sortBand`(밴드별)가 매긴다. 서버는 **후보 집합**만 정한다.
- 실측(하네스): `/` 진입 요청 1회 `?status=active&category=all&sort=popular`, page2~7 동일 정렬.

### ② Sentry
- 대표가 캡처한 `429` 는 **Sentry 가 우리 이벤트를 거절**한 것이고, 같이 뜬
  `TypeError … reading 'startTime' at et.reportAllChanges` 는 **`@sentry/react` 가 자기 번들 안에서** 던진다.
  uncaught 라 **Sentry 가 그걸 다시 올린다** — 쿼터를 스스로 태우는 고리다.
- 판정을 `src/lib/sentry-noise.ts` **순수 함수**로 빼서 테스트가 진짜로 돌린다(인라인이면 `Sentry.init` 없이 못 돈다).
- ⚠️ **좁게 거른다**: [메시지 + 스택이 Sentry 자신의 리포터] 둘 다 맞을 때만. 같은 메시지가 **우리 코드**에서 나면 그대로 올린다(테스트로 고정 — 진짜 버그를 삼키는 것이 429 보다 나쁘다).
- 덤: 기존 `localStorage`/`NetworkError` 필터는 `event.message` 만 봐서 **예외에는 한 번도 안 걸렸다**(예외 텍스트는 `exception.values[].value` 에 있다). 원 의도대로 동작하게 고쳤다.
- ⏭️ 그래도 429 가 계속되면 다음 레버는 **에러 `sampleRate`** 다(지금은 100%). 샘플링은 진짜 에러도 버리므로 대표 확인 후에.

### 다음 세션이 볼 것
배포 후 `/`(홈)에서 정렬 칩을 바꿔 가며 `/api/group-buy/products` 요청에 `sort=` 가 붙는지,
그리고 콘솔에 `reportAllChanges` TypeError 가 Sentry 로 전송되지 않는지(429 빈도 감소).

---

## 6. 자기 diff 재검토에서 **내가 만든 결함 2건**을 찾았다 (대표 "계속 끝까지 해")

테스트도 하네스도 통과한 뒤에 diff 를 적대적으로 다시 읽다가 나왔다. **둘 다 에러가 안 난다** —
그래서 이 절이 이 문서에서 제일 값지다.

### ① `near` 와 `sort` 를 같이 보내고 있었다 (조용히 틀린 정렬)
서버는 `baseOrder = hasNear ? 거리 : sort` — **near 가 sort 를 이긴다**(`group-buy-public.routes`).
`/map` 은 위치가 있으면 늘 `near` 를 보냈으므로, 위치를 켠 사용자가 '할인율순'을 골라도
서버는 **가까운 50개**를 주고 화면은 그 안에서만 할인순으로 정렬한다.
전량을 받던 시절엔 클라가 338개를 다 갖고 있어 최종 순서가 맞았다 — **수요 로딩으로 바꾼 그 순간
이게 결함이 됐다.** 내 최적화가 만든 결함이지 원래 있던 게 아니다.
⇒ `useFeedWindow`: 거리순일 때만 `near` 를 넘긴다. 가드 + 주입 매니페스트 등록(빨간불 확인).

### ② 위치 캐시가 있는 사용자는 진입 요청이 **2회**였다
`useNearMeAuto` 가 마운트 직후 정렬을 '가까운 순'으로 자동 전환하는데, 정렬이 서버 캐시키에
들어간 뒤로는 그 전환이 두 번째 요청을 만든다(진입 1회를 지키려던 일이 무색해진다).
⇒ 위치가 캐시돼 있으면 `sortBy` 를 처음부터 `'distance'` 로 시작(어차피 갈 자리 + 칩 깜빡임도 사라짐).

**하네스 실측(재검증)**
```
/map  위치 없음 → 1회  ?category=all&sort=discount
/map  위치 있음 → 1회  ?category=all&near=37.4979,127.0276&limit=50   (sort 와 겹치지 않음)
/     홈       → 1회  ?status=active&category=all&sort=popular
```

### 전체 검증
`tsc` 0 · `build` 0 · **전체 유닛 593파일 7,373 pass** · audit-gate 101 항목 ✓(✗ 0) ·
주입 매니페스트 7건 되돌려-검증 빨간불 확인.

### 🧭 교훈
**"테스트가 초록 = 옳다" 가 아니다.** 두 결함 모두 내가 쓴 테스트를 통과했다 — 테스트가
*배선*은 봤지만 *서버의 우선순위 규칙*과 *마운트 시퀀스*는 안 봤기 때문이다.
diff 를 적대적으로 다시 읽는 패스는 생략하지 말 것.

---

## 7. main 재병합 시 확인한 것 (같은 날 다른 세션과의 충돌 여부)

`93f64e6` 이후 main 이 두 번 더 움직였다. 병합하면서 **내 변경과 논리적으로 겹치는지** 확인했다:

- `d15c3eb` (#1340, 뒤로가기·필터 히스토리) → `VouchersPage`·`LinkshopPinPicker` 만. **내 파일과 무접촉.**
- `e5d4f3d` (#1334, 홈 '인기순' = 결제·리뷰·클릭 종합) → **`section-rules.ts`(홈 편성 섹션)** 의 점수다.
  피드 정렬 칩의 `case 'popular'` 은 여전히 `soldOf`(= `sold_count ?? group_buy_current`)이므로
  내가 서버에 미러한 정의(`COALESCE(sold_count, group_buy_current, 0)`)와 **여전히 일치**한다(확인함).
- 충돌 파일은 `auto-reference.ts` 하나(생성물) → 생성기로 재생성.

⚠️ **다음 세션이 알아야 할 것**: 이제 "인기"의 정의가 **두 벌**이다 —
**편성 섹션**(결제·리뷰·클릭 종합, `section-rules.ts`) vs **피드 정렬 칩**(`soldOf`, 서버 `popular` 미러).
같은 화면에 둘이 같이 뜨므로 언젠가 하나로 합치는 게 맞다. 이번 PR 범위 밖이라 남겨 둔다
(합칠 때 서버 `ALLOWED_GB_SORT.popular` 도 같이 바꿔야 정의가 안 갈린다).

---

## 8. 🩸 배포 전 라이브 기준선 — **"인기순·할인율순은 지금 아무 일도 안 한다"**

대표 *"배포하면 판정까지 해줘"* 에 답하려면 **배포 전 기준선**이 있어야 한다(배포 후엔 못 잰다).
`https://urdeal.kr/api/group-buy/products` 를 정렬 6종으로 직접 두드렸다. 결과가 예상 밖이었다:

```
sort= (없음) / popular / discount / newest / price / rating
  → 여섯 응답이 전부 byte-동일. 첫 5행: 2888, 2887, 2886, 2885, 2882 (= 최신순)
```

캐시가 아니다 — `cf-cache-status: DYNAMIC` 이고, 난수 `&cb=` 를 붙여도 같고,
`&limit=5` 는 **정상 동작**한다(n=5). 즉 같은 코드 경로가 `limit` 은 적용하고 `sort` 만 무시한다.

원인은 **정렬 정의가 라이브 데이터와 안 맞는 것**이었다. 활성 100건 실측:

| 필드 | 라이브 값 | main 의 정렬이 쓰는가 |
|---|---|---|
| `group_buy_current` | **전부 0** | ← `popular: 'p.group_buy_current DESC'` ⇒ **완전 tie** |
| `discount_rate` | **전부 0** | ← `discount: 'p.discount_rate DESC'` ⇒ **완전 tie** |
| `sold_count` | 0·54·88·49·64·104·63·110… | 안 봄 |
| `original_price > price` | **100/100 행** | 안 봄 |
| `avg_rating` | 4.3~5.0 실값 | 화이트리스트에 아예 없음 |
| 비데모 상품 | **100건 중 1건** | (DEMO_LAST 가 1차 키라 그 1건만 맨 앞) |

⇒ 서버 `popular`/`discount` 는 **완전한 동점**이라 ORDER BY 가 아무 순서도 만들지 못하고,
`newest` 는 기본 폴백과 같은 식이고, `price`/`rating` 은 화이트리스트 밖이라 폴백된다.
**네 정렬이 전부 최신순 그대로였다.** 에러가 없어 아무도 몰랐다 — 클라가 로드된 50개를 다시
정렬해 화면 순서는 바뀌었으므로, **"전체 중 인기순"이라는 약속만 조용히 거짓**이었다.

이 PR 의 서버 정의 교체가 정확히 이걸 고친다: `sold_count` 를 보게 되고(실값 있음),
할인율을 정가·판매가로 계산하며(100/100 행이 대상), `price`/`rating` 이 화이트리스트에 들어간다.
즉 **"정의가 갈렸다"보다 강한 사실이다 — main 정의로는 두 정렬이 무효였다.**

### 배포 후 판정표 (이 값과 대조하면 반영 여부가 즉시 갈린다)

| 판정 항목 | 배포 전(실측 2026-09-03 15:12 KST) | 배포 후 기대 |
|---|---|---|
| `?sort=popular` 첫 행 | `2888`(sold 0) — 최신순 | **sold_count 최대 행** |
| `?sort=discount` | 최신순과 byte-동일 | 계산 할인율 **내림차순** |
| `?sort=price` | 무시(최신순) | 가격 **오름차순** |
| `?sort=rating` | 무시(최신순) | 평점 **내림차순** |
| 응답 `total` 필드 | **없음** | **있음**(`region`/`q`/`bbox` 없는 요청) |

판정기: `scripts/`가 아니라 스크래치의 `verdict.mjs`(before/after 동일 실행 → 정렬 성립 여부를
불린으로 출력). 배포 후 `node verdict.mjs after` 로 같은 표를 다시 찍어 대조한다.

⚠️ **`total` 이 실리는 조건을 정확히 알고 판정할 것**: 코드는 `!hasRegion && !hasQ && !hasBbox`
일 때만 계산한다(그 셋은 전체 수의 의미가 달라지므로). **`sort`·`page`·`limit`·`near` 는 막지
않으므로 `?sort=price` 응답에도 `total` 이 실린다.** 반대로 지역/검색/뷰포트 요청에서 `total` 이
없는 것은 정상이며 미반영의 증거가 아니다.
