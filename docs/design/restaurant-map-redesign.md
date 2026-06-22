# 동네딜 지도(`/restaurant-map`) 야놀자식 재설계

시안: `docs/design/assets/restaurant-map-yanolja-ref.jpg` (대표 제공 2026-06-22)

## 시안 핵심 (야놀자 지도)
1. **상단**: 카테고리 칩(숙소/레저 …) 가로 줄이 지도 위에 떠 있음. 검색은 큰 입력창이 아니라 작게.
2. **지도**: 화면의 ~65~70% (넓음).
3. **하단**: 납작한 **가로형 카드 1장**(사진 좌 + 이름/별점/가격 우) — 옆으로 스와이프되는 캐러셀. 선택 핀이 큰 지도 중앙에.
4. 플로팅 **'목록'** 버튼 + 현위치 버튼.

## 현재 vs 시안
| 항목 | 현재 | 시안 |
|---|---|---|
| 검색 | 상단 full-width 검색바(MapSearchHeader) | 작은 **아이콘 버튼**(탭 시 확장) |
| 카테고리 칩(내주변/전체/식사…) | **하단 시트 안**(SheetFilterBar) | **상단**으로 이동(지도 위 플로팅) |
| 선택 카드 | 하단 시트 peek=**320px**(세로 카드) → 지도 좁음 | 납작한 **가로 카드**(~140px) → 지도 넓음 |
| 중앙 정렬 | 시트가 커서 핀이 시트 근처 | 넓은 지도의 진짜 중앙 |

## 구현 todo
- [x] 시안 이미지 archive + 본 문서
- [x] **MapTopBar** 신규 — 지도 위 상단 플로팅: 카테고리 칩(내주변+전체/식사/뷰티/헬스/숙소/반려/액티비티) 가로 스크롤 + **검색 아이콘 버튼**(탭→인라인 입력 확장, 기존 검색/히스토리 재사용) + 필터 아이콘(activeFilterCount). 정렬은 FilterSheet 로 위임(인라인 제거). MapSearchHeader(full 검색바) 대체.
- [x] 지도 영역 확대 — 상단은 플로팅(지도 inset-0 유지), 선택 시 하단은 납작 카드만.
- [x] **선택 모드 = 납작한 가로 카드**(SelectedDealCard, ~132px, 하단 네비 위 플로팅). 좌우 스와이프/‹›버튼 → 인접 딜 이동 + 지도 recenter. 탭→상세, X→해제(리스트 복귀). n/total 인디케이터.
- [x] 시트는 미선택 시에만 표시 + 칩 제거(SheetFilterBar `hideChips` — 리스트 모드는 칩 유지). 선택 시 시트 숨김 → 지도 최대.
- [x] `centerOffsetForSheet` 에 `'card'`(납작 카드) 높이 반영 → 넓은 지도 중앙에 핀. 핀 클릭/리스트 클릭/스와이프 모두 'card' 기준.
- [x] tsc 0 + build:client 0 + 테마 일관성 0. (⚠️ Kakao 실지도 모바일/PC 실측 권장)

## 보존
- `mode==='list'`(홈 당근식 리스트)·SheetFilterBar(리스트 모드에서 계속 사용)·FilterSheet(지역/정렬/반경/가격)·지오코딩·정렬/필터 술어·핀(상품사진) 로직 불변.
- panToProduct/centerOffsetForSheet projection 보정 유지.

## 진행
- branch `claude/cool-rubin-16gtlu` / PR #398.
