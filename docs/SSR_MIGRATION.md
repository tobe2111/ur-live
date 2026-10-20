# SSR 마이그레이션 가이드 (메인 페이지 우선)

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
