
## 2026-11-04 후속 — 기본 선택창(`<select>`) 전수 → `<Select>`
대표 *"정산 계좌 등록 부분도 팝업 적용 필요해. 안되어있는거 전체 확인 필요"* — 마이 → 정산 계좌의 은행 고르기가
기본 `<select>` 라 폰에서 휴대폰 기본 목록 창이 떴다.
- 새 부품 `src/components/ui/select.tsx` — 태그 이름만 바꾸는 대체(같은 자식 `<option>`·같은 `onChange(e.target.value)`).
  폰 = 유리 시트, PC = 버튼 아래 유리 목록, 대시보드·light-island 안이면 목록도 라이트.
- 73파일 137곳 변환(운영자 몰 Mall* 3파일 제외). 겹치던 오버레이 화살표 3곳 제거.
- 가드: `no-native-dialogs-2026-11-03` 에 `<select>` 금지 추가 · 부품 동작 시험 `ui-select-2026-11-04.test.tsx`.
- 남은 기본 창: 날짜·시간 입력(`type="date|time|datetime-local|month"`) **32파일** — 달력 부품이 따로 필요해 이번 범위 밖.
