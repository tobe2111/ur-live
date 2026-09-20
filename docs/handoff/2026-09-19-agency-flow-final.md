# 대행사(중개사) 확정 플로우 — 매장 코드 · 협업 코드 · 중개사 몫 (2026-09-19)

**레일**: 🎟️ 유어딜(소비자 + 셀러 대시보드). **머니 경로 접촉**: 있음 — 중개사 몫 적립(`broker-share.ts`)이 **게이트 OFF** 로
들어갔다(`broker_share_enabled` 기본 `false` = 종전과 byte-동일). 협업 코드는 기존 딜 레일(`seller_influencer_deals`)의
활성화 입구 하나가 더 생긴 것이라 결제·적립·환불 코드는 한 줄도 안 바뀌었다.

대표 확정: *"이걸 최종 플로우로 결정하고 중개사가 끼지 않는 매장 직접 운영도 유사한 형태로 하자. 모든 미흡한 부분은 빠짐없이 구현해줘."*
결재 파일: `docs/decisions/2026-09-19-agency-flow-final.md` · 구조 SSOT: `urdeal-platform-model.md` §2-1 🔑.

## [E2] 한 것

| 단계 | 구현 | 파일 |
|---|---|---|
| 1 | 매장 등록 때 **중개사 몫 % · 인플루언서 상한 %** 입력 + **사장님 승계 코드** 자동 발급, 응답 `owner_claim_code` | `StoreRegisterModal` · `seller-stores.routes`(600줄 — 래칫 한계) · **신규** `seller-broker-terms.routes` · `broker-share.ts` · `store-codes.ts` |
| 3 | `/seller/stores` 목록에 주인 없는 위임 매장의 코드 + 링크(`/store/find?code=`) · `/store/find` 코드 입구(`GET /store-claims/lookup-by-code`) | `SellerStoresPage` · `seller-operators.routes /my-stores` · `StoreOwnerClaimPage` · `seller-store-claims.routes` |
| 6·7 | **협업 코드** 발급·회수(`/api/seller-marketing/codes`) · 인플루언서 입력(`/api/influencer-settlement/codes/redeem`) · 착지 `/i/join/:code`(미리보기→로그인→자동 입력) | **신규** `marketing/collab-codes.ts` · `influencer-code-redeem.ts` · `seller-influencer-deals/CollabCodesSection` · `InfluencerJoinPage` |
| 7 | 🩸 **매장 제안 수락 엔드포인트가 0 이었다** → `POST /deals/:id/respond`(influencerApp) + 화면 버튼 | `collab-codes.ts` · `influencer-settlement/DealsAndCodesSection` |
| 7 | 케이스별 % 조정 `PATCH /api/seller-marketing/deals/:id`(이후 판매분부터·상대 알림·상한 검사) + 인라인 편집 UI | `collab-codes.ts` · `SellerInfluencerDealsPage` |
| 8 | 마이페이지 딜마다 **매장 링크**(`/s/{id}?ref=`) + 대표 이용권 링크 · 복사·공유 · 판매/대기/확정 | `marketing.routes /my-stores` · `DealsAndCodesSection` · `SellerPublicPage`(ref 캡처 1 effect — 잠금표 항목은 무접촉) |
| 9 | 중개사 몫 적립 — `/join`·`confirm-toss` 양 경로 대칭, `influencer_attributions source='broker_share'`, 매장 debit, 부분 UNIQUE 멱등, 환불은 기존 `voucher-clawback` 이 order_id 로 되돌림 | `broker-share.ts` · `group-buy.routes`(+3줄 — 래칫 1432→1435 정당 additive) |
| 10 | `/seller/operating` 매장별 **인플루언서별 성과 + 내 중개사 몫** · 어드민 ⑩ 스위치 · OPS_GATES · S-BROKER | `SellerOperatingSummaryPage` · `money-switch-fields.ts` · `admin-system-monitoring.routes` · `STAGING_CHECKLIST` |

