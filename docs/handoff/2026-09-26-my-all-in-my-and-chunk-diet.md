# 마이에서 전부 + 마이 청크 다이어트 (2026-09-26)

> 대표: *"모두 다 마이로 가능하게끔 하고 최적화 필요해. 로딩 속도를 줄이고, 시안도 다시 만들어야겠어."*
> 시안: `docs/design/my-seller-all-in-my-2026-09-26.md` · 렌더본 https://claude.ai/artifact/27VApxxLQkDpiVxtZPt66d

## 1. 다음 세션의 첫 액션

**배포 후 라이브 실측 두 가지** (둘 다 브라우저 네트워크 탭이면 1분):

1. `urdeal.kr/user/profile` 를 **셀러가 아닌 계정**으로 하드로드 →
   요청 목록에 `app-seller-components-*.js` 와 `SellerSection-*.js` 가 **없어야** 한다.
   (있으면 게이트가 새는 것이고, `SellerSectionLazy` 의 조기 반환을 먼저 볼 것.)
2. 셀러 계정으로 마이 → **전체 도구** → 아무 도구나 → **시트 안에서** 열리는지.
   `ExternalLink` 표시가 붙은 다섯만 전체화면으로 나가야 한다.

그리고 **staging 에서만 되는 것**: 시트 안 화면의 버튼이 실제로 눌리는지.
이 세션은 어드민 자격만 있어 셀러 로그인이 필요한 조작을 못 했다 → `STAGING_CHECKLIST.md` S-MYSELL-60~64.

## 2. 이번에 한 것

### 🪟 41개 화면이 복제 없이 마이 시트에서 열린다

`SellerLayout` 에 이미 `bare` 모드가 있었다(이용권 등록 위저드가 쓰고 있었다). 그 모드를
**context** 로 바꿨다(`src/shared/seller-embed.tsx`) — 그러면 **페이지를 한 글자도 안 고치고**
41개가 전부 따라온다. prop 이었다면 41번 뚫어야 하고 몇 개는 반드시 빠진다.

- `tool-pages.ts` — 주소 → 화면 모듈 **36개**(전부 `lazy`) + 제외 **5개**(이유를 값으로)
- `ToolPageSheet.tsx` — 감싸기만 한다: `Sheet` → `light-island` → `SellerEmbedProvider` → 그 화면
- `AllToolsSheet` 이 시트로 열지 내보낼지 **판정해서 넘긴다**(호출부가 다시 판정하면 청크가 붙는다)

### ⏳ 비셀러가 셀러 코드를 안 받는다

| | 전 | 후 |
|---|---|---|
| 마이 정적 폐쇄 | 30 청크 · 1,081.2 KB | **27 청크 · 912.5 KB** |
| `UserProfilePage` 청크 | 118.3 KB | **46.9 KB** |
| 그중 셀러 코드 | 129 KB | **6.0 KB** |
| `app-seller-components` · `app-dashboard` | 폐쇄 안 | **없음** |

세 처방: ① `SellerSectionLazy`(게이트가 `lazy` **바깥**) ② 시트 열넷 전부 `lazy`
③ 나브 색인을 `app-seller-nav` 로 분리.

## 3. 이번에 틀렸던 판단 · 배운 것

### 🩸 내 가드가 헛돌았다 — 건초더미만 소문자로 바꿨다

```js
for (const forbidden of ['token', 'localStorage', ...])
  expect(code.toLowerCase()).not.toMatch(new RegExp(`\\b${forbidden}\\s*[.(]`))
```
`localStorage` 는 **camelCase** 인데 건초더미만 `toLowerCase()` 했다. 주입을 통과시켰고
되돌려-검증이 잡았다. ⇒ **대소문자를 한쪽만 맞추지 말 것.** 지금은 `'i'` 플래그 + "react 말고는
아무것도 import 하지 않는다" 로 이중 고정.

### 🩸 내 **주입**도 헛돌았다 — 첫 문장만 잘랐다

"제외 사유를 비운다" 주입이 여러 줄 문자열의 **첫 문장만** 잘라서 뒤 문장이 남았고,
`length > 20` 을 그대로 통과했다. ⇒ 주입은 **불변식을 실제로 깨뜨려야** 한다.

### 🩸 `--help` 가 전수 실행을 시작했다

`check-guard-mutations.mjs --help` 는 플래그가 아니라 **전수 실행**이다(45~77분).
죽였더니 CLAUDE.md 가 경고한 대로 **주입본이 파일에 남았다**(`admin-system-monitoring.routes.ts`).
⇒ 그 스크립트는 **인자 없이 부르지 말 것.** 쓰려면 `--only "<이름>"`, 그리고 `--only` 는
**정규식이 아니라 부분일치**라 한 건씩 루프로 돌려야 한다.

### 🩸 한 봉투로 묶어 총량을 되찾으려다 실패했다

시트를 `app-my-seller-sheets` 한 청크로 묶어 보니 **총량은 7.56 으로 같은데**
`useSellerWork` 가 봉투로 끌려가 셀러 폐쇄만 936.9 → 1,003.4 KB 로 **커졌다**. 되돌렸다.
(manualChunks 가 `undefined` 를 돌려주면 Rollup 이 공유 모듈을 **다른 소비자 쪽에** 둘 수 있다.)

### 🧭 낡은 앵커 셋을 지우지 않고 재조준했다

`bare` → `bare || embedded` · 정적 import → `lazy(...)` · 예시 나열 → 나열 금지.
지키려던 것은 셋 다 그대로 살아 있었다(마지막 건 오히려 **더 강해졌다**).

## 4. 남은 결정 / 대기

- 🔴 **시안 A(매일 / 가끔 나누기)** — 디자인 판단이라 **구현 안 했다.** 대표 확정 대기.
- 🔴 **`/seller/ad-slots` · `/seller/prospects` · `/seller/proxy-products`** 에 `SellerLayout` 입히기 →
  그러면 이 셋도 자동으로 시트가 된다. 다만 **직접 방문했을 때 사이드바가 붙는다**(모양 변경).
- ⚠️ **시트 안 화면이 `navigate()` 하면 마이를 떠난다.** 도착 화면에 "마이로 돌아가기" 띠가
  뜨므로 길은 안 잃지만 시트가 닫히며 돌아오는 것과는 다르다. **종전과 같은 동작이라 회귀는 아니다.**
- ⚠️ **번들 총 raw 예산 9번째 상향**(7.54 → 7.57). ①(결재 아카이브 140.4 KB)은 2026-09-25 부터
  대표 대기이고, 승인되면 7.50 아래로 되돌아간다.

## 5. 가드

- `src/tests/unit/my-seller-all-in-my-2026-09-26.test.ts` **17건**
- `scripts/mutations/my-seller-all-in-my.mjs` **12건 — 되돌려-검증 전부 빨간불 확인**
- 재조준: `seller-register-stays-in-my.mjs` · `seller-tools-in-my.mjs` · `seller-rest-in-my.mjs` 각 1건
