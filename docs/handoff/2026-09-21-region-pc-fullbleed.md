# 2026-09-21 — 지역 페이지가 PC 에서 430px 액자에 갇혀 있던 것

`[E2]` 작성·검증됨(tsc 0 · 유닛 16건 · 주입 5건 되돌려-검증 빨간불 · 로컬 빌드 1440px 실측).
**배포 후 E4 판정 남음** — 아래 §4.

## 1. 대표 신고

> *"하단에 지역으로 누르니까 2번째 사진처럼 떠. 이 부분도 PC 버전 원래쓰던 것처럼 떠야지"*

첨부 두 장이 정확히 그 흐름이다 — ① 풀너비 PC 홈 푸터의 '지역별 동네딜'(1900px 폭) →
② 시/도를 누르면 도착한 `부산 이용권·동네딜` 이 **430px 액자 + 좌우 소비자 앱 거터 레일**.
같은 흐름 안에서 폭이 접힌다.

## 2. 실측 (수정 전, 라이브 `urdeal.kr`, 1440px)

| 경로 | framed | 거터 레일 | 본문 폭 |
|---|---|---|---|
| `/region` | true | 1 | 430 |
| `/region/부산` | true | 1 | 430 |
| `/region/서울/중구` | true | 1 | 430 |

🔑 **디자인 취향 문제가 아니라 죽은 코드였다.** `RegionPage`·`RegionIndexPage` 는 이미
`max-w-[1600px] px-4 lg:px-10` · `lg:grid-cols-3` · `<GroupBuyFeed pc>` 로 **PC 를 전제로** 짜여 있는데,
액자 폭이 430px 이라 그 `lg:` 가 발현될 자리가 없었다. `pc-fullbleed.ts` 주석이 기록해 둔
**`/cart` 와 같은 클래스**다(PC 2단 코드를 갖고도 액자 때문에 못 쓰던 것).

## 3. 수정 — SSOT 한 파일, 두 줄

`src/shared/pc-fullbleed.ts`
- `FULLBLEED_PC_PATHS` 에 `'/region'`
- `FULLBLEED_PC_PREFIXES` 에 `'/region/'` (시/도·시군구 두 깊이)

등재 조건(그 파일이 스스로 요구하는 것) 확인:
- 지역 표면과 부품(`GroupBuyFeed`·`SiteFooter`·`RegionLinkGrid`)에 **`app-frame-bar` 0건** →
  pc-fullbleed 가 숨길 하단 고정바가 없다. (`/referral` 이 그 바 때문에 일부러 제외돼 있다.)
- `App.tsx` 의 `fullScreenPrefixes` 에는 **일부러 넣지 않았다** — 지역 페이지는 랜딩이 아니라
  소비자 탐색 화면이라 전역 상단 네비를 `/browse`·`/search` 처럼 그대로 써야 한다.

**모바일(<lg) 영향 0** — 액자 CSS 자체가 lg+ 전용이다.

### 실측 (수정 후, 로컬 빌드 1440px)

세 경로 전부 `framed: false` · 거터 레일 `0` · 본문 `1440` · `body.pc-fullbleed` 켜짐 ·
하단 고정바 0 · 전역 상단 네비 1440 폭으로 표시. 지역 허브 3열, 딜 그리드 다열.

## 4. 다음 세션의 첫 액션 (E4 판정)

배포 뒤 1440px 로:

```bash
BASE=https://urdeal.kr node <하네스>   # /region · /region/부산 · /region/서울/중구
```

판정: `framed:false` · `rails:0` · `mainW` 가 뷰포트 폭. **그리고 딜 카드가 실제로 여러 열인지**
— 로컬 정적 서버엔 API 가 없어 카드가 비어 있었고, 카드 그리드의 열 수는 라이브에서만 확정된다.

## 5. 가드

- `src/tests/unit/region-pc-fullbleed-2026-09-21.test.ts` 16건
  (세 깊이 판정 · 이웃 경로 비삼킴 · PC 마크업 전제 · `app-frame-bar` 부재 · 배선 SSOT 단일)
- `scripts/mutations/region-pc-fullbleed.mjs` 5건 — **전부 빨간불 확인**
  (`node scripts/check-guard-mutations.mjs --only='🗺️'`)

⚠️ 테스트가 **못 보는 것**: 실제 픽셀. jsdom 엔 레이아웃이 없어 "1440px 로 펼쳐졌는가"는
브라우저 실측만 판정한다 — 그래서 §2·§3 의 수치를 여기 남긴다.

## 6. 이번에 하마터면 틀릴 뻔한 것

`MobileAppLayout.tsx` 의 `HIDE_SIDEBAR_PREFIXES` 에 넣는 길도 있었다(`/partners`·`/about`·`/creators`
를 그렇게 풀었다). **그러면 안 된다** — 그 목록은 대시보드·B2B 처럼 **소비자 네비까지 통째로 빼는**
표면용이고, 지역 페이지는 소비자 탐색 화면이라 상단 네비가 있어야 한다. 소비자 페이지가 액자만
벗는 자리는 `pc-fullbleed.ts` 다(홈·교환권·장바구니·검색이 전부 그쪽에 있다).

