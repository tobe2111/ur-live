# [UNLOCK_LOADING] 지갑 탭 밑줄이 미끄러진다 — 2026-11-02

- **바꾼 잠금 파일**: `src/pages/MyVouchersPage.tsx` (잠긴 항목: VoucherMap lazy chunk — **불변**)
- **대표 승인 문구(그대로)**: *"허락해줄게 잠금 파일 부분도."*
- **배경**: 모션 3차 "탭 밑줄"은 이 파일이 잠금표라 보류했었다(`docs/design/motion-mockups-2026-11.md`).

## 무엇을
[사용 가능 | 지난 이용권] 탭의 밑줄이 탭마다 따로 켜지던 것을 **밑줄 하나가 미끄러지는** 것으로 바꿨다.
유어샵 칩(`PinCategoryChips`)과 같은 `.ur-tab-bar`(index.css) 를 쓴다.
- 처음 그릴 때(측정 전)는 종전처럼 탭 안에 밑줄을 그린다 → 깜빡임 0.
- 측정은 그릴 때마다 하되 값이 같으면 상태를 안 바꾼다(탭 줄이 로딩 뒤에 생겨 의존성으로 못 잡는다).

## 안 바꾼 것
VoucherMap lazy · 목록·QR 열기 · 데이터 조회. 동작 줄이기면 `.ur-tab-bar` 전환이 꺼진다(index.css).

## 같은 허가로 — 목록 → 상세 화면 전환을 첫 화면 묶음에서 뺐다 (대표 *"셋 다 해줘"* — 공용 묶음 줄이기)
- **바꾼 잠금 파일**: `vite.config.ts` `manualChunks`(규칙 한 줄 **추가**: `/src/lib/deal-view-transition` → `app-deal-vt`) ·
  `src/pages/main-home/GroupBuyFeedCard.tsx`(전환 모듈을 정적 import → 동적 import).
- 카드가 화면에 들어오거나(이미 있던 상세 미리 받기와 **같은 때**) 손가락이 닿을 때 받는다. 아직 안 왔으면 그 클릭은 종전 링크 이동.
- `scripts/surface-chunks.mjs` `LAZY_ENVELOPES` 에 `app-deal-vt` 추가 — 없으면 묶음기가 다시 `lz-common` 으로 옮긴다(빌드 실측: 동적 import 만으로는 안 갈라졌다).
- 실측: **27개 화면 전부 −0.3~0.5KB**(brotli). 미리 받기 세 줄·viewport prefetch·`React.memo`·`rootMargin` 은 불변.

## 같은 허가로 — 이용권 상세 결제창 안 A (대표 *"응 다 해주고"*)
- **바꾼 잠금 파일**: `src/pages/GroupBuyDetailPage.tsx` — `DealBottomBar` 에 `summary`(이름·매장·첫 사진) prop **한 줄 추가**. 
  `__SSR_INITIAL_DETAIL__` 즉시 사용 · CountdownRing/폴링/below-fold lazy 는 불변.
