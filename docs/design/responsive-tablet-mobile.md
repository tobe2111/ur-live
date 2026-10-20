# 반응형 — 태블릿(1024) & 모바일(390)

**시안 받은 날**: 2026-05-06
**출처**: design-v4.html / v4/pc.jsx (line 1894+)
**상태**: 구현 완료

## 핵심 사양

```
≥1280  PC 풀 레이아웃 (240px 사이드바 + 1200px 메인)
768~1279  태블릿 — 사이드바 collapse (60px, 아이콘만)
<768   모바일 — 기존 모바일 레이아웃 유지 (BottomNav)
```

### 태블릿 (1024px)
- **사이드바 폭**: 60px (아이콘만, 라벨 제거)
- **active 표시**: 좌측 보더 2px `#EF4444` + 배경 `rgba(239,68,68,0.08)`
- **아이콘 영역**: 48px height, 가운데 정렬
- **메인 그리드**: 4열 → 3열 자동 축소
- **메인 패딩**: 24px

### 모바일 (<768)
- 기존 모바일 레이아웃 (BottomNav) 유지
- 기존 시안의 "앱 다운로드 권장 카드"는 별도 옵션

## 현재 vs 시안 차이

| 항목 | 현재 | 시안 | 작업 |
|---|---|---|---|
| 태블릿 사이드바 | 모바일 레이아웃 그대로 (사이드바 미노출) | 60px 아이콘 collapse | DesktopLiveSidebar 추가 모드 |
| 태블릿 그리드 | 모바일 그대로 | 3열 그리드 | breakpoint 조정 |
| 태블릿 BottomNav | 표시됨 | 사이드바로 대체 | xl/lg 브레이크포인트 변경 |

## 구현 todo

- [x] 시안 archive 저장
- [x] DesktopLiveSidebar `collapsed` 모드 추가 (md~xl 범위)
- [x] MobileAppLayout 태블릿 padding `md:pl-[60px]` 추가
- [x] BottomNav `md:hidden` 으로 변경 (이전: `lg:hidden`)
- [x] DesktopTopNav md+ 노출 (이전: lg+)
- [ ] 그리드: `md:grid-cols-3` 로 명시 (이미 lg/xl 정의된 페이지 위주)
- [ ] 검증: 1024px / 1280px / 1920px 3가지 viewport

## 영향 페이지

- `/` (홈) — 그리드 변화
- `/live` — 사이드바 collapse 시 1열 추가 가능
- `/browse` — 그리드 3열
- `/group-buy` — 그리드 3열
- `/wishlist`, `/my-orders` — 1→2열

## 영향 컴포넌트

- `src/components/DesktopLiveSidebar.tsx` (collapsed 모드 추가) ✅
- `src/components/MobileAppLayout.tsx` (padding + 사이드바 활성화 breakpoint) ✅
- `src/components/main/BottomNav.tsx` (`md:hidden`) ✅
- `src/components/main/DesktopTopNav.tsx` (`md:block`) ✅

## ✅ 구현 완료
