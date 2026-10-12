# 2026-10-12 알림톡 발송처 — 알리고 → 네이버 클라우드 SENS

## 왜
- 알리고는 "발송 서버 IP" 등록 필수(알리고 고객센터 답변 + 라이브 `-99`/`-101`). 콘솔은 **끝자리 대역(x.x.x.0~255)까지만** 받는다
  (대표가 `104.22.(비움).(비움)` 시도 → `104.22.0.[0-255]` 로 저장됨 = 셋째 칸이 0).
- 유어딜 워커의 나가는 IPv4 는 고정이 아니다 — 40회 실측: 앞 두 자리 6종(104.22·104.23·172.68·172.70·172.71·162.158), 앞 세 자리 17종.
- 비즈고(인포뱅크)도 IP ACL 필수(최대 10칸, 클래스 C) — 같은 이유로 불가.
- 네이버 클라우드 SENS: 서명 인증, 허용 IP 는 선택("등록하지 않으면 모든 접속 허용" — 공식 가이드). 알림톡 **7.5원**(대표 확인).

## 한 것
- `src/lib/ncp-sens.ts` — 서명(HMAC-SHA256)·발송·응답 해석. `sendTextNotice` 가 키 넷이 있으면 SENS 로(2차에서 알리고 경로 삭제 — SENS 하나).
- env(대표가 Cloudflare 에 넣는다): `NCP_ACCESS_KEY` · `NCP_SECRET_KEY`(시크릿) · `NCP_SENS_ALIMTALK_SERVICE_ID` · `NCP_KAKAO_CHANNEL_ID`.
  **Pages(ur-live) 와 cron 워커 둘 다**(만료 안내 등은 cron 에서 나간다).
- 템플릿 코드 = 우리 이름(SENS 는 등록 시 코드를 직접 정함). 승인 후 `alimtalk_approved_templates` 에 이름만 적는다.
- 가드: `ncp-sens-alimtalk-2026-10-12.test.ts` + 주입 4건(빨간불 확인).

## 2차 — 알리고 잔해 전부 제거 + SENS 메일 (대표 "최대한 설정하고 알리고 잔해들 빼고 내가 할 일들 알려줘")
- **알리고 코드 0** — `lib/aligo.ts`·`features/alimtalk/aligo.ts`·`lib/alimtalk-auto.ts` 삭제. 문구 빌더는 `features/alimtalk/messages.ts` 로(문구 불변).
  `sendTextNotice` 는 SENS 하나, 문자(SMS) 경로도 삭제. 모든 호출부가 `sendSystemAlimtalk`/`sendTextNotice`/`sendSensAlimtalk` 경유:
  크론 9개(숙소·드롭·체험·만료·재시도·청소·감시·다이제스트) · 선물 · 샘플 승인 · 사장님 매장 통보(버튼 2개 — SENS `buttons`) ·
  쇼핑 주문/배송/취소(`sendSellerAlimtalk` — 크레딧 차감 유지) · 사업자등록 승인/반려 · 유어애즈 광고 알림 · payment.routes 2곳(잠금, 승인받음 — CLAUDE.md audit log).
- env 템플릿 코드(`ALIGO_TPL_*` · `ALIGO_DROP_D1_REMINDER` 등)를 **이름으로 고정** — 다르게 지었으면 승인 목록에 `이름=코드`.
- **셀러 자체 채널 발송**(`POST /api/seller/alimtalk/test`·`/send`)은 410 — 알리고 전용이었고 라이브 `alimtalk_accounts` 0곳.
  손님 주문 알림은 유어딜 채널로 계속 나간다. `GET /alimtalk-egress-ip`(알리고용 IP 측정) 삭제.
- **SENS 메일** `src/lib/ncp-sens-mail.ts` — `services/email.ts sendEmail` 이 `NCP_ACCESS_KEY`+`NCP_SECRET_KEY`+`NCP_MAIL_SENDER` 가 있으면
  **거래성 메일만** SENS 로(월 1,000건 무료). List-Unsubscribe 헤더·회신 주소가 붙은 메일(대량·홍보·아웃리치)은 Resend 그대로.
  SENS 가 거절하면 Resend 로 한 번 더. env 는 워커 top-level(`cloudflare:workers`)에서 읽는다(호출부 30여 곳 무수정).
  ⚠️ **유어애즈 워커(ur-ads)엔 `NCP_MAIL_SENDER` 를 넣지 말 것** — 아웃리치가 대부분 회신 주소로 빠지지만 안전판으로 둔다.
- 검증: tsc 0 · 유닛 912파일 11,657건 pass · 주입 앵커 3,088건 · 신규/재조준 주입 전부 빨간불 확인.

## 다음 세션의 첫 액션
- 대표가 키를 넣었으면: `POST /api/admin/alimtalk-test-send {"user_id":3}` → 응답 `result` 의 SENS 원문으로 판정.
  `A000` 이면 접수 성공(폰 도착은 대표 확인). 템플릿 미등록이면 템플릿 오류가 나야 정상(인증·채널은 통과했다는 뜻).
- 승인된 템플릿 이름을 `alimtalk_approved_templates` 에 적기(대표 지시 시 PUT `/api/admin/tools/settings`).

## 남은 것 / 주의
- ~~cron 4개 미이전~~ → 2차에서 옮겼다.
- SENS 메일 엔드포인트(`mail.apigw.ntruss.com/api/v1/mails`)·본문 필드는 공식 문서 검색 결과로 확인했다(문서 페이지는 이 환경에서 DNS 차단). 응답 성공 판정은 2xx + `requestId`. **실발송 1회로 확정할 것.**
- Resend 키(`RESEND_API_KEY`)는 **지우지 말 것** — 대량·홍보 메일과 SENS 실패 폴백이 쓴다. 상당수 호출부가 Resend 키 존재를 먼저 검사한다.
- 문자(SMS)는 SENS 로 안 옮겼다 — 대표 "문자는 안 쓸거고 카톡만"(2026-10-11).
- 202+A000 은 "접수"다. 실제 전달 결과는 SENS 조회 API(미구현) — 필요해지면 추가.
- 알리고 콘솔의 `104.22.0.[0-255]` 항목은 쓸모없다 — 대표에게 삭제 안내함.

## 틀렸던 판단
- 2차에서 `seller-orders.routes.ts` 의 `if (dbStatus === 'CANCELLED') {` 를 **전체 치환**해, 알림과 무관한 머니 가드(결제 캡처 주문 무환불 취소 차단) 두 곳에 알림톡 조건을 붙여 버렸다 — diff 로 보고 되돌렸다. **넓은 문자열 치환은 매치 수를 먼저 세고 할 것.**
- "알리고 발송 서버 IP 칸을 비우면 된다"고 안내했다(데모 화면 문구만 믿음) — 알리고는 IP 등록 필수였다.
- "칸 두 개 비우면 /16" 가정 — 콘솔이 셋째 칸을 0 으로 저장했다. 추측을 시험으로 확인한 뒤에 말할 것.
