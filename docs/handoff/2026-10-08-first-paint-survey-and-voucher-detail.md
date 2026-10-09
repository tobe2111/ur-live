# 2026-10-08 — 첫 페인트 전수 실측 + 교환권 상세 서버 렌더 (①/④)

대표: *"그럼 그 홈 로딩 말고도 전체적으로 다른 페이지들은?"* → 전수 실측 보고 → **"모두 다 하자"**

## 1. 전수 실측 — 지금 로딩 장면 없이 열리는 화면은 **둘뿐**

재는 법: **JS 를 끄고** 라이브를 열어 서버 HTML 그대로 찍는다(`out/firstpaint.mjs`, 이 세션이 만든 하네스).
그게 React 가 깨기 전 사용자가 보는 화면의 정의다.

| 첫 페인트 | 화면 | HTML 속 데이터 |
|---|---|---|
| ✅ 내용 | `/pass/:id` · `/blog` | DETAIL · BLOG |
| 🟠 로더 | `/` **48KB** · `/vouchers` **13.6KB** · `/vouchers/:id` 2.4KB · `/products/:id` · `/u/:handle` 2.6KB | **이미 와 있다** |
| 🔴 로더 | `/map` · `/search` · `/stays` · `/community-group-buy` · `/experience` · `/new-openings` · `/gb-market` | **없다** |

**로더가 떠 있는 시간은 어디나 비슷하다**(실측 600~1,100ms). 차이는 *그 1초에 무엇이 보이느냐*뿐이다.
⇒ 🟠 는 "있는 걸 안 쓴다"(상세 처방이 그대로 통함) · 🔴 는 "데이터를 안 싣는다"(다른 문제).

🔎 부수 발견: **`/group-buy/:id` 는 라이브에서 301 → `/pass/:id`**. 문서·주석은 아직 옛 경로로 적혀 있다(정상 동작).

## 2. 이 세션이 한 것 — ① 교환권 상세

`worker/index.ts` 의 DETAIL 분기 **뒤**에 `/vouchers/` 분기 추가 + 신규
`utils/voucher-detail-ssr-body.ts`. [상단 바 + 정사각 사진 + 분류 칩 + 제목]까지 그리고 아래에만 로더(34dvh).

- **사진은 추가 요청 0** — 워커가 이미 `width:800 · cfSrcSet(…,800)` 으로 preload 한다. 첫 화면이
  **같은 `src`/`srcSet`/`sizes`** 를 쓰면 그 preload 를 그대로 쓴다(시험이 그 동치를 고정).
- **뒤로가기 아이콘은 안 그린다** — lucide path 를 워커 문자열로 옮기면 두 벌이 갈린다. 바의 높이
  클래스는 그대로라 아이콘이 나중에 바 **안에서** 나타날 뿐 밀림 0.
- **PC(lg+)도 그린다** — 이용권 상세에서 PC 를 뺀 이유(그리드 밖 제목)가 여기엔 없다.

## 3. 다음 세션의 첫 액션

1. **E4**: 배포 뒤 `node out/firstpaint.mjs /vouchers/2192` → 사진·제목이 첫 프레임에 있는지(로더만이 아니어야 한다).
2. **②③④ 남았다**(대표가 넷 다 승인):
   - ② 유어샵 `/u/:handle` 헤더(아바타+이름+소개 — per-user 아님)
   - ③ 쇼핑 상세 `/products/:id`(①과 같은 구조)
   - ④ 홈 · 교환권 — 첫 화면의 68%가 카드 그리드라 **카드 마크업 SSOT 선행**
     (`GroupBuyFeedCard` 354줄 + `DealCardMedia` 404줄 · per-user 요소는 거리·찜인데
     **첫 방문엔 둘 다 없다** — 그게 이 처방이 성립하는 근거다)

## 4. 이번에 틀렸던 판단

