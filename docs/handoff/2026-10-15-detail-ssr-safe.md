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

## 4. 남은 것 (3단계)
- `useBalance`: `initialData`(localStorage) · `enabled: isLoggedInSync()` — 서버 undefined/false vs 브라우저 값 → 결제 버튼(`allDeal`) 갈림.
- `KakaoShareButton` `isKorea()`(서버는 늘 KR) · `cf-image` Save-Data 품질(데이터 절약 사용자만 URL 이 갈림).
- `BrandLoader` 애니메이션 지연(시간 기반) — 시드가 있으면 안 그려진다.

## 5. 3단계 — 같은 PR 에 넣었다 (워커가 리액트 그대로 상세를 그린다)
| 무엇 | 어디 |
|---|---|
| 서버 렌더 진입점(페이지 그대로) | `src/ssr/pass-detail-entry.tsx` |
| 워커용 한 파일 번들 | `vite.ssr-pass.config.ts` · `npm run build:ssr-pass` → `dist/ssr-pass/` |
| 워커가 번들/스텁으로 푼다 | `scripts/build-worker.js`(`virtual:pass-ssr`) · `src/worker/ssr/pass-ssr-stub.ts` |
| 폰 · `/pass/:id` · 캐시 · 폴백 | `src/worker/utils/pass-ssr.ts` |
| 앱 붙기 전 누름 기억 | `src/lib/early-tap.ts` · `DealBottomBar.tsx` |
| 가드 | `pass-ssr-2026-10-15.test.ts` · `scripts/check-pass-ssr-smoke.mjs`(CI) · 주입 7건 |

측정(로컬 A/B, 8회 중간값): 가격·구매하기 보이는 시각 3.00 → 1.68초 · 첫 페인트 차이 없음 · 앱 붙는 시각 +0.3초.

### 다음 세션의 첫 액션(3단계)
배포 뒤 라이브: `curl -A '<iPhone UA>' https://urdeal.kr/pass/2919 | grep -c 'data-early-tap="buy"'` 가 1 이상 →
Playwright(iPhone 13 · CPU 4배 · 느린 4G)로 구매하기 보이는 시각과 마운트 때 밀림 0 확인.

### 이번에 틀렸던 판단
- 측정 서버가 HTML 을 압축하지 않아 서버 렌더가 첫 페인트를 0.3초 늦추는 것처럼 보였다 — 압축을 켜니 차이가 사라졌다.
- 5회 중간값이 첫 페인트 +0.6초로 나와 원인을 찾았는데 8회로 늘리니 범위가 겹쳤다(잡음). **회차를 늘리기 전에 결론 내지 말 것.**
- 처음 만든 측정기의 '마운트' 판정이 문서가 비어 있는 순간을 마운트로 셌다(83ms) — 첫 화면 노드를 **본 뒤** 사라질 때로 고쳤다.
