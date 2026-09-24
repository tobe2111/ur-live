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

## ✅ [E4/E5] 3계정 실사용 — 라이브 urdeal.kr 에서 흐름 전체 통과 (2026-09-20, 대표 "3번은 이메일 계정들로 지금 만들 수 있나?")

**계정**(이메일 API 로 생성, 비밀번호는 세션 스크래치에만): users 35 A `테스트중개사A` · 36 B `테스트사장님B` · 37 C `테스트인플C` (+38·39 가입 프로브).
**테스트 매장**: sellers 15 `[테스트] 클로드분식`(→ 승인, B 가 주인) · 16 `[테스트] 클로드카페` · 17 `[테스트] 클로드미용실`(둘은 pending 유지 — OCR·P15 용). 사업자번호 `999-99-9999{1,2,3}`(가짜, 형식만). 전부 이름에 `[테스트]`.

| 단계 | 결과 |
|---|---|
| A: `POST /api/seller/stores` ×3 (brokered, 10/5, 등록증 첨부) | 200 · pending · 승계 코드 `LMHS-YTBP`/`GGG4-VMYU`/`PBRN-YTGK` |
| A: 대기 매장 좌석 `POST /api/seller/stores/15/token` (#1501) | **200** (종전엔 403) · `operable_store_count: 3` |
| A: 협업 코드 `POST /api/seller-marketing/codes` | `EDF5-97WV` · `created_by: 35`(유저 id — #1501 발급자 수정 확인) |
| B: `GET /store-claims/lookup-by-code` → `POST /store-claims` | 매장 자동 선택 · claim 1 `bno_match: true` |
| C: `POST /api/influencer-settlement/codes/redeem` | deal 1 `active`(즉시 활성) · 코드 `use_count: 1` |
| 어드민: claim 1 approve → `PATCH /sellers/15/approve` | B `role: owner` · A 알림 `store_approved` 1건(#1501 운영자 통보 확인) |
| 브라우저(iPhone 13, 쿠키 주입): `/seller/stores` · `/seller/influencer-deals` · `/store/find?code=` · `/i/join/CODE` · `/influencer/settlement` | 전부 렌더 — "승인 대기" 배지 · 코드 표시 · 매장 자동 선택 · "협업 시작하기" · 정산 화면 매장 링크 |

**E5 에서 발견해 같은 날 고친 것**: ① 이메일 가입 500(아래 절, PR #1503·#1504) ② 등록증 가시성(아래 절, PR #1505) ③ 승계 주인에게 "위임받은 매장" 문구(PR #1505).
**못 잰 것**: 정산 skip(P15 ③ — 매출이 없어 payouts 행 자체가 0) · S-BROKER 실결제(테스트 매장에 이용권이 없다 — 대표가 올리거나 세션에 허락하면 진행) · 카카오 콜백 왕복(이메일 세션이라 OAuth 는 안 탔다 — state JWT 판정으로 대체).
**정리**: 테스트 유저 35~39 · 매장 15~17 · 코드·딜·claim 각 1 은 라이브에 남아 있다. 지우려면 어드민에서(세션은 D1 쓰기를 안 한다).

## 🩸 [E2] 이메일 가입 500 — E5 계정을 만들다 발견 (2026-09-20, 대표 "3번은 이메일 계정들로 지금 만들 수 있나?")

- 소비자 로그인 화면은 **카카오 전용**이라 이메일 가입 UI 는 없다. API(`POST /api/auth/register`)는 살아 있는데 라이브에서 **항상 500** 이었다.
  원인: 라이브 `users.id` 가 `INTEGER PRIMARY KEY AUTOINCREMENT` 인데 핸들러가 `generateId()`(TEXT) 를 id 에 넣어 datatype mismatch → catch → 'Registration failed'. 마지막 성공 가입 2026-03-15.
- 수정: id 컬럼을 INSERT 에서 빼고 `meta.last_row_id` 로 읽는다(카카오 upsert 와 같은 모양). 🩸 **첫 수정(PR #1503, users 만)을 배포하고도 500** — 라이브 `refresh_tokens.id` 도 INTEGER AUTOINCREMENT 였다(repair-schema 는 TEXT 로 선언 — 라이브와 다르다). users 행은 들어가고 refresh_tokens 에서 죽어 **고아 유저**가 남는다. 두 번째 수정으로 그 INSERT 도 id 를 뺐다. 가드 4건 + 주입 3건 빨간불 확인. tsc 0. 교훈: 500 의 원인을 스키마 한 곳만 보고 단정했다 — 같은 핸들러의 INSERT 전부를 라이브 pragma 로 대조했어야 했다.
- ⚠️ 이 API 로 만든 계정은 `ur_session` 쿠키로 로그인된다 — 브라우저 판정은 쿠키를 심어 한다. 대표가 손으로 만들려면 카카오 계정이 필요하다(화면이 그것뿐).

## 🧾 [E2] 등록증이 어드민·OCR·셀러 배너에 안 보이던 것 — E5 실사용에서 발견 (2026-09-20)

- 대시보드 매장 등록(`POST /api/seller/stores`, 직접·중개 모두)은 등록증을 `seller_meta.business_cert_url` 에만 적었고,
  어드민 승인 목록·상세·OCR·셀러 배너(`has_business_cert`)는 `sellers.business_registration_image_url` 컬럼만 읽었다.
  ⇒ 09-16 "사진을 받아 사람이 심사" 가 이 경로에서 **비어 있었다**. 실측: 테스트 매장 15·16·17 에서 OCR "제출된 이미지가 없습니다" · 대시보드 상단 "사본이 아직 없어요 — 서류 올리기".
- 수정: ① 등록이 컬럼에도 적는다(best-effort) ② SSOT `worker/utils/seller-cert-url.ts`(컬럼 → meta) ③ OCR·어드민 목록/상세(`admin-sellers/cert-fallback.ts`)·셀러 surface·세션 상태 넷이 폴백. 가드 5건 + 주입 4건 빨간불 확인. tsc 0.

## 🥕 [E2] 승인 대기 병목 — "준비는 지금, 노출·정산은 승인 뒤" (2026-09-20, 대표 *"2번은 더 이상적인 방법이 있어? 나머지 다 이상적으로"*)

**레일**: 유어딜 셀러 대시보드 + 정산 cron. **머니 경로 접촉**: 있음 — `payouts-generate` 에 **셀러 status 게이트**(제한만 추가, 승인 매장은 종전과 동일).
**롤백**: `isSeatableStoreStatus` → `active|approved` 직접 비교 환원 + payouts 의 `continue` 1줄 제거(둘은 짝이라 **반드시 함께**).

- 병목의 실체: 좌석 토큰(`/stores/:id/token`)이 `active|approved` 만 열어 **중개사가 등록한 매장은 승인 전엔 아무것도 못 했다**(이용권·협업 코드 전부 대기). 09-16 이 셀러 *계정*에 적용한 당근 규칙이 매장 *좌석*엔 안 미쳤다.
- 수정(SSOT `src/shared/seller-status.ts`): 좌석 = 대기·반려도 앉는다(정지·미지·null 제외) / 정산 = 승인·활성만. **두 집합이 다른 것이 설계의 전부** — 좌석을 열면서 정산 게이트를 빼면 09-16 사기 방어(등록증 + 어드민 승인)가 통째로 우회된다. 노출은 `approvedSellerProductSql` 이 이미 승인 매장만 내보낸다.
- 배선: 좌석 토큰·앉을 수 있는 매장 수(`store_ready`)·요약 API·이용권 매장 선택 화면(`StoreStep`) 네 곳이 같은 함수. `StoreSwitcher`·`StoreStep` 에 `심사 중`/`반려` 배지. 어드민 승인이 **위임 운영자(중개사)** 에게도 `store_approved` 알림(승계 전 매장은 `linked_user_id` 가 비어 종전 알림이 아무에게도 안 갔다). 협업 코드 `created_by` = 행위자 유저 id(좌석 토큰의 `operator_user_id` 를 `AuthUser` 로 통과).
- 더 이상적인 다음 단계(코드 있음·게이트 OFF): **S-OCR** `ocr_auto_verify_enabled` — 등록증 OCR 자동 승인. S-OCR-1~3 통과 뒤 켜면 사람 승인이 예외 처리로 줄어든다. 켜는 것은 대표 판단.
- 가드: `approval-gate-2026-09-20.test.ts` 10건 + 주입 4건(정산 게이트 소실 · 두 집합 동일화 · 좌석 환원 · 정지 개방) **되돌려-검증 빨간불 확인**. 낡은 지도 2건(d3 요약 필터·seller-stores 가산) 재조준. STAGING **P15**.
- 🩸 틀렸던 것: 주입 러너를 vitest 전수와 **동시에** 돌려 "복원 실패 의심"이 떴다 — 러너는 소스를 잠깐 고쳐 쓰므로 다른 검사와 병렬로 돌리면 안 된다. 순차로 돌리자 진짜 원인(낡은 지도 2건)이 남았다.

## 🪪 [E4] S-OCR 라이브 실측 — 라이선스 동의 뒤 (2026-09-21)

대표 *"동의해 너가 최대한 다 해주고"* → `POST /api/admin/ai/agree-ocr-model` 1회(응답은 `5016: Thank you for agreeing…` —
에러 모양이지만 성공이다). 그 뒤 합성 등록증 3종 OCR:

| 매장 | 서류 | 결과 |
|---|---|---|
| 16 | 부산 해운대구(매장은 전주 덕진구) | `mismatch` · "다른 지역입니다 (해운대구 ↔ 덕진구)" — **S-OCR-2 통과** |
| 17 | blur 5px | `unreadable` · 양쪽 `unknown` — **S-OCR-3 통과**(mismatch 아님) |
| 15 | 완전 일치(이름을 매장과 똑같이 다시 만들어 재업로드) | 5회 중 `match` **0회**: review(상호 1글자 오독) · unreadable(빈 응답) · review(주소 near) · review(주소 near) · unreadable(빈 응답). `business_registration_status` 는 5회 내내 `pending` — **S-OCR-4 통과** |

- 우리 결함 둘을 고쳤다(이 PR): ① 빈 응답 1회 재시도(`OCR_EMPTY_RETRIES=1`, 예외엔 미적용) ② `가리내 10길` → `가리내10길`
  도로명 숫자 붙이기(행정구역 뒤엔 안 붙인다). 가드 `ocr-empty-retry-2026-09-21.test.ts` 5건 + 주소 1건, 주입 3건 빨간불 확인.
- 고치지 않은 것(대표 판단): 상호 1글자 오독(`클로드`→`글로드`)은 `compareBizName` 이 **의도적으로** 오타를 안 봐줘 `review`.
  편집거리 허용은 자동 승인 문턱을 낮추는 일이라 결재 사항. 지금은 그 서류가 사람 큐에 남을 뿐이라 해가 없다.
- **E4(#1508 배포 뒤, 64KB 사진 4회)**: `match`·산문 거절·`match`·빈응답(2회 시도) — `match` 2/4(수리 전 0/5). #1509 가 ① 산문 거절도 재시도
  ② 문자열로 감싼 JSON 되살리기 ③ **셀러 상품 수정 매번 500**(응답 SELECT 의 없는 `image` 컬럼 — E5 에서 테스트 이용권 2916 을 숨기다 발견,
  UPDATE 는 반영되고 응답만 500 · 재고 응답이 legacy 컬럼 먼저라 등록 직후 0 으로 보임) 을 고친다.
- S-BROKER 준비: 매장 15 에 테스트 이용권 **2916**(1,000원, `is_active=0`·`HIDDEN`) 생성. 대표가 결제 전 어드민/대시보드에서 활성화(#1509 배포 뒤 대시보드 수정이 500 없이 된다).
- S-OCR-1 은 **대표 실사진**이 있어야 잰다(합성 문서는 폰트·해상도가 실물과 다르다 — 위 5회가 그 한계다).
- 게이트 `ocr_auto_verify_enabled` 는 **OFF 유지**. S-OCR-1 통과 + 수리 배포 뒤 매장 15 재호출에서 `match` 가 나오면 켤 후보.
- 🩸 틀렸던 것: 첫 판 등록증 상호를 `클로드분식 (테스트)` 로 만들어 매장 `[테스트] 클로드분식` 과 달랐다 — 판정이 `differ` 로 뜬 것을
  결함으로 읽을 뻔했다. 실측 픽스처는 **등록값을 그대로 복사**해 만들 것.

## 🧾 [E2] 대표 "각각 가장 이상적으로" 후속 (2026-09-21, 두 번째 PR)

- OCR 판정: 상호 **한 글자 오독 → `near`**(판정은 `review` 그대로, 어드민에게 "OCR 오독일 수 있다" 힌트만). `same` 으로 올리면 남의 가게 이름에서
  한 글자 바꾼 서류가 통과하므로 그건 결재(`docs/decisions/2026-09-21-ocr-auto-verify-gate.md` — 게이트 ON 여부·문턱 안 1~3, 기본안 2).
- OCR 파서: 등록번호 칸에 온 개업일을 제자리로(실측 5회 중 2회). 어드민 패널이 **못 읽은 이유**(빈 응답·산문·해석 실패) + 접힌 모델 원문을 그린다.
- S-BROKER 전제 라이브 확인(D1 읽기): 매장 15 `store_channel=brokered` · `broker_share_pct=10` · `broker_user_id=35(A)` · `influencer_pct_cap=5` ·
  operators = A(operator)·B(owner). 상품 **2916**(1,000원) 은 `HIDDEN`/`is_active=0` — 결제 직전 활성화가 필요하다(#1509 뒤 대시보드 수정 200).
  딜 결제 대체 검증은 **어드민 딜 지급 엔드포인트가 없어** 세션이 못 한다(D1 쓰기 금지) — 카드 결제는 대표.
- 모델 실패 모드 목록(2026-09-21 라이브 15회+ 누적): 빈 응답 · 산문 거절("정보가 없습니다") · JSON 을 문자열로 한 겹 감쌈 · 등록번호 칸에 개업일 ·
  **프롬프트 자리표시자 베낌**(`"biz_name":"상호(법인명)"` → 세 번째 PR 에서 null 처리) · 한 글자 오독(`글로드`) · 상호 대신 대표자 이름(`김테스트`) ·
  상호에서 `[테스트]` 접두 탈락(→ `contains`, 정상). 전부 파서 쪽에서 흡수 가능한 것은 흡수했고, 나머지는 `review`(사람 큐)로 떨어지며 해가 없다.
- 테스트 엔티티 목록(정리용): users 35(A 중개사)·36(B 사장님)·37(C 인플루언서) `claude-e5-*@claude-e5.invalid` · sellers 15·16·17 `[테스트] 클로드*` ·
  products 2916 · store_codes LMHS-YTBP/GGG4-VMYU/PBRN-YTGK · collab code EDF597WV · deal 1 · claim 1 · biz-cert 업로드 5장(`/api/media/uploads/biz-cert/2026-09/`).
  ⚠️ **어드민에 유저 삭제 엔드포인트가 없고, `DELETE /api/admin/sellers/:id` 는 삭제가 아니라 `status='suspended'` 정지다**(행은 남는다). products 만 `DELETE /api/admin/products/:id`. 정지된 테스트 매장은 `approvedSellerProductSql` 이 피드에서 걸러낸다. users 3명은 남는다(로그인 불가 도메인이라 해는 없음). 정리는 S-BROKER 뒤.

## 🔔 [E3] 서버 5xx 자동 알림 — 대표 "자동 알림 켜줘" (2026-09-21)

**계기**: 대표가 매장 등록에서 **500** 을 만났는데 흔적이 **어디에도 없었다.** 대표가 브라우저 콘솔을 복사해 와야 했다.
- 실측: `safeError` 는 5xx 를 **Sentry 로만** 보내는데(2026-06-12 배선) 그 Sentry 가 라이브에서 **429 Too Many Requests**
  (할당량 초과)라 보고가 통째로 버려지고 있었다. D1 엔 자리가 없었다 — `cron_failures` 는 cron 전용, `frontend_errors` 는 브라우저 JS.
  ⇒ **API 5xx 는 관측 밖이었다.**
- 수정: `worker/utils/server-error-alert.ts` — 5xx 를 `cron_failures` 에 `api:{태그}` 로 적는다(어드민 모니터링
  `GET /api/admin/cron-failures` → `/admin/system-monitoring` 이 **이미 읽는 표**라 새 화면 0). 같은 종류의 첫 건은 **어드민 벨**.
  폭주 방지가 코드의 절반이다 — isolate 메모로 태그별 창(기록 10분·벨 60분), 창 안이면 **D1 을 조회조차 안 한다**.
  DDL 0 · 4xx 제외 · 모든 실패 삼킴(알림이 요청을 깨뜨리면 주객전도).
- 가드 9건 + 주입 3건(폭주 방지 소실 · 4xx 포함 · 기록 실패 누출) **되돌려-검증 빨간불**.

**🩸 정작 그 500 은 재현하지 못했다 — 다음 세션이 헛짚지 않도록 확인한 것을 남긴다**:
- 라이브 D1: 그 시각 `sellers` 새 행 **0** ⇒ INSERT 전(또는 INSERT 에서) 실패다. 행이 생긴 뒤의 실패(메타·권한)는 아니다.
- 코드 재독: `POST /stores` 의 INSERT 전 경로는 전부 `.catch` 로 감싸여 있다(`resolveActorUserId`·`bnoColumnFree`·NTS 조회).
- 라이브 재현 2종 **둘 다 200**: ① 홍대돈까스와 **같은 사업자번호**(→ `bnoColumnFree=false` → 번호 없이 INSERT) ② **번호 없음**.
  `sellers.business_number` 는 `UNIQUE` 지만 SQLite 는 **NULL 중복을 허용**하므로 이 경로는 막히지 않는다(스키마 실측).
- 남은 가설(순위): D1 일시 오류(이 세션에서도 `code 971` rate limit 을 겪었다) · 배포 창(그 한 시간에 3번 배포) ·
  대표 브라우저의 **낡은 번들**(콘솔에 `index-BLWiVQiY.js`, 당시 라이브는 다른 해시) + 네트워크 단절(`ERR_NAME_NOT_RESOLVED` 연속).
- ⇒ **다음에 또 나면 이제는 `/admin/system-monitoring` 에 `api:[seller-stores]` 로 남는다.** 그게 이 작업의 요점이다.
- 정리: 재현용 매장 **18·19 는 닫았다**(`POST /stores/:id/close`).

## 🖱️ [E2] 매장 등록 모달 — 스크롤 표면 셋 → 하나 · 사업자번호 자동 하이픈 (2026-09-21 대표 신고)

대표: *"여기 스크롤하는게 어려워. 어느 부분에 손가락이나 마우스 커서를 대고 내리는지에 따라서 차이가 있어."*
- 원인: 지도 단계에 스크롤 표면이 **셋**이었다 — 모달 바디(`overflow-y-auto`) · 카카오 지도(제스처를 통째로 먹는다)
  · 결과 목록(`max-h-64` 자체 스크롤). 목록에 닿으려면 320px 지도를 **지나쳐야** 하는데 그 위에서는 아무것도 안 내려간다.
- 수정: `KakaoMapPicker` 에 `fill` prop(기본 false — 페이지 안 호출부 3곳 무영향). `fill` 이면 부모 높이를 채우는
  한 칸이 되어 **검색창·지도 고정 + 목록만 스크롤**(`flex-1 min-h-0 overscroll-contain`). 모달은 지도 단계에서만
  바디를 `overflow-hidden` 으로. 결과가 오면 지도가 260→160px 로 낮아져 목록이 넓어지고, 그때 **`relayout()`**
  을 부른다(안 부르면 줄어든 자리에 회색 띠가 남는다 — 높이만 바꾸면 반드시 밟는 함정).
- 같은 커밋: 사업자번호 입력이 타이핑하는 대로 `000-00-00000`(가입 폼과 **같은 포매터** SSOT, 전송은 숫자만 그대로).
- 가드 10건 + 주입 4건 **되돌려-검증 빨간불**. ⚠️ jsdom 은 레이아웃이 없어 "실제로 스크롤되는가"는 못 잰다 —
  시험은 *스크롤을 만드는 클래스가 어디 붙었나*만 고정한다. 눈 판정은 대표 화면이다.

## ⏭️ 다음 세션의 첫 액션

1. **대표 실사용 판정(E5 — 위 E4 가 못 본 생애주기)**: 대표 계정으로 `/seller/stores` 에서 중개 매장 하나 등록(요율 10/5) → 목록에 `XXXX-XXXX` 코드가 뜨는지 →
   다른 계정으로 `/store/find?code=…` → 매장이 자동 선택되는지. `/seller/influencer-deals` 에서 협업 코드 발급 → 세 번째 계정으로
   `/i/join/CODE` → "협업이 시작됐어요" + `/influencer/settlement` 에 매장 링크·수락 대기 딜이 보이는지.
2. **S-OCR 수리 판정**: 배포 뒤 `POST /api/admin/sellers/15/business-registration/ocr` 3회 → `match` 가 한 번이라도 나오는지 · `unreadable` 이 줄었는지(재시도 메시지 `(2회 시도)`).
3. **S-BROKER 실결제**(게이트는 09-20 에 이미 ON — 대표 지시): `docs/STAGING_CHECKLIST.md` 5건. 판정 쿼리:
   `SELECT influencer_id, commission_amount, status, source FROM influencer_attributions WHERE source='broker_share'`.
4. 남은 미흡(이번 범위 밖): 코드 발급자 `store_codes.created_by` 는 셀러 라우트에선 seller id 다(유저 id 아님) — 표시용이라 무해하나
   감사 로그로 쓰려면 정리. 인플루언서 정산 페이지의 `MyRankCard` 등 옛 이모지 잔재는 design-slop 래칫 대상 아님(소비자 마이).

## 남은 결정

- `broker_share_enabled` ON 시점 — S-BROKER 뒤 대표 판단(결재 09-16 그대로).
- 협업 코드 기본 `requires_approval` 을 OFF(즉시 활성)로 뒀다. 대표가 "승인 필요"를 기본으로 원하면 `CollabCodesSection` 초기값 1줄.

---

## 2026-09-24 — 유보 10일이 사장님 화면에서는 안 지켜지고 있었다 (#1521 의 짝)

**#1521 을 머지하며 리뷰하다 찾은 것.** 그 PR 은 정산 유보(적립 후 역일 14일 = 영업일 10일)를 넣으면서
**약관 제4조와 셀러 가이드를 같이 고쳤는데 대시보드만 빼먹었다.** `/seller/settlements` 는 그대로:

> "정산은 매주 자동으로 처리됩니다" · **미지급 (정산 예정 잔액)** — 힌트 **"다음 집계 대상"**

유보가 생긴 뒤 그 힌트는 방금 적립된 돈에 대해 **거짓**이다(다음 집계가 아니라 2주 뒤). 숫자가 틀린 게
아니라 **화면이 못 지킬 약속을 하는 것**이라 어떤 테스트도 어떤 에러도 안 난다. 첫 실매장이 뭔가 팔면
사장님이 "돈은 떠 있는데 왜 안 들어오지"로 겪는다. 라이브 영향은 아직 0(거래 0 · 최소출금액 미만).

**수리**
- `payout-hold.ts` 에 **여집합** `heldSql` 추가 — cron 이 쓰는 `sql` 과 **같은 함수가 같은 cutoff 로** 만든다.
  화면 쪽에서 부등호를 손으로 뒤집으면 `payout_hold_days` 를 바꾼 날(그게 이 기능의 롤백 수단이다)
  한쪽만 따라가서 갈린다.
- ⚠️ `heldSql` 은 `created_at > cutoff` **OR `created_at IS NULL`** 이다. SQL 3값 논리에서 NULL 은
  `<=` 도 `>` 도 거짓이라, 순진하게 부등호만 뒤집으면 그런 행이 **양쪽 어디에도 안 잡힌다**(cron 은
  집계에서 빼므로 화면도 '유보 중'이라고 말해야 둘이 같은 소리를 한다). 실제로는 INSERT 가 그 컬럼을
  안 넘겨 `DEFAULT CURRENT_TIMESTAMP` 가 늘 박히지만, 갈리는 길을 애초에 안 만든다.
- `GET /api/seller/payouts` 응답에 `held`(미지급 중 아직 안 익은 몫, `payable` 로 클램프) + `hold_days`.
- `AutoPayoutSection` — 유보 안내 한 줄 + 미지급 힌트가 `₩{익은 것} 다음 집계 · ₩{유보 중} 유보 중` 으로.
  **서버가 준 값만 쓴다**(화면이 유보일을 지어내면 설정을 바꾼 날 안내가 거짓말이 된다).
  `hold_days` 가 없으면(구버전 응답) 종전 문구 그대로 — 무회귀.

**🩸 내 시험이 두 번 헛돌았다(둘 다 스스로 잡았다)**
1. `expect(...).not.toContain?.call(null)` 이라는 **쓰레기 줄**을 남겼다 — 단언이 아니라 그냥 던졌다.
2. "부등호를 손으로 쓰지 말 것" 을 `/created_at\s*[<>]/` 로 썼는데, 같은 파일의 **운영자 스코프**
   (`created_at >= ?`, 2026-09-07 합류 이후만 보여 주는 조건)까지 먹어 빨간불이 났다. 무관한 선재 코드다.
   ⇒ 막아야 하는 건 부등호가 아니라 **cutoff 를 손으로 짓는 것**이라, 앵커를 `datetime('now'` 로 바꿨다.

**검증**: tsc 0 · 유보 시험 21건 pass · 주입 **11건 전부 되돌려-검증 빨간불**(내 6 + #1521 의 5).

### 🔴 그리고 유보의 **롤백 손잡이가 화면에 없었다** (같은 날 후속)

위 수리를 하다 어드민 설정 화면을 보고 발견. 두 개가 동시에 어긋나 있었다:

| 키 | 화면에 있나 | 코드가 읽나 |
|---|---|---|
| `settlement_hold_days` (라벨 **"정산 대기 기간 (일)"**, 기본 7) | ✅ 있었다 | ❌ **0건** — 검증표 한 줄 외에 참조 없음 |
| `payout_hold_days` (진짜 유보, 기본 14) | ❌ **없었다** | ✅ `payout-hold.ts` |

즉 대표가 유보를 줄이거나 끄려고 *"정산 대기 기간"* 을 고치면 **아무 일도 안 일어나고**, 돈은 그대로
2주 묶인 채 화면만 저장됐다고 말한다. 그런데 #1521 본문은 *"일수는 `payout_hold_days` 로 빼서 재배포
없이 조정 — 머니 경로의 롤백 시간이 곧 손실 크기다"* 라고 적고 있었다. **그 롤백 수단에 아무도 닿을 수
없는 상태였다**(이 세션의 CF 토큰은 읽기 전용이고 D1 쓰기는 금지라, 코드 말고는 길이 없다).

수리: 죽은 행을 진짜 키로 교체 + `payout_hold_days` 에 `intRange(0,365)` 검증 추가(미등록 키는
pass-through 라 검증이 없으면 `abc` 가 저장되고 fail-closed 가 **조용히 14로 되돌린다** — 대표는 0을
넣었다고 믿는데 돈은 계속 묶인다). 가드가 *"코드가 실제로 읽는 키를 화면이 쓰는가"* 를 소스에서
**역으로 파싱해** 대조하므로, 키 이름을 바꾸면 화면도 따라오지 않으면 빨간불이 난다.

**남은 것 (이번 범위 밖)**
- `restaurant_settlements`(Rail A)는 여전히 채널을 모르고 항상 5% 다. 직접 입점 매장이 생기면 같은
  이용권 사용에 Rail A 5% / Rail B 10% 를 뗀다. #1521 이 결재 Q4 로 올려 둔 그대로 **대기**.
- 어드민 `/admin/payouts/pending` 응답의 `hold_days` 는 아직 화면에 안 쓰인다(진단용).

### ✅ 배포 후 판정 — 라이브 번들 실측 (2026-09-24)

머지 `6aa22bb`(PR #1541) · Cloudflare Pages 배포 성공. **라이브가 실제로 서빙하는 청크를 받아서 재 봤다**
(주장이 아니라 측정 — 어드민 라우트 표 `app-routes-*.js` 에서 청크 이름을 따라가 직접 GET):

| 잰 것 | 결과 |
|---|---|
| `AdminPlatformSettingsPage-*.js` 에 `payout_hold_days` | ✅ 있다 |
| 그 라벨 | ✅ `정산 유보 기간 (역일 · 기본 14 = 영업일 10일, 0이면 유보 없음)` |
| **죽은 키 `settlement_hold_days`** | ✅ **0건** — 화면에서 사라졌다 |
| `SellerSettlementsPage-*.js` 의 유보 안내 문구 | ✅ 있다 |
| 새 힌트 `₩{{ready}} 다음 집계 · ₩{{held}} 유보 중` | ✅ 있다 |
| `hold_days` 참조(서버 값만 쓰는가) | ✅ 1건 |

⚠️ **이 측정이 증명하지 않는 것**: 행이 *렌더되는지*와 *저장이 실제로 먹는지*는 로그인이 필요해 안 쟀다.
번들에 실렸다는 것까지가 이 측정의 범위다. 저장 경로는 2026-08-02 에 **조용히 안 저장되던 전례**가 있으므로
(`/admin/platform-settings` 가 편집 중 RQ 리페치로 폼을 덮어썼다), 대표가 유보일을 처음 바꿀 때
**저장 후 값이 그대로 남아 있는지 한 번 확인**할 것.

**남은 것**: `restaurant_settlements`(Rail A) 요율 일원화는 #1521 이 결재 **Q4** 로 올린 그대로 대표 판단 대기.
