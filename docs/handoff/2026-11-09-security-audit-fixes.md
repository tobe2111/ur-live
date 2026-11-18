# 2026-11-09 보안 전수조사 수리 (대표 "모두 다 순서대로 진행해줘")

[E2] 코드·시험·주입 검사 통과. 머지·배포 후 E4 판정은 아래 "이어받는 세션의 첫 액션".

## 완료분 (PR tobe2111/ur-live#2245, 항목마다 커밋 하나)
1. 셀러 PIN·비밀번호 검사 3곳 — `verifyPassword` 결과 객체를 `.valid` 로 판정 (`7802aa3d`)
2. 키 게이트 데모 시드 엔드포인트 삭제 (`37e04ea8`)
3. 알림 채널 설정 PUT 열 이름 허용 목록 (`662a4260`)
4. 이미지 변환 프록시 래스터만 + `/api` 응답 nonce 미부착 [UNLOCK_LOADING] (`b87ef410`, 판정 함수 `src/worker/utils/image-proxy-safety.ts`)
5. 로그인 신원 종류를 서명된 값으로만 · 소비자 기능은 `requireUser()` · 재고는 셀러/어드민 · 주문 확정 소유 확인 (`2e9557a5`)
6. 관리자 역할 검사 디코드 경로 · 비밀 설정 가리기 · 내부 DDL 최고관리자 전용 · admins 행 없는 토큰 거부 · 소셜 위임 전 RBAC [UNLOCK_LOADING] (`4e14b937`)
7. 결제 웹훅 확정 전 Toss 결제 조회 [UNLOCK] (`664ef7fe`, 로직은 `src/worker/utils/webhook-toss-verify.ts` 로 분리)

