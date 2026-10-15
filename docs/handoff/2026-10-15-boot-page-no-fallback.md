# 2026-10-15 — 하드로드·탭 이동의 "페이지 로딩 중" 단계 제거 (상세 서버 렌더 계획 1단계)

대표 지시: *"응 이렇게 할래? 가장 이상적이고 영구적으로"* — 이용권 상세(`/pass/:id`)를 서버 리액트 렌더로
가는 계획(1 상세 JS 줄이기 → 2 서버 안전화 → 3 서버 렌더 + hydrate + 상품별 캐시)의 1단계.
앞 세션 인계: `2026-10-15-page-speed-survey.md` (6절 = 서버 렌더 시험 결과).

## 1. 다음 세션의 첫 액션

1. 이 PR 이 머지·배포됐는지 확인 → **라이브 판정(E4)**:
   스크래치 하네스는 세션 밖이라 없어진다. 같은 방식으로 다시 만든다 —
   Playwright · iPhone 13 · CPU 4배 · 느린 4G(150ms/1.6Mbps) · **MutationObserver 만**(rAF·innerText·getBoundingClientRect 금지 — 4절).
   - `/`·`/vouchers`·`/u/jiwon1228`·`/pass/2919` 하드로드에서 `#root` 에 "페이지 로딩" 글자가 **한 번도 안 나오는지**
   - 홈에서 6초 기다린 뒤 첫 `/pass/` 카드를 눌러 "페이지 로딩" 이 **안 나오는지**
2. 그다음 2단계(서버 안전화) — 상세 렌더 경로에서 window·localStorage 접근을 마운트 뒤로.

## 2. 이번 변경

| 무엇 | 어디 |
|---|---|
| `lazyPage` · `registerBootPage` · `preloadBootPage` · `bootSurface` | `src/lib/boot-page.tsx` (신규) |
| 주소 → 표면 판정 SSOT (워커 + 앱 부팅이 같은 함수) | `src/shared/route-surface.ts` (신규) |
| 첫 렌더 전 `await preloadBootPage(bootSurface())` | `src/main.tsx` |
| 하드로드 표면 19곳 페이지를 lazyPage + 등록 | `App.tsx` · `pages/pc-home/HomeRoute.tsx` · `routes/seller.routes.tsx` |
| 미리받기를 `loadRoute(이름)` 로 (직접 import 금지) | `lib/route-preload.ts` · `GroupBuyFeedCard.tsx` · `BottomNav.tsx` |
| 사업자 유어샵 래퍼 하나로 | `pages/seller-public/lazy-seller-public.ts` (신규) |
| 가드 | `boot-page-2026-10-15.test.tsx` · `check-loader-continuity`(판정 함수로 재조준) · 주입 `scripts/mutations/boot-page-2026-10-15.mjs` 10건 |

## 3. 측정 (같은 라이브 문서 + 로컬 두 빌드 A/B · 느린 4G · CPU 4배 · 5회 중간값)

| 화면 | 페이지가 붙은 시각 전 → 후 | "페이지 로딩 중" 등장 |
|---|---|---|
| 홈 `/` | 3.95 → **3.19초** | 5/5 → **0/5** |
| 교환권 `/vouchers` | 3.01 → **2.50초** | 5/5 → **0/5** |
| 유어샵 `/u/jiwon1228` | 3.13 → **2.79초** | 5/5 → **0/5** |
| 이용권 상세 `/pass/2919` | 2.98 → **2.83초** | 5/5 → **0/5** |
| 홈 카드 → 상세(이동) | 0.38~0.57 → 0.47~0.53초 | 3/3 → **0/3** |

이동은 시간이 거의 같다 — 로딩 화면을 그리던 시간이 상세를 바로 그리는 데로 옮겨갔다.

## 4. 이번에 틀렸던 판단 (제일 값지다)

- **"1단계 = JS 줄이기" 는 틀렸다.** 파일 단위 커버리지로 재 보니 폰에서 한 번도 안 쓰는 JS 를 다 빼도 압축 ~15KB(≈0.1초)다.
  진짜 병목 중 하나는 **React 의 폴백 단계 + 0.5초 공개 지연**이었다.
- **측정 도구가 1초 넘게 부풀렸다.** 매 프레임 `innerText`·`getBoundingClientRect` 로 화면을 읽어 레이아웃을 강제했다(CPU 4배에서 레이아웃 1회 50~300ms).
  가벼운 도구(MutationObserver)로 다시 재니 누를 수 있는 시점이 5.2초 → 3.8초로 나왔다. 앞 세션 6절의 숫자도 같은 방식이라 부풀려져 있다.
- **"JS 를 낮은 우선순위로 같이 받자" 는 기각.** 사진이 0.8 → 1.8초로 늦고 누를 수 있는 시점도 오히려 늦었다. CSS 먼저 순서(2026-10-12)가 맞다.
- **홈 카드 미리받기의 주석 약속이 거짓이었다**(*"첫 클릭에도 폴백 없이 즉시"*). 라이브에서 3/3 로딩 화면이 떴다.
- **부팅이 홈을 UA 로 골랐다** — 렌더러(HomeRoute)는 뷰포트(768px)로 고르는데. CI `chunks` 검사(폰 430 · 데스크톱 UA)가
  PC 홈 청크(lz-homePc·lz-homePc-map)를 잡았다(27 → 30). 앱은 뷰포트를 알므로 `HOME_DESKTOP_QUERY` 로 고친다(워커만 UA 추정).
- **유어샵 표면에 두 페이지를 다 걸었다** — `/u/*` 가 안 그릴 SellerPublicPage 까지 받았다(26 → 28). `isCuratorShopPath` 로 갈랐다.
  ⇒ 부팅 미리받기는 *"그 주소에서 실제로 그릴 것"* 만. 표면은 미리받기 묶음 단위라 그 안에 페이지가 둘일 수 있다.
- 빌드 중 `prerender-main` 의 `window is not defined` 는 **이번 변경과 무관**(App.tsx `PageLoader` 의 기존 줄 · graceful skip).
- 가드 주입 검사기를 `--help` 로 불렀다가 **전체 4,043건 모드가 돌았다**. SIGINT 는 동기 실행 중이라 안 먹어 `kill -9` 했고,
  남은 주입 하나(`sections.routes.ts`)를 `git checkout` 으로 되돌렸다. ⇒ 그 도구는 `--only "<이름>"` 으로만 부를 것.

## 5. 남은 결정·대기

- 2단계(서버 안전화) · 3단계(워커 리액트 렌더 + hydrate + 상품별 캐시 + 눌림 기억) — 대표 승인 범위 안(같은 지시). 잠금 파일 접촉 시 audit log.
- 홈 카드 → 상세 이동의 "누르고 0.5초 동안 반응 없음"은 남았다(상세 첫 렌더 자체가 무겁다 — CPU 4배에서 ~0.25초). 3단계의 hydrate·렌더 가볍게 하기에서 다룬다.
