# 2026-11-26 해외 거주 소개자 받는 곳 · 해외 송금 대기

대표: *"지금 해외 송금 서비스 붙히면 안돼?"* → 업체(Wise 등) 가입·세무 확인 전이라 업체와 무관한 부분만 → *"응 만들어줘"*.
결재 `docs/decisions/archive/2026-11-26-overseas-payee.md`.

## 한 것
- SSOT `worker/utils/overseas-payee.ts` — 표 `overseas_payees`(받는 곳, 암호화 `v1:`) · `overseas_payouts`(지급 기록 = 비거주자 지급명세서 원장). 원천징수율 어드민 `overseas_withholding_pct`(기본 22).
- 소개자 문 `GET/PUT/DELETE /api/influencer-settlement/overseas`(`marketing/overseas.ts`) · 정산 화면 "해외에서 받기" 줄 + `OverseasPayeeSheet`(Wise·PayPal·해외 은행). 해외 등록이면 주민등록번호 줄을 숨긴다.
- 어드민 지급: 목록에 `overseas`(가린 값) · 원문 `GET /api/admin-payouts/payouts/:id/overseas-destination`(require2FA·감사 로그) · [완료 처리] 시 국내 계좌·주민번호 검사 건너뜀, 해외 세율, `overseas_payouts` 기록(거주자 원천징수 장부엔 안 넣음). 일괄 처리에서는 해외 건을 뺀다(한 건씩).
- 월 정산 cron: 해외 등록자는 `🌍 해외 송금 대기` 알림(주민번호 요청 안 보냄).
- `computeCashPayout` 에 `withholdingRateOverride` 추가(안 주면 종전 그대로).
- 개인정보 처리방침 ⑤에 해외 거주자 항목 · 최종 개정 2026-11-26.
- 시험 `overseas-payee-2026-11-26.test.ts`(실제 라우트·cron).

## 이어받는 세션의 첫 액션 (대표가 이어서 하라고 했을 때만)
- 업체 API 연결: 대표가 Wise 비즈니스 가입 + 한국 법인 대량지급/API 가능 여부 확인 → 되면 `overseas_payouts` 를 만드는 지점(어드민 [완료 처리]) 앞에 송금 호출을 둔다.
- 개인 에이전시 해외 거주는 표만 지원(`payee_kind='agency'`) — 화면·지급 분기는 아직 없다.
- 비거주자 지급명세서 CSV(`overseas_payouts` 집계)는 아직 없다 — 세무사 형식 확인 뒤.

## 이번에 틀렸던 판단
- 시험에서 "2FA 없으면 원문이 안 나온다" 를 기대했는데 2FA 는 2026-07-19 대표 지시로 전체 꺼져 있다(`TWO_FA_DISABLED`). 문서·화면 문구에 "2FA 뒤" 라고 쓰지 않도록 고쳤다.
- 월 정산 cron 은 매월 정산일(기본 10일 KST)에만 송금 대기를 만든다 — 시험은 시계를 그날로 맞춰야 한다.

## 남은 결정
- 해외 원천징수율 정답(0 / 22 / 조세조약) — 세무사.
- 원화→외화 환율·송금 수수료를 누가 부담하는지 — 대표(지금은 원화 실지급액 상당을 보낸다고 안내).
