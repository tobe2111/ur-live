
## 2026-11-04 후속 — 기본 선택창(`<select>`) 전수 → `<Select>`
대표 *"정산 계좌 등록 부분도 팝업 적용 필요해. 안되어있는거 전체 확인 필요"* — 마이 → 정산 계좌의 은행 고르기가
기본 `<select>` 라 폰에서 휴대폰 기본 목록 창이 떴다.
- 새 부품 `src/components/ui/select.tsx` — 태그 이름만 바꾸는 대체(같은 자식 `<option>`·같은 `onChange(e.target.value)`).
  폰 = 유리 시트, PC = 버튼 아래 유리 목록, 대시보드·light-island 안이면 목록도 라이트.
- 73파일 137곳 변환(운영자 몰 Mall* 3파일 제외). 겹치던 오버레이 화살표 3곳 제거.
- 가드: `no-native-dialogs-2026-11-03` 에 `<select>` 금지 추가 · 부품 동작 시험 `ui-select-2026-11-04.test.tsx`.
- 남은 기본 창: 날짜·시간 입력(`type="date|time|datetime-local|month"`) **32파일** — 달력 부품이 따로 필요해 이번 범위 밖.

## 2026-11-05 — 날짜·시간 입력도 유어딜 것으로 (대표 *"응 유어딜꺼로 바꿔"*)

- 부품 `src/components/ui/date-input.tsx` — `<input type="date|time|datetime-local">` 와 같은 props·같은 값 형식
  (`YYYY-MM-DD` · `HH:MM` · `YYYY-MM-DDTHH:MM`). 폰은 아래 유리 시트, PC 는 칸 아래 유리 달력. 날짜+시간은 날짜를
  고르면 같은 창이 시간으로 넘어간다.
- 이행 30파일(코드모드 29곳 + `AdminHomeServicePage` 의 `type={f.type === 'date' ? …}` 는 손으로 갈랐다).
  Mall* 3파일(공구 서비스)은 범위 밖. 숙소 상세의 날짜 고르기는 이미 자체 달력(`StayDateGuestPicker`)이다.
- 가드: `no-native-dialogs-2026-11-03.test.ts` 셋째 describe(주입: SellerCouponsPage 하나 되돌려 빨간불 확인) ·
  부품 시험 `ui-date-input-2026-11-05.test.tsx` 5건.
- 🩸 **틀린 판단**: 부품 머리말에 처음 *"datetime-local 쓰는 곳 0"* 이라고 적었다 — `type="date"` 만 세고 단정했다.
  실제로는 11곳(마감·예약 발행 시각 등)이었다. ⇒ 세기 전에 변형(`datetime-local`·`type={…}`)까지 grep 할 것.
- 🩸 첫 빌드에서 묶음기가 달력을 이용권 상세 봉투에 넣어 숙소 검색·어드민이 +41KB 를 받았다 → `docs/locks/loading/2026-11-05-date-input-chunk.md`.
