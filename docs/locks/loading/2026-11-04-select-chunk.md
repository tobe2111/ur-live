# [LOADING_ADDITIVE] 유어딜 선택창을 작은 전용 봉투로 — 2026-11-04

- **바꾼 잠금 파일**: `vite.config.ts` `manualChunks` — catch-all(`app-components`) **앞에** 규칙 한 줄 추가(`app-select`).
  기존 규칙은 **불변**(추가만 — 약화·제거 0).
- **왜**: 기본 `<select>` 를 `components/ui/select.tsx`(유어딜 선택창)로 바꾸자(대표 *"정산 계좌 등록 부분도 팝업 적용 필요해. 안되어있는거 전체 확인 필요"*),
  그 부품이 catch-all 에 떨어져 **마이 판매 구역·에이전시 콘솔이 lucide 봉투(실행 +34KB)까지** 받았다
  (`check-exec-cost` CI 실측 +48KB). 부품 의존은 react·react-dom 뿐이라 4.9KB 봉투로 분리.
- **결과(로컬 하네스)**: 마이 판매 구역 실행 362.7 → 314.3KB · 에이전시 콘솔 444.0 → 395.0KB(둘 다 기준 안).
  첫 화면에 선택창이 있는 5화면(search·stays·lifePro·dash:my·dash:admin)은 +1.8KB — 기본 창 대체의 비용이라
  `surface-budgets` 기준을 사유와 함께 갱신(lazy 로 미루면 첫 탭이 늦어져 하지 않음).
- **아이콘**: 같은 이유로 부품 안 화살표·체크는 lucide 대신 직접 그린 SVG.
- **롤백**: 규칙 한 줄 제거(그러면 위 두 화면 실행 비용이 다시 늘어난다).
