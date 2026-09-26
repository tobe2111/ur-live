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

- 🔴 **세 번째 낡은 지도 — 이번엔 내가 사실을 틀리게 쟀다(가장 값진 부분).** 푸시 후 CI 가
  **선재 테스트** `groupon-detail-map.test.ts:260` 으로 빨간불을 냈다: `expect(fb).not.toMatch(/'\/referral'/)`
  — *"`/referral` 은 `app-frame-bar` 를 써서 일부러 제외했다"*. 나는 §7 작업 중 *"`/referral` 의
  `app-frame-bar` 는 0건"* 이라고 적었는데 **그게 틀렸다.** `ReferralPage.tsx:206` 에 그 바가 있다.
  🔑 **그런데 옛 주석도 틀렸다** — 바를 가진 것은 `ReferralPage`(`/referral/:code`, App.tsx:998)이고
  `/referral` 은 바가 없는 **`ReferralIndexPage`**(App.tsx:950) 다. 즉 **둘 다 경로를 잘못 짚었고**,
  실제로 막아야 할 것은 접두사 `/referral/` 였다(우리는 그걸 등재하지 않았으므로 라이브 동작은 처음부터
  옳았다 — 틀린 건 *근거*였다). 문자열 금지 → **판정 함수**(`isFullBleedPcPath('/referral/ABC123')`)
  + 두 페이지의 바 유무 전제로 재조준. 주입 1건 추가(`/referral/` 접두사) **빨간불 확인**.
- 🩸 **왜 로컬에서 못 잡았나**: 내 테스트 두 개만 돌렸고, **같은 SSOT 를 읽는 선재 테스트**는 안 돌렸다.
  pre-push 게이트는 가드 99개를 돌리지만 **vitest 전체는 안 돈다**(그건 CI 몫).
  ⇒ **SSOT 파일을 고쳤으면 그 파일을 읽는 테스트를 전부 찾아서 함께 돌릴 것**:
  `grep -rln 'pc-fullbleed\|isFullBleedPcPath' src/tests/` → 이번 경우 **5개**(groupon-detail-map ·
  pass-route-migration · ushop-a3-p1 + 신규 2개). 이 한 줄이면 CI 한 바퀴(실측 **약 7분**)를 안 태운다.
- 🩸 **그리고 그 한 줄로도 부족했다**(2026-09-23, `/store/new` PR #1535 에서 같은 날 재발).
  `StoreRegisterModal.tsx` 를 고치고 이름으로 grep 해 테스트 9개를 돌렸는데 CI 가 **열 번째**에서
  빨간불을 냈다 — `seller-d3-2026-09-15.test.ts` 의 "옛 패턴 0" 래칫은 **파일 이름을 안 쓴다**.
  `git ls-files ':(glob)src/components/seller/**/*.tsx'` 로 **경로 글롭**을 훑으므로 이름 grep 에
  구조적으로 안 걸린다(내가 넣은 `rounded-2xl` 이 그 금지 목록에 있었다).
  ⇒ **이름 grep 에 한 줄을 더한다**: `grep -rln 'git ls-files' src/tests/` (현재 **7개**) 를 열어
  바꾼 파일이 그 글롭 밑에 있는지 본다. 둘 다 몇 초면 끝난다.
- 🩸 **세 번째 변주 (2026-09-24, PR #1540)** — 이번엔 **코드가 아닌 파일**에서 났다.
  `docs/decisions/*.md` 두 개를 고쳤는데 스윕은 코드 파일(`StoreOwnerClaimPage`)만 했고,
  `ai-team-operating-model.test.ts` 가 **결재함 폴더를 통째로 훑어** `상태:` 줄 형식을 검사한다
  (`/^상태: (open|approved|rejected|expired)$/m` — **정확히 한 단어**). 내가 그 줄 뒤에 요약을 붙여
  빨간불이 났다. `pre-push` 게이트는 **가드 스크립트만** 돌고 vitest 는 안 돌아서 로컬은 초록이었다.
  ⇒ **바꾼 파일이 `src/` 밖이어도 스윕한다.** 다만 디렉터리 grep 은 너무 거칠다(`src/pages` 는 220개가
  걸린다) — **`docs/`·`scripts/` 같은 비코드 경로만 디렉터리로**, 코드는 파일명 + 글롭 래칫으로.
  세 줄이면 끝난다:
  ```bash
  git diff --name-only origin/main...HEAD            # 바꾼 것 전부 — src/ 밖도 본다
  grep -rln "<바꾼 코드 파일명>" src/tests/           # 이름
  grep -rln 'git ls-files\|docs/decisions\|docs/design' src/tests/   # 폴더째 훑는 가드
  ```

가드: `src/tests/unit/pc-frame-unlock-2026-09-21.test.ts` 43건 +
`scripts/mutations/pc-frame-unlock.mjs` **8건**(전부 빨간불) + 지역 5건 재조준 후 재확인 +
선재 `groupon-detail-map.test.ts` 재조준.