가드: `agency-flow-codes-2026-09-19.test.ts` 23건(node:sqlite 로 실제 행 확인) + `scripts/mutations/agency-flow-codes.mjs` 7건
**되돌려-검증 전부 빨간불 확인**. tsc 0 · 관련 102 파일 1,508건 pass · pre-push 게이트 98 통과 · i18n 6개 언어 동기.

## 🩸 이번에 틀렸던 판단 / 가드가 잡은 것

1. `createDashboardNotification` 을 `@/lib/notifications` 에서 import 하려 했다 — 그 파일엔 `notifySeller` 가 있다. tsc 전에 grep 으로 잡았다.
2. `check-file-size` 가 `seller-stores.routes.ts` 를 잡았다(595→670). 요율 라우트를 `seller-broker-terms.routes.ts` 로 빼고 정확히 600 에 맞췄다 — **다음 사람은 이 파일에 한 줄도 못 더한다.** 새 라우트는 형제 모듈로.
3. `store-operator-scope.test` 가 빨갰다 — `/operating-summary` 본문 3,000자 창 안에 `revenue_since_grant` 가 있어야 하는데 내 블록이 밀어냈다. 블록을 `out.push` 뒤로 옮겼다(`Object.assign`).
4. `consumer-hex` 래칫 — 새 소비자 화면 둘에 `dark:bg-[#…]` 를 손으로 박았다. 토큰(`bg-warm`·`bg-surface`·`border-line`)으로 교체.
5. `ops-gate-reachable` — OPS_GATES 에 등재만 하고 **켤 칸**을 안 만들었다(09-16 과 같은 실수) → `money-switch-fields` ⑩.

## ✅ [E3→E4] 머지·배포·라이브 판정 (2026-09-20 KST)

- 머지: PR #1499 squash → main `e3e182c`. 배포 감지 03:18 KST(번들 `index-DWihfLCS.js`).
- **API 판정** (어드민 읽기 토큰 + curl): `/api/seller-marketing/codes`(GET/POST) · `/codes/:code/revoke` · `/deals/:id`(PATCH) ·
  `/api/influencer-settlement/codes/redeem` · `/deals/:id/respond` · `/api/seller/stores/:id/broker-terms` → 비인증 **401**(라우트가 살아 있고 인증 벽이 선다).
  `GET /api/influencer-discover/code/ZZZZZZZZ` → `{"success":false,"code":"NOT_FOUND","error":"코드를 찾을 수 없어요…"}`.
  `/api/admin/system-monitoring/ops-status` 에 `broker_share_enabled` 가 `value:null · is_default:true`(= OFF). 가이드 시드 33 반영(첫 접근 뒤).
  라이브 D1(`store_codes`) 테이블 존재, 행 0 — 아직 아무도 코드를 만들지 않았다(정상).
- **브라우저 판정** (Playwright · iPhone 13 뷰포트, `e4-front.mjs`):
  `/i/join/ZZZZZZZZ` → 오류 문구 렌더(빈 화면 아님) · `/store/find?code=AB3K9QXP` → 비로그인이면 `/login?returnUrl=%2Fstore%2Ffind%3Fcode%3D…`(**코드 보존**) ·
  `/s/14?ref=777` → localStorage `affiliate_ref=777` + 만료 7일 + 쿠키(**매장 링크 추천 캡처**) · `/influencer/settlement` → 로그인 유도 · 어드민 플랫폼 설정에 ⑩ 스위치 표시.
- ⚠️ **E4 가 못 본 것**: 코드 발급→입력→수락 생애주기와 딜 % 조정은 **셀러·인플루언서·사장님 카카오 계정 3개**가 필요하다.
  어드민 계정은 읽기 전용이고 대리 로그인 엔드포인트가 없다. 이 부분은 단위 테스트 23건(실제 sqlite) 까지가 증거이고, 라이브 판정은 대표 실사용(아래 첫 액션 1)이 E5 다.
- 🩸 하네스가 헛돈 것: Chromium 을 프록시 없이 띄우면 청크 404 → 자가복구 루프(`ERR_TOO_MANY_RETRIES`)로 모든 경로가 흰 화면이었다.
  `proxy:{server:HTTPS_PROXY}` + `--ignore-certificate-errors` + `domcontentloaded`(networkidle 은 차단된 비콘 때문에 영원히 안 온다) 이 답.

