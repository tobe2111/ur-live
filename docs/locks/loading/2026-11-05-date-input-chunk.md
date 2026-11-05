# [LOADING_ADDITIVE] 2026-11-05 — 유어딜 달력 봉투 `app-date-input`

- **무엇**: `vite.config.ts` manualChunks 에 `components/ui/date-input` → `app-date-input` 규칙 **추가**(제거 0),
  `scripts/surface-chunks.mjs` `PINNED` 에 같은 모듈 **추가**.
- **왜**: 기본 `<input type="date|time|datetime-local">` 30파일을 `<DateInput>` 으로 바꿨다(대표 *"응 유어딜꺼로 바꿔"*).
  첫 빌드에서 묶음기가 이 3KB 를 `lz-gbDetailL`(이용권 상세 lazy 봉투)로 넣어, 숙소 검색·어드민이 상세 봉투 넷(+41KB)을
  끌고 왔다(`check-surface-budgets` 실측: stays 184.9→226.0 · dash:admin 253.7→293.7). `app-select` 에 합치면 달력을 안
  쓰는 검색·생활 견적·마이가 +1.9KB 를 받아 전용 봉투로 뺐다.
- **결과**: exec-cost 9개 화면 전부 예산 안 · 표면 무게는 stays·dash:admin 이 달력 몫 +2.9KB(의도) — 기준 갱신
  `scripts/surface-budgets-history/2026-11-05-*.json`. 같은 갱신의 app-utils +1.0KB(voucherDetail·urshorts·cart)는
  이 변경이 아니라 main 에서 온 것이다(달력 문자열이 그 봉투에 0건 — 실측).
- **롤백**: 두 줄 제거(달력이 다시 묶음기 판정을 받는다 — 그러면 위 +41KB 가 돌아온다).
