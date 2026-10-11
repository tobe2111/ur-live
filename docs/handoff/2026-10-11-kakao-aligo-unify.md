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

## 배포 후 시험 발송 (17:5x KST) + 대표 결정
- `POST /api/admin/alimtalk-test-send {user_id:3}` → **`인증오류입니다.-IP (code: -101)`**. 주소·키·발신번호는 통과(알리고가 정식 응답).
  알리고 콘솔 "발송 서버 IP" 가 **비어 있음**(대표 캡처) + **잔여포인트 0P**.
- 대표: *"문자는 안 쓸거고 카톡만 쓸건데?"* → 규칙 변경: 승인 템플릿만 알림톡, 문자·대체 발송 기본 OFF(`notice_sms_enabled`).
  승인 전이면 안 보내고 `pending:<코드>` 로 기록. 시험 발송은 `forceAlimtalk` 로 알림톡 경로를 강제(알리고가 IP·발신프로필·템플릿 중 어디서 막는지 원문으로 판정).
- 다음 첫 액션: #1691 배포 후 `GET /api/admin/alimtalk-egress-ip` 로 워커 출구 IP 를 재서 알리고 "발송 서버 IP" 에 무엇을 등록할지 결정 →
  등록 후 `alimtalk-test-send` 재시험(템플릿 미승인이면 템플릿 오류가 나야 IP 통과로 판정).

## #1691 배포 후 실측 (2026-10-11 오후, KST)
- **워커 출구 IP 는 고정이 아니다 — 대역도 하나가 아니다.** `GET /api/admin/alimtalk-egress-ip` 8회:
  `104.22.100.39 · 104.22.102.67/68 · 104.22.105.28 · 104.23.209.212 · 172.68.15.209 · 172.68.138.158/159 · 172.70.38.187 · 162.158.152.178`
  (IPv6 는 매번 `2a06:98c0:3600::103` 하나 — 알리고가 IPv6 로 받는지 미확인. 이 컨테이너는 알리고 DNS 를 못 푼다.)
  ⇒ IP 한두 개 등록으로는 **간헐적으로만** 나간다. 알리고 데모 화면에 "대역은 칸을 비워 두면 된다"는 안내가 있다(공식 운영 화면은 미확인).
- 시험 발송(`forceAlimtalk`) → `[Aligo Token Create] 인증되지 않는 서버 IP로 부터의 호출 입니다. (code: -99)` — **토큰 발급 단계**에서 IP 로 막힌다.
  주소·키는 통과. IP 를 풀면 그 다음 판정은 템플릿(시험 템플릿 미등록이면 템플릿 오류가 나야 정상).
- **틀렸던 판단**: 그동안 문서·코드 모두 "우리 이름(voucher_issued)이 곧 tpl_code" 로 가정했다. 알리고는 등록 시 **자기 코드**(`UA_…`)를 붙인다
  → 승인돼도 거절될 뻔했다. 설정 `alimtalk_approved_templates` 를 `우리이름=알리고코드` 맵으로 바꿨다(`parseTemplateCodeMap`, 이름만 적으면 종전과 동일).
- 템플릿 등록 정본 신설 `docs/alimtalk-register-list.md`(23종 + 시험 1종, 본문은 코드와 글자 일치). 등록 전 본문 정리: 조건부 줄 제거(사용 시각·예약 주소 → 값 없으면 `-`),
  음식 전용 "맛있게 드세요" 제거, 광고성 "보너스 딜 지급" → "후기 남기기", 예약 링크 https, "commission" → "커미션", 매장명 빈값 기본값, 교환권(딜)엔 발급 알림 안 보냄.
  `voucher-expire` cron 도 `sendTextNotice` 경유(직접 호출하면 승인·코드맵 규칙을 우회한다).
- 다음 첫 액션: 대표가 알리고 IP 를 넓게 등록(아래) + 포인트 충전 → `POST /api/admin/alimtalk-test-send {"user_id":3}` 재시험.
  -99/-101 이 사라지고 템플릿 오류가 나면 IP 통과. 템플릿 승인 후 알리고 코드를 받아 `alimtalk_approved_templates` 에 `이름=코드` 로 적는다(대표 지시 시 세션이 PUT `/api/admin/tools/settings`).

## 알림톡 줄이기 (대표 결정 2026-10-11)
- 대표: *"한도는 안낮춰도 될 것 같고, 만료 안내는 … 30일 전만 하지뭐 … 알림톡 안보내도 되는 것들은 좀 줄여야겠어."*
- 하루 한도(`ALIMTALK_DAILY_CAP` 기본 5만)는 **그대로**. ⚠️ 그 한도는 `sendSystemAlimtalk` 경로에만 걸리고 `sendTextNotice` 를 직접 부르는
  이용권 알림(판매·발급·만료)은 우회한다 — 대표에게 보고했고 낮추지 말라고 해서 손대지 않았다(폭주 방지 장치로서의 구멍은 남아 있다).