## ✅ [E3] PR #1501 머지·배포 (2026-09-20 KST)

- 머지: squash → main `a54e3e6` (대표 "머지해"). 원격 브랜치 삭제는 프록시 403 으로 못 했다(무해 — 다음 세션이 main 에서 다시 딴다).
- 배포: `Deploy to Cloudflare Pages` 성공. 라이브 `/api/version` = `index-DDu8xFR5.js`, `app-utils-*.js` 에 매장코드 보존 정규식 존재 확인.
- Notion 개발 로그 1행 기록(서비스 유어딜 · 기능 추가 · 머니 경로 ✓).
- ✅ **[E4] `?code=` 왕복 판정 통과(대표 "하고 판정까지")** — OAuth 를 끝까지 안 가도 잴 수 있었다: `/api/auth/kakao/start?redirect=…` 의 302 `Location` 에 실린 **서명 state(JWT) 의 `r` 가 `safeRedirect` 통과 후 값**이고 콜백은 그 값으로 돌아간다(쿠키 유실 시 그 경로). 결과 5건:
  `code=AB3K9QXP&auto=1` 보존 · `code=AB3K-9QXP` 보존 · `&evil=1` 제거 · `code=<script>&auto=2` → `/store/find` (둘 다 제거) · `ref=777` 종전대로 보존. 방법: 스크래치 `probe()` — Location 의 `state` 를 base64url 디코딩(서명 검증 불필요, 페이로드만 읽는다).
- ⚠️ **E4 못 잰 것**: 좌석 개방(대기 매장 토큰)·정산 skip — 라이브 D1 실측 `sellers` = approved 1곳 · `seller_operators` 활성 1(그 매장). 대기 매장이 없다. 만들려면 라이브에 가짜 셀러를 넣어야 하는데 그건 쓰기라 안 했다(어드민 토큰은 읽기 전용 규율). 대표 3계정 실사용에서 **사장님 B 가 등록하면 곧 대기 매장**이고, 그때 중개사 A 가 스위처에 '심사 중' 배지와 함께 들어가지는지가 판정이다. 정산 skip 은 STAGING P15.

## 🩸 [E2] 이메일 가입 500 — E5 계정을 만들다 발견 (2026-09-20, 대표 "3번은 이메일 계정들로 지금 만들 수 있나?")

- 소비자 로그인 화면은 **카카오 전용**이라 이메일 가입 UI 는 없다. API(`POST /api/auth/register`)는 살아 있는데 라이브에서 **항상 500** 이었다.
  원인: 라이브 `users.id` 가 `INTEGER PRIMARY KEY AUTOINCREMENT` 인데 핸들러가 `generateId()`(TEXT) 를 id 에 넣어 datatype mismatch → catch → 'Registration failed'. 마지막 성공 가입 2026-03-15.
- 수정: id 컬럼을 INSERT 에서 빼고 `meta.last_row_id` 로 읽는다(카카오 upsert 와 같은 모양). 가드 `auth-email-register-2026-09-20.test.ts` 4건 + 주입 2건 빨간불 확인. tsc 0.
- ⚠️ 이 API 로 만든 계정은 `ur_session` 쿠키로 로그인된다 — 브라우저 판정은 쿠키를 심어 한다. 대표가 손으로 만들려면 카카오 계정이 필요하다(화면이 그것뿐).

## 🥕 [E2] 승인 대기 병목 — "준비는 지금, 노출·정산은 승인 뒤" (2026-09-20, 대표 *"2번은 더 이상적인 방법이 있어? 나머지 다 이상적으로"*)

**레일**: 유어딜 셀러 대시보드 + 정산 cron. **머니 경로 접촉**: 있음 — `payouts-generate` 에 **셀러 status 게이트**(제한만 추가, 승인 매장은 종전과 동일).
**롤백**: `isSeatableStoreStatus` → `active|approved` 직접 비교 환원 + payouts 의 `continue` 1줄 제거(둘은 짝이라 **반드시 함께**).

