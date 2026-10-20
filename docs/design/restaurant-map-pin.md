# 동네딜 지도(`/restaurant-map`) 핀 아이콘 — 상품 사진 핀

## 배경 (대표 요청 2026-06-22)
- "지도에 있는 이 아이콘 변경을 하면 좋을 것 같은데… 이건 흑백일 필요도 없어."
- 기존 핀: 흰 원 + 카테고리 이모지(🍽️💇💪🐶🏨🎯) + 모서리 배지(할인%/LIVE/❤/+N). (2026-06-20 B&W 핀으로 통일했던 것)
- 색 사용 허용됨 → 더 시각적인 핀으로 교체.

## 결정 (AskUserQuestion)
**상품 사진 핀** 채택 (3개 안 중):
1. ✅ **상품 사진 핀** — image_url 원형 썸네일 + 카테고리 컬러 링 + 할인% 배지 (당근/배민 스타일, '딜 지도' 차별화)
2. 컬러 카테고리 핀 (물방울 + 카테고리색 + 흰 아이콘)
3. 가격 라벨 핀 (가격 pill)

## 구현 (`src/pages/restaurant-map/useKakaoMap.ts`)
- 개별 마커(클러스터 아님)를 흰 원+이모지 → **상품 썸네일 원형 핀**으로 교체.
- 썸네일: `cfImage(r.image_url, { width: 96, height: 96, fit: 'cover', format: 'auto' })` — WebP 최적화(핀당 ~5-10KB). cf-image.ts 는 **호출만**(잠금 — 수정 X).
- 카테고리 컬러 링 `categoryColor(cat)`: 식사=앰버 `#f59e0b` / 뷰티=핑크 `#ec4899` / 헬스=에메랄드 `#10b981` / 반려=바이올렛 `#8b5cf6` / 숙소=블루 `#3b82f6` / 액티비티=레드 `#ef4444`. 라이브는 링을 잉크 `#111827` 로 강조 유지.
- 사진 없음/로드 실패 → 뒤에 깔린 이모지 span 폴백 (CSP 로 inline onerror 불가 → `addEventListener('error')` 로 img 제거 → 이모지 노출).
- 모서리 배지(할인%/LIVE 펄스/❤/+N 그룹)·클러스터 버블·선택 강조(확대 + 잉크 외곽 링)는 유지.

## 같이 처리한 것 — 핀 중앙 보정 동적화
- "공구 상품을 누르면 지도 한가운데로" + "중앙 기준이 하단 시트 크기에 따라 달라짐" 지적 반영.
- `centerOffsetForSheet(snap)` — 보이는 지도 영역(상단 검색바 아래 ~ 하단 시트 위)의 중앙으로 핀을 끌어올리는 px 오프셋을 시트 snap(peek/mid/full)·뷰포트(lg)에 맞춰 동적 계산. Kakao projection 으로 panTo.

## ✅ 구현 완료
- PR #398 (branch `claude/cool-rubin-16gtlu`).
- 검증: `tsc --noEmit --skipLibCheck` 0 (기존 baseUrl deprecation 제외).
- ⚠️ Kakao 실지도 필요 — staging/prod 모바일·PC 실클릭 1회 확인 권장(사진 로드/폴백/중앙 배치).