- 🩸 **배선 시험의 앵커를 `url.pathname.startsWith('/vouchers/')` 로 잡았다가 헛돌았다.** 워커에는
  같은 표현이 **히어로 preload 에도** 있어서(`buildDetailHeroPreloadLink(…)`) `indexOf` 가 그걸 먼저
  집었고 순서 판정이 뒤집혔다. ⇒ 분기 조건 전체로 앵커.
- 🩸 **로더 포착용 스크린샷이 세 번 틀렸다.** `.ur-loader-breathe` 를 폴링해 찍었더니 **마운트된
  화면**이 나왔다(스크린샷 자체가 중계 구간에서 수백 ms 걸려 그 사이 마운트된다). ⇒ 타이밍으로
  쫓지 말고 **JS 를 끄고** 찍을 것. 그게 서버가 보낸 것의 정의다.
- 🩸 `node scripts/check-file-size.mjs --rebaseline` 은 **내가 안 건드린 파일의 천장도 올린다**
  (이번엔 `repair-schema/column-repairs.ts` 1104 → 1185). 한 줄만 손으로 고쳤다.
  ⚠️ 그 파일이 지금 main 에서 **baseline 을 81줄 넘겨 있다**(warn-only 라 통과 중) — 별건.

## 5. 남은 결정

- 홈 로딩 B안(④)의 선행 작업 범위 — 카드 SSOT 를 어디까지 뽑을지는 착수 때 다시 보고.

---

## 🔬 ②③④ 는 ①의 반복이 아니다 — 하나씩 재 본 결과 (2026-10-08 후속)

대표 **"모두 다 하자"** 로 넷 전부 승인받고 ① 을 끝낸 뒤, 나머지 셋의 **실제 비용**을 코드로 쟀다.
결론부터: **①이 쉬웠던 이유는 "경로가 같아서"가 아니라 "그릴 것이 사진 한 장 + 글자 한 줄이고
그 사이에 아이콘·per-user·lazy 가 없어서"다.** 셋 다 그 조건을 안 갖췄다.

### ② 유어샵 `/u/:handle`
| 잰 것 | 결과 |
|---|---|
| 그릴 payload | **글자 한 줄**(가게 이름). 아바타는 2026-09-28 에 제거됐고 배너도 안 쓴다 |
| DOM 이 하나인가 | 헤더 컴포넌트·래퍼(`ur-ushop-pc > ur-ushop-side`)는 **개인·사업자 공통**(확인함) |
| 이름의 출처 | 사업자는 `headerCurator` = **curator(users) 우선 · seller(sellers) 폴백 병합** — 서버 시드의 `curator.name` 이 비면 화면과 갈린다 |
| 마운트 직후 | 사업자 경로는 `CuratorPage` 가 `SellerPublicPage` 를 **`<Suspense fallback={<BrandLoader fullScreen/>}>`** 로 감싼다 → 서버가 그린 것을 **불투명 풀스크린이 덮는다**(2026-09-16 에 App 수준에서 고친 그 버그가 이 페이지 안에 또 있다) |
| 오른쪽 버튼 줄 | SNS(시드) + 공유(항상) + **관리(주인만)** → 주인에게만 이름 칸이 ~75px 좁아져 **첫 줄 글자가 바뀐다**(자리는 안 밀린다 — `items-start` 라 아래로만 자란다) |

⇒ 하려면 **헤더 마크업 + 로고(`UrDealLogo` size 19) 미러 + 병합 규칙 미러 + Suspense 폴백 교체** 넷을
한 커밋에 묶어야 하고, 얻는 것은 글자 한 줄이다. **아이콘은 안 그려도 된다** — 빈 `w-9 h-9` 상자로
자리만 잡으면 폭이 맞는다(①의 뒤로가기 처방과 같다).

### ③ 쇼핑 상세 `/products/:id`
- 사진이 **lazy 캐러셀**(`ProductImageCarousel`) 안이고 그 Suspense 폴백이 `h-96 animate-pulse` **회색 상자**다
  ⇒ 서버가 사진을 그리면 마운트 때 **사진이 사라지고 회색 상자**가 된다(대표가 금지한 "로딩 화면 2~3개").
  고치려면 그 폴백을 서버가 그린 것과 같은 `<img>` 로 바꿔야 한다(페이지 변경 동반).