- 병목의 실체: 좌석 토큰(`/stores/:id/token`)이 `active|approved` 만 열어 **중개사가 등록한 매장은 승인 전엔 아무것도 못 했다**(이용권·협업 코드 전부 대기). 09-16 이 셀러 *계정*에 적용한 당근 규칙이 매장 *좌석*엔 안 미쳤다.
- 수정(SSOT `src/shared/seller-status.ts`): 좌석 = 대기·반려도 앉는다(정지·미지·null 제외) / 정산 = 승인·활성만. **두 집합이 다른 것이 설계의 전부** — 좌석을 열면서 정산 게이트를 빼면 09-16 사기 방어(등록증 + 어드민 승인)가 통째로 우회된다. 노출은 `approvedSellerProductSql` 이 이미 승인 매장만 내보낸다.
- 배선: 좌석 토큰·앉을 수 있는 매장 수(`store_ready`)·요약 API·이용권 매장 선택 화면(`StoreStep`) 네 곳이 같은 함수. `StoreSwitcher`·`StoreStep` 에 `심사 중`/`반려` 배지. 어드민 승인이 **위임 운영자(중개사)** 에게도 `store_approved` 알림(승계 전 매장은 `linked_user_id` 가 비어 종전 알림이 아무에게도 안 갔다). 협업 코드 `created_by` = 행위자 유저 id(좌석 토큰의 `operator_user_id` 를 `AuthUser` 로 통과).
- 더 이상적인 다음 단계(코드 있음·게이트 OFF): **S-OCR** `ocr_auto_verify_enabled` — 등록증 OCR 자동 승인. S-OCR-1~3 통과 뒤 켜면 사람 승인이 예외 처리로 줄어든다. 켜는 것은 대표 판단.
- 가드: `approval-gate-2026-09-20.test.ts` 10건 + 주입 4건(정산 게이트 소실 · 두 집합 동일화 · 좌석 환원 · 정지 개방) **되돌려-검증 빨간불 확인**. 낡은 지도 2건(d3 요약 필터·seller-stores 가산) 재조준. STAGING **P15**.
- 🩸 틀렸던 것: 주입 러너를 vitest 전수와 **동시에** 돌려 "복원 실패 의심"이 떴다 — 러너는 소스를 잠깐 고쳐 쓰므로 다른 검사와 병렬로 돌리면 안 된다. 순차로 돌리자 진짜 원인(낡은 지도 2건)이 남았다.

## ⏭️ 다음 세션의 첫 액션

1. **대표 실사용 판정(E5 — 위 E4 가 못 본 생애주기)**: 대표 계정으로 `/seller/stores` 에서 중개 매장 하나 등록(요율 10/5) → 목록에 `XXXX-XXXX` 코드가 뜨는지 →
   다른 계정으로 `/store/find?code=…` → 매장이 자동 선택되는지. `/seller/influencer-deals` 에서 협업 코드 발급 → 세 번째 계정으로
   `/i/join/CODE` → "협업이 시작됐어요" + `/influencer/settlement` 에 매장 링크·수락 대기 딜이 보이는지.
2. **S-BROKER 실결제**(대표가 켜기로 하면): `docs/STAGING_CHECKLIST.md` 5건. 판정 쿼리:
   `SELECT influencer_id, commission_amount, status, source FROM influencer_attributions WHERE source='broker_share'`.
3. 남은 미흡(이번 범위 밖): 코드 발급자 `store_codes.created_by` 는 셀러 라우트에선 seller id 다(유저 id 아님) — 표시용이라 무해하나
   감사 로그로 쓰려면 정리. 인플루언서 정산 페이지의 `MyRankCard` 등 옛 이모지 잔재는 design-slop 래칫 대상 아님(소비자 마이).

## 남은 결정

- `broker_share_enabled` ON 시점 — S-BROKER 뒤 대표 판단(결재 09-16 그대로).
- 협업 코드 기본 `requires_approval` 을 OFF(즉시 활성)로 뒀다. 대표가 "승인 필요"를 기본으로 원하면 `CollabCodesSection` 초기값 1줄.