- 만료 안내 알림톡 = **30일 전만**(`voucher-expire.ts` `daysLeft === 30`). 7·3·1일 전은 앱 알림만. 만료일 없는 이용권은 원래 대상 아님.
- 알림톡 끄는 목록 SSOT `ALIMTALK_OFF_TEMPLATES`(`lib/alimtalk-templates.ts`) — voucher_used · seller_voucher_used ·
  appointment_user_confirmed · appointment_reminder_seller · store_owner_stats_link. `sendTextNotice` 가 첫 줄에서 거른다(기록도 안 남김).
  ⇒ 이용권 1장 팔리고 쓰이면 알림톡 2통(발급 + 판매).

## 등록 목록을 10개로 줄임 (2026-10-11 19:30 KST, 대표 "10개 기준으로 만들어줄래?")
- `docs/alimtalk-register-list.md` 를 **지금 등록 10개 / 나중 9개**로 재구성(본문 변경 없음 — 순서·묶음만).
- 나중 9개 근거(라이브 D1 실측): 예약 `appointment_bookings` 0건 · 체험단 `fcfs_applications` 7건 전부 데모 ·
  `commission_withdrawals` 0건 · `affiliate_earnings` 0건 · 정지 해제/서류 확인은 드묾.
- 코드 수정 없음 — 등록 안 한 템플릿은 `sendTextNotice` 가 `pending:` 기록 후 건너뛴다(비용 0).

## 이용권 최소 판매가 1,000원 (2026-10-11 20:00 KST, 대표 "최소가격을 정하는게 좋겠네")
- SSOT `VOUCHER_MIN_PRICE`/`voucherMinPriceError` (`src/shared/constants/voucher-categories.ts`).
- 막는 자리 4곳: 셀러 등록 POST · 셀러 수정 PUT(저장된 카테고리를 `SELECT id, category` 로 읽음) · 영입자 대행 등록
  (`curator.routes /me/proxy-product`) · 등록 화면(단계 이동 + 제출, 판매가 아래 안내 한 줄).
- 대상 아님: 어드민 생성(데모·교환권), 이미 등록된 1,000원 미만(라이브 실측: 비활성 시험 상품 id 2918, 585원 1건뿐).
- 가드 `voucher-min-price-2026-10-11.test.ts` + 주입 5건 빨간불 확인. `voucher-restore` 테스트·주입 앵커는
  조회문 변경(`SELECT id, category`)에 맞춰 재조준(불변식 그대로).
- 근거: 판매 1건 알림톡 2통(약 16원) vs 중개 매장 남는 몫 2.25% → 1,000원 미만이면 손해 가능.

## 카톡 간편로그인 + 옛 로그인 착지 주소 (2026-10-11 22:00 KST, 대표 "모두 가장 이상적으로 고치자")
- 신고: 다른 서비스(꼬기다)는 카톡 앱으로 바로 동의 화면, 유어딜은 카카오 아이디·비밀번호 창.
  원인 = 서버가 웹 authorize 로만 이동(JS SDK 미사용). 카카오 문서: `Kakao.Auth.authorize` 가 카톡 앱 간편로그인 실행.
- 구현: 서버 `/auth/kakao/start?mode=sdk`(같은 state·쿠키, JSON) · `lib/kakao-talk-login.ts`(안드로이드 일반 브라우저만,
  로그인 화면에서 미리 준비 → 클릭 안에서 동기 authorize, 미준비면 종전 웹 이동) · `LoginPage` 배선('다른 계정으로'는 제외).
- 아이폰 실패 기록 3건(10-10 10:25 KST): 그 시각 카카오 콜백 0건 → 옛 착지 주소 재방문. iOS 카카오 로그인은 6/20 이후 **0건**이라
  iOS 실제 로그인 상태는 미검증. 수정: `stale-login-landing.ts`(exp+600초) + main.tsx 400/401 재시도 중단.
- 다음 액션(E4): 배포 뒤 대표 안드로이드에서 로그인 → 카톡 앱 열림·복귀·로그인 확인 + `/api/_internal/kakao-login-diag` 에
  android 'ok' 행. 아이폰 간편로그인은 그 뒤 별건(SDK 클릭 시 로드는 탭 안 실행 조건 때문에 불가 — 미리 받기 필요, 멈춤 재현 확인부터).