- 그리고 **값이 낮다**: 쇼핑탭은 숨김(`SHOPPING_TAB_HIDDEN`)이고 sitemap 은 비-딜 상품 15건만 제출한다.
  교환권은 `/vouchers/:id`(=①)로 간다.

### ④ 홈 · 교환권 — **여기가 값이 크다. 그리고 막는 것은 per-page 가 아니라 카드다**
🩸 **먼저 내 오판 하나를 정정한다**: CLAUDE.md 잠금표가 *"모바일 홈 = `RestaurantMapPage`(지도)"* 라고
적혀 있어서 *"지도라 서버가 그릴 게 없다"* 로 결론 낼 뻔했다. **틀렸다** — 2026-08-19 대표 확정으로
모바일 홈은 **딜 피드**(`MobileHomePage`)이고 지도는 `/map` 으로 갔다. 같은 커밋에서 그 줄을 고쳤다.

라이브 390px 실측(`out/home-now-mounted.png`):
```
상단 chrome   136px   로고 · 검색/알림/장바구니 · 위치 · 목록|지도 · 카테고리 5
그 아래        전부   "지금 인기 이용권" + 사진 있는 카드 4장  ← 첫 화면의 85%
```
**chrome 만 그려 보면**(`out/home-chrome-only.png`) 로고와 탭만 뜨고 600px 가 빈다 —
지금의 유달이 로더보다 **낫다고 말하기 어렵다**. 즉 ④의 값은 **카드**에 있고, 카드를 그리려면
2026-09-16 이 이미 적어 둔 선행 조건이 그대로 남아 있다:

> "그리드는 N장 × 약 10개 속성이라 두 벌이 갈리는 클래스에 정면으로 들어간다 …
>  다시 시도한다면 **카드 마크업을 서버·클라가 같은 SSOT 로 만드는 것**이 선행 조건이다."

`/vouchers` 는 블로커가 하나 더 있다 — **첫 블록이 per-user 잔액**이라(로그인 152px ↔ 비로그인 44px)
그 아래를 그리면 로그인 사용자에게 108px 밀린다. 서버가 `ur_session` 쿠키 **존재**로 가를 수는 있지만
쿠키와 localStorage 가 갈린 사람에게 그대로 밀림이 된다.

### ⇒ 다음 세션에 권하는 길 (대표 판단 필요)
1. **워커에서 React 를 그린다**(`renderToStaticMarkup`). 레포엔 이미 `entry-server.tsx` 가 있다.
   컴포넌트를 그대로 쓰므로 **두 벌이 갈리는 클래스가 구조적으로 사라진다** — ②③④가 한 번에 풀린다.
   비용: 워커 번들에 `react-dom/server` + 요청당 CPU(이 계정은 CPU 천장에 실제로 부딪히는 중).
   완화: 첫 화면 HTML 을 **cron 예열 때 만들어 KV 에 둔다**(시드가 이미 그렇게 예열된다).
2. **첫 페인트 JS 다이어트** — 로더가 뜨는 **원인**(V8 파싱 ~1.1초)을 줄이면 **모든 화면**이 같이 짧아진다.
   2026-09-16 실측 잔여: `i18n` 20.1 · `axios` 17.3 · `app-routes` 8.3 KB(gzip).

---

## 🏠 ④ 홈 — 서버가 첫 화면을 그린다 (대표 *"진행해줘"*)

### 먼저: **(a) 워커 React 렌더는 죽었다 — 산수로**

대표에게 두 길을 올렸고(`(a)` 워커에서 React 를 그린다 / `(b)` ②③을 지금 모양으로 민다)
*"진행해줘"* 를 받았다. 그래서 (a)의 전제를 먼저 쟀고 **성립하지 않는다**:

