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