- 🍎 (22:10 KST, 대표 "아이폰도 일단은 해줘") 아이폰 일반 브라우저도 켬 — 05-04 멈춤 사고 때문에 로그인 화면이 그려진 뒤
  1.5초에 SDK 준비(`IOS_PREPARE_DELAY_MS`). 그보다 빠른 클릭은 종전 웹 이동. E4 확인에 "아이폰 로그인 화면이 멈추지 않는가" 추가.

## 📦 배포 막힘 수리 — 워커 압축 1MB 게이트 (2026-10-11 23:00 KST)

- **증상**: #1697(최소가)·#1699(카톡 로그인) 머지 후 `main.yml` "Verify build output" 실패 — `_worker.js` gzip 1008KB ≥ 게이트 1,032,000B.
  마지막 성공 배포는 ee516d438(21:17 KST). 그 뒤 #1695(에이전시 1단계)·#1697·#1699 **전부 라이브 미반영**이었다.
- **측정**(로컬 esbuild 메타파일, 같은 설정): ee516d438 = 1,026,725B → 지금 main = 1,033,800B(+7KB, 대부분 에이전시 라우트).
- **처방**: 공유 카드 유달이 PNG(base64 18KB, 압축 안 됨)를 코드에서 빼서 `public/static/og/udal-share-168.png` 로 옮기고
  `loadUdalOgPng(c.env.ASSETS, origin)` 이 카드 그릴 때 읽어 data URI 로(isolate 메모, 실패하면 유달이 없는 카드). 카드 모양 byte-동일.
  결과 1,018,879B(−14.9KB, 게이트까지 약 13KB 여유).
- ⚠️ **여유가 13KB 뿐이다.** #1698(에이전시 2단계)이 머지되면 다시 좁아진다. 근본은 CLAUDE.md/main.yml 이 적어 둔 대로
  (a) Workers Paid 전환 또는 (b) 큰 상주 텍스트 외부화(다음 후보: `demo-review-generator.ts` 55KB · `korea-regions.ts` 26KB ·
  `repair-schema/column-repairs.ts` 71KB). 측정 스크립트는 esbuild `metafile` 로 `bytesInOutput` 정렬하면 된다.
- 가드: `udal-touchpoints-2026-10-09.test.tsx` +3건 · 주입 `scripts/mutations/worker-diet-og-udal-2026-10-11.mjs` 3건 빨간불 확인.
- ⚠️ **E4 미확인**: 배포 후 `curl https://urdeal.kr/api/og/group-buy/2888 | grep -c 'data:image/png'` 가 1 이면 유달이가 카드에 들어간 것.

### 📦 (2) 크론 그래프를 Pages 번들에서 제거 — 같은 PR #1702 (대표 "2번" = 다이어트 선택)
- 발견: `_worker.js`(Pages)에 `scheduled: handleCronScheduled` 가 묶여 **크론 전용 코드 전체**가 실려 있었다. Pages 는 cron 을
  부르지 않는다 — cron 은 `worker-deploy.yml`(`wrangler deploy`, wrangler.toml)로 올리는 **별도 워커**가 돌린다.
- 처방: 빌드 상수 `__PAGES_BUNDLE__` — `build-worker.js` 만 `'true'`, wrangler.toml `[define]` 은 `"false"`.
  index.ts 는 `typeof … !== 'undefined' && === true` 일 때만 no-op(미정의 = 실제 핸들러 — 소비자 크론이 조용히 죽지 않게).
- 실측: Pages gzip 1,018,879 → **960,511B**(−58KB, 게이트까지 약 71KB 여유). cron 워커는 `wrangler deploy --dry-run`
  산출물로 확인 — no-op 마커 0, `cron_hb:` 10곳, 크기 1,442,618 → 1,442,685(사실상 불변).
- 🔎 **같은 측정이 보여 준 사실**: cron 워커는 gzip **1.44MB** 인데 매 배포 성공한다 → 계정 한도는 1MB 가 아니다.
  대표 확인(2026-10-11 "지금 $5짜리 요금제 쓰고는 있어") = Workers Paid(압축 10MB). `main.yml` 의 1MB 게이트는 실제보다
  10배 엄격하다 — 올릴지는 대표 판단 대기(올리면 이 다이어트 압박이 사라진다).
- 다음 다이어트 후보(대표 판단 필요): index.ts 의 `[TEMP-TEST]` 도매 마운트 3개(`/api/admin/buyer-pool`·`maker-pool`·
  `/api/buyer-ingest`, gzip ~25KB) — 주석상 "ur-wholesale 배포 시 제거 예정"이고 mount-wholesale.ts 에 정규 마운트가 이미 있다.
  빼면 urdeal.kr 어드민의 해당 화면이 안 되고 utongstart.com 쪽으로 가야 한다.