가드: `src/tests/unit/security-hardening-2026-11-09.test.ts` + `scripts/mutations/security-hardening-2026-11-09.mjs`(17건 빨간불 확인) +
`src/tests/unit/webhook-payment.test.ts`(위조 4경우). 잠금 기록: `docs/locks/loading/2026-11-09-*`, `docs/locks/toss/2026-11-09-webhook-toss-lookup.md`.

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
- 배포 확인: 카드 이미지 정상(`/api/image/resize` 200 image/*) · 카카오 로그인 후 마이·내 이용권·딜 결제 화면 정상 ·
  어드민 플랫폼 설정 화면(최고관리자)에서 Cloudflare 토큰 그대로 보임.
- staging 실결제 `docs/STAGING_CHECKLIST.md` S-WHLOOKUP.

## 이번에 틀렸던 판단
- 감사 게이트를 10분 제한으로 돌리다 끊겨, 그 안의 주입 검사 프로세스가 살아남아 작업 트리를 계속 바꿨다.
  게이트가 끊기면 `ps` 로 `check-guard-mutations` 잔여를 확인하고 멈춘 뒤 `git checkout -- .`.
- 소비자 이메일 로그인 토큰엔 `type` 이 없다 — "type 없으면 거부" 로 고치면 정상 소비자가 막힌다(그래서 purpose 거부 + 경로별 requireUser).

## 남은 결정/대기 (대표)
- Cloudflare `TOSS_WEBHOOK_IP_ALLOWLIST` 설정(추가 방어선 — 코드 수리와 별개).
- `archive/` 문서에 남은 옛 키들이 현재 키와 다른지 확인, 같으면 교체 · 문서 정리.
- 남은 낮음 등급(이용권 코드 6자리·전역 잠금, 카카오 로그인 CSRF, 관리자 PIN 잠금 미연동, 재발급 토큰 혼용, react-router 버전) — 다음 묶음.

## 2~9차 묶음 상세 — 보관으로 옮김 (2026-11-10)

중간·낮음 등급 수리, 소비자 전용 가드, 로그인 토큰 판정 통일, 별칭 verify, Stripe 주문번호·금액 대조, 메일 중계 차단, 낡은 면제 정리 —
PR tobe2111/ur-live#2247·#2251·#2254·#2258·#2261·#2263·#2264·#2266·#2273·#2282 (전부 머지·배포).
상세·그때 틀린 판단: `grep -n '<낱말>' docs/handoff/archive/2026-11-09-security-audit-fixes-2nd-to-9th.md`

## 10차 — 대표 "다 해줘" (2026-11-10 · 개선 후보 4개)
1. **"필수 칸이 빠진 저장" 경고 2건 = 오탐.** 라이브 D1 조회: `search_logs` 는 `query`, `order_refund_history` 는 `refund_amount` 로
   코드와 일치(검색 기록 575건 저장 중 · 환불 이력 0건은 환불 주문이 0건이라서). 검사기가 마이그레이션의 옛 정의를 읽었다 →
   `check-sql-not-null-insert.mjs` 가 라이브 사진에 없는 컬럼을 거른다. **결제 잠금 파일(`refund.ts`)은 안 건드렸다.**
   🩸 틀렸던 판단: 대표께 "저장이 실패하는 것으로 보인다"고 올렸는데 실측하니 검사기 쪽 결함이었다.
2. **react-router-dom 6.30 → 7.18.5.** `StaticRouter` import 경로만 변경. 화면 무게 +5~7KB(33개 화면 전부, 라이브러리 자체) →
   대표 승인으로 `surface-budgets.json` 기준 갱신(기록 `scripts/surface-budgets-history/2026-11-10-*`). audit moderate 12 → 10.
   검증: tsc 0 · 빌드 성공 · 관련 시험 53파일 601건 · 청크 순환 0 · 유어샵/교환권/로그인 실제 렌더(예외 0).
3. **돈 관련 파일 5곳의 빈 catch 33곳 → `swallow('<파일>')`**(동작 무변경, 실패가 로그에 남는다). ALTER 중복 무시(사유 주석 있음)는 그대로.
   나머지 100여 곳은 범위 밖. 가드 + 주입 2건.
4. **Stripe 주문 흐름 — 만들지 않았다.** 라이브에 키가 없고(503) 서비스가 국내 전용이라 **실결제로 검증할 수 없는 머니 코드**가 된다.
   해외 결제를 실제로 열기로 정하면 그때 단독 세션 + 실결제로.

## 11차 — 대표 "계속 개선" (2026-11-10)
- 10차 #2297 후속: **첫 화면 실행 비용** 검사가 빨개졌다(라우터 자체 +2.9KB · 이용권 상세 +5.7 · 에이전시 콘솔 +5.3, 허용 4) →
  재현 후 `exec-cost-baseline.json` 갱신. 🩸 화면 무게만 미리 돌리고 실행 비용은 안 돌려 CI 를 한 번 더 태웠다 —
  **번들이 바뀌는 변경은 `check-surface-budgets` 와 `check-exec-cost` 를 둘 다** 로컬에서 돌릴 것.
- 빈 catch 2차: 주문(`order.routes`)·공구(`group-buy.routes`)·추첨(`fcfs`)·분쟁(`disputes`)·체험단·찜 알림 cron — 37곳 → `swallow('<파일>')`.
  `orders-fk-mismatch.mjs` 주입 앵커 2건이 그 줄을 잡고 있어 같이 고쳤다(되돌려-검증 빨간불 확인).
- 잠금 파일(`payment.routes` 8 · `webhook.routes` 6)도 대표 허가("허가해줄게 계속 개선")로 같은 처리 — 기록 `docs/locks/toss/2026-11-10-silent-catch-to-log.md`.
- 남은 빈 catch: `admin-products`(72, 대부분 스키마 보정) · 그 외 소량.

## 12차 — 대표 "계속 개선" (2026-11-10)
- npm audit moderate **10 → 4**: `npm audit fix`(잠금 파일만 — glob·minimatch·rimraf) + `@capacitor/cli` 8.5.2 → 8.6.0(xcode·uuid 해소). 전부 개발·네이티브 빌드 도구 — 웹 런타임 무변경.
- 남은 4건은 `drizzle-kit` 이 끌고 오는 옛 esbuild(개발 서버 취약점). npm 이 제안하는 "수정"은 0.18.1 로의 **다운그레이드**라 따르지 않았다. `drizzle-kit` 을 부르는 스크립트는 없다(`drizzle.config.ts` 만 있음) — 지울지는 대표 판단.
- `admin-products.routes.ts` 의 빈 catch 72곳은 상품 삭제 때 딸린 행 정리(어드민 전용)라 그대로 둠.
- 빈 catch 4차: 환불(`returns`)·딜(`points`·`deal-refund`)·정산(`payouts-generate`·`auto-settlement`·`restaurant-settlement`·`settlement-tax-invoices`)·
  영입 커미션·이용권 분쟁·이용권 발급·숙소 — 21곳 → `swallow`. `voucher-dispute` 의 `ALTER TABLE … ADD COLUMN` 한 곳은
  **중복 컬럼 오류가 정상**이라 사유 주석을 단 채 조용히 둔다(로그로 바꾸면 콜드스타트마다 잡음). 관련 시험 73파일 996건 · tsc 0.

## 13차 — 대표 "해킹이나 개인정보 탈취 등의 허점 없을까?" (2026-11-17)
- **셀러 비밀번호 재설정 토큰을 해시로 저장**(`password_reset_tokens.token` 원문 → `hashToken`). 원문 대조는 옛 형식(32자 hex)만 1시간 이행.
  🩸 첫 수정이 원문도 그대로 받게 해서, 저장된 해시를 토큰인 척 내밀면 통과했다 — 형식 검사로 막고 주입으로 고정.
- 확인만(문제 없음): `dangerouslySetInnerHTML` 전수(정적·DOMPurify) · 서버 HTML/OG SVG 이스케이프 · 공개 응답 9곳 실측(손님 PII 0) ·
  비밀번호 찾기 열거 방지 · 재설정 뒤 세션 무효화 · 라이브 오류 기록(라우터 7 이후 신규 0) · 머니 데이터 대조 · 11-10 이후 신규 쓰기 경로 6개.
- 대표 판단 대기: 유어샵 공개 응답의 `pins[].deal_pct`(매장↔유어샵 주인 소개비 %)가 방문자에게도 보인다 · 자동화 관리자(10번) PIN/2FA 없음.
- **읽기 IDOR 전수 — 4차 가드가 놓친 58곳을 닫았다.** 4차(#2258)의 스캐너는 `user.id` 글자만 봤다. 같은 일을 하는
  `getCurrentUser(c)?.id` · `c.get('user').id` · `authUser.id` · `uid(c)` · `router.use('*', requireAuth())` 형태가 통째로 빠져 있었고,
  **라이브에서 관리자 토큰으로 `/api/orders`·`/api/notifications`·`/api/gifts/sent`·`/api/seeding/me`·`/api/wishlists` 가 200** 이었다(같은 날 `/api/cart` 는 403).
  셀러 #N 토큰이 유저 #N 의 주문(수령인 이름·전화·주소)·알림·선물 수신자 연락처·견적 요청 상세 주소를 읽을 수 있었다.
  - `requireUser()`: 견적 요청 8 · 시딩 14 · 선물 3 · 동네 쿠폰(router) · 찜 6 · 영입 5 · 관심 3 · 제휴 2 · 동네공구 2 · 지역 2 · 장바구니 PUT · 쇼츠 좋아요 · 추천 그룹 생성 · 팔로우 설정 · 체험단(router).
  - 주문 라우터 `requireUserType('user','admin')` · 알림은 `user_notifications` 를 손님 토큰일 때만(셀러·관리자도 쓰는 라우터라 통째로 못 바꾼다) ·
    찜 `/:userId` 두 곳 종류 확인 · 이의 대상 손님만 · 타임딜 생성 `requireSeller()`(반대 방향 — 유저 #N 이 셀러 #N 행세).
  - 스캐너 재작성(신원을 읽는 모든 형태 + 다음 라우트 선언까지) · ALLOWED 15 → 11.
    🩸 넓힌 스캐너가 `\.type` 를 아무 데서나 인정해 본문의 `tx.type` 만으로 통과했다(기존 주입이 잡음) → **신원 객체의** 종류만 인정.
- 공개 응답: `/api/seller/public/:id` 에서 email·phone 제거(라이브는 500 이라 지금은 안 새지만 쿼리가 살아나면 전 사장님 연락처가 열거된다) ·
  미승인·반려·정지 매장의 등록번호·주소·대표자 가림(`isSellerIdentityPublic`) · 경매·후원 랭킹 실명 → 첫 글자, 유저 id 제거.
- 일부러 안 한 것(낮음): `/api/account/check-restriction?email=`(탈퇴 계정 여부 — 시간당 20회) · 영입 중복 응답(`ALREADY_CLAIMED`) · 사업자번호 조회(로그인 필요·10분 20회).
- 가드 `security-hardening-8` 10건 + 주입 `[sec8]` 8 · `[cid]` 5 전부 빨간불 · 관련 시험 101파일 1,529건 · tsc 0.
- E4 판정 방법: 배포 뒤 관리자 토큰으로 `/api/orders`·`/api/gifts/sent`·`/api/seeding/me`·`/api/wishlists` → **403**, `/api/notifications` 200(빈 목록), 무인증 `/api/sellers/29/public` 200.
- **대표 "응 가려줘" (2026-11-17)** — 유어샵 공개 응답(`/api/curator/:handle`)의 `pins[].deal_pct` 를 **있음 1 / 없음 null** 로 줄였다(`dealFlag`).
  화면은 `> 0` 만 본다(`hasDealPin` — 계약 있는 핀을 위로). 주인은 로그인한 `/influencer` 발견 화면의 `my_deal_pct` 로 실제 %를 본다.
  E4: 배포 뒤 `/api/curator/jiwon1228` 의 `pins[].deal_pct` 가 1 또는 null 뿐인지 + 유어샵 화면 순서 불변.
- **#2398 라이브 판정(E4, 2026-11-18 새벽)**: 관리자 토큰으로 `/api/home-service/requests/mine`·`/api/district/my`·`/api/gifts/sent`·`/api/seeding/me`·`/api/wishlists`·`/api/prospects/mine` → **403**(배포 전 200) · `/api/notifications` 200(빈 목록 — 설계) · 무인증 `/api/orders` 401 · `/api/sellers/29/public`·`/api/curator/jiwon1228` 200.
  🩸 `/api/orders` 는 관리자에게 **여전히 200** 이었다 — 개별 조회·취소의 관리자 예외 때문에 `requireUserType('user','admin')` 로 뒀는데, 그러면 '내 주문 목록'이 admins.id 를 users.id 로 읽는다. → 관리자는 `/api/orders/:id`·`/:id/cancel` 만(`ADMIN_ORDER_PATH`).

## 14차 (2026-11-18 새벽) — 남은 영역 전수(쓰기 쪽 소유 검사·유어애즈·웹훅·업로드·역할·이용권·시크릿)
대표 *"그리고 다른 부분들의 보안 문제는 없어?"*. 조사 에이전트가 올린 6건을 **코드로 직접 확인한 뒤** 전부 고쳤다.
- **위임받은 운영자 → 주인** 2건(심각): `POST /api/seller/link-kakao` 와 `PUT /api/seller/personal-info` 에 주인 판정이 없었다. 둘 다 `resolveStoreActor().isOwner`(정산 계좌와 같은 판정).
- Resend 웹훅: 비밀값이 없으면 통과 → **503**. 라이브는 `RESEND_API_KEY` 자체가 없어(메일은 NCP) 정상 발신원이 없다 ⇒ 닫아도 잃는 것 없음.
- 이용권 사용(`use-by-seller`·카카오 챗봇): 남의 매장 번호에 403 → **없는 번호와 같은 404**.
- 번들 PATCH 소유·할인 검사 · 재고 스캔/이력 소유 검사(`ownsProduct`).
- 깨끗했던 곳: 유어애즈 워커(계정 격리)·인스타/카카오/토스 웹훅·업로드·에이전시 초대·이용권 CAS·설정 마스킹.
- **이번에 틀릴 뻔한 것**: `tsc` 가 heap 부족으로 죽었는데 `| tail` 때문에 rc=0 으로 보였다 → `NODE_OPTIONS=--max-old-space-size=8192` + `PIPESTATUS`.
- **남은 판단(대표)**: 운영자가 발급한 스캔 기기 키가 위임 회수 뒤에도 살아 있음(주인 화면에서 보이고 끌 수 있음) · 에이전시 지급 승인 라우트의 관리자 역할 제한 미확인.
- **#2402 라이브 판정(E4, 01:58)**: 관리자 토큰 `/api/orders` 403 · 무인증 `POST /api/webhooks/resend` 503 `webhook_not_configured` · `/api/inventory/stock/history/1` 200. 운영자·사업자 토큰이 필요한 4건은 라이브에서 못 쟀다(시험·주입까지).

## 15차 (2026-11-18) — 대표 *"모두 이상적으로 해줘"*
- **스캔 기기 키**: 발급자(운영자일 때만)를 옆 표 `seller_scan_device_issuers` 에 적고, `revokeOperator` 가 그 사람이 그 매장에서 만든 키를 같이 끈다. 주인 변경(`transferStoreOwnership`)·매장 탈퇴는 그 매장 키 전부. SSOT `src/worker/utils/scan-device-revoke.ts`. 못 막는 것: 이 변경 이전 발급분(발급자 기록 없음) · 에이전시 직원 좌석 발급분.
- **에이전시 지급 처리**: 코드 변경 없음 — 두 겹이 이미 있다: 전역 `adminRbacMiddleware`(super·admin 만) + 라우터의 `requireAdminRole('super','finance')`(이전은 super). 둘의 교집합이라 **실효는 super 만**이다(라우터가 의도한 finance 는 전역 게이트에 막힌다). 전역 쪽을 시험으로 고정했다. finance 에게 실제로 열지는 **대표 결재 사항**.
- 🩸 틀린 판단: 처음엔 "등급 제한 미확인" 이라고 보고했다 — 라우터 파일(`agency-admin.routes.ts`)을 안 보고 등록 함수만 봤다.
- picomatch `GHSA-fc5q-39xc-vjpf`(고친 버전 없음 · dev 전용) 면제 등재 — 대표 승인(AskUserQuestion).

## 16차 (2026-11-18) — 대표 *"이후 문제들도 파악해줘"* (3차 전수 · 조사 에이전트 7건을 코드·라이브로 확인)
- 🔴 **이메일 가입으로 매장 주인 되기**: `/api/auth/register`(주소 확인 없음)로 만든 계정이 `GET /api/curator/me/dashboard`·`GET /api/seller/my-seller-status` 의 "같은 이메일 매장 자동 연결" 을 탔다. 카카오 로그인 쪽은 `emailVerified===true` 게이트가 있었는데 이 두 읽기 경로엔 없었다 → `kakao_id IS NOT NULL AND email_verified = 1`. **라이브 실측: 미연결 승인 매장 11곳이 노출돼 있었고, 확인 안 된 계정에 연결된 매장은 0곳**(악용 흔적 없음).
- 🔴 **어드민 역할 검사 우회(등록 순서)**: `adminRbacMiddleware` 가 `internalAdminToolsRoutes` 보다 **뒤에** 등록돼 있어 그 파일의 `/api/admin/*`(수수료 설정·딜 소급 지급·사업자 승인·DDL)는 `requireAdmin()` 만 탔다. 게이트를 그 앞으로 옮겼다. `/api/admin-review-bonus/*` 에도 게이트. `/api/_internal/repair-new-tables` 는 super.
- 🔴 **재발급 토큰 전량 폐기가 오히려 전부 살렸다**: 재발급 경로는 "행 0 이면 서명만 보고 통과"(호환) → 비밀번호 변경이 행을 전부 DELETE 하면 옛 토큰이 30일 통했다. `revokeAllRefreshTokens`(`refresh-rotation.ts`)가 **묘비 행**을 남긴다. 호환 자체는 남겼다(카카오 좌석 토큰은 행을 안 만든다 — 없애면 전원 로그아웃).
- 선물 결제: orderId 를 `gift_<id>_` 로 묶고 같은 paymentKey 재사용을 토스 호출 전에 거절. **라이브에 `gifts` 표가 없다 — 죽은 경로**(클라이언트도 없음).
- ops 역할: `sellers/:id/link-user`·`tools/points-reconcile`·`tools/point-ledger-unlock` 은 super·admin 만, `verify-account` 는 finance. 관리자가 주인을 **바꾸면** 좌석 에포크 + 스캔 기기 키 전부 끊기.
- **남긴 것(미수리)**: 에이전시 직원 좌석이 만든 스캔 기기 키(직원 제거·연결 해제 시) · `community-group-buy` confirm/refund 의 토큰 종류 미검사(SUSPECT, 미확인) · 이미지 프록시 R2 쓰기 남용 · 카카오/네이버 프록시 무인증(30/분) · `/api/_bootstrap/reset-dashboard-password role=all` 의 범위 · ops 의 `DELETE /sellers/:id`.
- 🩸 틀린 판단: 주입 시험을 처음엔 "게이트보다 앞의 app.route 파일에 `/api/admin` 글자가 없다" 로 썼다가 `killer-sw.routes.ts`(클라이언트 스크립트 문자열)에 걸렸다 → 라우트 **정의**만 본다.
