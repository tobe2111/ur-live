# 2026-11-17 이용권 유효기간 상한 12개월 (토스 PG 심사)

서비스: 유어딜(소비자). 머니 경로: 이용권 만료 시각 → 만료 자동 환불 시점(환불 로직 자체는 무변경).

## 배경
토스페이먼츠 심사(MID `urdealtb84`): *"응모 및 당첨 후 결제 이후 이용권의 유효기간을 12개월 이내로 명시"*.
라이브 실측: 판매 중 이용권 150개 전부 `voucher_expiry` 없음(2026-08-22 "미설정 = 무기한" 정책).
대표 승인 *"응 다 해줘"* — 상한 구매일 + 12개월.

## 한 것
- SSOT `src/shared/voucher-validity.ts` — `resolveVoucherExpiresAt`(없음·초과 → 발급일+12개월, 더 짧으면 그대로, null 안 돌려줌) · `capValidityDays`(숙소 365일).
- 발급 레일 넷: group-buy.routes(2곳) · cart-checkout · experience-campaign · stays-public(2곳).
- 화면: 상세 이용 안내(늘 표시) · 추첨 응모 안내 · 환불정책 `/refund` "이용권 유효기간" · 사장님 등록 화면 라벨("기본 기한(구매일로부터 12개월)").
- 가드 `voucher-validity-12m-2026-11-17.test.ts`(주입: cart-checkout 되돌리기 → 빨간불 확인).
- 이미 발급된 무기한 이용권 1장은 소급 변경 안 함.

## 같은 날 라이브 데이터 작업(토스 지적 대응, 코드 아님)
- 스포츠시설·촬영 스튜디오 10개 판매 중지(2933,3091,3064,2997,3037,3055,3073,3079,3094,3102).
- 데모 이용권 146개를 숨겼다가 대표 지시 *"숨기지 마 146개"* 로 즉시 원복(전부 다시 판매 중).

## 남은 것
- 토스 "가맹점 사업자 지위" 질문 답변 방향 — 데모 상품(판매자 없는 실매장 이름 146개) 처리 미정(대표 판단).

## 후속 (같은 날)
- `/refund` 첫 글자 1.5~2.2s(앱 부팅 뒤 청크 출발) → `PRELOAD_ONLY_ROUTES.refund` + `route-surface` 'refund' + `registerBootPage('refund')` 로 페이지 청크를 워커가 미리받게 함(청크 구성 무변경). 예산 `surface-budgets.json` refund 218.5KB 등록.
- 결재 올림: `docs/decisions/2026-11-17-overseas-payment-store-fee.md`(해외결제 추가 수수료 매장 부담 + 매장 켜기/끄기).
- 토스 심사 테스트 계정 `tossreview@ur-team.com`(users 신규, 비밀번호는 대표에게 채팅으로만) — 심사 후 삭제·변경 권장.

## 외국인 이용권 이메일 (같은 날)
- 대표 *"3번 이메일 부분 개발해두자"* · *"수수료는 손해가 나면 안돼"*(결재 파일에 기록).
- `src/worker/utils/voucher-email-html.ts`(en·ja·zh·ko, 매장 한국어 원문 병기, `/v/:code` 버튼 — 로그인 불필요 화면) + `src/worker/utils/voucher-email-send.ts`(주문 단위 선점 · `voucher_email_enabled` 기본 꺼짐).
- **아직 아무 레일도 부르지 않는다** — 해외 간편결제 승인 직후에 붙인다. 켜는 것(발송)은 결재.
- ⚠️ 메일의 "미사용 시 전액 자동 환불" 문구는 해외결제 환불 시 수수료 처리 결정에 따라 바뀔 수 있다.
