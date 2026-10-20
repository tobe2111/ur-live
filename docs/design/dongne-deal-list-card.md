# 동네딜 리스트 카드 — 당근 리스트형 리디자인

> 대표 지시 (2026-06-22): "당근 상품들 카드 형태"처럼 우리 공구 상품 카드를 **전체 리디자인**.
> 핵심 인사이트(대표): *"우리 서비스는 지금 플로팅 카드 느낌이고, 당근은 가로 줄을 다 쓴다."*

## 레퍼런스

- **당근(Karrot) 리스트 카드**: `docs/design/refs/karrot-list-card-ref.jpg`
- **우리 현재 카드**: `live.ur-team.com/`(= `RestaurantMapPage` `mode='list'`) 의 가로형 카드 `RestaurantList.tsx`
  (김밥천국 · 9.1km · 25,000원 · "구매" 버튼)

## 현재(카드형) vs 당근(리스트형) 차이

| 구분 | 우리 (기존) — **카드형(floating)** | 당근 — **리스트형(full-bleed row)** |
|---|---|---|
| 컨테이너 | 둥근 박스 `rounded-2xl` + 배경/그림자/보더 → "떠 있는" 카드 | 박스 없음, 가로 폭 꽉 채움 |
| 항목 구분 | 카드끼리 `space-y-3` gap | 얇은 구분선(hairline `divide-y`) 1px |
| 밀도 | 여백 많음(한 화면 적게) | 조밀(한 화면 많이), 빠른 스캔 |
| 색감 | 분홍 액센트(`bg-pink-500`/`text-pink-500`) | 무채색 + 썸네일만 컬러 (B&W) |
| CTA | 항목마다 "구매" 버튼 | 버튼 없음, 줄 전체 탭 |
| 썸네일 | 72px `rounded-xl` | ~88–100px `rounded-lg` |

## 대표 결정

- 방향: **당근 스타일 전체 리디자인** (AskUserQuestion)
- 반응 지표(채팅/관심수): **불필요** (제외)
- "구매" 버튼: **카드 전체 탭 (버튼 제거) — 당근식**

## 구현 (`src/pages/restaurant-map/RestaurantList.tsx`)

- [x] 카드 박스 제거 → `divide-y divide-gray-100 dark:border` full-bleed 행
- [x] 항목 사이 hairline divider, gap 제거
- [x] 썸네일 72→88px, `rounded-xl`→`rounded-lg`
- [x] "구매" 버튼 제거 → 줄 전체 탭(`onSelect`)
  - 리스트 모드(`/`): `onSelect = navigate('/products/:id')` → 상세 이동 (당근식)
  - 지도 모드: `onSelect = selectAndPan` → 포커스 + `SelectedFocusCard`의 "구매하기"가 CTA 담당 (동선 보존)
- [x] 색상 B&W 통일: 할인 뱃지 `bg-red-500`→`bg-gray-900 dark:bg-white`, 거리 `text-pink-500`→`text-gray-600 dark:text-gray-300` (SelectedFocusCard 정합)
- [x] 선착순(fcfs) "지원" 버튼은 유지 — 탭(=네비)과 다른 기능 액션이라 필요
- [x] 로딩 스켈레톤도 flat(divider + 88px)으로 정합
- [x] 미사용 `useNavigate` import 제거

### 영향 범위
- `RestaurantList`는 두 곳에서 공유: ① 리스트 풀페이지(`mode='list'`, 홈) ② 지도 바텀시트. 둘 다 동일 카드 → 함께 당근화.
- 잠금 파일 아님(로딩/Toss 잠금 목록 외). SSR/캐시 표면 무관(렌더 컴포넌트만).

## ✅ 구현 완료
- commit: (아래 push 시 기록)
- 검증: `tsc --noEmit` 0 · `check-theme-consistency` 통과
