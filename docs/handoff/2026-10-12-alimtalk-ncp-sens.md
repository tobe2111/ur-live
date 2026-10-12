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

---

## 3차 (2026-10-12 오후) — 템플릿 코드 영문·숫자 + 알림톡 버튼

**배경**: 대표가 SENS 콘솔에 템플릿 10개를 등록하다 ① 템플릿 코드가 *"영문, 숫자만 입력 가능"* 함을 실측(밑줄 불가)
② *"알림톡을 보낼 때 유어딜 링크도 넣어야 되지 않을까? 매장 사장이나 대행사가 바로 톡으로 링크 유입을 하기 쉽게"* →
버튼 표 제안 → *"수정하면 돼. 각각 링크 넣어줘"*.

**한 것**
- 코드: 우리 이름에서 밑줄 뺀 소문자(`admintest`·`voucherissued`·…·`bizregrejected`). 승인 목록엔 `이름=코드` 로 적는다 —
  `parseTemplateCodeMap` 이 원래 지원해 코드 수정 0.
- 버튼 정본 `src/lib/alimtalk-buttons.ts` — 손님 3종 `[내 이용권 보기]`(/my-vouchers), 사장님 5종은
  `/store/go?s=#{매장번호}&to=…`(scan·settlements·orders·vouchers·docs). 1번 시험·10번 송금은 버튼 없음.
- 발송(`sendTextNotice`)이 템플릿 이름으로 표에서 버튼을 꺼내 싣는다. 매장 버튼인데 매장 번호가 없으면 **보내지 않고**
  `missing_store_id_for_buttons` 로 기록(보내도 카카오가 거절). `sendSystemAlimtalk` 에 `{ sellerId }` 5번째 인자.
- 본문에서 버튼과 겹치는 주소 줄 제거(2·3·4·6번) — **카카오 등록 본문도 같이 바뀌었다**. 문서 = 코드.
- 가드 `alimtalk-buttons-2026-10-12.test.ts`(문서 버튼 줄 = 표 · 본문 주소 0 · 호출부 매장번호) + 주입 7건 빨간불 확인.
  기존 `store-deep-link` 배선 단언 1건·주입 3건 재조준(링크가 버튼으로 옮겨가 불변식이 "매장 번호를 넘기는가" 로).

**대표님이 할 일**: 이미 검수 요청한 2~9번 → 검수 취소 → 본문(2·3·4·6)·버튼 수정 → 재검수 요청. 1·10번은 그대로.

**⚠️ 못 잰 것**: 버튼 링크에 변수(`#{매장번호}`)를 쓴 템플릿을 카카오가 통과시키는지 · 콘솔 값이 표와 같은지 — 첫 실발송 SENS 응답만이 판정.

---

## 4차 (#1728 머지·배포 후) — 메일이 Resend 키만 보고 건너뛰던 것

**발견(배포 후 `/api/version` 실측)**: ur-live 엔 `RESEND_API_KEY` 가 **없다**(false). 그런데 이용권 영수증(`group-buy.routes`)·
`sendSystemEmail`(에이전시 초대·가입 등)·셀러 비밀번호 찾기·셀러 일일 리포트·채널 감시가 **발송 전에 Resend 키만 보고** 건너뛰었다
⇒ SENS 메일(`NCP_MAIL_SENDER`)을 넣어도 한 통도 안 나갔다. **2차 handoff 의 "SENS 가 거절하면 Resend 로 한 번 더" 는 ur-live 에선
넘겨받을 곳이 없는 말이었다**(대표에게도 그렇게 말했다 — 정정함).

**수리**: `lib/ncp-sens-mail.ts` `transactionalMailReady(env)` = Resend 키 ∨ SENS 메일 — 위 다섯 자리와 `agencyMailReady` 가 이걸 본다.
셀러 일일 리포트는 Resend 직접 fetch → 공용 `sendEmail`. `/api/version` 에 `NCP_MAIL_SENDER` 플래그 추가.
유어애즈(marketing/·worker-ads/)는 **무접촉**(그 워커엔 NCP_MAIL_SENDER 를 안 둔다). 가드 `transactional-mail-ready-2026-10-12.test.ts` + 주입 4건 빨간불 확인.

**대표 진행 상황(KST 17시대)**: NCP 키 4종 + 메일 2종을 Pages·Worker 두 곳에 입력(이름 실측 확인 — 전부 secret, 발신자 이름만 plain).
SENS(통합 콘솔) Mail → Domain Management 에서 urdeal.kr 등록 → 인증 토큰 TXT 받음. 다음: Cloudflare DNS 에 인증 TXT + SPF + DKIM.
⚠️ 이 세션의 CF 토큰은 **DNS 읽기 권한이 없다**(10000 Authentication error) — 기존 SPF 유무는 대표 화면 캡처로만 판정.

---

## 5차 — 메일 도메인 인증 완료 · #1733 머지 · 시험 메일 API

- urdeal.kr 메일 도메인: 소유 TXT · SPF(`v=spf1 include:email.ncloud.com ~all`, 기존 SPF 없음 — 대표 DNS 목록 캡처로 확인) ·
  DKIM(`ncpcompubkr._domainkey`) · DMARC(`_dmarc` = `v=DMARC1; p=none`) 전부 대표가 Cloudflare 에 등록 → NCP 인증 통과(대표 확인).
  ⚠️ 이 환경은 TXT 조회가 **전 경로 차단**(시스템 리졸버는 A 레코드만 답함 · DoH·조회 사이트 CONNECT 403 · WebFetch 도 DNS 실패) —
  판정은 대표 브라우저(dns.google/resolve) 와 NCP 콘솔 인증 버튼으로만 했다.
- #1733 머지 `bd19dcdef` (대표 "머지해줘").
- 알리고 env(Pages 4·Worker 3)는 **남겨 둬도 무해** — 코드가 읽는 곳 0(main grep 실측, 테스트의 '없어야 한다' 단언뿐). 대표 판단으로 유지.
- 신규 `POST /api/admin/mail-test-send {"user_id":N}` — 거래성 메일 경로(`sendSystemEmail`)를 그대로 타는 시험. super_admin 만,
  유저 등록 이메일로만(본문 주소 무시), 수신 끔 무시. 응답에 SENS 결과 원문 + 가린 주소.
  🔍 **이게 판정해 줄 것**: `services/email.ts` 는 SENS 키를 `import('cloudflare:workers')` 의 env 로 읽는다 —
  Pages 런타임에서 이게 비면 `API key not configured` 로 실패한다. 첫 시험 응답이 그 여부를 바로 보여 준다.
