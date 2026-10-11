# 2026-10-11 — 알림을 알리고 하나로 · 로그인 채널 추가 게이트

대표: *"알리고로만 하는건데? 솔라피는 뭐야? 1번 진행해주고, 2번은 어떻게 되는거야? 3번은 어떤식으로 하는거야? 일단 해줘. 4번은 안해도 돼."*
이어서 *"유어딜은 어플리케이션이 아니라서 카톡, 알림톡을 최대한 활용하면 좋을 것 같긴 해. 가장 이상적인 형태는?"*

## 라이브 실측(2026-10-11, 판정 근거)
- Pages env: `ALIGO_API_KEY` · `ALIGO_USER_ID` · `ALIGO_SENDER_KEY` · **`ALIGO_SENDER`(11자리 번호)** 존재.
  **`ALIMTALK_API_KEY`(솔라피) 없음** · `KAKAO_SKILL_SECRET` 없음.
- `alimtalk_dispatch_log` **0행**(성공 기록 전무) · `alimtalk_budget` 0행.
- `alimtalk_failures` 2건(`voucher_used`, 10-01·10-06) 원문 `Unexpected token '<', "<!DOCTYPE "...` = 알리고 옛 주소가 HTML 반환.
- 카카오 가입 11 / 전체 25.

## 고친 것 (이 PR)
1. `src/lib/aligo.ts` — 카카오 API 주소를 `kakaoapi.aligo.in/akv10` 으로(셀러 경로 `features/alimtalk/aligo.ts` 와 통일),
   모든 호출에 apikey·userid·token, **알림톡 필수값 `sender`** 추가, 성공 판정 `code===0`(빈 값 함정 차단),
   JSON 아닌 응답을 읽을 수 있는 오류로. 문자 발송 `sendAligoSms`(단문/장문 자동) 신설. 발신번호는 `_PHONE ?? ALIGO_SENDER`.
2. `src/lib/text-notice.ts`(신규) — 규칙 하나: 어드민 `alimtalk_approved_templates` 에 코드가 있으면 알림톡+문자 대체, 아니면 문자.
   성공·실패 둘 다 기록(실패는 `max_retries 0` — 재시도 cron 은 알림톡으로 다시 보내기 때문).
3. `system-alimtalk.ts` 발송부를 그 모듈로. `group-buy/api/helpers.ts` 솔라피 7종 → 그 모듈(코드 5종 신규).
4. 발신번호 읽는 곳 4개(`admin-store-owner`·`admin-products`·`seller-orders`·env 타입) `ALIGO_SENDER` 폴백.
   ⚠️ `payment.routes.ts` 824행도 `ALIGO_SENDER_PHONE` 만 읽지만 **Toss 잠금 파일**이라 손대지 않았다
   (그 자리는 셀러 알림톡의 문자 대체 발신번호 — 게이트 `ALIMTALK_SMS_FAILOVER` 꺼져 있어 지금은 무영향).
5. 1번 로그인 채널 추가 — `services/kakao-login-scope.ts`: `KAKAO_CHANNEL_ADD_ENABLED='true'` 면 scope 에 `plusfriends`.
   **기본 OFF** — 카카오 콘솔 설정 전 켜면 KOE205 로 로그인 전체가 막힌다.
가드: `aligo-text-notice-2026-10-11.test.ts` 19건 + 주입 9건(전부 빨간불 확인).

## 다음 세션의 첫 액션
- 배포 후 첫 판매/사용/승인 이벤트가 나면 D1:
  `SELECT template_code, COUNT(*) FROM alimtalk_dispatch_log GROUP BY 1` → `sms:...` 행이 생겼는가(E4).
  `SELECT template_code, error FROM alimtalk_failures ORDER BY id DESC LIMIT 5` → 실패면 원문으로 판정:
  - 발신번호 미등록 → 알리고 콘솔 발신번호 등록 · IP 오류 → 알리고 콘솔 "발송 IP 제한" 해제(Cloudflare 출구 IP 는 고정 아님)
  - 잔액 부족 → 충전.
- ⚠️ **이 컨테이너는 알리고(apis/kakaoapi.aligo.in)에 닿지 않는다** — 주소·파라미터는 알리고 공개 스펙 기준이고 실호출 검증은 못 했다.

## 대표가 할 일(콘솔 — 세션이 못 하는 것)
- 1번: 카카오 개발자 콘솔 비즈앱 → 비즈니스 채널 → 앱에 채널 연결 → 대표 채널 → 동의항목 `plusfriends` 선택동의
  → 그 다음 Pages env `KAKAO_CHANNEL_ADD_ENABLED=true`.
- 2번: 알리고 콘솔에 템플릿 등록·검수(1~3영업일) → 승인된 코드를 어드민 설정 `alimtalk_approved_templates` 에 추가.
- 3번(챗봇): 카카오 비즈니스 → 오픈빌더 봇 생성·채널 연결 → 스킬 URL `https://urdeal.kr/api/cs/kakao-skill` →
  `KAKAO_SKILL_SECRET` 시크릿 등록 → staging S-KAKAOBOT 확인 → `kakao_bot_store_ops_enabled=true`.

## 틀렸던 판단
- 직전 보고에서 "#1685 판매 문자가 사장님 휴대폰으로 간다"고 E3 로 말했지만, 그 경로는 키 없는 솔라피였다 —
  **번호를 고쳐도 배달 수단이 죽어 있으면 안 간다.** 배달 수단(키 존재)부터 라이브로 확인할 것.
- `ALIGO_API_KEY` 등 알리고 값이 Pages 에 **plain_text** 로 저장돼 있다(대시보드에서 값이 보인다) — 시크릿으로 바꾸길 권장(대표 판단).

## 카카오 전체 흐름 라이브 판정 (2026-10-11 17:30 KST)
| 영역 | 판정 | 근거 |
|---|---|---|
| 로그인(안드로이드·PC·카톡 인앱) | ✅ | `kakao_login_diag` 30일 성공 53 · 실패 0 · OIDC scope 라이브 확인 |
| 로그인(iOS 사파리) | ⚪ 판정 불가 | 마지막 성공 06-20. 10-10 10:25 KST `establish_bad_ticket` 3건 — 같은 시각 콜백 기록 없음 ⇒ 120초 지난 옛 티켓 재사용 추정. **대표 아이폰 로그인 1회로 판정** |
| 공유 SDK·지도 | ✅ | 번들에 JS 키 존재(`app-kakao-sdk-*`) · `dapi.kakao.com` 이 Referer urdeal.kr 에 200(타 도메인 401 = 등록 도메인 확인) · CSP 허용 |
| 공유 미리보기 사진 | 🟡→수리 | 옛 카테고리 7종만 받아 2917('lifestyle') 404 → 이 브랜치에서 필터 제거 |
| 문자·알림톡 | 🔴→#1687 | 성공 0건이던 것 수리, 배포 후 대표 번호 시험 발송 |
| 상담 채널 `_AITdn` | ⚠️ | 채널명이 **"유어팀"**(회사 채널). 손님용·알림톡 발신·친구추가 채널을 유어딜로 둘지 대표 판단 |
| 챗봇 | ⏸ | 404(시크릿 없음) · 연결 0 |
| 카톡 메시지 API(친구에게) | ⚪ | 토큰 보유 8명 — 사용처가 라이브커머스(중단) |
| 카카오맵 후기 보너스 | ⚪ | 제출 0 |
⚠️ 이 컨테이너 브라우저는 라이브 자산을 못 받는다(ERR_TOO_MANY_RETRIES) — SDK 로드는 번들·도메인 응답으로 판정했다.