```
_worker.js gzip   991,518 B      (실측)
CI 게이트        1,032,000 B      (.github/workflows/main.yml:123)
여유                39,482 B
react-dom/server     ~40,000 B    (그 하나로 이미 초과)
```

그 위에 페이지 트리·i18n·react-query·router 가 얹힌다. 그리고 이 게이트는 **이미 한 번
배포를 깨뜨린 자리**다(#533 머지 후 Pages 배포 실패 → #537 응급 다이어트).
⇒ **다시 제안하지 말 것.** 유료 전환(gzip 10MB) 전에는 불가능하다.

### 그래서 (c) — 베끼되, **시험이 진짜 컴포넌트를 렌더해 대조**한다

`home-ssr-first-screen-2026-10-08.test.tsx` 가 `GroupBuyFeedCard` 를 jsdom 에 실제로 렌더해
워커 HTML 과 **토큰까지** 맞춘다. 가장 값진 단언은 이것이다:

```ts
const rows = (a) => [...a.children[1].children].map(c => tokens(c.className).join(' '))
expect(rows(workerCard(p))).toEqual(rows(reactCard(p)))
```

카드 본문에 **줄이 하나 늘거나 줄면** 빨간불이다 — 그게 마운트 때의 밀림이고, 그 외의
어떤 검사로도 안 잡힌다(빌드도 테스트도 화면도 멀쩡하다).

### 실측

| | 값 |
|---|---|
| 크롬 높이 | **136px** — 라이브 실측과 동일 |
| 첫 섹션 패널 | y=148 (`mt-3`) |
| 첫 카드 | `[14, 217, 175, 246]` · 4장 2행 |
| 사진 URL | preload `href` 와 **byte-일치** (200 / 15,305B) |
| 그린 내용 총높이 | ~770px (뷰포트 844) |

### 다음 세션의 첫 액션

1. **E4**: 배포 후 `node out/firstpaint.mjs /`(JS 끄고 서버 HTML 그대로) — 카드 4장이 첫
   프레임에 뜨는지 + **마운트 때 첫 카드 y 가 1종인지**(2종이면 밀렸다는 뜻).
2. 그 다음 후보는 **② `/u/:handle`** 인데 선행 조건이 하나 있다 — 사업자 경로가
   `<Suspense fallback={<BrandLoader fullScreen />}>` 라 **서버가 그린 것을 덮는다.**
   2026-09-16 의 `BootFirstScreenLoader` 가 소비자 `PageLoader` 만 다루므로 그 짝을 먼저.
3. **③ `/products/:id` 는 하지 말 것** — 사진이 lazy `ProductImageCarousel` 안이고 그
   Suspense 폴백이 `h-96 animate-pulse` 회색이라, 서버가 사진을 그리면 마운트 때 **사라진다**.
   게다가 `SHOPPING_TAB_HIDDEN` 이라 트래픽이 사실상 0 이다(sitemap 제출 15건).

### 이번에 틀렸던 판단

- 시험 첫 판에서 inline style 을 `getAttribute('style')` 로 비교했다 — React 는
  `width: 94%;`, 워커는 `width:94%`. **같은 값인데 글자가 달라** 늘 빨간불이었다.
  ⇒ 비교는 파싱된 값(`style.width`)으로. 지키려는 건 "같은 비율"이지 "같은 글자"가 아니다.
- `locLabel` 을 소스에서 통째로 찾았다 — 그 클래스는 **삼항으로 조립**돼 한 덩어리로
  안 나타난다. **코드가 멀쩡한데 빨간불**이 났다. ⇒ 조각 둘을 각각 대조(한쪽만 보면
  나머지 절반이 조용히 갈린다).

---

## ✅ ①의 E4 (배포 후 라이브, `urdeal.kr/vouchers/2192`, JS 끈 채 서버 HTML 그대로)

**통과** — 첫 페인트에 **사진 + `교환권` 칩 + 제목**이 그대로 있다(`out/loadshots/fp_vouchers_2192.png`).
`x-ssr-status: DETAIL:edge-hit`.

### 🔎 그런데 짧아진 로더가 **첫 화면에 안 보인다** — 의도와 다르다(해롭진 않다)

HTML 을 세어 보니 `34dvh` 1건 · `100dvh` 1건인데, 그 `100dvh` 는 **로더가 아니라**
`VOUCHER_FS_CLASS.root` 의 `min-h-[100dvh]` 다. 즉 치환은 제대로 됐고(로더는 34dvh),
**첫 화면 루트가 이미 100dvh 를 차지해** 로더가 y≥844 로 밀려 접힘 밖에 있다.

- **해롭지 않다** — 오히려 대표가 말한 *"로딩 장면 없이"* 에 더 가깝다. 그래서 되돌리지 않았다.
- **다만 설계 의도와 다르므로 적어 둔다**: `/pass/:id`(2026-09-15)도 같은 구조이니
  "그 아래 짧은 로더" 라는 서술을 그대로 믿지 말 것. 실제로는 **안 보인다.**
- **④ 홈은 다르다** — `HOME_FS_CLASS.root` 에 `min-h-[100dvh]` 를 **일부러 안 넣었다**.
  그려진 내용이 ~770px 라 34dvh 로더가 바로 아래에서 보인다.

## 🩸 squash 머지 뒤 같은 브랜치를 이어 써서 PR 이 조용히 멎었다

#1664 를 **squash** 로 머지한 뒤 같은 브랜치에 ④를 쌓았더니 #1665 가
`mergeable_state: dirty` + **`Verify` 가 아예 없음**(= CLAUDE.md 가 적어 둔 그 증상 —
GitHub 이 머지 커밋을 못 만들면 `pull_request` 워크플로가 **디스패치되지 않는다**).
빨간 체크가 하나도 없어서 훑어보면 통과처럼 보인다.

**처방**: `git checkout -B <branch> origin/main` → `git cherry-pick <미머지 커밋>` →
`check-github-side-merge` 통과 확인 → `--force-with-lease`. 되돌아온 뒤 `Verify` 정상 디스패치.

⚠️ **다음 세션 규칙**: squash 머지된 브랜치에 **그대로 이어 붙이지 말 것.** 머지 직후
`git checkout -B <branch> origin/main` 으로 base 를 새로 잡고 시작한다.

---

## 🛍️ ② `/u/:handle` — 사전조사 (2026-10-08, #1665 머지 대기 중 수행 · 미구현)

**라이브 실측** (`curl -A '<iPhone UA>' https://urdeal.kr/u/jiwon1228`):
- `x-ssr-status: CURATOR:self-fetch-hit` · 문서 **60,773B** · `#root` 는 **catch-all 유달이 로더**(`ur-first-screen` 0건).
- `__SSR_INITIAL_CURATOR__` **2,639B** — 그릴 것이 충분하다:
  - `curator`: `name` `bio` `profile_image` `banner_url` `headline` `accent` `youtube_url` `instagram_url` `tiktok_url` `linkshop_show_recommend`
  - `pins` **4건**, 각 핀에 `product_name` `restaurant_name` `restaurant_address` `price` `original_price` `discount_rate` `image_url` `dominant_color` `avg_rating` `review_count` `category` `deal_only` `position`
  - `linked_seller` = **null**(이 핸들은 핀 그리드 경로 — 인라인 `SellerPublicPage` 아님)

> 🩸 **전에 제가 "이 페이지 페이로드는 한 줄뿐" 이라고 보고한 것은 틀렸다**(`CuratorHeader.tsx` 만 읽고 핀 줄을 안 봤다). 위가 실측값이다.

**로더가 뜨는 이유는 데이터가 아니다** — 시드가 핸들과 맞으면 `CuratorPage` 의 `loading` 은 첫 렌더에
이미 `false`(l.86 `useState(!data)`)라 **마운트 순간 본문을 그린다.** 보이는 1초는 전부
[정적 로더 → 청크 다운로드·파싱 → 마운트] 구간이고, ①④와 **같은 모양**이다.

### 🔴 막는 자리 — 주인 전용 `관리` 버튼이 **제목 위**가 아니라 **제목 옆**에 있다

`CuratorHeader` 의 이름 줄은 `flex items-start` 로 [왼: h1+bio(`min-w-0 flex-1`)] / [오: SNS+공유+`canEdit && 관리`].

- **높이는 안 변한다** — 오른쪽 묶음은 `canEdit` 와 무관하게 공유 버튼(`w-9 h-9`)이 있어 늘 36px.
- **⚠️ 폭이 변한다** — `관리`(`h-9 px-3` + gap)가 붙으면 왼쪽 칸이 좁아지고, `h1` 이 `line-clamp-2` 라
  **1줄 → 2줄로 되감겨 그 아래 전체가 밀린다.** 소스 주석(2026-09-30)이 이 폭 변화를 이미 기록하고 있다
  ("주인 화면에서 왼쪽 칸이 156px").
- `isOwner` 는 **동기**다(`localStorage.user_id` + `useAuthStore`, l.101~109) → 주인의 **첫 React 렌더에
  이미 버튼이 있다**. 즉 서버가 버튼 없이 그리면 **주인에게만** 마운트 때 되감김이 일어난다
  (2026-09-15 에 `/group-buy/:id` 를 히어로에서 멈추게 한 것과 **같은 클래스**).

### 쓸 수 있는 길 (다음 세션이 고를 것)

1. **이름 길이 보수 게이트 (추천)** — 주인 폭(가장 좁은 경우)에서도 `h1` 이 한 줄에 들어가는 길이면
   버튼 없이 그리고, 넘치면 `''` 를 돌려 **종전 로더로 떨어진다**(①④가 이미 쓰는 실패 패턴).
   임계값은 브라우저 하네스로 **실측해 테스트에 박는다**(17px bold · tracking −0.03em · 156px 칸).
   `jiwon1228`("정지원" 3자)은 안전. ⚠️ 긴 이름 샵은 지금과 같다(개선 없음, 악화 없음).
2. **`관리` 자리를 모두에게 예약** — ❌ 손님 레이아웃이 오늘보다 좁아져 **회귀**다(+대표 확정 안 C 를 건드린다).
3. **헤더를 안 그리고 핀만** — ❌ 헤더 높이를 숫자로 예약해야 해서 2026-09-16 "마법의 숫자 금지" 를 어긴다.

### 그릴 경계 (①④와 같은 규율)

- ✅ 브랜드 바(`lg:hidden`, 로고는 `<UrDealLogo>` 이미 워커가 쓰는 것) · 이름 · bio · 칩 줄의 **높이** · 핀 4줄
- ❌ `관리` 버튼 · SNS 아이콘(lucide) · `SortMenu` · 검색창(게이트는 `pins.length >= SEARCH_MIN_PINS` 로 시드 파생 가능하므로 **높이는 그릴 수 있다**) · `UShopQrCard`(PC 전용 칸)
- 사진은 핀의 `image_url` + `dominant_color` — **`/u/` 에는 워커 preload 가 없다**(홈·상세와 달리).
  ⇒ 같은 커밋에서 preload 를 추가하든, 추가 요청을 감수하든 **먼저 정할 것**(갈리면 사진을 두 번 받는다).

### 먼저 할 무해한 한 걸음

`CuratorPage.tsx` l.229 · l.251 의 `<BrandLoader fullScreen />` → `BootFirstScreenLoader`.
오늘은 서버 첫 화면이 없어 **no-op** 이지만, 생기는 날 풀스크린 로더가 그 화면을 덮는 것을 막는다
(2026-09-16 에 `/group-buy/:id` 에서 실제로 540ms 덮었던 그 결함).

---

## ✅ ④ 홈 — 머지 + E4 판정 통과 (2026-10-09, 대표 *"머지해"*)

- **머지**: PR #1665 → `a90c7dbe`(squash). 배포 `Deploy to Cloudflare Pages: success`.
- **E4(라이브 2회, iPhone 13 · `urdeal.kr/`)**:
  - ⓐ JS 끈 캡처 — `ur-first-screen` 존재 · **카드 4장** · 첫 카드 `[14,217,175,246]`(머지 전 로컬 예측값과 일치) · 로더 top **349 → 854**
  - ⓑ JS 켜고 80ms × 89~95프레임 — 첫 카드 슬롯 y **1종(217)** · href **1종**(`/pass/2915`) · **풀스크린 로더 0프레임**

### 🩸 이번에 틀렸던 것 — 둘 다 라이브가 아니라 내 측정기였다

1. **href 정규식에 `/stays/` 가 빠져 카드를 `4 → 2장`으로 셌다.** 숙소 카드 2장이 필터에서 빠졌는데
   에러가 안 나고 그냥 적은 숫자가 나온다. HTML 을 직접 세어(`<a href=` 4개: `/pass/2915`·`/pass/2919`
   ·`/stays/2765`·`/stays/2725`) 4장임을 확인하고 넓혔다.
   ⇒ **적은 값·0 이 나오면 먼저 측정기를 의심하라**(2026-10-06 교훈이 또 맞았다).
2. **y 앵커를 *특정 상품의 글자*로 잡아 `217 → 8232 → 8530` 3종이 나왔다.** 그건 "그 상품이 피드 몇
   번째냐" 를 재는 것이고, E4 기준인 **"첫 카드 슬롯이 움직이는가"** 와 **다른 질문**이다. 앵커를
   슬롯(사진 가진 첫 상세 링크)으로 바꾸니 1종이 됐다.
   ⚠️ 2026-09-16 의 교훈("선택자 앵커가 단계마다 다른 요소를 집는다")을 피하려 글자로 잡았는데,
   이번엔 **글자가 너무 구체적**이어서 반대로 틀렸다. 재려는 것이 *슬롯*인지 *내용*인지 먼저 정할 것.

### ⚠️ 마운트 표식이 없다 (다음 세션 주의)

`mountedAt` 숫자는 **인용하지 말 것** — 표식으로 쓴 `#root > div:not(#ur-first-screen)` 과 `<nav>` 가
**둘 다 서버가 그리는 것**이다(로더 div 가 `#root` 안에 첫 화면과 나란히 들어가고, 크롬 줄에 `<nav>` 가 있다).
실제 마운트 신호는 **`ur-first-screen` 노드가 사라지는 전이**다. React 전용 DOM 표식을 찾으려면
서버 첫 화면 HTML 에 그것이 없음을 **먼저 grep 으로 확인**할 것.

### 🧰 E4 하네스는 매 세션 재작성해야 한다

`out/` 은 `.gitignore` 라 컨테이너와 함께 사라진다. 재작성 요령:
- `playwright-core` 를 **스크래치패드에** 설치(`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright-core@1.64.0`),
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`, `--no-sandbox`.
  (레포에 `npm ci` 를 돌리지 말 것 — `npm run build` 가 `route-chunk-map.ts` 를 재생성해 커밋 오염 위험.)
- **두 패스로 나눈다**: ⓐ `javaScriptEnabled: false` = 서버가 그린 것 ⓑ JS 켜고 슬롯 y 추적.
  섞으면 무엇을 재는지 알 수 없다.
- **배포 전 기준선을 먼저 뜰 것** — 배포 후 0 이 나왔을 때 회귀와 측정 실패를 구분하는 유일한 방법이다
  (이번 기준선: `hasFirstScreen:false` · `cardCount:0` · `loaderTop:349`).

### 다음: ② `/u/:handle`

설계·막는 자리·처방 셋은 이 문서 위쪽 "🛍️ ② `/u/:handle` — 사전조사" 절에 있다. **다시 조사하지 말 것.**
먼저 정해야 할 것 하나: `/u/` 에는 워커 사진 preload 가 **없다** — 추가할지 추가 요청을 감수할지
그리기 전에 결정(갈리면 같은 사진을 두 번 받는다).
