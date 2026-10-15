# 2026-10-15 — 이용권 상세 서버 안전화 (상세 서버 렌더 계획 2단계)

대표 지시: *"응 이렇게 할래? 가장 이상적이고 영구적으로"* — 1단계(`2026-10-15-boot-page-no-fallback.md`, PR #1865) 다음.

## 1. 다음 세션의 첫 액션
1. 이 변경이 머지됐는지 확인. 화면은 바뀌지 않는다(E3 이상 판정 대상 없음 — 3단계의 전제다).
2. 3단계: 워커가 `/pass/:id` 를 리액트로 그린다(`entry-server` 에 StaticRouter + QueryClient(시드 채움) + HelmetProvider) → 브라우저 `hydrateRoot`.
   - 시험 `detail-server-render-2026-10-15.test.tsx` 의 `tree()` 가 그 조립의 최소형이다 — 그대로 옮겨 쓴다.
   - i18n 은 상세 폐쇄 밖이다 — 서버가 따로 초기화해야 `t()` 결과가 브라우저와 같다.
   - 잔액(`useBalance` localStorage 시드 · `isLoggedInSync`)이 결제 버튼에 주는 갈림을 먼저 막을 것(아래 4절).

## 2. 이번 변경
| 무엇 | 어디 |
|---|---|
| 렌더 중 localStorage 안전 읽기(서버 스냅샷 null) | `src/hooks/useStoredValue.ts` (신규) |
| 상세의 직접 읽기 4곳 → 훅 | `src/pages/GroupBuyDetailPage.tsx` |
| 위치 캐시 파서 분리 | `src/shared/utils/cached-loc.ts` `parseCachedLoc` |
| `useMediaQuery` → useSyncExternalStore(서버=fallback) | `src/hooks/useMediaQuery.ts` |
| 유효기간 한국 날짜 | `src/pages/group-buy/UsageGuide.tsx` |
| 가드 | `detail-server-render-2026-10-15.test.tsx` + 주입 `scripts/mutations/detail-server-render-2026-10-15.mjs` 4건 |

## 3. 이번에 틀렸던 판단
- 첫 hydrate 시험이 옛 코드에서도 빨간불이었는데 **이유가 서버 렌더가 던져서**였다 — 갈림을 잡는지는 따로 증명해야 했다.
  "가드만 두고 첫 렌더에 브라우저 값" 주입으로 따로 재니 회복 오류 11건으로 잡았다.
- 주입 하나를 자리표시로 썼다가(행동을 안 바꾸는 치환) 고쳤다 — 그대로 두면 러너가 *헛도는 가드* 로 실패한다.

## 4. 남은 것 → 3단계에서 확인
- `useBalance`(잔액 캐시 `urq:balance`): 첫 화면에 잔액이 그려지지 않아 갈리지 않는다 — 앱 전체 이어받기 시험에 캐시를 넣고 0건 확인.
- `KakaoShareButton` `isKorea()`: 서버·브라우저 모두 KR 이라 같다.
- `cf-image` Save-Data 품질: 데이터 절약 사용자만 사진 주소가 갈린다 — React 18 은 속성 갈림을 오류로 보지 않고 서버 값을 남긴다(사진은 뜬다). 남겨 둠.

## 5. 3단계 — 앱 전체를 서버가 그리고 브라우저가 **이어받는다** (같은 PR)
대표: 첫 구현(페이지만 그리고 브라우저가 통째로 다시 그림)의 한계를 보고하자 *"계속 해봐 가장 이상적이어야 해. 대기업 수준의 로딩 인프라. 비용은 차이없어도"*.

| 무엇 | 어디 |
|---|---|
| 서버 렌더 진입점(**`App` 전체**, 요청마다 새 QueryClient, `i18nReady`·`preloadBootPage` 대기) | `src/ssr/pass-detail-entry.tsx` |
| 서버 번들은 동적 import 허용목록만(상세 + 한국어 core) — 626KB | `scripts/ssr-dynamic-import-allowlist.mjs` · `vite.ssr-pass.config.ts` |
| 워커: `#root` 에 앱 HTML + `data-ssr="app"`, 누름 기억 스크립트는 `#root` 바깥 · 캐시 키에 주소 | `src/worker/utils/pass-ssr.ts` · `src/worker/index.ts` |
| 한국어 core 문구 head 미리받기(`LOCALE_CORE`) | `scripts/generate-route-chunk-map.mjs` · 워커 head 핸들러 |
| 브라우저: 표식 + 문구 준비 → `hydrateRoot`, 아니면 `createRoot` · 갈림 수 HYD 표본 | `src/main.tsx` · `src/lib/web-vitals-report.ts` · `analytics.routes.ts` |
| 이어받기 우선순위(유휴 → 보통) | `src/lib/hydration-priority.tsx` + `App.tsx` 의 `<HydrationPriority />` |
| 셸 문지기를 영역 안쪽 부품으로 | `App.tsx` `SignedInOnly` · `WideOnly` |
| 앱 붙기 전 누름 → 붙은 뒤엔 React 가 직접(선택적 이어받기) | `lib/early-tap.ts` · `main.tsx`(`__urHydrated`) |
| 가드 | `app-hydrate-2026-10-15.test.tsx` · `pass-ssr-2026-10-15.test.ts` · `check-pass-ssr-smoke.mjs`(CI) · 주입 16건 |

측정(로컬 A/B — 같은 빌드·같은 서버 HTML, 표식만 다르게, iPhone 13 · 느린 4G · CPU 4배, 7회 중간값):

| | 다시 그리기 | 이어받기 |
|---|---|---|
| React 가 클릭을 받기 시작 | 3.51초 | **2.89초** |
| 화면 전체가 붙음(구매 바 이펙트) | 3.51초 | **3.32초** |
| 서버 사진 노드 유지 | 매번 교체 | **유지** |
| 로딩 화면 | 0 | 0 |

### 다음 세션의 첫 액션(3단계)
배포 뒤 라이브:
1. `curl -sS -A '<iPhone UA>' https://urdeal.kr/pass/2919 | grep -c 'data-ssr="app"'` → 1, 같은 응답에 `aria-label="마이"`·가격.
2. 같은 요청 두 번째가 빠른지(캐시 적중 — 번들을 안 부른다).
3. Playwright(iPhone 13 · CPU 4배 · 느린 4G)로 `#root img` 노드가 유지되는지 + 로딩 화면 0회.
4. 하루 뒤 `/api/analytics/summary` 의 `HYD` — p95 가 0 이어야 한다(0 보다 크면 실제 브라우저에서 갈림이 있다).

### 이번에 틀렸던 판단
- **"페이지만 서버에서 그리면 충분하다"** — 가격은 빨리 보였지만 브라우저가 통째로 다시 그려 누를 수 있는 시점이 늦어졌다. 앱 전체를 그려야 이어받을 수 있다.
- **이어받기를 켜자마자 오히려 0.26초 느렸다** — 원인 둘: ① 이어받기 전에 기다리는 한국어 문구가 부팅 뒤에야 받아졌다(head 미리받기로 해소) ② React 18 이 서버 Suspense 영역을 **유휴 우선순위**로 이어받는다(react-dom 소스 `mountDehydratedSuspenseComponent` 확인 → `unstable_scheduleHydration` 으로 해소). **켰다고 빨라진다고 가정하지 말고 같은 조건 A/B 로 잴 것.**
- 처음 갈림 11건 → 렌더 중 직접 읽기 제거로 1건 → 남은 1건은 *"이어받기 영역 바깥의 업데이트"* 였다. uSES 로 바꾸는 것만으로는 부족하고 **읽는 자리가 영역 안쪽**이어야 한다.
- 시험 환경이 `window.location` 을 `/` 로 고정해(tests/setup.ts) 브라우저 쪽이 홈을 그려 갈림이 수백 건처럼 보였다 — MemoryRouter 로 고쳐 재니 실제 원인이 보였다.
- 실행 비용 검사(exec-cost)가 4화면 초과로 나왔지만 **main 자체가 이 기기에서 이미 초과**(어드민 539.5 vs 기준 529.8)였다. 같은 측정기로 main 빌드와 대조하니 이 변경분은 어드민 +2.5KB · 교환권 −2.8KB(허용 4KB 안). 기준값은 CI 크로미움이 판정하므로 로컬에서 다시 잠그지 않았다.
