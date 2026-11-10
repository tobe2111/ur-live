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