---

# 같은 날 후속 — PC 액자 전수 해제 3묶음 (24곳)

`[E2]` 작성·검증됨. **배포 후 E4 판정 남음**(§4 와 같은 방법).

## 7. 대표 확정

지역 페이지를 고친 뒤 *"이제 또 해야하는건?"* 에 답하려고 **소비자 라우트를 1440px 로 전수 측정**했다.
**25곳이 430px 액자**였고, 액자 자체는 2026-06-20 대표 확정("PC 소비자 = 중앙 액자")이라
전부 푸는 것은 틀리므로 셋으로 갈라 올렸다 — 대표가 **A·B·C 전부** 승인.

| 묶음 | 경로 | 왜 |
|---|---|---|
| A 정책·약관 | `/terms` `/terms/seller` `/terms/group-buy` `/terms/influencer` `/privacy` `/refund` `/faq` `/gdpr` | 푸터(풀너비)가 링크하는 긴 문서를 430px 한 칸으로 읽고 있었다 |
| B 사장님·파트너 | `/partnership` `/store/new` `/store/find` `/host` `/host/new` `/my-store` `/influencer` `/influencer/rankings` | `/partners`·`/about`·`/creators`(09-16)와 같은 클래스 — 빈 거터를 소비자 앱 설치 QR 이 채운다 |
| C 소비자 탐색 | `/experience` `/new-openings` `/gb-market` `/area-report` `/interest-list` `/following` `/community-group-buy/new` `/referral` | 대표가 "액자가 맞을 수 있다"는 설명을 듣고도 포함을 택했다 |

## 8. 풀었더니 깨지던 두 곳 (함께 수리)

1. **`/community-group-buy/new`** — 하단 제출 CTA 가 `app-frame-bar` 라
   `body.pc-fullbleed .app-frame-bar { display:none !important }`(index.css:1415)에 걸려 **버튼이 통째로
   사라진다**(에러 0). 클래스를 빼고 `xl:left-56`(사이드바 보정, 풀너비엔 사이드바가 없다)도 함께 제거,
   안쪽을 `ur-content-narrow` 로 묶었다. 그 CSS 규칙은 lg+ 전용이라 **모바일 영향 0**.
2. **`/gb-market`** — 폭 토큰이 없어 1440px 로 퍼졌다 → 헤더·본문에 `ur-content-wide`.

## 9. 실측 (로컬 빌드 1440px, 24곳 전부)

`액자 false · body.pc-fullbleed true · 거터 레일 0`. 약관 본문은 `ur-content-medium` = **1024px 중앙 정렬**.
비회귀: `/influencer/dashboard`·`/settlement`·`/analytics`·`/discover`·`/my-coupons`·`/mypage`·
`/referral/:code` 는 **액자 유지** 확인.

### 🩸 하네스가 두 번 엉뚱한 것을 쟀다 (다음 세션 주의)

1. 보호 라우트 8곳이 "액자"로 보였는데 실제로는 `/login?returnUrl=…` 로 튕긴 **로그인 화면**이었다.
   → `location.pathname` 을 함께 찍어야 구분된다. `localStorage` 에 `user_id`/`user_type` 을 심어 재측정.
2. `/terms`·`/privacy`·`/refund` 는 `dist/client/terms.html` 같은 **정적 파일**이 있어서 로컬 정적 서버가
   SPA 대신 그 파일을 내줬다(라이브는 워커가 SPA 를 준다). → SPA 안에서 `pushState` + `popstate` 로 이동.

## 10. 가드에서 드러난 것 (값진 부분)

- 내가 **오전에 만든 지역 주입 3건의 앵커가 오후 변경으로 전부 낡았다.** 러너의 "복원 실패 의심"이 잡았다.
  낡은 앵커는 **조용히 아무것도 주입하지 않는다** → 재조준.
- 지역 테스트 ②가 `/area-report/*`·`/referral` 을 "액자로 남아야 한다"고 못 박고 있었는데,
  **대표가 C 묶음으로 풀라고 확정**해 기대값이 뒤집혔다 → 정정(머리말에 이력 기록).
- `공구 마켓 폭 토큰` 단언이 **헛돌았다** — `ur-content-wide` 를 헤더에도 넣은 탓에 본문에서 지워도 초록.
  → 본문 컨테이너(`ur-content-wide px-4 pt-4`)로 앵커 교체.

가드: `src/tests/unit/pc-frame-unlock-2026-09-21.test.ts` 43건 +
`scripts/mutations/pc-frame-unlock.mjs` 7건(전부 빨간불) + 지역 5건 재조준 후 재확인.
