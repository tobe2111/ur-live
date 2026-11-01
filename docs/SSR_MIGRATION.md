# SSR 마이그레이션 가이드 (메인 페이지 우선)

> 🔴 **이 문서의 2026-05~07 절은 역사 기록이다. 지금 상태는 맨 아래 [2026-11-01](#-2026-11-01--prerender-는-끝났다-그-단계는-검사기가-됐다) 절을 먼저 읽을 것.**
> 그 절들이 약속하는 *"`view-source` 에 `data-ssr="main"` 이 보이면 확정"* 은 **더는 성립하지 않는다** —
> prerender 는 2026-11-01 부터 **파일을 쓰지 않는다**(라이브가 그 산출물을 100% 버리기 때문).
> 그 문장을 그대로 믿으면 멀쩡한 빌드를 "prerender 실패" 로 오진한다.

**시작**: 2026-05-28
**진행 책임자**: TBD
**예상 완료**: 4-7일 (메인 페이지만)

## 🎯 목표

| Metric | 현재 | 목표 |
|---|---|---|
| Performance (모바일 Lighthouse) | 66 | **85-92** |
| LCP | 10.7s | **0.5-1.5s** |
| FCP | 2.1s | **0.3-0.6s** |
| TBT | 300ms | 300ms (변화 없음) |
| CLS | 0 | 0 (유지) |

## 📋 진행 계획 (Phase 별)

### Phase 1: 인프라 셋업 (1일) — **현재 commit 적용**
- [x] `src/entry-server.tsx` 신규 — StaticRouter + renderToString
- [x] `src/entry-client.tsx` 신규 — hydrateRoot + BrowserRouter
- [x] `vite.config.ts` SSR build target 추가
- [x] `package.json` `build:ssr` script
- [ ] 다음 commit: main.tsx → entry-client.tsx 분리

### Phase 2: 메인 페이지 컴포넌트 SSR-safe (1-2일)

**대상 컴포넌트 약 30-50개** (메인 페이지 trees):
- `MainHomePage`
- `main-home/GroupBuyFeed`, `GroupBuyFeedCard`, `GroupBuyGuideCard`
- `components/main/SiteFooter`, `BottomNav`, `DesktopTopNav`, `DesktopLiveSidebar`
- `components/brand/UrDealLogo`
- `components/SEO`
- 이들의 의존성 (lucide-react, helmet, i18n, React Query)

**Audit Checklist (각 컴포넌트)**:
- [ ] `window.` 직접 접근 → `useEffect` 또는 `typeof window === 'undefined'` 가드
- [ ] `localStorage.` 직접 접근 → useEffect
- [ ] `document.` 직접 접근 → useEffect
- [ ] `navigator.` 직접 접근 → useEffect
- [ ] 외부 SDK import (kakao-sdk, toss, firebase) → dynamic import 안에서만
- [ ] `useLayoutEffect` → `useEffect` 또는 `useIsomorphicLayoutEffect`

**SSR 시 위험 패턴**:
```ts
// ❌ render 함수 안에서 직접 접근 — SSR 에러
const isLoggedIn = !!localStorage.getItem('user_id')

// ✅ useEffect 안 (client only)
const [isLoggedIn, setIsLoggedIn] = useState(false)
useEffect(() => {
  setIsLoggedIn(!!localStorage.getItem('user_id'))
}, [])

// ✅ 또는 typeof window 가드 + initial state
const [isLoggedIn] = useState(() =>
  typeof window !== 'undefined' && !!localStorage.getItem('user_id')
)
```

### Phase 3: prerender script (1일)
- [ ] `scripts/prerender-main.mjs` 신규
  - API 호출: `/api/group-buy/products?status=active&category=all`
  - React `renderToString(<App initialData={...} url="/" />)` 호출
  - `dist/client/index.html` 의 `<div id="root">` 안에 HTML inject
- [ ] `package.json` `build` script 에 prerender step 추가

### Phase 4: Cloudflare Pages 라우팅 (반나절)
- [ ] 메인 (`/`) = 정적 prerender HTML 우선 (worker 안 거침)
- [ ] 다른 페이지 = worker (현 그대로)
- [ ] `_routes.json` 또는 `_headers` 설정

### Phase 5: 검증 + 배포 (1일)
- [ ] 빌드 + 로컬 검증
- [ ] Cloudflare Pages 배포
- [ ] 카카오 OAuth / hydrate 정상 동작
- [ ] Lighthouse 재측정 → LCP 0.5-1.5s 확인
- [ ] 사용자 보고 검증

## ⚠️ 위험 영역

### High 위험
- **카카오 OAuth** (KakaoCallback 등) — window.location, sessionStorage 직접 사용
- **결제 (Toss V2)** — CLAUDE.md 잠금 영역, 위젯 SDK 등
- **Firebase Auth** — window 의존 큼
- **라이브 송출** (Streaming, OBS) — WebRTC, browser API

### Medium 위험
- **i18n** (react-i18next) — language detection 시 navigator 사용
- **React Query** — initial data hydration 필요

### Low 위험
- **카드 컴포넌트** — useState/props 위주 (이미 React.memo)
- **SEO (helmet)** — server-side 기본 지원

## 🔄 점진 적용 전략

1. **메인 페이지만 먼저** (가장 ROI 큼)
2. 효과 검증 후 확장:
   - 큐레이터 페이지 (`/u/:handle`)
   - 공구 상세 (`/group-buy/:id`)
   - 쇼핑 (`/browse`), 교환권 (`/vouchers`)
3. 셀러/어드민/에이전시 = SSR 불필요 (인증 페이지)

## 📊 audit 통계 (시작 시점)

- 전체 컴포넌트 파일: **503**
- `localStorage` 직접 사용: **199 곳** (모두 audit 필요)
- `window` 직접 사용: **103 곳**
- `document` 직접 사용: **68 곳**
- 이미 SSR-safe (`typeof window` 가드): 20 곳

## 🛠️ 사용 도구

- **Vite SSR mode** (`vite build --ssr`)
- **react-router-dom v6** (`StaticRouter`)
- **react-dom/server** (`renderToString`)
- **react-helmet-async** (SSR 기본 지원)
- **@tanstack/react-query** (`dehydrate` / `hydrate`)

## 🔗 참고

- Vite SSR 가이드: https://vitejs.dev/guide/ssr
- React 18 SSR: https://react.dev/reference/react-dom/server/renderToString
- React Router SSR: https://reactrouter.com/en/main/guides/ssr

## ✅ 본 commit 적용

**Phase 1 인프라**:
- `src/entry-server.tsx` placeholder (다음 세션 진짜 구현)
- `src/entry-client.tsx` placeholder
- `vite.config.ts` SSR build target 옵션
- `package.json` `build:ssr` script

빌드 영향 0 — `npm run build` 변화 없음.
다음 세션 = Phase 2 본격 진행.

---

## ✅ 2026-05-31 — Phase 2 메인 트리 SSR-safe audit + 1차 fix

인프라(entry-server `renderToString` + `prerender-main.mjs` HTML inject)는 이미 구현 완료.
`build` 의 `prerender:main || echo skip` 로 **graceful** — prerender 가 throw 하면 SSR 만 건너뛰고
빌드는 성공(메인 백지 위험 0). 따라서 핵심 = **메인 `/` 트리의 render-path 브라우저 전역 접근 제거**.

### 메인 트리 정적 audit 결과 (entry tree: App → MainHomePage + shell)
| 대상 | 판정 |
|---|---|
| `utils/auth.ts:isLoggedInSync()` | ❌ **유일한 실제 throw** — `localStorage` 직접 접근(try-catch 없음). DesktopTopNav 렌더 + useUnreadCount/useCartCount `enabled` 에서 호출 → **`typeof localStorage` 가드 추가 (fixed)** |
| `hooks/queries/localCache.ts readCache/writeCache` | ✅ try-catch 로 ReferenceError 흡수 — 안전 |
| `shared/stores/useAuthKR.ts loadTokenCacheFromStorage` | ✅ try-catch — 안전 |
| `shared/stores/useTheme.ts` (모듈레벨 readMode/applyToDocument) | ✅ 모든 접근 try-catch — 안전 |
| `i18n.ts` (LanguageDetector init) | ✅ `void bootstrap()` async + `useSuspense:false` + `typeof window` 가드 + 검출기 내부 try-catch — 안전 |
| `App.tsx` (window.location/localStorage 다수) | ✅ 전부 `useEffect`/핸들러 내부 (렌더 경로 pure, 주석 명시) |
| `main-home/GroupBuyFeed.tsx:66` document.getElementById | ✅ `typeof document` 가드 + try-catch (useMemo) |
| `BottomNav.tsx:36` window.location.href | ✅ onClick 핸들러 내부 |

→ 정적 분석상 **메인 트리는 SSR-safe**. (단, 빌드 실행 불가 환경에서 작업 — transitive dep 의 잠재 throw 는 아래 명령으로 확인 필요)

### ⚠️ 다음: 로컬에서 prerender 실제 동작 검증 (필수)
```bash
npm run build:client && npm run build:ssr && npm run prerender:main
# 성공: "[prerender-main] dist/client/index.html 갱신 완료 ✅"
#        + dist/client/index.html 의 <div id="root" ... data-ssr="main"> 에 카드 HTML 존재
# throw 시: 에러 메시지가 어느 module 의 어느 전역인지 정확히 표시 → 위 audit 패턴으로 가드 추가
```
throw 가 더 나오면 그 파일만 `typeof window/document === 'undefined'` 가드 또는 useEffect 이동.
Phase 4(`_routes.json`) / Phase 5(Lighthouse) 는 prerender 성공 확인 후 진행.

## ✅ 2026-05-31 — `/` 렌더 트리 SSR-safe 전수 정적 검증 완료

이 환경은 vite 미설치로 build:ssr/prerender 직접 실행 불가 → **정적 전수 검증**으로 대체:
- 모듈 top-level 브라우저 전역 접근: **0건** (import-time throw 없음)
- `/` 렌더 트리(App 셸 + 프로바이더 + MainHomePage 트리) render-path 접근: **isLoggedInSync 하나뿐 → 수정 완료**
  - 셸(BottomNav/ScrollToTop/InAppBrowserBanner/ThemeProvider 등): 전부 useEffect/typeof 가드
  - `/` 라우트 = `<Route path="/" element={<MainHomePage/>}>` — **가드(PublicRoute/ProtectedRoute) 미래핑** → RouteGuards localStorage 호출 안 됨
  - ThemeProvider: 두 useEffect 모두 `typeof window` 가드
  - MainHomePage 직접 import(SiteFooter/SEO/UrDealLogo/GroupBuyFeed): render-path 접근 0
  - GroupBuyFeed `__SSR_INITIAL_MAIN__` 읽기: `typeof document` 가드 + try-catch (useMemo)

**결론**: isLoggedInSync 수정이 포함된 현재 배포에서 prerender 가 **성공할 것**으로 높은 신뢰도. (이전 배포는 이 throw 로 skip → LCP 8-11s 유지였을 가능성.)

**최종 확정(사용자/CI)**: Actions 빌드 로그 `[prerender-main] ... ✅` 또는 `view-source` 의 `<div id="root" data-ssr="main">`. 이 둘 중 하나만 확인하면 LCP 개선 확정.

---

## 🔬 2026-11-01 — prerender 는 끝났다. 그 단계는 **검사기**가 됐다

`scripts/prerender-main.mjs` → **`scripts/check-ssr-render-window.mjs`**(`npm run check:ssr-render`).
**HTML 을 파일에 쓰지 않는다.** 하는 일은 하나다 — 앱 트리 전체를 Node 에서 렌더해 **렌더 중
`window`/`document` 접근을 잡는다.**

### 왜 (전부 실측)

| 실측 | 값 |
|---|---|
| 라이브가 구운 `#root` 를 쓰는가 | **아니오.** 워커가 모든 HTML 응답에서 교체(첫 화면 분기 + **catch-all `else`**) |
| 우회 경로 | 없음. `/index.html` → Pages **308 → `/`** · 검색 크롤러는 봇 셸(`app.get('*')`) |
| `#root` 를 읽는 가드 | **0개** |
| 수리 전 구워진 내용 | `#root` **1,298B** · `role="status"` = **BrandLoader 스피너** |
| 그 원인 | 호출부가 2번째 인자로 `null` → `renderAppComplete(url, timeoutMs = 20000)` → `setTimeout(…, null)` = **0ms** → 즉시 `renderToString` 폴백. **`allReady` 가 한 번도 돈 적이 없다** |
| 인자를 빼면 | 107ms · **20,192자** · 에러 0 · Suspense 실패 **1 → 0** |
| 그 대가 | `index.html` **28,568 → 47,860B (+19.3KB)** — 그 19KB 를 매 응답에서 워커가 파싱한 뒤 **버린다** |

⇒ **둘을 같이** 했다: `allReady` 를 켜서 검사 범위를 **앱 트리 전체**로 넓히고(2026-07-05 가 고치려던
*"스피너만 구워진다"* 해소) 산출물은 **쓰지 않아** 낭비를 0 으로 만든다.

🔒 **안전 근거**: 이 단계는 몇 달간 매 빌드 죽어 있었고(= `index.html` 이 갱신되지 않았고) 그동안
라이브는 멀쩡했다. "쓰지 않는 상태" 는 이미 프로덕션에서 검증된 상태다.

### 실패를 어디서 막나 — **비대칭이 의도다**

| 자리 | 동작 | 이유 |
|---|---|---|
| `npm run build` | **소리만** 낸다(`\|\| echo` 가 exit code 를 삼킨다) | 앱 트리 전체를 Node 에서 렌더하므로, 의존성 하나가 모듈 평가 중 `window` 를 읽으면 그날부터 **main 배포가 통째로 멎는다** |
| `verify.yml`(PR) | **`--strict` → `exit 1`** | 머지를 막는 자리는 배포가 아니라 PR |

⚠️ 이 비대칭을 지우지 말 것: strict 를 빌드 체인으로 옮기면 긴급 수정이 막히고, PR 게이트를 빼면
이 검사가 **다시 로그 속 침묵**이 된다(그게 원 사고의 원인이었다).

### 검증 방법 (지금의 올바른 절차)

```bash
npm run build:ssr && npm run check:ssr-render          # 빌드 체인과 같은 모드(소리만)
npm run build:ssr && node scripts/check-ssr-render-window.mjs --strict   # PR 게이트와 같은 모드
# 성공: "[ssr-render-window] ✅ 결함 0 — 렌더 중 브라우저 전역 접근 없음(앱 트리 전체)"
```

❌ **`dist/client/index.html` 에서 `data-ssr="main"` 을 찾지 말 것** — 이제 안 생긴다(그게 정상이다).

### 짝 — 같은 불변식을 두 층에서

- **소스 렌더**(PR, 1.9초): `src/tests/unit/ssr-render-window-2026-11-01.test.tsx` — `/`·`/videos`·`/seller`
- **번들 렌더**(PR, 빌드 뒤): `scripts/check-ssr-render-window.mjs --strict` — 앱 트리 전체 + lazy 모듈

🔴 **`entry-server.tsx` 머리말의 "lazy 는 safe" 는 2026-11-01 에 정정됐다** — `allReady` 는 lazy
모듈을 끝까지 평가한다. 그 오해가 이 결함의 사각지대였다.

### 아직 안 한 것

렌더 중 `document.body` 를 읽는 **잠든** 두 자리(`CustomModal.tsx` · `main/AppDownloadModal.tsx` 의
`createPortal`). 지금은 SSR 경로에 없어 검사기가 안 잡지만, 그 모달이 서버 렌더 경로에 들어오는 날
같은 모양으로 터진다.
