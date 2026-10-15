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
