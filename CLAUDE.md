# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## 🌐 유어딜 플랫폼 모델 SSOT — 전 세션 자동 최신화 (2026-07-02 대표 지시 "어떤 세션에서 작업하더라도 자동 업데이트")

**플랫폼 전체 그림(SSOT)** = `docs/design/urdeal-platform-model.md` (드릴다운: `linkshop-role-model.md`) + **대외 비즈니스 문서** `docs/business/urdeal-business-plan.md`(사업계획/회사소개/입점제안). 새 세션은 이 문서로 전체 구조(3서비스·행위자·상품종류·경제·성장·데이터)를 먼저 잡는다. **어드민 `/admin/platform-model` 에서 두 문서 모두 탭으로 열람**(`?raw` import → 배포 시 자동 동기화).

**🔄 필수 룰 (모든 세션 준수 — "자동 업데이트"의 실체는 이 규칙이다)**: 플랫폼 **구조**가 바뀌면 **같은 커밋에서** 이 문서를 갱신한다. 구조 = 행위자(부류)·상품/콘텐츠 종류·커미션/정산의 *종류*·서비스 경계·역할·성장 루프·주요 라우트. 예:
- 새 행위자·역할(`seller-roles.ts`)·상품종류(`voucher-categories`)·커미션종류(affiliate/영입/공급자 helper) 추가/변경 → §2~5 갱신
- 새 소비자 기능 도메인(`features/*`)·주요 라우트 신설 → §3~4 갱신
- 서비스 분리 경계·명칭 SSOT 변경 → §1·§3 갱신
- ❗ **수치(%·기간·금액)만의 변경은 문서 갱신 불필요** — 값은 어드민(`platform_settings`) 조정 대상이고 문서는 *구조*만 고정(문서에도 "어드민 조정 기본값"으로만 표기).

**자동 강제**: `scripts/check-platform-model-sync.mjs` (pre-commit + audit-gate, warn·`STRICT_PLATFORM_MODEL=1` block) — 구조 파일 staged 인데 문서 미갱신이면 경고. 우회: 수치만 변경이면 무관, 의도적이면 commit 메시지 `[SKIP_PLATFORM_MODEL]`. 문서 하단 "구현 로그"에 단계 완료 시 commit hash 기록.

> ⚠️ 이 룰 안 지키면: 문서가 낡아 다음 세션이 옛 구조로 오판 → 대표가 "왜 문서랑 코드가 달라?" 반복. (블로그 시드·운영 가이드 자동 sync 와 동일 철학.)

## 🤖 AI 팀 운영 모델 — 역할 7(판정 6 + 운영 1) · 결재함 1 · 완료 판정 E1~E5 (2026-09-07 대표 확정, 모든 세션 준수)

대표: *"세계 최고의 전문가 담당자(경영·기획·마케팅·디자인·개발·정산) 팀을 빌딩해서 최대한 자동화 운영"* +
*"미완성·에러·문제가 곳곳에 숨어있었는데도 완성되었다고 판단하는 경우가 많았어."*

**SSOT = `docs/design/ai-team-operating-model.md`.** 세 가지가 파일로 고정돼 있다:
1. **역할** — `.claude/agents/{ceo-office,planning,marketing,design,dev,finance,ops}.md`. 세션이 어떤 역할로 일하는지는 이 파일의
   프론트매터(허용 도구·결정권·금지 레일·읽을 SSOT·보고 형식)가 정한다. 채팅에서 즉석으로 역할을 부여하지 않는다.
2. **결재함** — 대표가 판단할 것은 **`docs/decisions/<날짜>-<슬러그>.md` 로만** 올린다(필수 필드는 `_template.md`).
   handoff·PR·채팅에 "대표 판단 필요" 라고만 적고 끝내는 것 금지. 결정은 대표가 한 말 **그대로** 옮긴다.
3. **완료 판정** — "완료" 라는 말은 **증거 등급 E4(라이브에서 의도한 효과를 실측) 이상**에서만 쓴다.
   E1 작성됨 · E2 검증됨(tsc·vitest·가드·되돌려-검증) · E3 머지·배포됨 · **E4 라이브 판정됨** · E5 사용자 판정됨.
   **모든 보고 첫 줄에 `[E등급]`** 을 적는다. E3 에서 멈추면 "배포됐다"까지만 말한다. 머니 경로의 E4 는 staging 실결제다.

결정권은 세 등급뿐이다 — **A 자율 / B 세 줄 보고 후 진행 / C 결재(승인 전 실행 금지)**. 결제·정산·요율·환불·원장·커미션 ·
게이트 ON · 발행/발송 · 삭제/purge · 잠금표 파일 · 유료 전환은 **전부 C**. 애매하면 한 등급 위.
행위자·베네핏의 "지금 살아 있는 값"은 `docs/design/actor-benefit-map.md` 한 장(코드·`platform_settings` 실측이 진실).
가드: `src/tests/unit/ai-team-operating-model.test.ts` + 주입 매니페스트 2건.

## 🧱 서비스 철저 분리 — 유어딜 공구(소비자) ↔ **공구 서비스(운영자 SaaS)** ↔ 유어애즈 (2026-06-26 대표 명령 · 2026-10-11 도매몰 철거)

> 🧨 **2026-10-11 — 도매몰(유통스타트)은 코드에서 철거됐다.** 대표 *"도매몰 잔해들은 아예 다 삭제해줘"*.
> 177파일 삭제(라우트 마운트 · 화면 전부 · 어드민 도매 밴드 3개 · `features/supply` 의 도매 라우트 50).
> **아래 표의 '도매몰' 열은 역사 기록이다** — 새 작업에 도매 축은 없다. 상세·경계: `docs/design/wholesale-teardown-plan.md`,
> 실행 기록: `docs/design/urdeal-platform-model.md` §1.
>
> 🔴 **그래도 `features/supply/` 를 통째로 지우지 말 것** — 디렉터리 이름이 `supply` 라서 도매 전용으로 보이지만
> **소비자 결제·환불·cron 이 그 안의 정산 엔진을 직접 부른다**(`supply-settlement`·`supply-visibility`·
> `wholesale-deposit-core`·`supplier-withdrawal-core`). 거기에 **유어애즈가 쓰는 maker 풀**과 **공구 서비스의
> 몰 인프라**(`wholesale-malls*` — 이름만 wholesale 이다)도 같이 산다. 가드가 양방향을 고정한다:
> `src/tests/unit/wholesale-teardown-2026-10-11.test.ts`(21건 + 주입 8).
>
> 🩸 **이름으로 분류하지 말 것** — 2026-10-11 철거 때 `SellerRegisterSupplierPage.tsx` 를 "Supplier" 라는
> 이름만 보고 지웠는데, 그건 **유어딜 사업자 유저 가입** 화면이었다(옛 라우트 `/seller/register/supplier`).
> 주입 앵커 검사가 잡아 복원했다. 반대 방향도 같다 — `wholesale-malls.ts` 는 이름이 도매인데 **공구 서비스**다.
>
> 🪦 **2026-10-12 — 그 파일은 이번엔 *쓰임으로* 지웠다.** 가입 문이 2026-10-10 부터 `/store/new` 하나라
> `SellerRegisterSupplierPage` 와 그 부품(가게 카드·주소 검색·확인 시트·약관 상자)은 **import 하는 곳이 0** 이었다.
> 옛 링크 `/seller/register/supplier` 는 라우트(`LegacySellerRegisterRedirect`)로 계속 살아 있고, 시험이 그 라우트를 지킨다.
> ⇒ 판단 기준은 이름도 "단위 시험이 참조한다"도 아니다 — **실제로 import·라우팅되는가**다(시험은 지킬 코드를 따라 줄인다).
>
> ✅ **코드 밖 잔여 — 2026-10-13 전부 결정 완료**(다시 묻지 말 것): `role='wholesale'` 어드민 계정은 **소프트 삭제**(10-12) ·
> `ur-wholesale` Pages 프로젝트는 **410 묘비만 올린 채 존치**(대표 *"그대로 둘게 귀찮아"* — 프로젝트를 안 지우므로
> `deploy-wholesale.yml`·`deploy/ur-wholesale-tombstone/`·`scripts/pages-tombstone-gate.mjs` 도 **지우지 말 것**, 지우면
> 그 프로젝트가 다시 소비자 앱 사본을 빌드한다) · `utongstart.com` **갱신 안 함**(대표 *"갱신 안해"* — 만료되게 둔다) ·
> DB 테이블은 회계 증빙으로 **존치**.

> 🆕 **2026-08-03 — 축이 셋이 됐다.** 이 절은 오래 "두 서비스"였는데, 그 사이 **공구 서비스**
> (매장 업주가 자기 몰을 열고 픽업 공구를 파는 운영자 SaaS)가 **도매몰 코드를 용도 변경해**
> 구현되기 시작했다(2026-07-29 대표 사업설계 · `docs/design/operator-mall-saas-gap.md`).
>
> ⚠️ **이 문서가 낡아서 실제 사고가 났다**: 2026-08-03 세션이 **공구 서비스의 오픈 차단 항목**
> (미수령 고지 문구·브랜딩·실결제)을 **"유어딜 일"로 대표에게 보고**했다. 서로 다른 서비스의
> 할 일이 한 목록에 섞였고, 대표가 *"유어딜과 공동구매 분리를 잘 생각해라"* 고 바로잡아 줬다.
>
> 🔑 **작업·보고 전에 "이건 넷 중 어디인가"를 먼저 밝힌다**(유어애즈 포함). 특히 헷갈리는 짝 —
> **유어딜의 이용권**(소비자가 즉시 구매, `urdeal.kr/group-buy/:id`) ↔ **공구 서비스의 픽업 공구**
> (운영자가 자기 몰에서, `urdeal.kr/{몰슬러그}`). **코드가 둘 다 `group_buy_*` 라고 부르지만 서비스가 다르다.**
> 서비스 지도 SSOT: `docs/design/urdeal-platform-model.md` §1.

**대표 지시**: "도매몰과 유어딜 공구 서비스를 철저히 분리해서 작업해야 해. 어떠한 세션에서도."

이 레포는 **별개의 두 서비스**를 한 코드베이스에 담고 있다. **한쪽 작업이 다른 쪽에 새지 않게** 하는 것이 최우선 룰. 작업 전 "이건 어느 서비스인가?"를 먼저 판별하고, **그 서비스 경계 안에서만** 변경한다.

| 축 | 🏭 **도매몰 (유통스타트, B2B)** | 🎟️ **유어딜 공구 (소비자)** |
|---|---|---|
| 정체성 | 제조사→판매사 B2B 도매 (도매가/예치금/정산) | 소비자 공동구매·교환권·쇼핑 (딜포인트/결제) |
| 행위자 | 제조사(supplier) · 판매사(distributor=`sellers.is_distributor=1`) · 도매 어드민(`admin role='wholesale'`) | 유저(소비자) · 사업자유저(셀러) · 일반 어드민 |
| 라우트(페이지) | `/wholesale/*` · `/supplier/*` · `/admin/wholesale-*` · `/admin/distributor*` · `/admin/suppliers` · `/admin/distributor-approval` | `/` · `/group-buy` · `/community-group-buy` · `/vouchers` · `/products` · `/browse` · `/u/*` · `/seller/*`(소비자 셀러) |
| API 네임스페이스 | `/api/wholesale/*` · `/api/supplier/*` · `/api/admin/wholesale-*` · `/api/admin/distributor*` · `/api/admin/suppliers` · `/api/admin/supplier-products` | `/api/group-buy/*` · `/api/community-group-buy/*` · `/api/products` · `/api/vouchers` · `/api/orders`(소비자) |
| 코드 | `src/features/supply/**` · `src/pages/wholesale*/**` · `src/pages/supplier-dashboard/**` · `src/components/wholesale/**` | `src/features/group-buy/**` · `src/features/community-group-buy/**` · `src/pages/main-home/**` · `src/pages/GroupBuy*.tsx` · `src/pages/Vouchers*.tsx` |
| 브랜드/도메인 | 유통스타트 · `utongstart.com` | 유어딜 · `urdeal.kr` (2026-07-20 이전 — 구 `live.ur-team.com` 은 영구 301) |

**룰**:
1. **한 서비스 작업 시 다른 서비스 파일/라우트/네임스페이스를 건드리지 말 것.** 예: 도매 정산 수정이 소비자 정산을, 도매 상품등록이 소비자 카탈로그를 바꾸면 안 됨.
2. **공유 테이블은 구분 플래그로 격리** — `products.is_supply_product`(도매=1) · `sellers.is_distributor`(판매사=1). 한쪽 쿼리/변경이 반대쪽 행을 건드리지 않게 WHERE 에 항상 플래그 포함. 새 공유 컬럼 추가 금지(예산제 — `product_supply_meta` 사이드테이블).
3. **"공구"는 둘 다 존재** — 도매에 B2B 발주가 있고 소비자엔 공동구매가 있음. 맥락(행위자/라우트/네임스페이스)으로 어느 쪽인지 먼저 확정. `community-group-buy`=소비자, `wholesale/orders`=도매.
4. **크로스-서비스 변경이 정말 필요하면** — 착수 전 **세 줄만 보고하고 바로 진행**한다(2026-07-29 대표 확정 — 이전의 "`AskUserQuestion` 으로 승인 대기"를 **대체**. 매번 멈추지 말 것):
   **(a) 어느 레일을 만지는가**(도매 / 소비자(유어딜) / **공구 서비스(운영자 몰)** / 유어애즈 / 여럿 — 여럿이면 파일·네임스페이스) · **(b) 머니 경로 접촉 여부**(결제·정산·적립·환불·원장 중 무엇, 없으면 "없음") · **(c) 롤백 방법**(게이트 OFF / revert / 블록 제거).
   ⚠️ (b)가 "있음"이면 **단독 세션 + staging 실결제** 룰이 추가로 붙는다. 상세: `docs/design/pickup-groupbuy-wholesale-link.md` §7.2
> 💳 **결제 수단 오해 방지 (2026-07-29 실측 정정)**: 소스 주석 `wholesale-plus.routes.ts:4` 의
> *"도매몰은 PG(Toss) 미사용 — 예치금에서 차감"* 은 **그 파일(연 구독) 맥락이지 도매 전체가 아니다.**
> 도매에도 Toss 경로가 있다(`wholesale.routes.ts:1775 POST /orders/confirm` → `confirmTossPayment`).
> **소비자가 그 경로를 못 타는 진짜 이유는 PG 부재가 아니라** `seller_token` 필수 · `distributor_seller_id`
> 스코프 · 대상 테이블 `wholesale_orders`(B2B) 다. 몰 주문을 소비자에게 팔려면 **소비자 `orders` 레일**로
> 태워야 한다(`payment.routes` 무수정). 상세: `docs/design/operator-mall-saas-gap.md` §3.

5. 자동 가드: `scripts/check-dashboard-api-crossrole.mjs`(역할별 API 네임스페이스 격리) — 이 분리의 일부를 결정론으로 강제.

> ⚠️ 이 룰 위반 시: 한 서비스 버그픽스가 다른 서비스를 망가뜨림 + 대표가 "왜 도매 고쳤는데 공구가 깨졌어?" 반복.

## 🔒 Toss V2 docs audit 잠금 (2026-05-24 — 사용자 명령)

**배경**: 2026-05-24 사용자가 토스페이먼츠 V2 공식 docs 9개를 직접 공유하여 SDK / 결제승인 응답 / 에러코드 (~100) / 결제위젯 어드민 / Webhook / 결제취소 / 간편결제 응답 / 세금처리 / 결제결과안내 / 지급대행 / Status Page / WebView 전 영역 audit + 정합 작업 완료.

**🚫 절대 룰**: 아래 파일/심볼은 **사용자 명시 허가 없이 직접 수정 금지**. 변경 필요할 때는 반드시 사용자에게 먼저 질문할 것 (`AskUserQuestion`).

| 파일 | 잠긴 이유 |
|---|---|
| `src/worker/utils/toss-gateway.ts` | confirmTossPayment / cancelTossPayment / detectTossKeyType / decideTossFlow / generateTossOrderId — V2 docs SSOT |
| `src/worker/utils/toss-error-messages.ts` | ~100개 에러코드 SSOT (docs `/reference/error-codes`) |
| `src/worker/utils/toss-refund.ts` | gateway wrapper. 직접 수정 X, 변경은 gateway 에서 |
| `src/worker/utils/toss-payments.ts` | gateway wrapper |
| `src/worker/utils/refund.ts` | gateway wrapper |
| `src/worker/routes/payment.routes.ts` | /confirm / amount 검증 / client-key endpoint — docs 준수 |
| `src/worker/routes/webhook.routes.ts` | V2 이벤트 (PAYMENT_STATUS_CHANGED 등) + graceful 시그니처 |
| `src/components/payments/TossPaymentWidget.tsx` | V2 SDK widgets() / customerEmail / customerName / orderName 100자 |
| `src/pages/TossWidgetPayPage.tsx` | 딜 충전용 widgets() flow |
| `src/pages/PaymentSuccessPage.tsx` | TossPaymentObject 필드 표시 (receipt.url / cashReceipt / easyPay / card) |
| `src/shared/types/index.ts` | TossEventType / TossWebhookPayload — V2 docs 사양 |

**예외 (수정 OK — 사용자 허가 불필요)**:
- 새로 추가되는 결제 시나리오에서 SSOT helper (`confirmTossPayment` / `cancelTossPayment`) 를 **호출**하는 코드 — 단, helper 자체는 변경 X
- 운영 가이드 / 주석 / 비-결제 UI 문자열만의 변경

**수정 절차 (예외 발생 시)**:
1. `AskUserQuestion` 으로 의도/근거 설명 + 확인 받기
2. 변경 사유 + docs URL 인용 + commit 메시지 명시
3. 변경 기록을 아래 audit log 디렉터리에 **파일 하나로** 추가(옛 큰 파일은 동결)

### 변경 audit log

📄 **전문 → `docs/locks/toss-v2-audit-log.md`**(기록 48건, 2026-05-24 ~ 2026-11-01, **동결**) + `docs/locks/toss/`(그 뒤)

🔴 **위 잠금표의 파일을 건드리기 전에 grep 할 것** — 왜 지금 그 모양인지와
**이미 시도해 실패한 처방**이 거기 있다. 안 읽고 고치면 같은 것을 두 번 밟는다.
`grep -rn 'payment.routes' docs/locks/`

➕ **새 `[UNLOCK]` 기록은 `docs/locks/toss/<날짜>-<슬러그>.md` 파일 하나로 쓴다** — 옛 파일 맨 위에 적지 말 것
(**동결**: 항목 수가 늘면 CI 빨간불). 모든 세션이 같은 줄에 적어서 머지마다 충돌했다(2026-11-01).

## 🔒 로딩 최적화 잠금 (2026-05-27 — 사용자 명령)

**배경**: 2026-05-27 사용자가 메인/공구/쇼핑/교환권/링크샵 페이지 로딩 속도 + KV 비용 + 상품 수 확장성 동시에 이상적으로 최적화 완료. 이 영역의 회귀는 즉시 사용자 체감 + Cloudflare 비용 발생.

**🚫 절대 룰**: 아래 파일/심볼은 **사용자 명시 허가 없이 변경/제거 금지**. 추가는 OK (예: 이미지 host 화이트리스트 확장), 제거/약화는 금지.

| 파일 | 잠긴 항목 | 회귀 시 발생 |
|---|---|---|
| `src/worker/middleware/edge-cache.ts` | `publicCache` 의 `useKv: false` 기본 | KV write 한도 초과 → 월 $2-5 비용 |
| `src/worker/middleware/edge-cache.ts` | `CDN-Cache-Control` 분리 헤더 | 브라우저/edge TTL trade-off 깨짐 |
| `src/worker/index.ts` | HTMLRewriter SSR inject 블록 (4페이지) + `caches.default.match` 직접 read | SSR 0 RTT 회귀 → 메인 페이지 200-500ms ↑ |
| `src/worker/cron/cache-prewarm.ts` | `HOT_PATHS` 의 SSR key 정확 매칭 | SSR cache miss → 첫 사용자 skeleton |
| `src/utils/cf-image.ts` | `SUPPORTED_HOSTS` / `EXTERNAL_PROXY_HOSTS` | 추가 OK, **제거 금지** (LCP 회귀, 트래픽 ↑) |
| `src/utils/cf-image.ts` | Save-Data 감지 quality 자동 조절 | 모바일 데이터 절약 사용자 트래픽 ↑ |
| `src/worker/index.ts` `/api/image/resize` | `ALLOWED_HOSTS` | 같음 |
| `src/components/RestaurantMiniMap.tsx` | IntersectionObserver lazy load (`shouldLoadSdk`) | 모든 공구 상세 페이지 SDK 즉시 로드 회귀 |
| `src/components/auth/RouteGuards.tsx` | `isAdminLoggedIn` / `isUserLoggedIn` / `isSellerLoggedIn` 토큰 존재 검사 | admin↔user 이중 로그인 자동 로그아웃 회귀 (`user_type` 추가 검사 X) |
| `src/components/main/BottomNav.tsx` | `linkshopPath` localStorage cache 우선 (seller_username → linked_seller_username → user_handle) | 매번 API 호출, `/host/new` fall through |
| `src/components/main/BottomNav.tsx` | `isActivePath` 가 `/profile/`, `/s/` 도 링크샵 활성 | 링크샵 탭 비활성 표시 |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | hover/touch/focus prefetch + IntersectionObserver viewport prefetch | 카드 클릭 시 fetch waterfall |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | image fade-in (`opacity` transition) + aboveFold eager | UX 깜빡임 |
| `src/pages/GroupBuyDetailPage.tsx` | `__SSR_INITIAL_DETAIL__` 즉시 사용 | 상세 페이지 fetch waterfall |
| `src/pages/SellerPublicPage.tsx` | `__SSR_INITIAL_SELLER__` 즉시 사용 | 셀러 페이지 fetch waterfall |
| `src/pages/VouchersPage.tsx` | `__SSR_INITIAL_VOUCHERS__` 즉시 사용 + default sort `price_low` | first paint 회귀 |
| `src/pages/BrowsePage.tsx` | `__SSR_INITIAL_BROWSE__` 즉시 사용 | first paint 회귀 |
| `src/features/auth/services/KakaoAuthService.ts` | `upsertUser` 의 same-email seller auto-link | `/host/new` fall through 사고 회귀 |
| `src/features/auth/api/kakao.routes.ts` | `issueLinkedRoleTokens` 응답에 `seller.username` 포함 | localStorage `seller_username` 누락 |
| `src/pages/KakaoCallbackPage.tsx` | `seller_username` localStorage 저장 + admin/agency 토큰 있을 때 user_type 보존 | 이중 로그인 race |
| `src/worker/routes/repair-schema.routes.ts` | `backfill: sellers.linked_user_id (same-email)` UPDATE | 시드 데이터 정정 못 함 |
| `index.html` | preload `crossOrigin` 속성 없음 (same-origin) | preload mismatch → 200-500ms 손해 |
| `index.html` | Speculation Rules prerender 대상 (`/group-buy/*`, `/products/*`, `/live/*`) | 카드 클릭 후 prerender 효과 X |
| `index.html` | preconnect (`firebasestorage.googleapis.com` 등) | DNS+TLS 100-200ms 손해 |
| ~~`src/App.tsx`~~ | ~~`MainHomePage` eager `import` (lazy X)~~ → **2026-07-29 폐기**: 홈이 `HomeRoute`(PC=`PcHomePage` / 모바일=`MobileHomePage`, **둘 다 lazy**)로 바뀌면서 `MainHomePage` 는 참조 0인 죽은 파일이 됐다. 🩸 **2026-10-08 정정**: 여기 오래 *"모바일=`RestaurantMapPage`"* 라고 적혀 있었다 — **2026-08-19 대표 확정(그루폰 모바일 홈)으로 모바일 홈은 지도가 아니라 딜 피드(`pages/mobile-home/MobileHomePage`)가 됐고 지도는 `/map` 으로 남았다**(`HomeRoute.tsx` 머리말이 그 전환을 명시한다). 첫 페인트 작업을 하던 세션이 이 줄을 믿고 *"모바일 홈은 지도라 서버가 그릴 게 없다"* 고 오판할 뻔했다 — 실제로는 **사진 있는 카드 4장**이 첫 화면이고 시드(`__SSR_INITIAL_MAIN__`·`__SSR_INITIAL_SECTIONS__`)도 이미 와 있다. `check-lock-table-symbols` 는 심볼 **존재**만 보므로 이렇게 *다른 파일로 옮겨간* 경우를 못 잡는다(그 가드가 스스로 적어 둔 한계). 이 행을 그대로 따르면 **죽은 컴포넌트를 eager import 로 되살리게 된다.** 현재 홈 lazy 는 App.tsx:46 이 명시한 의도적 트레이드오프(카카오 SDK async 로드라 청크 페치가 가려짐) | (해당 없음) |
| `src/App.tsx` | idle prefetch (BrowsePage / VouchersPage / UserProfilePage / MyVouchersPage / SellerPublicPage) | 탭 클릭 시 chunk fetch 대기 |
| Migration `0276_products_groupbuy_perf_index` | `idx_products_groupbuy_feed` partial composite index | 풀스캔 회귀 → 상품 늘면 선형 느려짐 |
| Migration `0080` FTS5 | `products_fts` virtual table | 검색 풀스캔 회귀 |

**예외 (수정 OK — 사용자 허가 불필요)**:
- 새 페이지 / 새 SSR slot 추가 (기존 4 페이지 inject 패턴 따라)
- `EXTERNAL_PROXY_HOSTS` / `ALLOWED_HOSTS` **추가** (제거 X)
- 새 BottomNav 탭 추가 (기존 5탭 active path 패턴 보존)
- 새 cron HOT_PATHS 추가 (제거 X)

**수정 절차 (예외 발생 시)**:
1. `AskUserQuestion` 으로 의도/근거 + 회귀 영향 설명
2. 변경 사유 + commit 메시지에 잠금 해제 명시 (`[UNLOCK_LOADING]`)
3. 변경 기록을 아래 audit log 디렉터리에 **파일 하나로** 추가(옛 큰 파일은 동결)

### 변경 audit log

📄 **전문 → `docs/locks/loading-audit-log.md`**(기록 239건, 2026-05-27 ~ 2026-11-01, **동결**) + `docs/locks/loading/`(그 뒤)

🔴 **위 잠금표의 파일을 건드리기 전에 grep 할 것** — 왜 지금 그 모양인지,
**이미 측정해서 기각한 처방**, **그때 틀린 판단**이 거기 있다. 안 읽고 고치면 같은 것을 두 번 밟는다.
`grep -rn 'VouchersPage' docs/locks/`

➕ **새 `[UNLOCK_LOADING]` / `[LOADING_ADDITIVE]` 기록은 `docs/locks/loading/<날짜>-<슬러그>.md` 파일 하나로
쓴다** — 옛 파일 맨 위에 적지 말 것(**동결**: 항목 수가 늘면 CI 빨간불). 🩸 **왜**: 그 규칙("맨 위에
추가") 때문에 잠금 파일을 건드리는 **모든 세션이 같은 줄을 고쳤고**, 무관한 작업끼리 머지마다 충돌해
Verify 가 처음부터 다시 돌았다(2026-11-01 한 PR 이 두 번 · 최근 Verify 100회 중 36회 취소).
`CURRENT_WORK.md` 가 같은 병을 같은 처방(세션마다 파일 하나)으로 고쳤다. CLAUDE.md 로 되돌리지도 말 것
— 그렇게 이 파일이 30만 토큰이 되어 세션이 안 켜졌다.

### 2차 확장 — 추가 잠금 항목 (회귀 시 critical path 30%+ 증가 위험)

| 파일 | 잠긴 항목 | 회귀 시 발생 |
|---|---|---|
| `src/hooks/queries/useMyData.ts` | `useMyVouchers / useMyOrders / useMyAppointments` 의 `refetchOnMount: 'always'` | voucher/주문 발급 후 페이지 진입 시 빈 화면 (2026-05-27 사고) |
| `src/pages/user-profile/useMyCounts.ts` | `useMyVouchers` 재사용 (별도 fetch 금지) | /user/profile 카운트 ↔ /my-vouchers 목록 불일치 재발 |
| voucher 발급 4곳 (`GroupBuyDetailPage`, `GroupBuyConfirmPaymentPage`, `VoucherDetailPage`, `ProductDetailPage`) | `useInvalidateMyVouchers()` 호출 — voucher 발급 후 navigate 직전 | RQ stale cache 영구 표시 |
| `src/main.tsx` | `validateEnvForRuntime` dynamic import — eager 금지 | zod 52KB chunk critical path 진입 |
| `vite.config.ts` `manualChunks` | env-validator/AdminLayout/AgencyLayout/SellerLayout 등 별도 chunk + seller-public/agency/dashboard/payments/cart/search/mypage/wallet/group-buy/product/guide/shipping/upload/glass/settings 폴더별 chunk + useLiveStream/product-template/useCart/useSearch/useTokenAutoRefresh hoisted | critical path -341 KB 회귀 |
| `src/utils/cf-image.ts` `SUPPORTED_HOSTS` / `EXTERNAL_PROXY_HOSTS` + worker `ALLOWED_HOSTS` | ImgBB (i.ibb.co), googleusercontent 추가 — 제거 금지 | 셀러 업로드 이미지 변환 회피 → 트래픽 폭증 |
| `src/worker/cron/cache-prewarm.ts` | 카테고리 칩 4종 prewarm (meal/stay/beauty/etc) — 제거 금지 | 칩 클릭 시 cold D1 (~200-500ms) |
| `src/features/group-buy/api/group-buy-public.routes.ts` | `Cache-Control: max-age=60` + `CDN-Cache-Control: max-age=900` 분리 + `group_buy_tiers` 서버 parse → array 반환 | 브라우저 5분 stale (신선도 회귀) + 클라이언트 JSON.parse 부담 |
| `src/features/products/api/products.routes.ts`, `src/worker/routes/public-utility.routes.ts` | 동일 Cache-Control / CDN-Cache-Control 분리 | 동일 |
| `src/worker/index.ts` SSR inject regex | `/(?:profile\|s)/:slug` 둘 다 매칭 — 제거 금지 | `/s/:id` SSR cache miss 회귀 |
| `src/pages/GroupBuyDetailPage.tsx` | CountdownRing adaptive interval + polling adaptive jitter + below-fold lazy (Confetti/RestaurantMiniMap/ProductReviewsSection) | 매초 리렌더 회귀 + 폴링 부하 ↑ + 초기 chunk 30-50KB ↑ |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | `React.memo` + `rootMargin: '100px'` (200px 금지 — 트래픽 ↑) | 카드 reconcile + 익명 사용자 트래픽 ↑ |
| `src/pages/MyVouchersPage.tsx` | VoucherMap lazy chunk (Kakao Maps SDK) | 진입 시 ~150KB 즉시 로드 |
| `src/lib/image-compress.ts` | `browser-image-compression` 함수 내 dynamic import (module-level eager 금지) | critical path +51KB |
| 발급/주문/모달 lazy (`SellerOrdersPage`, `MyOrdersPage`, `AdminPage`) | OrderDetailModal / BizInfoModal / RejectionModal lazy + Suspense | 페이지 chunk 10-30KB ↑ |

---

## 🚨 개발 + 에러 대처 절대 룰 (모든 다른 룰보다 우선)

**개발/리팩토링 작업 시작 시**: `docs/DEV_IMPLEMENTATION_PLAYBOOK.md` 먼저 스캔.
**에러/버그 신고 받았을 때**: `docs/ERROR_DEBUGGING_PLAYBOOK.md` 먼저 스캔.
**처음 보는 에러 메시지**: `docs/KNOWN_ERRORS.md` 에서 grep — 매칭되면 5분 fix.

핵심 (Playbook 요약):
1. **추측 금지** — "캐시일거다", "env 일거다" 단정 후 코드 변경 X
2. **진단 페이지/명령 먼저** — 같은 에러 2번 보고 받으면 무조건 ground truth 수집 도구 작성 (10분 이내)
3. **에러 메시지 단어 그대로 grep** — 의역 X. `node_modules/<sdk>/types/*.d.ts` 에서 1:1 매칭
3-1. **실패 메시지를 믿기 전에 그 메시지를 낸 코드를 볼 것** — *"원인을 오진하게 만드는 메시지는
   그 자체가 결함"* 이다. 실측 사례: pre-commit 이 `❌ Fix TypeScript errors` 를 냈는데 실제로는
   **tsc 가 heap 부족으로 죽은 것**이었다(`||` 가 죽은 이유를 구분하지 않았다) — 그대로 믿으면
   *존재하지 않는 타입 에러*를 찾아 헤맨다. 같은 클래스: cron 의 `skipped=` 를 값 없이 키만 보고
   거짓 경보 1,331건(2026-10-15) · `merge-tree` 의 `unknown option` exit 129 를 "충돌" 로 읽음
   (2026-10-06) · 측정기 오류를 결함으로 오진(같은 세션에서 다섯 번). ⇒ **0 이나 예상 밖 값이
   나오면 먼저 측정기·메시지를 의심하고, 고칠 때는 메시지가 원인을 구분하게 만들 것.**
4. **dual-mode 제거 금지** — "통일/단순화" 명목으로 기존 분기 삭제 X
5. **1 commit = 1 원인** — 큰 리팩토링 X

> ⚠️ 이 룰 안 지키면: 2026-05-23 Toss 사건처럼 추측 fix 5번 반복 → 사용자 시간 1시간+ 낭비.

## 📔 Notion 기록 — **중단** (2026-10-25 대표 지시 *"이제 notion에 그만 올리자"*)

🛑 **세션은 Notion 에 쓰지 않는다.** 2026-08-13 지시(*"구현이 될 때마다 업데이트를 Notion 에다가"*)로
머지마다 로그 행을 남기던 규칙은 **대표가 오늘 중단시켰다.** `mcp__Notion__notion-create-pages` ·
`notion-update-page` 류 **쓰기를 호출하지 말 것** — 대표가 보는 창이 레포 안 인계로 옮겨왔다.

⚠️ **읽기는 금지가 아니다** — 대표가 *"노션에서 찾아봐"* 라고 하면 `notion-search`·`notion-fetch` 는 쓴다.
막힌 것은 **세션이 알아서 올리는 기록**이다.

🔁 **되살리려면 대표의 명시 지시가 필요하다.** 그때는 이 절을 되돌리고, 대상·필드는 git 히스토리에
남아 있다(`git log -S "571b32b9-cefb-4453" -- CLAUDE.md`).

> 🩸 **왜 규칙을 지우는 대신 "중단" 으로 남기나**: 절을 통째로 삭제하면 다음 세션이 *"Notion 규칙이
> 없네"* 가 아니라 **8-13 지시를 기억해 다시 올린다**(이 레포가 반복해 당한 *낡은 지도* 클래스).
> 중단 사실이 **그 자리에** 적혀 있어야 멈춘다.

**⇒ 기록은 전부 `docs/handoff/<날짜>-<슬러그>.md` 로.** 대표 판단이 필요한 것은 `docs/decisions/`(등급 C).

## 🔄 진행 중 작업 인계 (필수 — 단, **자기 작업의 인계만**)

### 🧱 세션 = 작업 하나. 남의 작업은 이어받지 않는다 (2026-11-02 대표 *"세션별 작업 분리가 안되는데? 다른 세션에서 기존 세션에서 작업하던 걸 가져오고 그래"*)

**세션의 일은 그 세션에서 대표가 시킨 것 하나뿐이다.** 동시에 여러 세션이 돌기 때문에 *최신 인계 = 다른 세션이 지금 하고 있는 일*이다.
1. **인계는 주제로 찾는다. 최신순으로 열지 않는다.** 대표가 시킨 작업의 낱말로 `grep -ril '<낱말>' docs/handoff/ | sort -r | head -3` →
   **같은 주제일 때만** 읽는다. 읽는 목적은 *중복 구현·같은 오진을 피하는 것*이지 거기 적힌 일을 하는 것이 아니다.
2. **다른 세션의 인계에 적힌 "이어받는 세션의 첫 액션"·대기 항목을 실행하지 않는다** — 대표가 그 세션에서
   *"○○ 이어서 해줘"* 라고 **이름을 대서** 시켰을 때만 한다.
3. **다른 세션의 브랜치·PR 에 커밋·머지·코멘트하지 않는다.** 자기 PR 의 CI 가 남의 변경 때문에 빨개도
   그건 보고만 한다. (예외: 역할 루틴 — `.claude/agents/dev.md` 처럼 *그 일 자체*가 맡겨진 세션.)
4. **겹치는 걸 발견하면** 멈추고 세 줄로 보고한다(무엇이 · 어느 세션/PR 과 · 어떻게 할지). 알아서 합치지 않는다.

> 🩸 **왜 규칙이 됐나**: 여기 오래 *"새 세션 시작 시 반드시 `ls docs/handoff/ | sort -r | head -5` 로 최근
> 인계를 찾아 1~3건 열기"* 라고 적혀 있었고, 인계마다 *"다음 세션의 첫 액션"* 이 적혀 있었다(최근 30건에
> 40회). 둘이 합쳐지면 **새 세션이 주제와 무관하게 남이 방금 쓴 할 일 목록을 받아 실행한다.** 인계를 쓰던 시절
> (2026-07)엔 세션이 하나씩 돌아 "최신 = 내 앞 사람" 이었지만, 지금은 동시에 여러 개가 돈다.
> 가드: `src/tests/unit/session-scope-2026-11-02.test.ts`.

(목차 파일을 원하면 `node scripts/generate-handoff-index.mjs` → `docs/handoff/INDEX.local.md`. 추적 안 하는 사이드카다.)

인계는 **세션별 파일**이다(2026-07-29 구조 변경 — 대표 승인):
- `docs/handoff/<날짜>-<슬러그>.md` — **세션마다 자기 파일 하나**. 이게 실제 인계 내용이다.
- `docs/CURRENT_WORK.md` — **옛 기록(2026-07-29 이전) + 안내**. ❌ 여기에 새 내용을 적지 마라.
- 🔀 **목차는 추적하지 않는다** (2026-10-06 대표 *"남은 것도 다 해줘"*): `docs/handoff/INDEX.local.md`
  (`.gitignore`). 만들기 `node scripts/generate-handoff-index.mjs`, 또는 그냥 `ls docs/handoff/`
  (파일명이 날짜 접두사라 정렬이 곧 최신순). **왜 뺐나**: 종전엔 목차가 `CURRENT_WORK.md` 안에 있고
  pre-commit 이 stage 해서, handoff 파일을 만든 **모든 브랜치가 같은 생성 블록을 고쳤다** → 내용상
  무관한데도 머지마다 충돌(2026-07-29 하루 10번+ · 2026-10-06 하루 3번). `merge=union` 은 로컬에만
  먹고 GitHub 서버측 머지는 그 드라이버를 안 쓴다 ⇒ **휘발성 생성물을 추적한 것이 원인**이었다.
- `docs/handoff/archive/` — 2026-07-26 이전 기록(내용 무변경 보존). 필요할 때 grep.

> 🧱 **왜 나눴나**: 예전엔 모든 세션이 `CURRENT_WORK.md` **맨 위에** append 해서, 내용상 무관한 두
> 브랜치가 **같은 줄을 다퉈 거의 모든 PR 에서 충돌**했다(2026-07-29 하루 10번+ 수작업 병합).
> `.gitattributes` 의 `merge=union`(#836)은 **로컬에서만** 통하고 **GitHub 서버측 머지는 그 드라이버를
> 안 쓴다**(07-29 #835 머지에서 실측: 로컬 clean ↔ GitHub `dirty`). 그래서 다툴 줄 자체를 없앴다.
>
> 🔴 **2026-10-06 — 그 비대칭의 대가가 '머지 못 함' 보다 나쁘다는 걸 실측했다.** PR 셋(#1621·#1623·#1625)이
> 멎어 있었는데 **PR 화면에 빨간 체크가 하나도 없었다** — `Verify` 가 실패가 아니라 **아예 없었다.**
> GitHub 이 머지 커밋을 못 만들면 `pull_request` 워크플로가 **디스패치되지 않기 때문**이다(실측:
> `c46a124`·`064ac07` 에 check-run 0개). 그래서 auto-merge 는 **조용히 멎고** 아무 신호가 없다.
> ⇒ **`git merge-tree` 가 clean 이라고 해도 GitHub 이 clean 이라는 뜻이 아니다.** 판정은
> `gh api repos/{o}/{r}/pulls/N --jq .mergeable` 로 하고, 푸시 전 사전판정은
> **`scripts/check-github-side-merge.mjs`**(pre-push 게이트가 가드보다 먼저 돌린다)가 한다 —
> 커스텀 머지 드라이버를 끈 상태로 머지를 다시 돌려 "로컬만 clean" 을 잡는다. 해소는 손으로 고칠 게
> 없다: `git merge origin/main` → 커밋 → 푸시(로컬 드라이버가 해소해 준다).
> ⚠️ **근본 해소는 아니다** — main 이 움직일 때마다 다시 난다(이 레포는 세션이 여러 개 동시에 돈다).
> 🧭 그리고 이 기제를 "증명" 한 제 첫 명령이 **가짜였다**: `merge-tree --write-tree --attr-source=…` 는
> `unknown option` + **exit 129** 인데 `&& clean || CONFLICT` 로 읽어 충돌로 보고했다. `--attr-source` 는
> **최상위 git 옵션**이다(`git --attr-source=<tree> merge-tree …`). **명령 실패와 판정 결과를 섞지 말 것.**

**자동 업데이트 룰 (모든 세션이 지킬 것)**:
1. 세션 작업을 시작·진행하면서 알게 된 것 → **자기 handoff 파일**에 적는다(공유 파일 편집 금지).
2. 기능 완료 + commit 시 → 그 파일에 commit/PR 해시 기록.
3. 사용자가 새 요구 추가 시 → 즉시 반영.
4. 매 commit 의 변경 파일에 코어 기능 (송출/결제/인증) 포함 시 → 같은 commit 에 handoff 갱신 함께 staged

**세션을 끝낼 때(또는 PR 을 머지할 때) 반드시 남길 4가지** — 대표가 이 작업을 *이어서 하라고 한* 세션이 이것만 읽고 이어갈 수 있어야 한다:
1. **이어받는 세션의 첫 액션** — 명령/쿼리까지 구체적으로. "무엇을 보면 무엇이 판정되는가"까지.
   (대표가 이 작업을 이어서 하라고 했을 때만 실행된다 — 위 🧱 절. 그러니 "누구든 하라" 는 투로 쓰지 말 것.)
2. **완료분 + commit/PR 해시** — 이미 된 것을 또 파지 않게.
3. **이번에 틀렸던 판단** — 같은 오진 반복 방지. **이게 제일 값지다**(문서의 오기를 믿고 오진한 사례가 실제로 있었다).
4. **남은 결정/대기 항목** — 대표 판단이 필요한 것.

🛡️ **자동 강제 (2026-07-28 신설)**: `scripts/check-current-work-sync.mjs` — 브랜치가 `src/` 를 바꿨는데
**인계(`docs/handoff/**` 또는 목차)** 를 **한 번도** 안 건드렸으면 경고(pre-commit + audit-gate). 문서/테스트만 바꾼 브랜치는
검사 대상 아님(소음 억제). 차단: `STRICT_HANDOFF=1` · 우회: 커밋 메시지 `[SKIP_HANDOFF]`.
> 이 가드는 **실제 사고 후** 만들어졌다 — 2026-07-28 세션이 보강 레인 수리 5건을 머지하는 동안 인계를 한 번도
> 갱신하지 않아, 문서가 이전 세션에 멈춰 있었다. 룰만 있고 강제가 없으면 결국 놓친다.

> ⚠️ 이 룰 안 지키면: 다음 세션이 진행 상태 모름 → 중복 구현 / 누락 / 사용자 "왜 이거 안 됐어?" 반복.

## 📣 유어애즈 방향 확정 (2026-07-29 대표 — "앞으로 이것만 계속 할거야")

**유어애즈 = 인플루언서 DB.** 앞으로 할 일은 **네 가지뿐**:
**① DB 수집 · ② 카테고리화 · ③ 필터링 · ④ 정보 최대 수집.**

### 🎯 이 DB 를 무엇에 쓰는가 (2026-08-03 대표 확정 — 이전 "아웃리치 없음"을 **대체**)

> 대표: *"DB로 유어딜에 활동할 인플루언서 및 대행사에게 **제휴 제안을 보낼거야**. 출구는 내가 알아서 해."*

⛔ **이전 판의 "🚫 이메일 아웃리치는 하지 않는다 / 발송 코드에 새 작업을 얹지 말 것"(2026-07-29)은
폐기됐다.** 그 문장을 믿고 **발송에 필요한 필드·필터·내보내기를 방치하거나 정리하지 말 것** —
`opted_out` · `email_status`(반송/스팸신고) · `contacted_at` · `status` · 엑셀 내보내기는
**제안 발송의 전제**다. (⚠️ 다만 **발송 자체는 대표가 한다** — 세션이 콜드 발송을 자동화하지 않는다.
그건 방향이 아니라 법·평판 문제이고, 대표가 직접 판단할 자리다.)

**⇒ 그래서 이 DB 의 유일한 성공 지표는 총 인원이 아니라 "제안 보낼 수 있는 리드 수"다.**
```
전체 43,995 → 이메일 6,107 → 거부제외 6,097 → 카테고리 있음 5,887 → 개인(브랜드 제외) 5,801
                                                     그중 도달력 1k+ 4,473 (20k+ 1,399)
```
⚠️ **44,012 같은 총계로 진척을 보고하지 말 것** — 87%는 이메일이 없어 지금은 쓸 수 없다.
네 축(수집·카테고리화·필터링·정보수집)의 우선순위도 이 지표로 매긴다: 발송 가능 리드 중
**96.5%가 이미 카테고리를 갖고 있으므로**(5,887/6,097) ②는 병목이 아니다. 병목은 ④(연락처)뿐이다.

> 🔑 **네 축의 병목은 하나다** (2026-07-29 실측, 2026-08-03 재확인): `enrichNaverActivity` 가 한 번 돌면
> ②(본문 기반 카테고리)와 ④(연락처)가 **같이** 채워진다. 측정 수율 실측:
> **네이버 블로그 측정됨 28.7%(3,372/11,730) vs 미측정 1.2%(263/21,491) · 유튜브 측정됨 45%.**
> 즉 연락처는 "소스가 없다"가 아니라 **"측정을 못 따라간다"** 이고, 측정이 곧 연락처다.
> ⇒ **처리량이 곧 품질이다.** 근거·다음 액션: `docs/handoff/2026-07-29-influencer-db-throughput.md`
>
> ✅ **2026-08-03 그 병목이 수렴으로 전환됐다** (DO 알람 — 부모 cron CPU 천장 제거):
> `유입 1,613/일 vs 측정 3,600/일 → 순감 1,987/일`. 07-29 에 *"시간당 133씩 벌어진다"* 던 것이 뒤집혔다.
> ⚠️ **그러니 처리량을 더 밀지 말 것** — 조각 4배로 13일→3~4일이 되지만 얻는 건 9일이고
> 지는 건 **네이버 차단**(차단되면 측정이 통째로 멎는다). 수렴 중인 걸 리스크 지고 밀 이유가 없다.

### 🏷️ 옛 행의 업종은 **재분류로 안 고쳐진다 — 재수집이다** (2026-10-26 실측 · 대표 질문 "예전에 수집한 DB들의 업종은 잘못 되어있을텐데")

맞다. 그런데 **`CLASSIFY_RULES_VERSION` 을 올리는 것으로는 안 고쳐진다** — 재분류기는 `description` 의
한글 품목을 읽는데 **그 자리가 비어 있다.** 라이브 실측(업체 `commerce` 424,299행):

| 덩어리 | 건수 | 저절로 고쳐지나 |
|---|---|---|
| `취급` 문자열이 **아예 없음**(detail 레코드를 못 받았다) | **417,156** | ✅ detail 커서가 그 페이지에 닿으면 |
| `취급 01 02` **숫자코드**(2026-10-25 `g()` 순서 수리 **전**의 detail) | **5,713** | ❌ **커서가 이미 지나갔다 — 한 바퀴 더 돌아야** |
| `취급 종합몰 …` **한글** | 1,430 | ✅ 이미 79% 가 구체 라벨 |

🔑 **고치는 기제는 이미 있다** — `company-save.ts` 의 ON CONFLICT 가 `subcategory` 를 **총칭만 승격**
(`통신판매` → 구체 라벨, 사람이 큐레이션한 값은 보존)한다. detail 이 닿는 행은 **손댈 필요 없이** 고쳐진다.
속도: detail 커서 **하루 +17 페이지**(10-25 48 → 10-26 65 실측) × 페이지 500행. status 가 간 366
페이지가 전체라면 **약 18일**.

🔴 **"이메일 보유 행부터 우선 재수집" 은 구조적으로 불가능하다** — detail 수집기는 공공 API 의
**페이지 번호를 순서대로** 받는다(`pageNo=N&numOfRows=500`, `commerce-notify-collect.ts`). 우리 DB
행을 골라 돌리는 구조가 아니다. 2026-10-26 세션이 그 처방을 올리려다 코드를 읽고 **철회**했다.

📎 **같은 날 고친 것(원문 보존)**: `description` 이 ON CONFLICT 갱신 목록에 **없어서** detail 이 품목
한글을 들고 와도 업종만 승격되고 **원문은 영영 안 남았다** — 수집기 자신의 주석이 *"원문이 있어야 다음에
표를 고칠 수 있다"* 고 적어 둔 의도가 조용히 깨져 있었다(그러면 나중에 `PRODUCT_BUCKETS` 를 넓혀
재분류를 돌려도 **읽을 재료가 없어 헛돈다**). 승계를 **네 겹**으로 좁혀 넣었다: ① 들어오는 값이
`commerce` 출처 ② 그 값의 취급이 **한글** ③ 저장값이 비었거나 `대표 ` 로 시작하는 **수집기 조립
문자열** ④ 그 저장값의 취급이 없거나 숫자코드. ③이 webkr 크롤 소개문을 지키고(실측: 대부분 "취급" 이
**없다** — 그래서 ③만이 그걸 막는다) ①이 status 레코드(품목 없음)가 detail 원문을 되덮는 것을 막는다.
⚠️ 보수적 실패 하나: 한글 품목이 숫자로 시작하면(`취급 1인가구용품`) 승계를 **건너뛴다**(덮어쓰는
쪽이 아니라 안 하는 쪽). 가드 `company-description-promote-2026-10-26.test.ts` 13건(**진짜 SQLite** 에
소스의 ON CONFLICT 를 그대로 떼어 먹인다) + 주입 **8건 되돌려-검증 전부 빨간불 확인**(절반이 반대 방향).
🩸 그 시험의 첫 판은 크롤 소개문 픽스처에 "취급" 이 들어 있어 **③을 한 번도 밟지 않았다** — ③을 지워도
초록이었고 주입이 잡았다. ⇒ **규칙을 겹으로 쌓으면 겹마다 그것만 밟는 픽스처가 필요하다.**

⚠️ **아직 안 한 것**: 숫자코드 **5,713행**(그중 아직 `통신판매` 5,537). detail 커서가 지나갔으므로
저절로는 안 고쳐진다 — 커서를 되돌려 한 바퀴 더 돌리는 것은 **쓰기 예산을 다시 쇠는 일**이라 대표 판단
사항이다(2026-10-26 대표는 "기다리고 + description 한 줄" 을 골랐다).

🔬 **2026-10-26 후속 — 그 1,430행을 전수로 읽고 오분류 둘을 잡았다.** 한글 품목의 어휘는
**닫힌 11종**(공정위 통신판매 신고 표준)이다: `종합몰 · 의류/패션/잡화/뷰티 · 건강/식품 ·
교육/도서/완구/오락 · 레저/여행/공연 · 가구/수납용품 · 컴퓨터/사무용품 · 자동차/자동차용품 ·
가전 · 성인/성인용품 · 기타`(복합 신고는 공백으로 이어 준다). 그 11종을 `productBucket` 에
**실제로 돌려** 보니 둘이 자유텍스트 규칙에 먼저 걸려 엉뚱한 버킷으로 갔다:

      컴퓨터/사무용품 → 도서·문구   (그 정규식의 `사무용품` 이 2번째라 `컴퓨터` 를 가로챘다)   라이브 45행
      가구/수납용품   → 생활·주방   (그 정규식의 `수납` 이 7번째라 `가구` 를 가로챘다)        라이브 28행

2026-10-25 에 `완구` 가 `교육·도서` 를 가로챈 것과 **같은 클래스**(순서가 곧 규칙이다)이고,
그때 "낱말 하나에 걸려 좁은 업종으로 오분류" 라고 적어 둔 바로 그 함정이다.
🧷 **앵커는 슬래시째 리터럴**(`/컴퓨터\/사무용품/`)로 둔다 — 이 문자열은 공정위 라벨에서만 나오므로
자유 텍스트(블로그·크롤 문구)에 걸릴 수 없다. 낱말로 올리면 *"컴퓨터 서적 · 프로그래밍 도서"* 가
가전·디지털로 끌려온다(가드가 그 반대 방향을 고정). `성인/성인용품`(11행)과 `기타`(421행)는
**일부러 버킷이 없다** — 전자는 B2B 마케팅 풀에 둘 라벨이 아니고 후자는 공정위 자신의 '기타' 라
우리가 뜻을 지어낼 수 없다(둘 다 `통신판매` 로 남는다).
🔴 **이미 찍힌 73행은 코드로 안 고쳐진다** — `ON CONFLICT` 는 총칭(`통신판매`)만 승격하고 구체
라벨은 보존한다. 그 행은 데이터 UPDATE(**결재**) 대상이고, 이 수리가 하는 일은 *그 뒤로 더 안 늘게*
막는 것이다. ⇒ **틀린 라벨은 늦게 고칠수록 비싸다**(매 회차 쌓인다).
🩸 그리고 **라이브 숫자를 필터로 가르지 말 것** — `종합몰` 을 `email IS NOT NULL` 로 세어 **134** 가
나왔고 전날 인계의 **403** 과 비교해 회귀로 오진할 뻔했다. 전수로는 **420**(그 사이 늘었다)이다.
가드: `product-bucket-ftc-labels-2026-10-26.test.ts` 18건(**진짜 `productBucket` 을 돌린다** —
표의 *순서*가 결과를 정하는데 순서는 문자열 검사로 못 본다) + 주입 6건 되돌려-검증 전부 빨간불 확인.
⚠️ **못 보는 것**: 11종 밖 자유 텍스트의 분류 품질 · 숫자 코드(`취급 12` 1,269행)의 뜻
(**코드표 결재는 2026-10-25 에 기각됐다 — 대표께 다시 묻지 말 것**) · 이미 찍힌 73행.

### 📮 발송 시점 = **한참 뒤** (2026-08-05 대표 확정) → 그래서 **발굴 우선, 측정은 최소 유지**

대표에게 *"제휴 제안을 언제 보내기 시작하느냐"* 를 물어 확정받았다: **"한참 뒤."**
이 한 줄이 배분·유료전환 판단을 전부 결정하므로 **다른 세션은 이 전제로 계획할 것.**

**⇒ 미측정 백로그를 쌓는 것이 지금은 손해가 아니다.** 백로그는 **썩지 않는다** — 6개월 뒤에
측정해도 그때의 현재 활동을 재는 것이라 결과가 같다(2026-08-05 에 "데이터 부패" 라고 적었던 것은
**오기였고 정정한다**). 실측이 그걸 뒷받침한다:
```
측정됨 28,086 → 이메일 수율 27.7%      미측정 25,947 → 1.6%     ← 측정이 이메일을 만든다(17배)
미측정 안에 잠든 이메일 ≈ 7,200        (현재 보유 8,187의 거의 두 배)
24h 유입 5,656  vs  측정 5,938         ← 순감 282/일. **균형점 바로 위**
```
⚠️ **다만 발굴을 늘리면 이 균형이 뒤집힌다**(유입 > 측정 → 백로그 영구 증가). 발송이 한참 뒤라
그 자체는 괜찮지만, **측정을 0으로 두면 안 된다** — 키워드 수율(`recomputeKeywordContactYield`)이
측정에서만 나오므로, 측정을 끊으면 **어떤 키워드가 좋은지 모른 채 발굴**하게 되어 모수만 늘고 질이 안 오른다.
⇒ `MEASURE_SHARE`(기본 0.5)를 **0 으로 만들지 말 것**. 발굴 우선으로 기울이더라도 피드백 루프는 남긴다.

### 🧱 발굴의 천장은 플랫폼마다 다르다 (2026-08-05 실측 — 대표 *"수집도 플랫폼마다 천장이 있을거야"*)

맞다. 그리고 **하나는 이미 초과**다. 발굴 확대를 계획할 때 이 표를 먼저 볼 것:

| 축 | 일 한도 | 2026-08-05 실측 | 성격 |
|---|---|---|---|
| **YouTube units** | 10,000 (구글) | search 66회×100 + perf 3,702 ≈ **10,302 → 초과** | 🔴 **하드**. 유료 전환 무관. 여기서 더 못 뽑는다 |
| **네이버 검색 API** | 25,000 (목표 22,500) | **163 (0.7%)** | 🟢 하드지만 **140배 여유** — 볼륨은 여기서 나온다 |
| **네이버 직접 크롤** | ~8,000 관측치 | ok 2,006 · blocked **0** | 🟡 **소프트**. 공식 한도가 아니라 **차단 위험** — 차단되면 측정이 통째로 멎는다 |
| 카카오 로컬 | **미확정** | 187 lookups | ❓ 코드에 선언 없음. 확대 전 확인 필요 |
| 공공데이터포털 | API별 상이 | — | ❓ 미조사 |

**24h 수집 기여**: `naver_blog 5,130` · `youtube 408` · `tistory 45` — **네이버가 92%** 다.

#### 📏 무료 발굴량은 **하루 700~12,500 사이에서 요동친다** — "천장"이라 부를 값이 아직 없다 (2026-08-05)

> ⚠️ **이 절은 같은 날 두 번 고쳐 썼다. 두 번째가 맞다.** 첫 판에 *"무료 천장 = 하루 5,400명,
> 이미 포화"* 라고 단정했는데, **30시간 창만 보고 내린 결론**이었다. 3주 일별로 보면 전혀 평평하지 않다:

```
07-20  9,226   07-25    732 ←최저   07-30      1 ←사실상 정지   08-04  5,429
07-21 12,533   07-26  1,014         07-31    884                08-05 ~5,000 페이스
07-22  4,977   07-27  3,200         08-01  1,832
07-23  2,201   07-28  1,895         08-02  1,911
07-24  1,212   07-29  1,711         08-03  4,266
```
**17배 진폭**이고 하루는 **1건**이었다. 30시간이 평평해 보인 건 우연히 안정적인 구간을 잘라 본 것이다.

🔑 **그리고 5,400 은 천장이 아니다** — 07-21 에 **12,533** 을 한 적이 있다. 지금 값은 천장이 아니라
*지금 설정에서 나오는 값*이다.

##### 🔬 진폭의 원인 = **키워드 소진이 아니라 "그날 레인이 살아 있었나"** (2026-08-05 실측)

첫 판에 *"키워드 풀 소진 곡선으로 보인다"* 고 적었는데 **재 보니 아니었다**:
```
활성 키워드 399개 중 고갈(barren_streak>0)   9개뿐        ← 마르지 않았다
키워드 나이별 신규율   3~10일 36.5%  vs  10~30일 46.9%   ← 오래된 게 오히려 높다
```
⇒ 키워드는 병목이 아니다. 진폭은 **시스템 가용성**과 맞아떨어진다:
```
07-30   1건    ← 유어애즈 자동 정비가 07-26부터 멎어 있던 구간(#793)
08-03~04  4,266 → 5,429   ← CPU 사망을 수리하던 날들(#1054·#1059·#1065·#1073·#1076)
```
**즉 무료 발굴량을 결정하는 것은 쿼터도 키워드도 아니라 "레인이 안 죽고 도는가" 다.**
안정적이면 5,000대, 레인이 죽으면 1,000대 이하로 떨어진다. ⇒ **안정화가 곧 발굴량이다.**

✅ **07-21 의 12,533 은 규명됐다** (2026-08-09 #1106 — 이전 판 "아직 설명 못 한다"를 대체):
07-20 에 키워드 862개 생성·202개 활성화된 **다음날**이다. 신선한 키워드의 첫 회차가 기존 글 백로그를
수확한다(고갈 곡선 실측: 회당 저장 5~14회차 14.3 → 30회차+ 2.4). 그 조건을 상시화한 것이
`MAX_AUTO_KEYWORDS` 60→120 + 수율 은퇴(+livelock 차단·30일 가석방 — 후속 PR). 판정 ~08-11.
⇒ 무료 발굴량 공식: **레인 안정성 × 키워드 신선도.** 여전히 "하루 N건 영구" 단정은 금물이다.

💡 활성화의 답도 나왔다(2026-08-09 실측): 활성 키워드는 실행당 **157.6명**, 비활성 출신은 **49.7명**
(3분의 1) — **무차별 활성화 확대는 수율 3배 낮은 키워드를 섞는 일**이다. 늘릴 가치가 있는 것은
"신선한(안 돌아 본) 승격 후보"이고, 그게 cap 60→120 처방의 근거다(위 ✅ 참조).

> 🧭 **교훈**: 같은 날 **두 번** 좁은 창으로 단정했다(경보 6건 → 원장 보니 3배 · 30시간 → 3주 보니 17배 진폭).
> **주기가 있는 계에서는 관측 창이 주기보다 길어야 한다.** 시간당 값으로 일별 결론을 내지 말 것.

🔴 **그리고 `lanesPerTick`(cap)은 발굴에 안 닿는다.** 같은 창에서 cap 이 6→2 로 무너졌는데
**수집량이 안 변했다**:
```
08-04 18~20시  cap 6    →  132 · 74        ← 오히려 낮다
08-05 01~04시  cap 2~3  →  279 · 161 · 423 · 115
```
이유: **인플루언서** 발굴 레인(`collect`)은 cron 레인 순환이 아니라 **DO 알람**으로 돈다
(하트비트에 `lane-alarm-boot:collect` 가 찍힌다). 2026-08-05 세션이 "cap 6 회복하면 공짜 2배"
라고 대표에게 보고했다가 이 실측으로 **정정**했다 — 같은 오판을 반복하지 말 것.

🔴 **단 B2B 는 정반대다.** 매장후보·업체 레인(`collect-storeinfo`·`collect-hira`·`collect-localdata`
·`collect-neis`·`collect-store-kakao`·`collect-commerce`)은 **cron 레인 순환**이라 `cap` 이 직접 먹는다.
```
매장후보  11,170/일        업체  3,493/일     →  B2B 14,663/일 (인플루언서 5,583 의 2.6배)
시간당이 아니라 회차당 덩어리로 들어온다: 08-04 23시 6,000 · 09시 2,000 · 17시 1,765
```
공공 API 라 한 번에 500건씩 벌크로 긁으므로 **평평하지 않고 레인이 뽑혀야 들어온다.**
⇒ **cap 회복은 인플루언서엔 무의미하지만 B2B 발굴은 실제로 늘린다.** 그리고 2026-08-04 에
CPU 로 죽은 레인 3개가 **전부 B2B** 였다 — cap 붕괴의 피해자도 B2B 다.
⚠️ "cap 은 발굴에 안 닿는다" 를 **B2B 에까지 일반화하지 말 것**(이 문단이 그 오독을 막으려고 있다).

무료 천장을 실제로 정하는 것(전부 요금제 인지 상수):
| 노브 | 무료 | 유료 |
|---|---|---|
| DO 알람 간격 | **5분** | 1분 (5×) |
| 알람 시간당 실행 | **12회** | 60회 (5×) |
| 회차당 서브리퀘스트 | **56 중 51 사용(91%)** | ~900 (15×) |

시간당 12회 × 회차당 9키워드(2026-08-11 대표 승인 6→9) = **108키워드/시간**이 무료의 구조적 상한이다.
⚠️ **다만 이것은 "회차를 몇 번 도느냐"의 상한이지 "몇 명을 얻느냐"가 아니다** — 회차당 수확은
키워드가 얼마나 신선한지에 달렸고, 그래서 위 일별 표가 17배로 요동친다.

⇒ 무료에서 **회차 수**를 늘릴 방법은 없다(알람 빈도·회차당 예산이 막는다 — 네이버 쿼터는 0.7% 남아돈다).
그 축의 레버는 **유료 전환**뿐이다(대표 판단 대기).
⚠️ **다만 "그래서 무료 발굴량이 고정"은 아니다** — 위 일별 표가 17배로 요동치는 것이 그 반증이다.
회차 수가 같아도 **키워드가 신선하면 수확이 뛴다.** 그 여지는 2026-08-09 #1106 이 실측·상시화했다
(cap 120 + 수율 은퇴 — 위 ✅ 참조). 판정 ~08-11, 기대치는 기준선 5,700 → 8천~1.2만.
**B2B 는 다르다** — cap 회복(2→6)만으로도 늘어나고, 연락처 보유율도 이미 훨씬 높다:

| | 전체 | 연락처 | 보유율 |
|---|---|---|---|
| 업체(대행사) | 23,832 | 이메일 18,833 | **79%** |
| 매장후보 | 79,072 | 전화 47,034 | **59%** |
| 인플루언서 | 54,033 | 이메일 8,187 | **15%** |

발송 대상이 *"인플루언서 및 대행사"*(대표) 인데 **대행사 쪽은 이미 준비돼 있고 인플루언서가 뒤처져 있다.**

🔑 **그래서 발굴 확대의 실질 상한은 네이버이고, 네이버는 아직 0.7% 밖에 안 썼다.**
막고 있는 것은 쿼터가 아니라 **우리 Cloudflare 서브리퀘스트 예산**이다(실측 `spent 51/56`, `계획 16 → 처리 6`).

> 🌙 **2026-08-12 대표 승인("응 해") — YT 쿼터 소진 회차만 예산까지 확장.** YT 검색 쿼터(일 90회)는
> 이른 시간에 소진되고 그 뒤 회차는 네이버 전용인데, 키워드당 비용이 3분의 1(실측 29/9≈3.2)인데도
> **폭 9에서 멈춰 `spent 29 / 56`** 으로 끝났다(예산 27 유휴). 그 회차만 `COLLECT_KEYWORDS_PER_ROUND_NAVER_ONLY`
> (18, 실제 상한은 예산·계획폭)로 넓힌다. **YT 살아있는 회차는 9 그대로** — 지금도 예산이 캡(56/56)이라
> 넓혀도 안 늘고 YT 쿼터만 빨리 태운다. 해제 근거: 측정 22,764/일 > 유입 6,434/일(3.5배) · 실백로그 ~8시간분 ·
> `blocked 0` · 네이버 쿼터 0.3% ⇒ 동결 사유("측정이 병목")가 더 이상 사실이 아니다.
> ⚠️ 롤백은 그 상수를 9 로 되돌리는 것 하나다. 차단(`ads_naver_crawl_block.blocked > 0`) 뜨면 즉시.
> 정책 SSOT 는 `influencer-round-width.ts`(2026-08-12 분리).
>
> ✅ **발굴 폭 잠금은 2026-08-11 대표 승인("폭 9로 올려")으로 6→9 해제됐다** — 그 주석이 명시한
> 해제 조건("측정 처리량이 올라간 뒤")을 숫자로 채운 뒤였다: 측정 8,018/일(샤딩) > 유입 5,045/일 ·
> 백로그 감소 · blocked 0, 그리고 §16 판정이 "폭이 캡"임을 규명(경보 원문 "예산 37/56 · 키워드 6/16").
> ⇒ **9 초과 상향은 다시 대표 판단 사항이다**(테스트가 9 를 상한으로 잠금). 올리려면 (a) 측정 처리량이
> 받쳐 주는지 (b) `ads_naver_crawl_block.blocked` 가 0 을 유지하는지 **두 값을 먼저 보고** 근거와 함께.

## 🇰🇷 대표 보고는 **한국어** (2026-10-19 대표 지시 — "한글로 설명. 앞으로도")

**대표에게 하는 설명·보고·질문은 전부 한국어로 쓴다.** 영어로 작성된 문장을 그대로 내보내지 말 것.
코드 식별자·파일 경로·명령어·URL·고유 명사(PR 번호, 함수 이름)는 원문 그대로 둔다 — 번역 대상은 *설명하는 문장*이다.

## 🕐 대표 보고는 **한국시간(KST)** (2026-08-01 대표 지시 — "앞으로 한국 시간으로 알려줘")

**대표에게 시각을 말할 때는 KST 만 쓴다** (2026-08-02 대표 재지시 *"한국시간으로만 알려줘 앞으로"*).
> 예) `밤 11시 회차` · `배포 21:51 완료` · `마지막 실행 13:44`

⛔ **UTC 를 괄호로 덧붙이는 것도 하지 말 것** — 이전 규칙(병기 허용)은 폐기됐다. cron 표현식처럼
UTC 가 *값 자체*인 경우(`0 * * * *`)만 예외이고, 그때도 "매시 정각"처럼 KST 로 읽어 준다.

⚠️ **왜 틀리기 쉬운가**: 이 시스템의 시각은 거의 전부 UTC 다 —
cron 은 `0 * * * *`(UTC) · 워커 런타임 TZ=UTC · D1 `datetime('now')` 는 **`Z` 없는 UTC 문자열**
(`2026-08-01 04:00:39`) · GitHub Actions·CF 대시보드도 UTC. 그래서 **읽은 값을 그대로 옮기면
자동으로 UTC 보고**가 된다(실제로 이 세션이 하루 종일 그랬다).
⇒ 어드민 API·하트비트·워크플로 시각을 인용할 때는 **변환했는지 매번 확인**할 것.

📌 정각 회차는 KST 로도 정각이다(오프셋이 정확히 +9h) — "매시 정각" 은 두 표기에서 같다.
🔢 코드 안의 KST 처리는 별개 규칙이다 → `src/utils/date.ts` SSOT + `check-utc-date-parse.mjs`
   (아래 방어선 표). 이 절은 **사람에게 말할 때**의 규칙이다.

## 🔑 어드민 진단 접근 (2026-07-28 대표 지시 — "모든 세션에서 자동으로")

라이브 데이터를 **추측 대신 실측**으로 확인하기 위해 어드민 API 읽기 접근을 상시 사용한다.
대표가 전용 계정 `claude@ur-team.com`(super_admin)을 발급했다.

**🚫 절대 룰**: **비밀번호를 레포에 커밋하지 말 것**(공개 레포 — 영구 노출). 코드·문서·커밋 메시지·주석 어디에도 금지.
`check-no-secrets.sh` 가 일부 패턴만 잡으므로 최종 방어는 이 룰이다.

**자격증명 위치**: Claude Code **환경변수**(Cloudflare env 아님 — 세션 환경변수) — 대표가 2026-07-28 등록 완료.
`URDEAL_ADMIN_EMAIL` / `URDEAL_ADMIN_PASSWORD`. **모든 세션이 자동 사용**한다.
⚠️ 환경변수는 **컨테이너 시작 시점에 주입**되므로 등록 직후 실행 중이던 세션엔 안 보인다(다음 세션부터 적용).
미주입 세션이면 대표에게 값을 요청하지 말고 **다음 세션에서 수행**하거나 대표에게 상태줄을 요청한다.

**접속 절차(3가지 함정 주의)**:
1. **도메인**: `live.ur-team.com` 을 쓰면 확실하다 — 도메인 이전 시 `/api/*` 는 301 제외라 구 도메인 API 가 살아 있다.
   ⚠️ **2026-07-29 정정**: 여기 오래 적혀 있던 *"프록시가 `urdeal.kr` 을 차단(CONNECT 403)"* 은 **더 이상 사실이 아니다** —
   실측 `urdeal.kr/`(HTML) **200** · `urdeal.kr/api/version` **200** · `live.ur-team.com/api/version` **200**.
   이 오기를 믿으면 **할 수 있는 라이브 실측을 포기하고 대표에게 화면 복사를 요청하는 왕복**이 생긴다(실제로 그럴 뻔했다).
   이 환경에서 **실제로 막힌 것**은 `dash.cloudflare.com` · **`*.pages.dev`(PR 프리뷰 — CONNECT 403)** ·
   한국 공공 API 도메인(`apis.data.go.kr` 등)이다. 프록시 규칙은 바뀔 수 있으니 **막혔다고 단정하기 전에 한 번 찔러볼 것.**
2. **User-Agent**: `botProtection()`(`bot-detection.ts`)이 curl UA 를 차단하고 `{"success":false,"error":"Forbidden"}`
   (키 2개, `code` 없음)를 준다. **브라우저 UA 헤더 필수**. `code:'ADMIN_IP_BLOCKED'` 가 있으면 그건 IP 화이트리스트로 **다른 원인**.
3. **토큰**: `POST /api/admin/login` {email,password} → 응답 토큰 필드가 **한 가지가 아니다** — 실측상
   `data.accessToken` / `data.token` / 최상위 `token` 중 하나로 온다. **존재하는 것을 골라 쓸 것**
   (`data['token']` 만 꺼내면 KeyError). 이후 `Authorization: Bearer <token>`. 계정은 `admins.id=10`.

**🤝 동시 로그인(2026-07-28 대표 지시 "동시 로그인되게 하고")**: 대시보드는 시트별 **단일 세션**이라 같은
계정으로 다른 곳에서 로그인하면 기존 세션이 즉시 `SESSION_SUPERSEDED` 로 끊긴다. 자동화 계정은 **여러 세션이
동시에** 쓰므로(이 문서가 "모든 세션이 자동 사용"이라 규정) 서로를 계속 밀어냈고, 대표가 브라우저로 들어오면
자동화가 끊겼다. → `dashboard_sessions.multi_session=1` 인 시트는 **세션 경계를 올리지 않아 동시 접속 유지**.

```bash
# super_admin 토큰으로 1회만 켜면 영구 적용(계정별 opt-in, 기본 OFF)
curl -sS -X PATCH "https://live.ur-team.com/api/admin/admins/10/multi-session" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" -H 'Content-Type: application/json' \
  --data '{"enabled":true}'
```
> ⚠️ **자동화 계정에만 켤 것.** 단일 세션은 계정 공유·도용의 *탐지 신호*이기도 하다(남이 쓰면 내가 튕겨서
> 알게 된다). 사람이 쓰는 운영 계정에 켜면 그 신호를 잃는다.
```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
# ⚠️ 단일 세션 정책: 같은 계정으로 다른 곳(대표 브라우저 등)에서 로그인하면 이 토큰이 무효화된다
#    (SESSION_SUPERSEDED). 긴 작업 중 끊기면 재로그인 후 재시도.
curl -sS "https://live.ur-team.com/api/admin/partner-pool/stats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA"
```

**⚠️ 유어애즈(`/api/ads/*`)는 별도 워커(ur-ads)** — env 가 메인 Pages(ur-live)와 **분리**돼 있다.
메인 `/api/version` 의 시크릿 목록에 없다고 ur-ads 에도 없는 것이 아니고, 그 반대도 아니다.
ur-ads 쪽 설정 확인은 기능 호출로 판정할 것(예: `/api/ads/keywords/related` → `NOT_CONFIGURED` = 키 없음).

**사용 원칙**: 기본 **읽기 전용**(stats·목록·진단). 쓰기(큐레이션·수집 트리거·설정 변경)는 대표가 명시로 지시할 때만.
토큰·응답 파일은 스크래치패드에만 두고 작업 후 삭제. 세션 종료 시 남기지 않는다.

> ⚠️ 이 접근이 없으면: 라이브 원인 규명이 "대표가 상태줄 복사 → 붙여넣기" 왕복에 묶여 한 사이클에 수십 분씩 소모된다
> (2026-07-28 크롤 전멸 규명이 실제로 그랬고, 직접 조회로 전환하자 예외 원문 확보에 1분 걸렸다).

### 👤 대표 본인 계정 = 유저 `users.id = 3` "정지원" (2026-10-07 대표 확정 — *"그 정지원 계정이 내 계정이야. 앞으로 명심하고"*)

대표가 **"내 계정"·"내 딜"·"정지원 계정"** 이라고 하면 **언제나 `users.id = 3`**(이름 `정지원`, 카카오 로그인)이다.
되묻지 않는다.
- ⚠️ **헷갈리는 짝: `users.id = 30` "유어팀 (정지원)"** — 쓰인 적 없는 다른 계정이다(주문 0). 이름 검색에 같이 걸리므로
  **이름으로 고르지 말고 id 로 고를 것.** 2026-10-07 에 둘이 함께 검색돼 실제로 헷갈릴 뻔했다.
- **"딜 넣어줘"** = 어드민 딜 선물 `POST /api/admin/users/3/gift-deal` `{"amount":N,"reason":"대표 지시 — …"}`.
  무상 딜(출금 불가·결제 시 우선 차감)로 들어가고 감사 로그·알림이 남는다. 원장에 직접 쓰지 말 것(이 엔드포인트가 SSOT).
  대표의 직접 지시가 곧 승인이다 — 머니 경로지만 결재함으로 돌리지 않는다. **넣은 뒤 잔액을 다시 조회해 전후 값을 보고**한다.
- 이메일 등 식별 정보는 공개 레포라 여기 적지 않는다. 확인이 필요하면 `GET /api/admin/users/3` 로 조회.

## ☁️ Cloudflare API 접근 (2026-07-28 대표 지시 — "영구적으로, 다른 세션에서도")

라이브 인프라(환경변수·배포·빌드로그·D1·KV)를 **대시보드 왕복 없이 직접** 확인·조정한다.

**자격증명 — 2026-07-28 대표 지시로 D1 보관이 SSOT**: 토큰은 **`platform_settings` 의 `cf_api_token` /
`cf_account_id`** 에 저장돼 있다. 어드민 자격(위 섹션)만 있으면 **모든 세션이 자동으로** 꺼내 쓴다 —
대표가 세션마다 환경변수를 만질 필요가 없다(그게 이 방식을 택한 이유).

```bash
# 표준 취득 절차 — 어드민 토큰($TOK) 확보 후
CFJSON=$(curl -sS "https://live.ur-team.com/api/admin/tools/settings" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA")
export CLOUDFLARE_API_TOKEN=$(echo "$CFJSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'].get('cf_api_token',''))")
export CLOUDFLARE_ACCOUNT_ID=$(echo "$CFJSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'].get('cf_account_id',''))")
```

환경변수 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 가 이미 주입돼 있으면 그걸 우선 쓰고, 없으면 위 절차로 D1 에서 취득한다.
**🚫 레포에 값 커밋 절대 금지**(공개 레포 — `visibility: public` 확인됨. 커밋하면 git 히스토리에 영구 잔존 + 스캐너가 수분 내 수집).
값이 아니라 **키 이름만** 문서에 남긴다.

**⚠️ 프록시**: `dash.cloudflare.com` 은 이 환경에서 차단(000). **`api.cloudflare.com` 은 통과** — API 만 쓴다.

```bash
CF=https://api.cloudflare.com/client/v4
AUTH="Authorization: Bearer $CLOUDFLARE_API_TOKEN"
curl -sS "$CF/user/tokens/verify" -H "$AUTH"                                    # 토큰 유효성
curl -sS "$CF/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" -H "$AUTH"       # 워커 목록
# 워커 환경변수(시크릿 아님) 조회/설정은 settings 엔드포인트 — 값 교체 시 기존 바인딩 전체를 함께 보내야
# 덮어써지지 않는다(부분 PATCH 아님). 반드시 조회 → 병합 → 전송 순서.
curl -sS "$CF/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/ur-ads/settings" -H "$AUTH"
```

**🗄️ D1 원본 조회 (2026-08-02 신설 — 어드민이 노출한 통계 말고 테이블 자체를 본다)**

```bash
# ⚠️ 계정에 D1 이 8개 있다. **이름으로 고르지 말 것** — 이름 매칭은 엉뚱한 DB 를 집어
#    `no such table` 을 낸다(실제로 두 번 헛짚었다). 라이브는 **셋**이고 목적이 다르다
#    (근거: wrangler.toml · wrangler-ads.toml 의 database_id).
#    🔴 2026-08-27 정정 — 여기 오래 "라이브는 이 uuid **하나뿐**"이라고 적혀 있었다. 틀렸다.
#       그 줄을 믿고 ads 데이터를 메인에서 찾다가 `no such table: ad_company_leads` 를 만났고,
#       ads 리드를 메인에서 읽으면 **2026-08-19 에 멈춘 사본**이라 조용히 오판한다(에러가 안 난다).
DB_MAIN=d9530ba6-7a26-4c02-9295-3ce5aef112a3   # platform_settings · 회차 통계 · 조율기 · 소비자 전반
DB_ADS_LEADS=d4630482-b97e-4e96-bb96-abde4ef8cc95  # ad_influencer_leads · ad_discovery_keywords
DB_ADS_COMPANY=0e9a8f82-32fb-4584-878c-cdaec6c0aff0 # ad_company_leads(업체·매장) · ad_company_keywords
DB=$DB_ADS_LEADS
python3 -c "import json,sys;json.dump({'sql':sys.argv[1]},open('/tmp/q.json','w'))" "SELECT COUNT(*) n FROM ad_influencer_leads"
curl -sS -X POST "$CF/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/$DB/query" -H "$AUTH" \
  -H 'Content-Type: application/json' --data-binary @/tmp/q.json
```
🔒 **읽기 전용으로만 쓴다.** 데이터 수리는 일회성 SQL 이 아니라 **코드 경로**(정비 레인 · `repair-schema`)로
간다 — 그래야 재현되고 리뷰되고 다음에도 돈다. 프로덕션 D1 에 잘못 날린 UPDATE 는 되돌릴 방법이 없다.

**🚫 자율 규율 (대표가 넓은 권한을 줬어도 지킨다)**:
1. **코드 배포는 이 토큰으로 하지 않는다.** 반드시 PR → CI(46 불변식) → 대표 승인 → 머지 경유.
   토큰으로 직접 배포하면 오늘 실제로 실수를 잡아낸 게이트(파일크기 래칫·타입체크)를 통째로 우회하게 된다.
2. 토큰 용도는 **① 진단(빌드로그·배포상태·플랜/한도 확인) ~~② 게이트 env 토글~~ ③ D1/KV 읽기** 로 한정.
   > 🔒 **2026-07-29 대표 지시로 축소 — 토큰 용도는 "조회 한정"이다.** ②(게이트 env 토글)를 **철회**한다.
   > **플랫폼 쓰기(cron 트리거 추가·env 변경·바인딩 수정)는 세션이 하지 않는다** — 세션은 **판정 결과만
   > 보고**하고, 실제 변경은 **대표가 대시보드에서 직접** 한다. 스코프도 읽기 4종(Workers Scripts Read /
   > Pages Read / D1 Read / Account Settings Read)만 요청하며, **부족해도 Edit 를 추가로 요청하지 않는다**
   > (D1 Read 로 쿼리가 막히면 그 값은 대표가 어드민에서 직접 확인 — 예: 예치금 4숫자).
3. **삭제·purge·바인딩 제거는 대표 명시 지시가 있을 때만.** 되돌리기 어려운 작업은 먼저 확인.
4. 토큰 값을 파일·로그·커밋·PR 본문에 남기지 않는다. 응답 파일은 스크래치패드에만, 작업 후 삭제.

> ✅ **2026-08-02 복구 — 토큰은 살아 있다(실측).** 07-29 의 "죽음" 표기는 **해소됐다.** 대표가 새 토큰을
> 발급했고, `platform_settings.cf_api_token` 에 저장돼 **모든 세션이 그대로 쓸 수 있다.** 실측:
> `GET /user/tokens/verify` → `success:true, status:active` · **D1 6개 / Workers 8개 / Pages 7개 조회 OK**
> · `POST /accounts/{acc}/d1/database/{uuid}/query` 로 **원본 테이블 SELECT 가 된다.**
> ⇒ 그래도 절차는 그대로다: **`verify` 로 먼저 확인하고 쓴다**(만료·회전은 언제든 일어난다).
>
> 🩸 **07-29 세션이 "죽었다"고 판정한 것은 사실이었지만 원인은 토큰이 아니라 저장 UI 였다.**
> `/admin/platform-settings` 가 값을 **조용히 안 저장**했다 — 편집 중 RQ 리페치가 폼을 서버 값으로
> 덮어써서, 새 토큰을 붙여넣고 저장해도 **옛 토큰이 다시 저장**됐다. 화면엔 계속 "설정됨"이 떠서
> 성공처럼 보였다(길이가 같으면 구분할 표시가 아예 없었다). 2026-08-02 수리: 시드 1회 + 저장 후
> "…끝4자리" 표시 + 무엇이 교체됐는지 토스트. ⇒ **자격이 반영됐는지는 화면 문구가 아니라 `verify` 로 판정할 것.**

**확인된 사실(2026-07-28 실측 — 추측 대체)**:
- ⚠️ **정정(2026-07-28 후속)**: 아래 "유료 → 1,000" 은 **틀렸다. 믿지 말 것.** `usage_model: standard` 는
  Workers **과금 모델**(bundled/unbound 세대 구분)이지 free/paid 구분이 아니다 — 무료 계정도 `standard` 로 나온다.
  같은 날 `docs/CURRENT_WORK.md` 가 기록한 **"대표 확정 '일단 무료' → 인보케이션당 서브리퀘스트 50(D1 포함)"** 이 맞고,
  보강 레인의 학습 상한이 **29~55 에서 맴돈 것은 고장이 아니라 실제 천장(50)으로의 정상 수렴**이었다.
  ⇒ 이 줄을 믿고 "상한이 갇혔다"를 결함으로 오진한 사례가 실제로 있었다(PR #800 의 최초 서술). 계획을 세울 땐
  **50 을 전제**로 하라 — 크롤 1사이트가 4~8 서브리퀘스트라 라운드당 실효 5~8사이트다. 처방은 회계 수정이 아니라
  **건당 비용 절감**(부기 배치화·중복 레인 제거)이거나 **유료 전환**이다.
- ~~계정 `usage_model: standard` = **Workers 유료** → 서브리퀘스트 한도 **1,000**(50 아님).~~ ← 위 정정 참조
- `ur-ads` 바인딩 31개에 `NAVER_SEARCH_CLIENT_ID/SECRET`·`KAKAO_REST_API_KEY` **모두 존재** —
  "크롤이 0인 건 네이버 키 부재" 가설도 **기각**.
- `tail` 세션 생성은 되지만 **wss 업그레이드를 이 환경 프록시가 막는다**(non-101) → 실시간 로그는 불가.
  ⇒ 라이브 원인 규명은 **D1 스냅샷 계측**에 의존해야 한다(그래서 `ads_enrich_last` 에 phase/p2/crash 추가).
- Observability(telemetry) API 는 현재 토큰 권한 밖(`Authentication error`) — 필요해지면 권한 추가 요청.

> 이 접근이 없어서 오늘 막혔던 것들: `Workers Builds: ur-live-global` 이 매 PR 마다 실패하는데 **빌드 로그가
> 대시보드에만 있어** 원인을 못 밝히고 "선재 실패"로만 넘겼다 · `SUPPLY_MAKER_COLLECT_ENABLED` 게이트를
> 못 켜 제조사 풀이 수동 실행분(85건)에 머물렀다.

## 🔀 PR 머지는 세션이 끝낸다 — 그리고 **지시 없이 자동으로** (2026-09-16 대표 *"앞으로 너가 하도록 설정해줘 모든 세션에서"* → 2026-10-14 ***"머지해줘 앞으로 자동으로"***)

**머지까지가 세션의 일이다.** draft 해제·auto-merge·머지·머지 후 브랜치 정리는 전부 세션이 한다.
*"GitHub API 가 막혀서 대표님이 눌러 주세요"* 는 **답이 아니다.**

🆕 **2026-10-14 — 머지 지시를 기다리지 않는다.** 종전엔 *"대표가 머지를 지시하지 않았으면 초록 사실만
보고하고 기다린다"* 였는데 대표가 ***"머지해줘 앞으로 자동으로"*** 로 그 기본값을 바꿨다. 이제 세션이 연
PR 은 **초록이 되면 스스로 머지된다** — 기다리라는 지시가 따로 있을 때만 멈춘다.
**방법은 손으로 누르는 것이 아니라 `auto_merge` 를 켜는 것이다**(아래 REST 경로):
draft 를 해제하고 auto-merge(squash)를 켜 두면 GitHub 이 체크 통과를 기다려 머지한다.
🔴 **먼저 un-draft, 그 다음 auto-merge** — draft 전환은 auto-merge 를 날리므로 순서가 뒤집히면
조용히 안 켜진다(GitHub 이 그 경고를 명시한다). 켠 뒤 `auto_merge.enabled` 를 **응답으로 확인**할 것.

🩸 **그 확인은 `PUT /ccr/auto_merge` 의 응답에만 쓸 것** (2026-10-14 양방향 실측) — GitHub REST 의
**PR 객체에는 `auto_merge.enabled` 필드가 없다**(필드는 `enabled_by`·`merge_method`·`commit_title`·
`commit_message` 넷). 그래서 `gh api .../pulls/N --jq .auto_merge.enabled` 는 **켜져 있어도 `null`** 이고,
그 null 을 "안 켜졌다" 로 읽으면 멀쩡한 auto-merge 를 다시 켜거나 — 더 나쁘게 — *"머지 자동화가 깨졌다"* 로
보고하고 대표에게 버튼을 떠넘기게 된다(이 절이 생긴 그 사고다). **PR 객체에서의 판정은 `.auto_merge != null`**:
`gh api .../pulls/N --jq '{auto_on:(.auto_merge!=null),method:.auto_merge.merge_method}'`.
🔬 양방향으로 쟀다 — 켜진 PR(#1828)은 객체가 있고 `enabled` 만 없다 · auto-merge 규칙 이전에 머지된
PR(#806·#1149·#1296·#1400)은 **객체 자체가 `null`**. 그 대조군이 유효한 이유는 **머지가 객체를 지우지
않기 때문**이다(#1815~#1827 전부 머지됐는데 `present`) — 안 그러면 "null = 꺼짐" 과 "null = 머지됨" 이
구분되지 않는다.

🩸 **`merge_method` 를 빼면 422 다** (2026-10-15 실측 — #1834): 본문 없이 `PUT /ccr/auto_merge` 를
치면 GitHub 이 기본 `merge` 로 무장하려 하고 이 레포는 머지 커밋을 금지하므로
`Merge method merge commits are not allowed on this repository` 로 거부된다. **실패가 조용하지도
않지만 오독하기 쉽다** — 그 문장을 "auto-merge 를 쓸 수 없다" 로 읽으면 다시 대표에게 버튼을
떠넘기게 된다(2026-10-14 규칙이 막으려던 바로 그 자리다). **`{"merge_method":"squash"}` 를 함께
보낸다** — 응답이 `{"enabled":true,"merge_method":"squash"}` 면 무장된 것이다.

🔴 **그리고 auto-merge 는 조건을 다 채워도 멎는다 — 켠 것으로 일을 끝냈다고 보지 말 것.** 2026-10-14
#1828 실측: `auto_merge` 무장 · `Verify` **success** · `mergeable:true` · `mergeable_state:clean` ·
`draft:false` 인데 **2분+ 동안 머지되지 않았다**(같은 세션의 #1826·#1827 은 정상 자동 머지됐으니 간헐이다).
그 문장(*"켜 두면 GitHub 이 체크 통과를 기다려 머지한다"*)만 믿고 턴을 끝내면 **PR 이 초록인 채 열려 남고
아무 신호도 없다** — 이 레포가 반복해 당한 **조용한 부재**다. ⇒ 초록을 확인한 뒤에도 **머지됐는지를 따로
보고**, `clean` 인데 안 머지됐으면 위 `PUT /merge` 로 **세션이 끝낸다**(#1828 은 그렇게 `b55bafffb` 로 들어갔다).

> 🩸 **이 규칙은 실제로 떠넘긴 뒤에 생겼다.** 2026-09-16, PR #1472 는 CI 초록·충돌 0 인데 draft 라
> 머지가 405 였다. `mcp__github__update_pull_request` 가 rate limit(`for user ID 64677275`)이라
> 대표에게 "Ready for review 눌러 주세요" 라고 했다. **그런데 그때 이미 다른 경로가 멀쩡한 걸 확인해
> 놓고 있었다** — 그 경로로 한 번 시도했다가 `GitHub is temporarily unavailable. Retry shortly.`
> (일시 오류, 재시도하면 되는 것)를 받고 포기했다. 대표: *"내가 해야하는 작업마저 너가 할 수 없나?"*

### 경로가 둘이고, 버킷이 다르다

| | 쓰는 신원 | 한도 |
|---|---|---|
| `mcp__github__*` 쓰기 | **대표 계정(user OAuth)** — 동시에 도는 모든 세션이 **한 버킷을 나눠 쓴다** | 자주 소진된다 |
| `curl https://api.github.com/...` | **앱 설치 토큰**(에이전트 프록시가 주입) — repo `admin:true` | 실측 core 15,000 / graphql 10,000, 보통 **0 사용** |

⇒ **MCP 쓰기가 rate limit 이면 그대로 curl 로 간다.** 토큰을 직접 넣지 않는다(프록시가 붙인다).
`GH_TOKEN`/`GITHUB_TOKEN` 환경변수는 14자 `proxy…` 자리표시자라 **그 값을 쓰면 안 된다.**

### ⚠️ GraphQL 은 막혀 있다 — CCR REST 경로를 쓴다

`POST /graphql` 은 *"GitHub GraphQL is not available from Claude Code sessions"* 로 거부된다.
draft·auto-merge·리뷰 스레드는 GraphQL 전용 기능이라 **전용 REST 경로**가 따로 있다:

```bash
G=https://api.github.com/repos/tobe2111/ur-live/pulls/<번호>
curl -sS -X POST "$G/ccr/ready_for_review"            # draft 해제
curl -sS -X POST "$G/ccr/convert_to_draft"            # 다시 draft 로
curl -sS -X PUT    "$G/ccr/auto_merge" -H 'Content-Type: application/json' \
  --data '{"merge_method":"squash"}'                   # 초록 뜨면 자동 머지 (DELETE 로 해제)
curl -sS       "$G/ccr/review_threads"                # 리뷰 스레드 조회
curl -sS -X POST "$G/ccr/comments/<id>/resolve"       # 스레드 해결 (또는 /unresolve)
curl -sS -X PUT  "$G/merge" -H 'Content-Type: application/json' \
  --data '{"merge_method":"squash","sha":"<head sha>"}'   # 머지(REST 로 됨)
```

🔴 **`GitHub is temporarily unavailable. Retry shortly.` 는 실패가 아니라 재시도 신호다.**
한 번 받고 멈추지 말 것 — 몇 초 간격으로 3~4회. 그 문장을 보고 포기한 것이 이 규칙이 생긴 이유다.

### 그래도 바뀌지 않는 것

이 규칙은 **머지 버튼을 누가 누르느냐**만 정한다. 승인 자체를 대신하지 않는다:
- **"자동으로" 는 머지 버튼까지다 — 승인 자체를 대신하지 않는다.** 결재(C) 항목은 *PR 을 쓰기 전에*
  받는 것이고(머니 경로·게이트 ON·요율·환불·원장·커미션·발행/발송·삭제/purge·잠금표 파일·유료 전환),
  그 승인 없이 만든 PR 은 초록이어도 자동 머지 대상이 아니다. **자동 머지가 결재의 우회로가 되면 안 된다.**
- 대표가 **기다리라고 했으면** 초록 사실만 보고하고 멈춘다(그때만 auto-merge 를 켜지 않는다).
- **CI 를 우회하지 않는다** — Verify 가 이 커밋(head sha 대조!)에 실제로 초록이어야 머지한다.
  `check_runs` 가 비어 있는데 PR 이 초록처럼 보이는 경우가 있다(옛 커밋의 통과 기록이 붙는다).
- **머니 경로·게이트 ON·발행/발송·삭제/purge 는 여전히 결재(C)** — 이 절과 무관하다.

## 🧪 원격 세션 검증 능력 — **npm 은 세션마다 다르다. 먼저 확인할 것** (2026-08-02 정정)

⚠️ **이 섹션은 2026-07-28 에 "npm 정상화"로 단정돼 있었다. 그 단정이 틀렸다** — 정책은 세션마다 바뀐다.
2026-08-02 실측: `npm ci` **403** · `npm view <any>` **403** · `npm i ms@2.1.3` **403**
(특정 패키지가 아니라 **레지스트리 전면 차단**). 07-28 의 성공도 사실이었다 — 둘 다 사실이고, 그래서
**단정하지 말고 세션 시작 때 한 번 찔러봐야 한다**(`npm view ms version` 이면 3초).

> ⚠️ **"npm 되니까 CI 로 미루지 마라"는 지침 자체는 유효하다.** 다만 **되는 세션에서만** 유효하다.
> 잠금파일(Toss·로딩)을 건드렸는데 npm 이 막혔으면 아래 우회로 **할 수 있는 만큼은 반드시 하고**,
> 못 한 범위를 커밋/PR 에 명시할 것. (머니 경로의 staging 실결제는 그대로 별도 — 빌드가 대체 못 한다.)

**🛟 npm 이 막혔을 때의 우회 — 2026-08-02 에 실제로 쓴 방법**
`node_modules` 가 없어도 **전역 `tsc`(`/opt/node22/bin/tsc`, TS 6)** 는 있다. 의존성 없는 순수 모듈
(`worker-ads/dispatch-budget.ts` 같은 정책·계산 파일)은 **단독 타입체크 + 컴파일 + 실행**이 된다:
```bash
tsc --ignoreConfig --noEmit --strict --target es2022 --module esnext --moduleResolution bundler <file.ts>
tsc --ignoreConfig --outDir <scratch>/build --target es2022 --module esnext --moduleResolution bundler <file.ts>
node <scratch>/harness.mjs      # 컴파일된 JS 를 import 해 불변식을 실제로 돌린다
```
⚠️ `--ignoreConfig` 없으면 TS6 이 **TS5112(tsconfig 있는데 파일을 지정함)로 즉시 중단**한다 — 출력이
짧아 "에러 없음"과 구분이 안 된다(이 레포가 `baseUrl` 로 이미 당한 클래스).
**alias(`@/`)·vitest import 가 있는 테스트 파일도 타입체크된다** — 스크래치에 스텁 tsconfig 를 만든다:
```jsonc
// <scratch>/tc/tsconfig.json  (+ stubs/vitest.d.ts 에 describe/it/expect·node:fs 최소 선언)
{ "compilerOptions": { "strict": true, "target": "es2022", "module": "esnext",
    "moduleResolution": "bundler", "noEmit": true, "skipLibCheck": true, "types": [],
    "paths": { "@/*": ["<레포절대경로>/src/*"] } },
  "include": ["stubs/**/*.d.ts", "<레포절대경로>/src/tests/unit/<대상>.test.ts"] }
```
⚠️ **왜 이걸 꼭 하라는가**: 컴파일된 JS 를 돌리는 해네스는 **타입 에러를 절대 못 잡는다.** 2026-08-02 에
`let cursor = 0` 에 객체를 대입하는 TS2322 를 해네스가 통과시켜 CI 를 한 번 더 돌렸다. 스텁 타입체크로
바꾸자 **TS7022**(제어흐름 narrowing 이 `cursor → sel → cursor` 로 순환)까지 미리 잡혔다.
⚠️ 이 우회로도 **못 하는 것**: React/JSX, vitest 러너 실행(어서션이 실제로 통과하는지), `npm run build`,
번들·배선 가드. ⇒ **순수 로직은 실행 검증 + 타입은 스텁으로, 배선·빌드는 CI 에 남긴다**로 나눠라.

**빌드 산출물 주의**: `npm run build` 는 `src/worker/generated/route-chunk-map.ts` 를 **재생성**한다(로컬 청크 해시).
이건 커밋 대상이 아니다 — 검증 후 `git checkout -- src/worker/generated/route-chunk-map.ts` 로 되돌릴 것.

**여전히 막힌 것(프록시)**: `dash.cloudflare.com` · `urdeal.kr` · **한국 공공 API 도메인 전반**
(`apis.data.go.kr` · `open.neis.go.kr` 등 CONNECT 403). 공공 API 스펙 검증은 이 환경에서 직접 호출로 못 한다 →
**라이브 워커의 `diag.error` 원문**(어드민 stats)이 사실상 유일한 ground truth. `data.go.kr` 문서 페이지는
WebFetch 도 403(봇 차단)이라 스펙 확인은 대표 화면 확인이 필요하다.

## 🧪 규율은 문서가 아니라 테스트로 (2026-07-29 대표 지시 — "문서 기재로 끝내지 말 것")

**규율 항목(지켜야 하는 불변식)을 발견하면 문서에 적는 것으로 끝내지 말 것.**
**발견 즉시 "테스트로 환원 가능한가"를 먼저 판단하고, 가능하면 그 세션에 박는다.**

판단 순서:
1. **환원 가능한가?** — 레포 안에서 관측 가능한 사실로 표현되는가(파일 내용·발행 SQL·설정값·호출 그래프).
2. **가능하면 그 세션에 작성** — 다음 세션으로 미루지 않는다. 미루면 문서만 남고 가드는 안 생긴다(실제로 반복됨).
3. **부분만 가능하면 그 부분을 박고, 못 막는 범위를 테스트 주석에 명시** — "이 테스트가 못 막는 것"을 적어야
   다음 세션이 가드를 과신하지 않는다.
4. **반드시 깨뜨려서 확인** — 일부러 위반을 주입해 빨강이 뜨는지 본 뒤 복원. (가드가 헛도는 사고가 실제로 있었다.)

> 예: *"ur-wholesale 에 cron 금지(정산 이중성숙)"* 는 머니 룰인데 **문서에만** 있었다(가드 0). 2026-07-29 에
> `wholesale-invariants.test.ts` 로 환원 — 단, 실제 cron 은 **Cloudflare 대시보드**에 걸려 레포가 못 보므로
> "레포 안에서 같은 사고를 만드는 경로"만 고정하고 그 한계를 주석에 적었다.
## 🚦 "코드에 있다 ≠ 살아 있다" — 소비자 경로를 말하기 전에 볼 것 (2026-08-03 신설)

**소비자 구매 경로·테스트 시나리오·절차를 제안하기 전에 `docs/FEATURE_STATUS.md` 를 먼저 열어라.**
자동 생성표다(`scripts/generate-feature-status.mjs`, pre-commit 재생성). 지금 **9개 기능이 꺼져 있다.**

> ⚠️ **왜 이 룰이 생겼나**: 2026-08-03 세션이 대표에게 실결제 절차로 **"딜 충전 5,000원"** 을 제안했다.
> 그 기능은 **2026-07-18 에 종료**됐고 서버는 403 을 준다. 라우트(`/points/charge`)도 페이지도 위젯
> 코드도 **온전히 남아 있어서** 파일만 보면 살아 있는 것으로 읽힌다. 종료는 `TOPUP_DISABLED = true`
> 한 줄로만 표현된다. 같은 함정이 최소 4개 더 있다(라이브커머스·쇼핑탭·공구호스팅·동네공구제안).

**💳 결제수단은 카테고리로 판정하지 않는다** — SSOT `src/shared/product-flow.ts` `getProductFlow()`:

| 판정 | 결제 | 무엇 |
|---|---|---|
| `deal_only === 1` | **딜** | **교환권** (기프티콘·KT) |
| `group_buy_status === 'active'` | **카드** | **이용권**(식당·뷰티·숙박) · 공구 |
| 그 외 | 카드 | 일반 쇼핑 |

⚠️ **교환권 ≠ 이용권.** 카테고리에 `_voucher` 가 붙는다고 딜 결제가 아니다 —
`meal_voucher` 인 "김밥천국 할인권"은 **카드 결제**다(SSOT 주석이 이 예를 든다).
같은 날 세션이 이걸 뒤집어 *"이용권은 카드로 못 산다"* 고 보고했고, 원인은 소비자 화면의
낡은 주석(*"교환권(voucher 카테고리)은 딜 결제"*)이었다. 가드: `check-payment-flow-ssot.mjs`.

## 🛡️ 감사 게이트 — 전수감사 전 필수 (2026-06-26 대표 지시 "이상적이면 이후 감사에선 안 보고 넘어가게 환경 설정")

**감사/전수조사 요청을 받으면 먼저 `bash scripts/audit-gate.sh` 를 돌려라.** 그리고:

1. **GREEN 도메인은 수동 재감사 금지** — 그 불변식은 결정론적 가드가 지키고 있다(`docs/AUDIT_INVARIANTS.md` 레지스트리). 가드가 GREEN 인 영역을 또 전수조사하는 건 시간 낭비 + 오탐 양산(이번 세션 교훈). 그 영역은 *새 코드가 가드를 통과하는지*만 보면 된다.
2. **RED·미보유 영역만 작업** — 게이트가 RED 면 그 가드가 가리키는 사이트만, `AUDIT_INVARIANTS.md` 의 "가드 미보유" 영역(결제 금액정확성·런타임 크래시·외부 PG 실응답)만 수동 감사.
3. **새 불변식을 발견·확인하면 가드부터 만들어라**(애초에 없도록) → `audit-gate.sh` + `AUDIT_INVARIANTS.md` 갱신. 수동 감사 결과를 반복하지 말고 기계가 지키게 한다.

> 현재 **100개** 불변식 GREEN (서비스분리·인증세션RBAC·머니패턴·DB스키마·상품종류·UI테마·시각KST·배포·번들). 상세: `docs/AUDIT_INVARIANTS.md`.
> ⚠️ 이 숫자는 가드를 추가할 때마다 낡는다(2026-07-29 에 47 → 76 으로 정정 — 29개가 밀려 있었다).
> **정확한 값은 `bash scripts/audit-gate.sh` 의 마지막 줄**이고, `check-audit-registry-sync` 가
> `docs/AUDIT_INVARIANTS.md` 의 개수만 강제한다(이 줄은 강제 대상이 아니라 수동 관리다).

> 🧪 **staging 검증 백로그 SSOT = `docs/STAGING_CHECKLIST.md`** (2026-07-05 신설). audit log 에 "staging 실결제 검증 필수"를 남길 때는 **같은 커밋에서 이 체크리스트에 항목(S#/P#) 추가** + 게이트 플래그면 `admin-system-monitoring.routes.ts` `OPS_GATES` 등록. 어드민 열람: `/admin/system-monitoring` "게이트·하트비트" 탭. cron 침묵·백업 무결성 관측: `cron-heartbeat.ts` + `/api/_healthcheck/cron` + `docs/BACKUP_RESTORE.md`.

## 🎫 디자인 시스템 확정 — 코레일톡 시안 (2026-09-02 대표 지시, 모든 세션 준수)

대표가 코레일톡 화면 둘(다크 결제 완료 · 화이트 지갑)을 보내며 확정했다:
*"저 이미지 속의 내용은 상관없어. 디자인 시스템이 중요하다"* · *"내가 보내준 다크모드 이미지, 화이트모드 이미지 다
오차없이 정확하게 디자인 시스템을 적용해서 진행해줘"* · *"우리 색상도 저 로즈 색 말고 내가 보내준 이미지 색으로
브랜드 색상 변경하자"* · *"결제가 완료되었어요 뒷 배경색이 난 가장 마음에 들기도 해"* · *"앞으로 아이콘은 모두 저 컨셉이야 명심해줘"*.
시안 원본: `docs/design/assets/korailtalk-payment-complete-ref.jpg`(다크) · `korailtalk-wallet-light-ref.jpg`(화이트).
분해·실측·매핑: `docs/design/ticket-completion-reference-2026-09.md`. 부품: `src/components/ticket/TicketCard.tsx`.

**색 (시안 픽셀 실측값 — `src/index.css` SSOT)**
| 역할 | 화이트 | 다크 |
|---|---|---|
| 브랜드(면·밴드·주 버튼) `--brand` | **#1C69EF** (구 로즈 #E0526B 폐기) | #1C69EF |
| 브랜드 글자 `--brand-text` | #1C69EF | #4D8DF5 |
| 바탕 `--bg` | **#F8F7FC** (구 크림 #FAF7F5 폐기) | **#11141C** (구 #0D0F12 폐기 — 남색 기운 근검정) |
| 카드 `--surface` | #FFFFFF | #1D1F29 |
| 카드 안 구분선 `--rule` / outline `--rule-strong` | 잉크 8% / 28% | 흰 8% / 32% |
| 카드 들림 `--lift` | `0 2px 10px 잉크 6%` 한 값 | none |

**표면 규칙 6개** — ① 표면 두 톤·**카드 테두리 0**(화이트에서 카드는 `shadow-lift` 한 값 — 단, **목록 그룹은 회색 바탕 위 평면 흰 판**이라 그림자 없이 쓴다, 아래 ⑦) ② 강조색 하나, 자리 셋(밴드·주 행동 글자·강조 단어) ③ 숫자가 주인공 ④ 티켓 은유(색 밴드 + 본문) ⑤ 나머지는 회색 ⑥ 체크 원·그라디언트·이모지·색깔 정보상자 0 (**섹션 라벨은 아래 ⑦ 의 그룹 라벨만 허용** — 그 밖의 장식 라벨은 여전히 0).
**⑦ 목록 문법 — 전체메뉴형 평면 목록(2026-09-29 대표 확정 **안 C**)**: 대표가 코레일톡 전체메뉴 화면을 보내며 *"마이는 이 이미지 형태로 가는게 좋을 것 같은데"* → 시안 셋 중 **안 C** 확정. 그 화면의 본질은 스타일이 아니라 **성격**이다 — 전체메뉴는 *읽는 화면이 아니라 찾는 화면*이라 셋을 안 한다: ① 줄마다 설명 ② 판(카드) ③ 두꺼운 행.
- **행 48px 평면**: [아이콘 18 · 제목 15px semibold · **짧은 값 오른쪽**(13px 회색, 여덟 자 안팎) · 화살표], 아래 hairline(`border-rule`), 판 없음. **설명 문장을 줄에 달지 않는다** — 길면 잘리고, 잘린 설명은 없느니만 못하다.
- **구역마다 17px 제목**(`SectionTitle`) — 내 가게 · 내가 산 것 · 설정·고객지원. **semibold · 자간 −1% · 흐린 잉크**(`text-gray-500`), 위 여백 `mt-8`. 🩸 **같은 것을 두 번 지적받고 나온 값이다**(2026-09-30): 오전 *"폰트 하며 너무 투박해"* 에 무게·자간만 고쳤고(`extrabold −3%` → `bold −1%`, 크기 24 유지), 오후 *"글자들이 너무 촌스러워. 무조건 해결"* 이 다시 왔다. 렌더로 보니 24px 순잉크 제목이 구역마다 서서 **화면에서 가장 무거운 글자가 제목**이었다 — 주인공은 오늘 매출(28)과 행 제목(15)이고 제목은 구역을 *가르기만* 하면 된다. ⚠️ **크기를 줄인 만큼 위 여백을 늘린다**(mt-7→mt-8): 경계를 이제 공백이 만들기 때문이고 둘은 짝이다. 🔑 값은 `SECTION_TITLE_CLS` **한 곳**에 있다 — 오전 처방이 화면에 안 닿은 이유가 판매 구역이 제목을 *손으로 적고 있어서*였다(가드가 출처를 고정한다). 24px 단계는 스케일에 남아 있지만(다른 표면이 쓴다) 마이의 구역 제목은 아니다.
- 🔵 **판(`ListPlate`)은 파는 쪽에만.** 안 C 에서 **판이 곧 "여기가 파는 쪽"** 이라는 표시자다. 손님 쪽 블록에 `shadow-lift` 가 하나라도 서면 그 표시가 무의미해진다.
  🗂️ **2026-10-14 — PC(lg+)는 예외다**(대표 확정 *"PC 마이는 B"*): PC 마이는 머리·내 가게·설정·곧 쓸 이용권·내가 산 것이 **전부 카드**다. 모양은 `index.css` 의 `.ur-account-pc .ur-pc-card`(lg 미디어쿼리 안) **한 곳**에서 오고, 부품 소스엔 `shadow-lift` 를 쓰지 않는다 — 그래서 폰은 이 규칙 그대로다. 가드 `my-zones-and-pc` · `my-pc-plan5` + 주입 `pc-my-b-2026-10-14.mjs`.
  📋 **2026-10-25 — 폰 위쪽(내 딜 · 이용권 · 쿠폰)도 판 하나다**(대표 확정 *"위쪽 안 3 으로 하되, 곧 쓸 이용권은 빼주고"*). 손님 쪽의 **유일한** 판이고 대표 승인 예외다 — 다른 손님 구역에 판을 더하지 말 것(가드 `my-top-plan3-2026-10-25` ⑤가 MyStats 의 판 1개 · 다른 구역 0개를 고정). 줄의 값엔 단위를 붙인다(`111,500딜` — 칸이 아니라 줄이라 잘릴 폭이 없다). 환급 줄은 **`충전 딜 환급`** 이라고 말한다(대표 *"환급은 뭐야? 정산이야?"* — 손님이 충전했던 딜을 현금으로 돌려받는 일이고, 가게 매출 입금인 정산과 다르다).
- 🔓 **접이식을 기본으로 두지 않는다** (2026-09-30 대표 *"왜 굳이 열고 닫게 해두는거지? … 가시적이지 않아 보는데에 불편해"*). 접기는 *길이*에 대한 처방이지 기본값이 아니다 — 구역이 다섯에서 셋으로 줄면서 아낄 세로가 병목이 아니게 됐다. 접힌 줄은 "여기 뭔가 있다" 고만 말하고 무엇인지 안 말한다.
- ⏳ **판매 구역은 자리를 *예약*한다** — 좌석 조회가 도는 동안 비워 두면 손님 줄이 구역 전체 높이만큼(실측 **+336px**) 밀린다. 예약 높이는 **지난 렌더에서 잰 값**(`seller-reserve.ts`)이지 손으로 적은 숫자가 아니다. 같은 이유로 *폴백*(매장 계산대)은 좌석이 **확정된 뒤에만** 뜬다 — "아직 모른다" 는 "없다" 가 아니다.
- 🏪 **2026-10-31 대표 확정 9번 B안 — 폰 마이는 판·구분선이 없다.** 위쪽(내 딜·이용권·쿠폰)·판매 목록의 흰 판과 줄 사이 실선을 폰에서만 걷는다(`index.css` `.ur-my-flat` · lg 미만). '여기가 파는 쪽' 표시자는 판 → **가게 머리줄**[가게 사진 · 이름 ⌄ / 판매 중 N개 · 매장 N곳 · 가게 보기 ›]로 옮겨갔다. 머리줄을 누르면 매장 고르기 창(매장마다 오늘 매출 · 다른 매장 새 주문 표시 · 매장 추가). 위 *"판은 파는 쪽에만"* · 10-25 위쪽 판은 **폰에서 이 결정으로 대체**, PC 카드(10-14)는 그대로. 공용 부품(`list-grammar`)은 불변 — 유어샵 관리·에이전시 화면은 판 유지. 가드 `my-store-head-flat-2026-10-31.test.tsx`.
- 🔢 값이 **0 이면 회색**, `undefined`(아직 모름)는 **아예 안 그린다**, 조회 실패는 `—`(0 으로 위장 금지). **PC 머리 띠의 숫자 칸**(`MyStats inline`)의 값에는 **단위를 붙이지 않는다**(`10,300딜` 아님 `10,300` — 폰은 2026-10-25 부터 칸이 아니라 목록 줄이라 단위를 붙인다) — 라벨이 이미 무엇인지 말하고, 그 단위 17px 가 아이폰 13(390px)에서 숫자를 칸 밖으로 밀어내 `10,30` 으로 잘리게 하던 원인이다(실측).
- **부품 SSOT = `src/pages/user-profile/list-grammar.tsx`**(`SectionTitle`/`ListPlate`/`ListRow`/`FoldRow`) — 마이의 목록은 전부 이것으로 그린다.
> 📏 **실측이 이 전환의 근거다**(`out/visual/my-firstscreen.png`): 폰 한 화면(430×844)에 행 높이 **약 70 → 48px**, 흰 판 **3 + 파란 면 → 1**. 종전 문법은 *읽는 화면*처럼 만들어져 있어서, 1200px(한 화면 반)까지 내려도 '내가 산 것'이 안 나왔다.
> 🩸 **여기 오래 적혀 있던 "손님 줄 0 → 3" 은 페르소나를 안 밝힌 숫자라 정정한다** — 그 3 은 **비셀러** 측정이고, 셀러로 열면 안 C 뒤에도 **0** 이었다(내 가게 아홉 줄이 화면을 채운다). 같은 화면이 사람에 따라 다른 값을 내는데 숫자만 적으면 다음 세션이 오판한다.
> 🧹 **2026-09-30 대표 확정 ⑥ — 판매 바로가기 아홉 → 넷**(주문 · 이용권 · 정산 + 전체 도구, 그 위에 파란 사용처리 줄). 뺀 넷(매출 분석 · 가게 · 소개 파트너 · 브랜드메시지)은 **지운 게 아니라** `전체 도구` 가 `COVERED_BY_SHEET` 로 **같은 시트**에 보낸다. 매출 분석은 사라지지도 않았다 — **오늘 숫자가 그 입구**가 됐다(같은 데이터의 드릴다운이라 줄을 따로 쓸 이유가 없었다). ⇒ 셀러 첫 화면 손님 줄 **0 → 3**. **바로가기가 아홉이면 바로가기가 아니다** — 목록을 떼어 재지 말고 **위(헤더·스탯·제목·오늘 카드)와 아래(하단 탭)를 같이** 잴 것. 가드 `my-shortcut-four-2026-09-30`.
> 🎟️ **2026-10-10 대표 확정 안 3 — 사용처리 = QR 티켓, 이용권 = 진한 블루 줄.** 대표 *"이용권 사용처리와 이용권 등록 및 관리 모두 다르더라도 티가 나야하는데"* → 시안 넷 중 **안 3** + *"바코드 모양이 아니라 QR모양이어야 하잖아 버튼이"*. 같은 줄 문법이던 둘을 **생김새부터** 가른다: 사용처리는 옅은 블루(`bg-brand-tint`) **티켓**(판 색 `bg-surface` 로 뚫은 홈 둘 + 점선 + QR 꼬리 `QrScanIcon`), `이용권 등록 · 관리` 는 판의 **유일한 진한 블루 면**(`주문` 위). 바로가기 줄은 셋(주문 · 정산 · 전체 도구). 꼬리를 바코드로 그리지 말 것 — 손님이 내미는 이용권은 QR 이다. 가드 `my-scan-ticket-qr-2026-10-10` + 주입 3건.
> 🎟️ **2026-10-25 대표 확정 안 G — 위 10-10 안 3 을 대체한다.** 대표 *"안 G로 하고, 이용권 등록 및 관리로 명칭 바꾸면 되잖아"*. '내 가게' 는 [판 **밖 위**에 나란한 두 칸: 진한 블루 `사용처리`(QR · 손님 QR 찍기) · 흰 칸 `이용권 등록·관리`(판매 중 N개)] + [목록 판 하나: 오늘 매출 › · 판매 알림 › · 주문 › · 정산 › · 전체 도구 ›]. 10-10 의 불변식은 그대로다 — 둘은 생김새가 다르고(파란 칸 ↔ 흰 칸) 그림은 QR 이며 진한 블루 면은 하나(이제 **사용처리**). 이름은 `이용권 등록·관리`(가운뎃점 — '및' 은 390px 에서 두 줄이 된다). 판매 알림은 머리 알약 → 판 안의 줄(`StoreNotifButton variant="row"`, 머리 벨과 헷갈리지 않게 아이콘은 `MailIcon`). 오늘 숫자는 28px 카드 → 판의 머리 줄(누르면 매출 분석). ⚠️ **에이전시 콘솔 판은 범위 밖**이라 옛 모양 그대로다. 가드 `my-scan-ticket-qr-2026-10-10`(재조준) + 주입 3건.
> ⚠️ **잃은 것**: 줄마다 붙던 설명 12개("매장에서 QR·코드로 사용" 등). 처음 쓰는 사람에겐 정보가 준다 — 대신 하루에 여러 번 여는 사람에겐 매번 소음이었고, 그 12줄이 손님 메뉴를 첫 화면 밖으로 밀어내고 있었다.
> 🔴 **이 결정이 2026-09-28 '이름 E' 를 대체한다.** E 는 *"손님 구역엔 큰 제목을 두지 않는다 — 제목이 붙은 구역이 파는 쪽"* 이었는데, 안 C 는 **모든 구역**에 제목을 주므로 제목이 그 일을 못 한다. 표시자가 **제목 → 판**으로 옮겨간 것이지 사라진 게 아니다. 같은 이유로 **브랜드 띠(3px)와 구역 경계선도 걷었다**(규칙 ②로도 남길 수 없다 — 그 구역의 파란 자리는 이미 셋이다). 가드 `my-zones-and-pc-2026-09-28` 재조준 + `my-list-grammar-2026-09-28` 재조준.
> 🩸 **2026-09-28 정정(기록 유지)**: 이 줄은 한때 *"평면 흰 판 … **그림자 0**"* 이라고 적혀 있었는데 확정 구현과 달랐다 — 대표가 확정한 '전체 4'도 판매 묶음도 전부 `shadow-lift` 였다. 그 문서를 믿고 손으로 그린 목록이 마이 한 화면에 **셋**이었고 라벨 위치·판 개수·글자 크기·테두리가 전부 갈려 있었다. ⇒ **문서가 실측과 어긋나면 다음 세션이 그 문서를 믿고 대표 확정안을 되돌린다.**
**⑧ 타입 스케일 여섯 단계 + 4px 격자(2026-09-28 대표 *"디자인, ui 모두 별로야. 대기업수준이 필요해"*)**: 글자 크기는 **28**(큰 숫자 — 규칙 ③) · **24**(구역 제목) · **17**(사람 이름·시트 제목) · **15**(목록 행 제목·블록 라벨·주 버튼) · **13**(설명·보조) · **12**(그룹 라벨 — **바닥**, 이보다 작은 글자를 새로 만들지 않는다) **여섯 개뿐**이고, tailwind 기본 단계(`text-sm`/`text-lg`/…)를 **섞지 않는다**(체계가 둘이 되면 스케일이 무의미해진다). 간격은 **4의 배수**만 — 유일한 예외는 **음수 광학 보정**(`-mt-0.5` 같은 아이콘 미세 정렬)이다(리듬이 아니라 한 요소를 눈으로 맞추는 일이라 격자 밖이 맞다). 🩸 **왜 규칙이 됐나(실측)**: 마이 한 화면에 크기가 **17단계**(`9·10·10.5·11·11.5·12·12.5·13·13.5·14·15·16·17·18·25·28·30px`)였고 반쪽 간격이 **115건**이었다. 12 와 12.5 와 13 이 한 화면에 있으면 **어느 두 줄도 서로 동의하지 않는다** — 개별 결함이 아니라 그것 자체가 *"덜 만든 화면"* 의 인상을 만든다(대표가 두 번 지적한 그 인상). 단계 하나가 반쪽 값으로 새도 **빌드는 초록이고 화면도 안 깨져서** 17단계까지 이렇게 자랐다 ⇒ 사람 눈이 아니라 가드가 센다: `my-type-scale-2026-09-28.test.ts`(주입 6건) — 측정 토큰이 100개 미만이면 **통과가 아니라 실패**다.
> 🌐 **2026-09-29 — 이 규칙이 소비자 전 화면으로 넓어졌다**(대표가 UI 개선 네 트랙을 전부 승인, 그 ③번). 실측(잠금표 밖 **391파일**): 본문 크기 **26단계·3,576건 → 5단계**(12·13·15·17·24) · tailwind 기본 단계 **1,086건 → 0**(체계가 둘이던 것) · 반쪽 간격 **737건 → 0**. 가드 `consumer-type-scale-2026-09-29.test.ts`(주입 7건).
> 🕳️ **그 가드의 첫 판이 최상위 페이지 734개에 눈멀어 있었다** — `git ls-files 'src/pages/**/*.tsx'` 의 `**` 는 `FNM_PATHNAME` 이라 **디렉터리를 최소 하나 요구한다.** `src/pages/AffiliatePage.tsx` 같은 파일이 코드모드에서도 가드에서도 통째로 빠졌는데, 에러가 안 나고 *"459개 검사함"* 처럼 보여서 **지키는 척**만 했다(그 파일의 `text-xs`·`text-sm` 이 그대로 남은 채 초록불이었다). ⇒ **glob 은 최상위와 하위를 둘 다 명시**하고, 검사 대상 수 하한(3,000·7,000)이 같은 회귀를 다시 잡는다. 같은 클래스의 glob 을 쓰는 다른 가드도 의심할 것.
> 🔒 **잠금표에 있는 소비자 파일 12개는 손대지 않았다**(BottomNav · TossPaymentWidget · GroupBuyFeedCard · VouchersPage · BrowsePage · MyVouchersPage · PaymentSuccessPage · TossWidgetPayPage · RestaurantMiniMap · RouteGuards · KakaoCallbackPage · GroupBuyDetailPage). **클래스만 바꾸는 일이어도 잠금 절대 룰이 걸려 대표 승인 + audit log 가 필요하고**, 게다가 색만 바뀌는 일도 아니다 — `text-[9px]` → `12px` 면 하단 탭 라벨과 온누리 뱃지가 눈에 띄게 커진다. `LOCKED_BASELINE`(size 22 · tw 29 · half 44)으로 **늘지 않게만** 막고, 그 목록은 손으로 적지 않고 **이 문서의 잠금표 행에서 파생**한다(아무 파일이나 제외 목록에 넣는 탈출구는 주입이 막는다).
> 🖼️ **디스플레이(26px 이상)는 일곱 단계 — `28 · 34 · 40 · 48 · 60 · 76 · 96`** (2026-09-30 대표 *"다 순서대로 이상적으로 해줘"*로 결정. 비율 1.21·1.18·1.20·1.25·1.27·1.26 의 모듈러 스케일이고 본문 `…17·24` 위에 이어진다). 이행 전은 **임의 px 25단계 130건 + tailwind `3xl~7xl` 5단계 48건** = 디스플레이도 **체계가 둘**이었다. 이동은 최대 6px(66→60·54→48)이고 대부분 ≤2px. 코드모드 `scripts/codemods/display-scale.mjs`. **96px 초과는 글자가 아니라 그래픽이라 무접촉**(`IntroducePage` 100px 워터마크 · `NotFoundPage` 140/200px 404 글리프 — 둘 다 `select-none`), 그리고 진짜 글자가 그 예외로 새지 못하게 가드가 `select-none` 인지 대조한다. 🩸 **코드모드가 조용히 만든 결함 하나를 잡았다 — 반응형 사다리 붕괴**: 7 rung 은 원본보다 촘촘하지 않아 `34/44/58/66` → `34/40/60/60` 처럼 **인접 rung 이 같아진다**(그 브레이크포인트가 아무 일도 안 하는데 빌드도 화면도 안 깨진다). 5곳을 전수로 찾아 **늘리지 않고 잉여 rung 을 덜어내는** 쪽으로 손으로 고쳤다(늘리면 −10px 급 이동이 생긴다). 가드: `consumer-type-scale-2026-09-29.test.ts`(디스플레이 5건 추가) — **정본 집합이 이 문장과 어긋나면 빨간불**이라 가드가 스스로 스케일을 넓힐 수 없다.
> ⚠️ 이 가드가 **못 보는 것**: 인라인 `style`·CSS 파일의 크기값 · 크기는 맞는데 **자리가 틀린** 경우(설명을 15 로, 제목을 13 으로) — 그건 그림으로만 보인다(`node scripts/visual-preview.mjs --route=/user/profile --stores=1`). **대시보드(어드민·셀러·에이전시·도매)는 여전히 범위 밖이다**(별도 체계).

**⑨ 굵기 세 단계 — 400 · 500 · 700 (+ 디스플레이 800)** (2026-10-25 대표 *"굵기, 크기 등의 전반적인 것들이 투박함이 남아있는 것 같아"* → 에이블리·여기어때·NOL·오늘의집 화면 비교 → *"체계적으로 하자"*): **400** 설명·가게명·보조 · **500** 상품명·목록 제목·탭·칩·작은 강조 · **700** 섹션 제목·가격 숫자·주 버튼 — **15px 이상에서만** · **800** 은 디스플레이(28px+)만. ❌ `font-semibold`(600) · `font-black`(900) · 12·13px 의 700+(칩·배지도 예외 없다). 인라인 `style={{ fontWeight }}` 도 같은 규칙. **한 덩어리에 굵은 제목은 하나** — 카드 안 이름·소제목은 500(크기 규칙으로는 못 잡는 역할 규칙이라 그려서 본다). 🩸 **왜 규칙이 됐나(실측)**: 라이브 첫 화면의 굵은 글자(600+) 비율이 교환권 **73%** · 유어샵 80% · 홈 62% · 이용권 상세 45%였고 **500 은 0** 이었다(강조하려면 곧바로 700~900). 참고 화면들은 굵게를 섹션 제목과 가격에만 쓴다. 변환 `scripts/codemods/weight-scale.mjs`(같은 문자열의 크기를 보고 정한다) · 가드 `weight-scale-2026-10-25.test.ts`(이행 화면 0 + 나머지 래칫 · 주입 5건). 1차 이행 = 교환권 · 이용권 상세(교환권 굵은 글자 73% → 11%). 시안·비교: `docs/design/weight-scale-2026-10.md`.

새 소비자 카드는 `TicketCard`/`shadow-lift`/`border-rule` 로만. `border border-*`·`shadow-sm~2xl`·`bg-amber-50` 류 정보상자 **신규 금지**.
🛡️ **2026-09-29 — 이 문장에 드디어 강제가 붙었다**(대표 UI 네 트랙 ④). 룰은 2026-09-02 에 적혀 있었는데 가드가 없어서 재 보니 테두리 친 카드가 **304건**이었다. ⇒ `card-border-to-lift-2026-09-29.test.ts`(주입 5건) + 코드모드 `scripts/codemods/card-border-to-lift.mjs`. **전수 변환은 일부러 안 한다** — 테두리가 *일하고 있는* 자리가 섞여 있다: 떠 있는 면(드롭다운·토스트·모달 — 그림자만으론 페이지와 안 갈린다) · **선택 신호**(`border-brand`·`ring-` — UI① 이 세운 언어라 지우면 눌러도 표시가 없다) · 틴트 상자(`shadow-lift` 는 잉크 6% 라 그 면 위에서 거의 안 보인다) · 잠금표 파일. ⇒ **흐름 속 평범한 흰 카드 65건만** 바꾸고(84 → 19) 나머지 239는 래칫. 🔑 시험이 조건을 복제하지 않고 **코드모드를 `--dry` 로 돌려** "자동으로 고칠 게 남았는가" 를 묻는다 — 둘이 갈리면 둘 다 못 믿기 때문이다. ⚠️ 못 보는 것: 변수로 조립한 className · 인라인 `style` · **뗀 자리가 보기 좋은지**(그려서 봐야 한다).

**🎨 아이콘 컨셉 (대표 "앞으로 아이콘은 모두 저 컨셉")** — 두 벌뿐이다:
- **하단 탭·네비**: `src/components/icons/urdeal-icons.tsx` — 24 그리드, 획 1.6, 둥근 끝, **비활성 = 선 / 활성 = 면(`filled`)**. lucide 탭 아이콘 금지.
- **카테고리·서비스 타일**: `src/components/icons/category-icons.tsx` — 32 그리드, **윤곽선 없는 flat 채색 일러스트**(물건 그 자체를 색 하나 + 명암 한 단계로), `CategoryTile` 원 위에. 팔레트는 그 파일의 `CATEGORY_PALETTE` 에서만 고른다.
- **지도 위 칩**(`MapTopBar`·`SheetFilterBar`, 2026-09-02 대표 "B안"): `urdeal-icons.tsx` 의 **선 아이콘**(`GridIcon`·`MealLineIcon`·`BeautyLineIcon`·`StayLineIcon`·`TicketStubIcon`, voucher-types `icon` 필드). 채색 타일은 카드·완료 화면용이고 지도 위엔 단색이다.
- **목록 행**(마이의 `ListRow` 18px): `urdeal-icons.tsx` 의 **선 아이콘**. 2026-09-28 에 18종을 더해 24종이 됐다 (쿠폰·찜·단골·알림·주문상자·배송지·리뷰·제안·사람들·가게등록·주문·분석·메시지·설정·스캔·로그아웃·메일·메달). 경계는 **뜻이냐 조작이냐**다 — *뜻*(내 이용권·정산·설정·가게)은 우리 물건의 이름이라 남의 세트에 맞는 그림이 없고, *조작*(화살표·닫기·검색·확인·더하기·로딩)은 어느 앱에서나 같아서 직접 그릴 값이 없다.
- 유틸리티(화살표·닫기·검색·복사)만 lucide, 획 1.6. **새 화면에 lucide 로 카테고리/서비스/탭/목록행 아이콘을 그리지 말 것.**
🌐 **2026-09-29 — 이 경계가 마이를 넘어 소비자 전 화면으로 넓어졌다**(같은 트랙 ④). 넓히기 전 실측: lucide **136종 853건** 중 조작 27종 371건 / **뜻 109종 482건** — 즉 탭 다섯과 마이만 우리 것이고 나머지는 통째로 lucide 였다(획이 2.0 과 1.6 으로 갈리는데 같은 줄에 나란히 선다). 뜻이 1:1 로 맞는 27개 이름을 코드모드로 이행해 **482 → 184건(-62%)**, 신규 10종(`Clock`·`Store`·`Bag`·`Wallet`·`Ok`·`Alert`·`Warn`·`Bad`·`Info`·`Truck`)을 그려 세트가 **42종**이 됐다. 남은 184(93종)는 한두 번씩만 쓰이는 긴 꼬리라 래칫으로 동결. 가드 `consumer-icon-system-2026-09-29.test.ts`(주입 6건) + 코드모드 `scripts/codemods/adopt-urdeal-icons.mjs`.
🩸 **그림만 바꾸면 안 된다 — 코드모드가 만든 결함 둘**: ① `strokeWidth` **58곳**(lucide 기본이 2 라 호출부가 1.5~3 으로 제각기 손보고 있었다 — 그대로 두면 세트를 바꾸고도 획이 열 가지로 남는다. **세트의 정체성은 1.6 하나다**) ② `fill` **12곳** — lucide 는 `<svg fill>`·`fill-*` 클래스가 path 까지 먹지만 우리 아이콘은 path 에 `fill="none"` 을 박으므로(면/선을 `filled` 로 가르기 위해) **안 채워진다**. 찜한 하트·별점이 속 빈 채로 뜨는데 에러가 없다 ⇒ `filled` prop 으로 옮기고 **조건부였던 4곳**(별점 picker·찜·관심)은 `filled={조건}` 로. 둘 다 가드가 고정한다.
⚠️ **래칫은 스스로 헐거워지는 걸 못 막는다** — 기준을 올리거나 `OPERATION` 목록에 뜻 이름을 더하면 조용히 통과한다(주입 둘이 실제로 헛돌아 그걸 배웠다). 그래서 시험이 *"코드모드 대응표에 이미 그려 둔 이름이 조작 목록에 있으면 안 된다"* 는 불변식을 따로 갖는다. **`OPERATION` 에 뜻 이름을 추가하지 말 것.**

**🔵 주 행동 버튼은 브랜드 블루 하나다 (2026-09-28 — 2026-09-02 확정의 이행 완료)**: `ur-btn` 을 쓰는 자리는 **`ur-btn-primary`**(뜻 클래스), 아니면 **`bg-brand text-white`**. ❌ `bg-gray-900 … text-white` 를 **손으로 적지 말 것** — 검정은 규칙 ⑤(나머지는 회색)의 *글자·테두리* 용이고, 채움으로 쓰면 주 버튼이 화면마다 두 색이 된다. 🩸 **왜 규칙이 됐나(실측)**: 2026-09-02 에 *"주 버튼: 잉크 #16181C → 브랜드 블루 #1C69EF"* 로 정하고 `.ur-btn-primary` 까지 만들어 놨는데, 2026-09-28 에 재 보니 소비자 화면 **224곳**이 아직 손으로 검정을 적고 있었다. 그래서 **똑같은 "다시 시도" 버튼이 마이에선 파랑, 숙소 목록에선 검정**이었고 홈의 "교환권 보러가기"도 검정이었다. 빌드는 초록이고 화면도 안 깨져서 **아무도 신고하지 않는다** — 대표가 두 번 지적한 *"디자인·ui 가 별로다"* 의 실체 중 하나가 이것이다. 가드: `check-primary-button-color.mjs`(주입 4건) + `primary-button-color-2026-09-28.test.ts`.
> ⚠️ 이 가드가 **못 보는 것**: 파랑이 *맞는 자리*인지는 안 본다(파괴적 행동까지 파랑으로 칠해도 통과) · 변수로 조립한 클래스 · 인라인 `style`. 그리고 **잠금표 파일 8개의 잔여 20건은 일부러 안 고쳤다** — 색만 바꾸는 일이어도 잠금 절대 룰이 걸려 대표 승인이 필요하다(`scripts/primary-button-baseline.json` 에 동결, 승인되면 0 으로 내리고 파일 삭제).
> 🔴 **할인율 빨강(`text-sale`)은 이 규칙의 예외가 아니라 다른 축이다** — 블루=**행동**, 빨강=**가격 이득**(2026-09-07 대표 확정, AA 검증 + 가드). 할인율을 블루로 바꾸지 말 것.
  🩸 **왜 규칙이 됐나(실측)**: 탭 다섯만 우리 것으로 바꿔 놓고 **그 바로 아래 본문은 통째로 lucide** 였다 — 마이 한 화면에 lucide 36종·87건 vs 유어딜 0종. 획이 2 와 1.6 으로 갈리는데 **같은 열에 나란히** 서 있어서 그 차이가 그대로 보였다. 가드 `my-icon-system-2026-09-28.test.ts`(주입 6건)가 조작 허용목록 밖 이름을 차단한다. ⚠️ 그 가드는 **이름만** 본다 — 그림이 좋은지는 `visual-preview` 로 그려서 봐야 한다.

**🌡️ 회색 램프 온도 (2026-09-30 대표 *"전체 적용하자"*)** — `tailwind.config.js` 의 `INK` 가 **중간에서 온도를 뒤집고** 있었다(양 끝은 쿨, 100~700 은 크림/베이지 — 2026-09-02 로즈→블루 전환이 양 끝만 갈았다). 한 화면에 온도가 둘이면 개별 결함이 아니라 *"칠이 안 맞는다"* 로 읽힌다(대표 *"지저분하다 · 전문성도 없어보인다"*). 온도만 차갑게 재계산하고 **대비는 ±0.10 보존**: `100 #EDEFF3 · 200 #E2E5E9 · 300 #CFD3D8 · 400 #81868C · 500 #666C72 · 600 #4F545A · 700 #383D42 · 800 #262A2F`(다크 `--ink-soft #9FA3A8 · --ink-faint #6F747A · --ink #F8F7FC`). 🔑 **적용 지점은 `tailwind.config.js` INK 와 `src/index.css` 토큰 둘이고 쌍이다** — 화면에 유틸(`text-gray-*`)과 토큰(`border-line`)이 함께 남아 있어 한쪽만 고치면 같은 선이 두 색으로 그려진다(에러 0). `surface-tokens-2026-09-15.test.ts` 가 INK 에서 기대값을 뽑아 둘을 대조한다. 아래 audit log 의 웜 hex 표기는 *작성 당시 기록*이다(소급 수정 X).

**🛍️ 유어샵 한 톤 (2026-09-30 대표 확정 — 규칙 ①의 명시적 예외)**: 페이지 바탕 = `bg-surface`(카드와 같은 톤) · 목록은 판 대신 `divide-y divide-rule`(**폰 한정** — PC 는 같은 칸에서 09-02 문단의 안 A 2열이라 `lg:divide-y-0 lg:grid`. 두 확정이 서로 다른 뷰포트라 결합했다) · 분류는 알약 칩 → **밑줄 탭 + 개수** · chrome↔목록은 탭 줄 아래 실선 하나. 대표 *"아예 모두 똑같이 배경색을 카드 색상이랑 같게 한다면???"* → *"일단 이 형태가 낫고"*. 카드 화면(결제 완료·지갑)은 두 톤이 맞지만 **목록 화면은 판이 N개 떠다닌다**(⑦ 을 만든 것과 같은 판단). ⚠️ `DealRow` 의 `surface="plain"` 은 **opt-in** — 기본값(`card`)을 바꾸면 다른 다섯 화면이 같이 납작해진다. 좌상단 `urdeal` 은 **텍스트가 아니라 `<UrDealLogo/>`**(라이브 실측에서 Pretendard·점 없음이었다) · 검색·찜·내 이용권 GNB 없음(대표 지시). SSOT: `docs/design/ticket-completion-reference-2026-09.md` §14·§15 · 가드 `ushop-one-tone.mjs` 8건.

**🔵 유어샵 헤더 버튼 (2026-10-07 대표 확정 — 시안 셋 중 **안 C**)**: 대표 *"여기 관리, 공유 버튼이 촌스럽네.."*. 한 줄에 **모양 2종·높이 2종**(36px 민 원 ↔ 31px 테두리 알약)이 섞여 있었고, c2 가 *"그 한 자리"* 라고 못 박은 `관리` 가 누구나 보는 `공유` 와 같은 무게로 서 있었다. ⇒ **공유는 SNS 와 같은 상수**(`iconBtnCls` — 테두리 없는 36px 원)로 내리고 **관리만 채운다**(`manageBtnCls` = `bg-brand text-white` · h-9 · 15px · 유어딜 `EditIcon`). ⚠️ 이것은 2026-09-28 의 *"헤더에 블루 면을 두지 않는다"* 를 **뒤집는다** — 불변식이 "블루 면 0" → **"채운 면은 정확히 하나이고 그것이 `관리`"** 로 옮겨갔다(🎫 규칙 ② 그대로이고, 헤더의 유일한 색 면이 주인 전용 자리가 되어 c2 의 의도는 오히려 또렷해진다). 가드 `ushop-a3-p1.test.ts`·`ushop-sns-mono-2026-09-16.test.ts` + 주입 `ushop-header-c.mjs` 6건.

**👤 유어샵 머리 = **2안 컴팩트 머리** (2026-11-01 대표 *"2안"* — 2026-10-14 A 의 치수를 대체한다)**: 맨 윗줄 [로고(모바일만 `lg:hidden`) … **공유 · 관리**] / 그 아래 [얼굴 **40px**(사진, 없으면 **유달이** `SHARE_MASCOT_SRC` — 공유 카드와 같은 그림, 이니셜 원 금지) · **이름(크기 자동 17→15px, `truncate` 로 언제나 한 줄)** + 소개 **한 줄**] / 그 아래 [`이용권 N · 누적 구매 M`(`curatorSoldTotal` SSOT) · SNS 이름표(탭 36px `snsHitCls` / 알약 `snsPillCls`)]. 서버 첫 화면(`curator-ssr-body.ts`)이 같은 클래스·같은 얼굴 URL·같은 숫자·**같은 글자 크기 함수**를 쓴다.
> 🔴 **버튼(공유·관리)을 이름 줄로 되돌리지 말 것** — 그게 긴 이름이 두 줄이 되던 원인이다(실측: 이름 칸 **132px**, 24px 한글 5자). 지금은 **294px**. 되돌리면 2026-10-09 의 `관리` 자리 예약(`invisible`)도 **같이** 되살려야 한다(주인/방문자 폭이 갈리면 서버 첫 화면이 마운트 때 아래를 전부 민다).
> 🔴 **이름 크기를 손으로 박지 말 것** — SSOT `shared/ushop-name-size.ts` 의 `ushopNameSizePx(name)` 이 **글자만 보고** 정하고 워커가 같은 함수를 쓴다. 측정 기반(`ResizeObserver`)은 워커가 못 따라가 머리가 튄다.
> 🔴 **칩·정렬 줄의 자리 예약은 조건부다** — 판정 SSOT `shared/ushop-pin-category.ts`(`showUShopChips` · `showUShopSort`, 정렬 최소 **5개**)를 화면·부품·워커가 **같이** 쓴다. 무조건 예약으로 되돌리면 이용권이 적은 유어샵에서 서버만 그 줄을 그려 밀린다.
> ✅ **E4 판정 통과(배포 후 라이브 + 하네스, 머지 `26fe4a9`)**: 폰 UA 로 `urdeal.kr/u/jiwon1228` 을
> 받아 **파싱해서** 재니 — h1 이 `style="font-size:17px"` 를 **실제로 들고 있다**(박힌 값이 아니라
> `ushopNameSizePx` 가 정한 값) · `truncate`·`min-w-0` 실재 · 얼굴 `w-10 h-10`(옛 `w-14` **0**) ·
> 버튼 묶음(`ml-auto`)이 **h1 보다 앞**(오프셋 695 < 1314 = 브랜드 바 줄에 있고 이름 줄에 없다) ·
> 칩 줄 div 가 **비어 있다**(`empty:hidden` → 접힌다. 라이브 핀 1개라 `showUShopChips`·`showUShopSort`
> 둘 다 거짓 ⇒ 서버가 자리를 **안 그렸다**). 🔴 **대조군도 함께 쟀다**(0 은 결함과 측정 실패를
> 구분하지 못한다): 프로필 `<img>` 1 · 첫 이용권 링크 `/u/jiwon1228/p/2919` · 가격 숫자 실재.
> 📐 하네스 박스(390px): h1 **h=21 · top=60** · 얼굴 40×40 · **첫 이용권 top=163**(종전 281 — 예측과 일치).
> 🔑 **긴 이름을 경계까지 밀어 봤다**: 한글 20자 → **h=19 · w=291**(17 → 15px 로 줄고 말줄임) ·
> 영문 45자 → **h=19 · w=294**. 어느 경우도 **38 이상(두 줄)이 나오지 않는다** ⇒ *"아무리 길어도 한 줄"*.
> PC(1440) 한글 15자도 **h=21 한 줄**(회귀 0). ⚠️ **못 잰 것**: 실제 폰의 체감(렌더는 시스템 글꼴로
> 떨어진다 — 자간·행간 판단 불가, 배치·높이만 유효) · 사업자 유어샵(`linked_seller`)의 아래 레이아웃.
> ⚠️ *누적 구매* 는 진열 상품의 전체 판매 수 합이다(이 유어샵을 거친 구매 수가 아니다 — 시안 A 의 정의). 시안·실측: `docs/design/ushop-compact-2026-11-01.md` · 가드 `ushop-compact-head-2026-11-01.test.ts`(주입 15).

**🛍️ 유어샵 (2026-09-02 대표 확정 — 모바일 안3 · PC 안P1)**: 주인 상단 안내 띠 없음. 주인·방문자 차이는 헤더 버튼 **한 자리**뿐([유어샵 편집] 블루 ↔ 없음). **방문자에게 팔로우 같은 대체 버튼을 두지 않는다**(대표: "그냥 방문자는 안보이면 되잖아"). 헤더는 아바타+왼정렬(배너 히어로 렌더 없음), 카테고리 칩은 지도 B안과 같은 그림(핀 7개 이상), PC 는 `/u/:handle` 한 세그먼트만 액자를 벗고 좌 300px 프로필 열 + 우 진열대 칸. 🖥️ **2026-09-30 대표 확정 안 A — 그 칸 안에서 *카드*는 3열(`grid-cols-2`→3), *줄 목록*(s3)은 2열**(`.ur-ushop-main .ur-ushop-rows`). 줄은 폰 폭에 맞춰 확정된 형식이라 칸(796px)만큼 늘리면 64px 썸네일 하나에 오른쪽 절반이 빈 칸이 된다(2026-09-28 실측) — 2열이면 줄당 ~378px 로 폰과 같아 줄 형식이 한 글자도 안 바뀐다. ⚠️ tailwind `lg:grid-cols-2` 를 쓰지 않는다(액자 1열 오버라이드가 `/profile`·`/s` 에서 되돌린다). 맨 아래 유입 링크 세 줄도 **칸 안**에 둔다 — 밖에 두면 자기 `max-w-3xl mx-auto` 가 페이지 한가운데를 잡아 어느 칸과도 안 맞는다. ⚠️ 2026-07-07 "아바타·스탯 삭제"는 이 시안으로 갱신됐다. SSOT: `docs/design/ticket-completion-reference-2026-09.md` §9 · 가드 `ushop-a3-p1.test.ts`.


**🏝️ 라이트 섬 `light-island` (2026-09-02 대표 확정 "안A · 다크에서도 패널은 흰색")** — 배경이 테마와 무관하게 정해진 자리(잉크 색면 위 홈 패널 `ur-home-panel`, 지도 타일 위 오버레이)는 이 클래스 하나로 안쪽 `dark:` 유틸을 전부 끄고(`tailwind.config` `darkMode: ['variant', '&:is(.dark *):not(.light-island *)']`, 섬 밖 출력은 byte-동일) **전역 라이트 입력 규칙(색·placeholder·autofill, `!important`)을 켠다**. 손으로 `dark:` 를 빼거나 `!important` 로 덮지 말 것.
> 🔴 **`light-island`(클래스) ≠ `light-fixed`(주석). 늘 밝은 표면에는 반드시 클래스를 붙인다.** `light-fixed` 는 `check-theme-consistency` 를 면제하는 **부표**일 뿐 런타임엔 아무 일도 안 한다. 2026-09-03 에 지도 검색창이 주석만 달고 클래스가 없어서, 전역 `.dark input`(0,5,1)이 `text-gray-900`(0,1,0)을 이겨 **흰 배경 위 흰 글자**가 됐다(실측 1.1:1 — 대표 신고 "글자가 또 하얘"). 클래스 유틸로는 이 싸움을 못 이긴다. 회귀 감시: `scripts/check-dark-contrast.mjs`(실제 렌더 측정). 가드: `home-panel-light-island.test.ts` + 주입 매니페스트 2건.

**🗺️ 지도 위 UI 는 테마를 따르지 않는다 (2026-09-02 대표 신고 "색깔이 눈에 잘 안 들어와" · "눌렀는지 확인도 안 돼")** — 카카오 지도 타일은 다크에서도 밝다. 그 위 오버레이(칩·검색바·현위치 버튼·핀)는 **흰 표면 고정 + 선택/활성 = 브랜드 블루 면**, 핀 링은 잉크 하나(선택·라이브만 블루). `dark:bg-[#11141C]` 를 지도 위에 주지 말 것 — 테마 가드는 그 줄에 `light-fixed` 주석으로 면제한다(지도 위에만 허용). 가드: `map-chips-b.test.ts` + 주입 매니페스트 3건.

⚠️ 2026-08-30 "완전 검정"·2026-07-19 "웜 로즈·크림" 결정은 **이 절로 대체**됐다. 아래 audit log 의 로즈/크림/#0D0F12 표기는 작성 당시 기록이다(소급 수정 X).

## 🦦 유달이(마스코트) 생성 철칙 (2026-10-11 대표 — "앞으로는 만들 때 이것을 철칙으로 여겨서 문제가 없도록")

새 유달이 그림을 만들 때는 **`docs/design/urdeal-mascot-otter-2026-10.md` 의 "🔒 유달이 생성 철칙" 여섯 줄을 전부** 지킨다:
① 모델 `gpt-image-2.5`만(gemini 금지) ② 설정서 본문 + 세부 실측 + 보정 블록을 **그대로** 넣고 포즈만 덧붙임 ③ 여러 포즈는 한 장 시트로 ④ 원본 해상도로 `scripts/mascot/udal-qa.py` 검수 + 수염 3가닥·눈썹·흰자·입·발바닥 대조 ⑤ 통과한 칸만 사용 ⑥ **색은 서비스 유달이(`src/assets/mascot/udal-curious.webp`) 기준** — 생성 직후 `scripts/mascot/udal-color-match.py` 로 맞추고 `udal-qa.py` 톤 판정 통과(2026-10-11 대표 *"색상도 철칙으로 지켜져야 해"*).
> ⛔ **예외 없음** (2026-10-11 대표 *"무조건 다 철칙대로 하는거야 변함없어. 앞으로 무조건."*). 급한 시안도 "이번만"도 없다. 못 지키면 그리지 말고 멈춰서 보고. 서비스에 넣는 그림은 같은 커밋에서 그 문서의 **📒 화면 반영 장부**에 출처·검수 결과를 적는다(테스트가 대조).
> 🩸 2026-10-11 에 이걸 안 지켜 다른 캐릭터를 두 번 만들었다(짧게 다시 쓴 문구·gemini·미리보기만 보고 판정).

## 🎨 anti-slop 디자인 스킬 (2026-08-30 대표 지시 — "AI 스럽지 않게")

**대외 문서·랜딩·마케팅 표면을 디자인할 때는 `.claude/skills/taste-skill/SKILL.md` 를 먼저 읽는다.**
(`Leonxlnx/taste-skill`, MIT. 대표가 지정해 레포에 벤더링 — 세션마다 자동으로 잡힌다.)

가장 자주 걸리는 것 다섯 개(이 레포에서 실제로 전부 위반했었다):
- **em-dash `—` 0개.** "적게 쓰기"가 아니라 0개다. 마침표·쉼표·괄호·`-` 로 바꾼다.
- **섹션번호 eyebrow 금지** (`01 — 서비스`, `05 · 정산`). 제목만으로 충분하다.
- **eyebrow 총량 ≤ ceil(섹션수/3)**. 모든 섹션 위에 작은 대문자 라벨을 다는 것이 가장 흔한 AI 티다.
- **가운뎃점 `·` 은 줄당 1개**까지. 기본 구분자로 쓰지 않는다.
- **같은 레이아웃 계열 반복 금지** — 3열 균등 카드가 연달아 나오면 실패. 8섹션이면 최소 4계열.

⚠️ **브랜드가 스킬을 이긴다.** (2026-09-02 부터 라이트 바탕은 `#F8F7FC` — 위 🎫 절. 아래 문장은 당시 기록.) 스킬 §4.2 가 웜 크림 배경(`#faf7f1` 계열)을 금지하는데 우리 브랜드 배경이
`#FAF7F5`(`src/index.css` SSOT)다. 스킬 자신의 override 조항에 해당하므로 **브랜드를 따른다** — 스킬을 이유로
브랜드 토큰을 바꾸지 말 것(그러면 그 문서만 서비스와 달라진다).

🛡️ **자동 강제 (2026-09-01 신설)**: `scripts/check-anti-slop-copy.mjs` — 위 다섯 개 중 **기계로 판정 가능한 셋**
(em-dash · 섹션번호 뱃지 · 한글 라벨의 `uppercase`)을 대외 표면에서 0 으로 동결(verify.yml + audit-gate strict).
나머지 둘(eyebrow 예산 · 레이아웃 계열 반복)은 **렌더해서 눈으로** 봐야 한다 — 가드가 못 한다.
> 이 가드는 **실제 사고 뒤** 생겼다: 이 절이 다섯 규칙을 적어 두고도 강제가 없어서, 대외 랜딩 `/about` 이
> 다섯 개를 **전부** 위반한 채 배포돼 있었다(2026-09-01 실측). 룰만 있고 강제가 없으면 결국 놓친다.

적용 대상: 제안서·랜딩·소비자 마케팅 표면. **어드민/셀러 대시보드는 대상 아님**(스킬 자신이 dashboard 제외를 명시).

## 🎨 디자인 시안 archive 룰 (필수)

사용자가 디자인 시안 (이미지/스크린샷) 을 보낼 때:

1. **반드시 `docs/design/<page-name>.md` 에 저장** — 채팅 이미지는 세션 끝나면 사라져 다음 세션이 못 봄
2. 파일 구조: 시안 설명 + 현재 vs 시안 차이 표 + 구현 todo 체크리스트
3. **구현 전이라도** 시안 받은 즉시 commit + push (다음 세션 / 다른 에이전트가 추적 가능)
4. 구현 완료 시 같은 파일 하단에 `## ✅ 구현 완료` + commit hash 추가
5. 미구현 시안 목록은 `docs/design/README.md` 의 표에 등록

> ⚠️ 이 룰을 안 지키면: 시안이 채팅에서 잊혀지고 → 구현 안 됨 → 사용자가 "왜 이거 안 됐어?" 질문 반복.

## 📚 문서 분할 (CLAUDE.md 는 활성 룰만)

- **`docs/INCIDENTS.md`** — 사고 기록 / 재발 방지 룰의 출처
- **`docs/SCHEMA.md`** — DB 스키마 룰 (금지 컬럼, status 값 등)
- **`docs/ROUTES.md`** — `/api/seller` 등 라우트 매핑
- **`docs/design/`** — UI 시안 archive
- **`TECHNICAL_DEBT.md`** — 기술 부채 목록
- **`docs/locks/loading-audit-log.md`** — 로딩 최적화 잠금의 변경 이력 239건 (2026-11-01 분리 · **동결**) → 그 뒤는 **`docs/locks/loading/`** (기록마다 파일 하나)
- **`docs/locks/toss-v2-audit-log.md`** — Toss V2 잠금의 변경 이력 48건 (2026-11-01 분리 · **동결**) → 그 뒤는 **`docs/locks/toss/`**
- **`docs/GUARD_RAILS.md`** — 영구 방어선 표 전문(사고 출처와 경위) (2026-11-01 분리)

CLAUDE.md 는 매 작업마다 읽는 활성 규칙만 유지. 사고 후일담 / 긴 표 / 시안 detail 은 위 파일로 분리.

> 🔴 **이 규칙은 장식이 아니다 — 안 지켜서 세션이 안 켜졌다 (2026-11-01 대표 신고 *"계속 클로드 코드
> 세션들에서 금방 prompt is too long 이라고 되는데"*).** 실측: `CLAUDE.md` 가 **589,461자 ≈ 30만 토큰**
> 으로 자라 Claude Code 한 세션 용량(20만 토큰)의 **151%** 였다. 즉 **대화를 한 마디도 안 했는데 세션이
> 시작하는 순간 이미 한도를 넘겼다.** 그 **63%(374,124자)가 변경 기록 284줄**이었고(가장 긴 한 줄이
> 9,468자) 그건 정확히 이 절이 "분리하라" 고 한 *사고 후일담* 이다. 분리 후 **114,915자 ≈ 5.9만 토큰
> (창의 29%)**. 내용은 **한 글자도 안 지웠다** — 옮기고 포인터를 남겼다(검증: 날짜 항목 284 → 284개,
> 원본 1,785줄 전부 보존, 잠금표 49행 불변, CLAUDE.md 를 파싱하는 테스트 5파일 76건 통과).
>
> 🛡️ **자동 강제**: `scripts/check-context-budget.mjs`(verify strict + audit-gate) — 세션이 읽는
> 파일의 **토큰 하드 상한**(이 파일 8만 · `CURRENT_WORK.md` 5천 · 인계 목차 4천 · 에이전시 정의 합 1.2만
> · 최근 인계 5건 합 2.5만)과, **12만 토큰 넘는 문서엔 "통째로 읽지 말고 grep" 머리말**을 강제한다.
> 래칫이 아니라 하드 상한인 이유: 래칫은 조금씩 늘리기를 허용하고 이 파일은 **그렇게 284번에 걸쳐**
> 30만이 됐다. 상한을 올리는 것은 "매 세션 비용을 늘린다" 는 결정이라 근거와 함께 사람이 한다.
>
> 🧭 **그리고 이 파일이 언급하는 문서는 전부 예산 안에 있다 — 목록은 손으로 관리하지 않는다.**
> 가드가 **CLAUDE.md 를 파싱해 자동으로** `.md` 경로를 뽑고 두 등급으로 가른다:
> **A(그 경로가 적힌 줄에 `먼저 읽`·`먼저 스캔`·`필수 참조` 가 있다)** 는 통째로 읽으라고 지시한
> 문서라 **하드 상한 4만**이고 grep 머리말로 면제되지 않는다 · **B(그 외 언급)** 는 4만을 넘으면
> **"통째로 읽지 말고 grep 하라" 머리말이 있어야** 한다(큰 것 자체는 죄가 아니다 — *경고 없는* 큰
> 것이 지뢰다). 🩸 **왜 자동인가**: 첫 판은 손으로 쓴 6줄이었고, 그 목록 밖에서
> `urdeal-platform-model.md` 가 **3만 토큰**으로 자라 있었다(거의 모든 세션이 읽는데 예산 밖).
> ⇒ **"이건 먼저 읽어라" 한 줄을 CLAUDE.md 에 더하는 순간 그 문서는 자동으로 예산에 들어온다.**
>
> ⇒ **새 기록을 CLAUDE.md 본문에 쌓지 말 것.** `[UNLOCK*]` 은 위 `docs/locks/*`, 새 가드는
> `docs/GUARD_RAILS.md`, 세션 인계는 `docs/handoff/<날짜>-<슬러그>.md`. CLAUDE.md 에는 **지금 유효한
> 규칙과 그 파일을 가리키는 한 줄**만 남긴다. ⚠️ 이 파일이 다시 20만 자를 넘기면 같은 사고가 재발한다
> (`wc -c CLAUDE.md` 로 확인 — 현재 약 11만 자).

## 📝 블로그 시드 자동 업데이트 (2026-07-01 대표 지시 — "코드 수정될 때마다 블로그도 자동 반영")

소비자 블로그(`/blog`, `/admin/blog`)는 `blog_posts` 테이블 + **버전 재시드** 구조.
- **SSOT 시드**: `src/features/blog/api/blog-seed.ts` 의 `blogSeedPosts()` 배열(콘텐츠 데이터, blog.routes.ts 에서 분리) + `blog.routes.ts` 의 `BLOG_SEED_VERSION` 상수. 시드 문구는 blog-seed.ts, 버전 bump 는 blog.routes.ts. (본문 렌더러는 상세·관리자 미리보기 공용 `src/features/blog/BlogMarkdown.tsx`.)
- **자동 반영 원리**: `BLOG_SEED_VERSION` > DB 저장 버전이면 배포 후 첫 접근 시 `maybeSyncBlogSeed()` 가 자동 동기화. 신규 글 삽입 / 시드 관리 글(`is_seed=1, manually_edited=0`) 최신화 / 새 시드에서 빠진 낡은 글은 **비공개**(삭제 아님). 관리자가 `/admin/blog` 에서 **직접 수정(`manually_edited=1`)하거나 생성(`is_seed=0`)한 글은 절대 덮어쓰지 않음**(수동 편집 보존).

> ⚠️ **필수 룰 (모든 세션 준수)**: **서비스 사실이 바뀌면 블로그 시드도 같은 커밋에서 고치고 `BLOG_SEED_VERSION` 을 +1 하라.** 안 올리면 라이브 블로그가 안 바뀜. 특히:
> - 명칭 SSOT 변경(이용권/유저/사업자 유저/링크샵/동네딜/교환권 등) → 관련 글 문구 갱신
> - 기능 신설/중단(예: 라이브커머스 영구중단, 쇼핑탭 숨김) → 해당 글 삭제/수정
> - 수수료율·딜포인트·결제·정산 규칙 변경 → 해당 가이드 글 갱신
> - ❌ 블로그 시드에 낡은 용어(식사권/공구권, "라이브 커머스"를 현재 기능으로) 재유입 금지 — `scripts/check-blog-seed-currency.mjs` 가 감지.
> - ❌ 도매몰(유통스타트/판매사/제조사) 내용 유입 금지 — 소비자 블로그 전용(서비스 분리).
> - 💰 **수치 사실(수수료 5%·원천징수 3.3%·딜포인트·최소후원 500딜)** 이 코드 SSOT(`fee-resolver.ts`/`tax-withholding.ts`/`points.routes.ts`)에서 바뀌면 블로그 시드도 같은 커밋에서 갱신 — `scripts/check-blog-fact-sync.sh` 가 감지(warn).

수동 강제 재동기화: 어드민 `POST /api/blog/seed` (버전 무관 강제 sync).

### 🤖 AI 홍보 초안 (2026-07-01 대표 지시 — "비즈니스(서비스 홍보) 차원만, 운영 정보 유출 금지")
- **목적**: 현재 서비스 사실 기반 **소비자 홍보/마케팅 초안**을 AI로 생성 → **항상 비공개 초안**(`is_published=0, ai_generated=1`) → 관리자 검토 후 발행.
- **SSOT**: `src/features/blog/api/blog-ai.ts` — `PROMO_BRIEF`(홍보용 사실만, 운영 수치 제외)·`PROMO_TOPICS`(홍보 주제 백로그)·`generateBlogDraft()`(Claude + 출력 검증).
- **🚫 운영 정보 차단**: brief 에 수수료율·정산·원천징수·커미션·매출·관리자·도매(B2B) 를 **아예 넣지 않고**, 출력에 그런 용어(+폐기어·도매몰 명칭)가 나타나면 **초안 폐기**(1회 재시도 후 실패). 소비자 홍보 콘텐츠만 통과.
- **트리거**: 관리자 수동 `POST /api/admin/blog/ai-draft`(AdminBlogPage "AI 홍보 초안" 버튼) + 주간 cron(`blog-ai-draft`, 월요일). cron 은 킬스위치 **`BLOG_AI_DRAFTS_ENABLED='true'`** 일 때만(기본 OFF — 토큰 낭비 0). `ANTHROPIC_API_KEY` 필요.
- **캡**: 미검토 AI 초안 5개 이상이면 생성 중단(검토 유도). 초안은 `is_seed=0` 이라 재시드가 안 건드림.
- 🔁 **되먹임 루프(닫힌 루프)**: 발행 글 조회수(`blog_posts.view_count`, 공개 `POST /api/blog/public/:slug/view` — 세션당 1회)를 태그별 평균으로 집계해, `pickPromoTopic()` 이 **성과 좋은 태그를 가진 미작성 주제를 우선** 생성. 성과 데이터 없으면 백로그 순 폴백. 관리자 목록에 조회수 노출. → AI 생성이 성과 기반 자기최적화.

### 🔎 블로그 SEO (구글 + 네이버) — 지속 최적화 규칙
- **비-JS 크롤러(네이버/카카오/소셜 스크래퍼) 대응**: `/blog`·`/blog/:slug` 는 `worker/index.ts` HTMLRewriter 가 **서버측에서 title/description/OG/twitter/canonical + `BlogPosting` JSON-LD** 를 주입(도매 surface 패턴과 동일). 상세는 `BLOGPOST` SSR 슬롯이 `/api/blog/public/:slug` 를 edge-read/self-fetch → 그 payload 로 메타 생성 + `__SSR_INITIAL_BLOGPOST__` 0-RTT. (Googlebot 은 JS 렌더로 `<SEO>`(react-helmet)도 봄.)
- **발견성**: `/blog` 는 `SiteFooter`(프리렌더된 홈에 포함 → 네이버도 발견) + `sitemap.xml`(`is_published=1` 글 포함) + **RSS `/blog/rss`**(`blog-seo.routes.ts`)에 노출. 상세엔 "함께 보면 좋은 글"(같은 태그) 내부 링크.
- **공유 배너**: 글별 동적 OG 이미지 `GET /blog/og/:slug`(SVG 1200×630, 제목+태그+브랜드 — `blog-seo.routes.ts`). 상세 head 에 og:image/twitter:image 로 주입(사이트 기본 OG 도 SVG 라 호환). ⚠️ 카카오/일부 소셜은 raster(PNG) 선호 — 필요 시 satori/resvg 로 PNG 업그레이드(별도 결정).
- **새 글 작성 시 SEO 필수**: 모든 시드/발행 글은 **`summary`(메타 description, ~50~160자)**, **`tags`(≥1)**, **고유 `slug`(영문 kebab)** 를 갖출 것 — 서버 메타/OG/related 가 이 값들을 사용. 제목은 핵심 키워드를 앞쪽에.
- ❌ 블로그 라우트(`/blog*`)를 `robots.txt` 에서 Disallow 하지 말 것(현재 Allow). 새 소비자 글 URL 은 sitemap 이 자동 포함.

## 📖 운영 가이드 3종 자동 업데이트

DB(`operation_guides` 테이블) 에 저장된 3개 가이드:
- `admin` → `/admin/operations-guide`
- `seller` → `/seller/guide`
- `agency` → `/agency/guide`

**시드 SSOT**: `src/features/guides/api/guide-seed.ts`(집계) + `guide-seed-{admin,seller,agency,wholesale}.ts`(콘텐츠) + `guide.routes.ts` 의 `GUIDE_SEED_VERSION` 상수.

**자동 반영 원리 (2026-07-11 — 블로그 `BLOG_SEED_VERSION` 메커니즘 미러)**: `GUIDE_SEED_VERSION` > DB 저장 버전(`platform_settings.guide_seed_version`)이면 배포 후 첫 가이드 접근 시 `maybeSyncGuideSeed()` 가 자동 동기화 — 신규 섹션 삽입 / 시드 관리 섹션(`manually_edited=0`) 최신화. 관리자가 UI 에서 **직접 수정·생성한 섹션(`manually_edited=1`)은 절대 덮어쓰지 않음**(수동 편집 보존). 시드에서 빠진 섹션은 삭제 안 함(가이드는 큐레이션 문서 — 정리는 관리자 삭제/강제 리셋으로).

### 코드 변경 시 함께 업데이트
- 새 API 엔드포인트 → 영향받는 역할의 가이드 섹션
- 새 관리자 페이지 → 어드민 가이드 "유용한 링크"
- 정산/주문 플로우 변경 → 어드민 + 셀러 동시
- 수수료율 변경 → 어드민 + 셀러 + 에이전시 동시
- 장애 발생/해결 → 어드민 "기술 장애 대응" 섹션
- FAQ 추가 → 해당 역할 "자주 묻는 문제"

### 업데이트 방법
- **권장**: `guide-seed-*.ts` 수정 + **같은 커밋에서 `GUIDE_SEED_VERSION` +1**(guide.routes.ts) → 배포 후 자동 반영(수동 편집 보존). 버전 안 올리면 라이브 미반영.
- **대안**: 관리자가 `/admin/operations-guide` 에서 직접 편집(해당 섹션 `manually_edited=1` → 이후 재시드 불침범)
- **강제 리셋**: `POST /api/guides/:type/reseed {"confirm":true}` — 수동 편집까지 초기화하고 해당 type 전체를 시드로 교체(footgun 가드 있음)

### 자동 강제 (`scripts/check-guide-sync.sh`)
Pre-commit hook 이 다음 파일 변경 시 `guide-seed.ts` 동시 수정 검사:

| 변경 파일 | 영향 가이드 |
|---|---|
| `src/pages/Seller*.tsx`, `src/features/(seller\|youtube)/api/*.ts` | 셀러 |
| `src/pages/Admin*.tsx`, `src/worker/routes/*.ts` | 어드민 |
| `src/pages/Agency*.tsx`, `src/features/agency/api/*.ts` | 에이전시 |
| `src/features/auth/api/*.ts` | 모두 |

기본 warn-only, 차단 모드: `STRICT_GUIDE_SYNC=1`.

### 자동 생성 참조 (`scripts/generate-guide-references.mjs`)
각 가이드 끝에 "코드 자동 참조" 섹션 자동 추가 (key=`auto-reference`, order=999):
- `src/App.tsx` 라우트 + `*.routes.ts` 의 endpoint 추출
- 출력: `src/features/guides/api/auto-reference.ts` (수동 편집 금지)
- Pre-commit hook 자동 재생성. 수동: `npm run generate:guide-refs`

후속 PR 로 미루면 커밋 메시지에 `guide-update-pending` 명시.

## 🚨 기술 부채 & 알려진 이슈

**전체 목록**: `TECHNICAL_DEBT.md`. 특히 주의:
- 🔴 DB Migration CI 미작동 (D1 권한 없음) → `/api/_internal/repair-schema` 응급 처치
- 🟡 스키마 이중화 컬럼 (`stock`/`stock_quantity`, `shipping_fee`/`base_shipping_fee`)
- 🟢 시크릿 회전 완료 (2026-04-27) — 자세한 내용은 `docs/INCIDENTS.md`

## 🚨 큰 파일 / PowerShell 수정 규칙 (2026-05-12 사고 후 추가)

**배경:** `youtube-live.routes.ts` (1978줄) 가 이전 에이전트의 PowerShell 전체 덮어쓰기 실패로 `// PLACEHOLDER` 2줄만 남고 모두 삭제됨 → YouTube 라이브 API 5개 전부 404 → 셀러 방송 시작 불가 → 메인에 라이브 노출 안 됨. commit `b09d9b4` (-1953줄) 으로 push 됐는데 빌드/diff 검증 누락. 자세한 경위는 `docs/INCIDENTS.md`.

### 절대 하지 말 것
- ❌ **500줄 이상 파일에 Write (전체 덮어쓰기) 사용 금지** — 반드시 Edit 으로 부분 수정
- ❌ **PowerShell `Set-Content` / `Out-File` / heredoc 으로 큰 코드 덮어쓰기 금지** — 한글 인코딩 + 버퍼 잘림 사고 빈발
- ❌ **`Get-Content -Raw` 로 한글 포함 파일 읽기 금지** — 기본 인코딩이 UTF-8 아님 → 한글 깨짐
  - 안전한 방법: `[System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))`
  - 안전한 쓰기: `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))`

### 반드시 할 것
- ✅ **commit 전 `git diff --stat` 으로 줄 수 변화 확인** — `-500` 이상 줄이 사라졌으면 의심하고 멈춤
- ✅ **push 전 `npx vite build` 또는 `npx tsc --noEmit --skipLibCheck` 통과 확인 필수**
- ✅ **PowerShell 로 파일 수정한 직후 Select-String 으로 한글 깨짐 검증** — 예: `Select-String -Path X -Pattern "시스템"` 매치 안 되면 인코딩 깨진 것
- ✅ **`export default` 같은 중복 가능 라인은 추가 전에 `Select-String` 으로 기존 존재 여부 확인** — 중복 export → 빌드 실패

> ⚠️ 이 룰 안 지키면: 오늘처럼 또 라이브 API 통째로 날아감 → 운영 중단.

## 📐 PC 반응형 디자인 시스템 (2026-05-02 도입)

### 핵심 원칙
1. **모바일 First** — 기존 모바일 디자인 그대로
2. **PC 활용** — `lg:` (1024px+) / `xl:` (1280px+) / `2xl:` (1536px+) variants
3. **콘텐츠 폭 토큰** (`src/index.css`):
   - `ur-content-narrow` (720px) — form / 결제 / 가입
   - `ur-content-medium` (1024px) — 가이드 / 약관
   - `ur-content-wide` (1280px) — 쇼핑 / 그리드 / 마이
   - `ur-content-full` (1536px) — 어드민/셀러 대시보드
4. **9:16 비디오 페이지** (`/live/*`, `/shorts`) — `MOBILE_ONLY_PREFIXES` 매칭, PC 에서도 430px 액자

### 페이지별 패턴

| 페이지 종류 | 폭 토큰 | 핵심 변환 |
|---|---|---|
| 쇼핑 그리드 | `ur-content-wide` | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` |
| 상품 상세 | `ur-content-wide` | mobile 1열 → lg 좌이미지 / 우구매 |
| 결제/주문 | `ur-content-narrow` | PC 가운데 정렬 |
| 마이 | `ur-content-medium` | mobile 1열 → lg 2단 |
| 홈 | `ur-content-wide` | 라이브 카드 4-5열 |
| 라이브 | `data-mobile-only="true"` | 9:16 풀스크린 |
| 셀러/어드민/에이전시 | (변경 없음) | 풀 너비 |

### 새 페이지 작성 체크리스트
1. mobile 우선 (430px 가정)
2. PC: `<div className="ur-content-wide px-4 lg:px-8">` + 그리드/폰트/간격 lg variants
3. sticky header/footer 풀너비, 내부 콘텐츠는 `ur-content-*` centered
4. 9:16 비디오면 `MOBILE_ONLY_PREFIXES` 추가
5. 4가지 뷰포트 (≤640 / 768 / 1280 / 1920) 확인

### PC 사이드바 / TopNav
- `DesktopTopNav` (lg+) + `DesktopLiveSidebar` (xl+)
- BottomNav `lg:hidden` (PC 에서 숨김)
- MobileAppLayout 자동: `xl:pl-56` + `2xl:pr-72`
- HIDE_SIDEBAR_PREFIXES (셀러/어드민/에이전시/embed/checkout-return/introduce) 만 사이드바 제외

> 시안에 따른 사이드바 재설계 todo: `docs/design/home-sidebar.md`

## 🎨 테마 규칙 (필수)

페이지 생성/수정 시 **반드시** 해당 테마에 맞는 색상 사용.

### 다크 테마 — 유저 대면 메인
- **해당**: 홈 (`/`), 라이브 (`/live/*`), 쇼츠 (`/shorts`), 마이 (`/user/profile`), 알림 (`/notifications`), 셀러 공개 (`/profile/*`, `/s/*`)
- **배경**: `bg-[#020202]` (메인) / `bg-[#121212]` (카드) / `bg-[#1A1A1A]` (서브)
- **텍스트**: `text-white` (제목) / `text-gray-300` (본문) / `text-gray-400`~`500` (보조)
- **보더**: `border-[#1A1A1A]`, `border-[#2A2A2A]`
- ❌ 금지: `text-gray-900/800/700`, `bg-white`, `border-gray-200`
- 🛡️ `/user/profile` 은 화이트/다크 토글 **모두 지원** — 서브 컴포넌트 전부 `dark:` 매핑 완료 (2026-05-06)

### 화이트 테마 — 쇼핑/결제 (사용자 토글 지원)
- **해당**: `/browse`, `/cart`, `/checkout`, `/products/*`, `/my-orders`, `/search`, `/wishlist`, `/mypage/addresses`, `/account/*`, `/referral/*`, `/restaurant-map`, `/points/charge`
- **배경**: `bg-white` / `bg-gray-50`
- **텍스트**: `text-gray-900` / `text-gray-600` / `text-gray-500`
- **보더**: `border-gray-100`, `border-gray-200`
- ❌ 금지: `text-white` (컬러 버튼 위 제외), `bg-[#020202]`, `border-[#333]`

#### 사용자 다크 모드 토글 (2026-05-02)
- `/account/settings` "화면 테마" — 시스템 / 라이트 / 다크 선택
- 인프라: `useTheme` 스토어 + `<html class="dark">` + Tailwind `darkMode: 'class'`
- **새 페이지·컴포넌트 작성 시 `dark:` variant 동시 추가 필수**:

  | 라이트 (기본) | 다크 |
  |---|---|
  | `bg-white` | `dark:bg-[#0A0A0A]` |
  | `bg-gray-50` | `dark:bg-[#121212]` |
  | `bg-gray-100` | `dark:bg-[#1A1A1A]` |
  | `text-gray-900` | `dark:text-white` |
  | `text-gray-800` | `dark:text-gray-100` |
  | `text-gray-700` | `dark:text-gray-200` |
  | `text-gray-600` | `dark:text-gray-300` |
  | `text-gray-500` | `dark:text-gray-400` |
  | `text-gray-400` | `dark:text-gray-500` |
  | `border-gray-100` | `dark:border-[#1A1A1A]` |
  | `border-gray-200` | `dark:border-[#2A2A2A]` |

- 자동 마이그레이션: `perl /tmp/dark_migrate.pl <files...>` (사용 후 git diff 검토)
  - ⚠️ perl 일괄 치환은 **이미 `dark:` / `hover:` / `focus:` prefix 가 붙은 토큰까지 매칭**해
    `dark:dark:bg-` / 중복 `dark:bg-` / 잘못된 state(`hover:bg-gray-100` → `dark:bg-` 아닌
    `dark:hover:bg-`) 같은 깨진 클래스를 만들 수 있음. 치환 후 반드시
    `node scripts/check-theme-consistency.mjs` 로 검증하고 중복/오매핑 수동 교정.
- FOUC 방지: `index.html` inline script 가 `localStorage.ur_theme_mode_v1` 읽고 선반영
- 다크 페이지 / 셀러 / 어드민 대시보드는 토글 무영향 (페이지 단 명시 강제)
- 🛡️ **자동 강제 (2026-05-31)**: `scripts/check-theme-consistency.mjs` 가 pre-commit(staged 파일)
  + `verify.yml` CI 에서 라이트 토큰의 `dark:` variant 누락을 검사 (variant-aware — `hover:`/`focus:`/
  `placeholder:` 등 state 별 매칭). 대시보드(seller/admin/agency) + 순수 다크 페이지(`bg-[#020202]`/
  `data-mobile-only`) + 콜백/디버그/embed 는 자동 제외. 기본 warn-only, 차단: `STRICT_THEME=1`,
  우회: commit 메시지 `[SKIP_THEME_CHECK]`. → **앞으로 생성/수정되는 페이지에 테마 누락 자동 감지.**

> ⚠️ **글로벌 CSS invert 절대 금지** (2026-05-03 시도/롤백, `docs/INCIDENTS.md`)

> ⚠️ **CSP `style-src` 에 `'nonce-XXX'` 추가 절대 금지** (2026-05-21 사고)
> - React/Tailwind inline style 수천 곳이 nonce 없어 전부 차단 → 화면 전체 깨짐.
> - `'unsafe-inline'` 만 유지. script-src 의 nonce 는 OK (HTMLRewriter 자동 부여).
> - 향후 강화는 별도 PR (모든 inline style 외부화 후 nonce 부여 인프라).

> ⚠️ **셀러 role (seller_type) 직접 비교 절대 금지** (2026-05-21 Phase D-5)
> - `=== 'influencer'`, `=== 'store_owner'` 같은 직접 비교 금지.
> - 항상 `isInfluencer()` / `isStoreOwner()` / `canBroadcast()` 등 helper 사용.
> - UI 자동 분기는 `<RoleGate showFor="...">` 컴포넌트 사용.
> - 마스터: `src/shared/seller-roles.ts` (single source of truth).
> - 라벨 변경 / 새 role 추가 시 본 파일만 수정 → 전체 UI 자동 반영.
> - 한국어 명칭: **명칭 SSOT 는 아래 "🏷️ 명칭(용어) SSOT" 섹션 참조 (사용자 확정 2026-06-17 — 유저 / 사업자 유저).**
>   - "에이전시" = 매니징 조직 / "도매 공급자(제조사)" = B2B 공급 (개인 축과 별도)

## 🏷️ 명칭(용어) SSOT (2026-06-17 사용자 확정 — 무조건 이 명칭 사용)

**사용자-가시 라벨은 무조건 아래 명칭을 따른다. 새 UI 문구·번역·안내 작성 시 필수 참조.**

| 명칭 | 정의 | 코드 실체 |
|---|---|---|
| **유저** | 회원가입한 누구나. **유어샵(`/u/{handle}`) 자동 생성**, 담기(소개)·구매 가능 | `users` + handle |
| **유어샵** | 그 사람의 **진열대**(`/u/{handle}`). 담은 이용권·내 가게 이용권이 한 곳에 뜬다. 매장은 *설정할 때 고르는 스코프*이지 진열 단위가 아님 | `CuratorPage` + `SellerPublicPage` |
| **사업자 유저** | 유저 + **사업자등록 → 판매 승인**. 자기 상품·이용권 판매 + 현금 정산 | `users` + 연결된 승인 `sellers` |
| **셀러 대시보드** | 사업자 유저가 쓰는 **판매 관리 도구**(`/seller/*`) — "셀러"는 *도구 이름*으로만 유지 | SellerLayout |
| **이용권** | 온라인에서 할인가로 **즉시 구매** → 매장에서 QR/PIN 으로 사용하는 권종(식당·뷰티·숙박·액티비티 등). **공동구매(모여서 사기) 아님** | `products.category='meal_voucher'` 등 |
| **에이전시** | 여러 매장을 맡아 운영하는 **대행사**. 계정은 **이메일로만**(카카오 아님), 직원(관리자/직원)을 초대해 함께 쓴다 — 2026-10-11 대표 *"에이전시가 대행사잖아. 에이전시로 통일하자"* ("중개사" 라벨은 이 이름으로 통일 예정) | `agency_accounts` · `agency_staff` (`/agency` · `/api/agency-console`). ⚠️ 옛 `agencies`(2026-09-04 일몰)와 다른 것 |
| **도매 공급자(제조사)** | 도매몰에 상품 공급하는 B2B 주체 | suppliers |

> 🏷️ **2026-08-26 대표 확정 — "링크샵" → "유어샵" 으로 통일.** 이유: ① 유어딜·유어애즈·유어팀과 **브랜드 패밀리**가 이어진다 ② "링크샵"은 무엇을 파는지도 누구 것인지도 안 알려준다. 사용자-가시 "링크샵" **src 552건 + 6개 언어 90건** 일괄 치환. **URL(`/u/{handle}`)은 불변** — 이미 공유된 링크가 하나도 안 깨진다. **코드 식별자(`linkshopPath`·`useLinkshopPath`·`nav.linkshop`·`LinkshopVisitorRails`·`isLinkshopSurface`)는 불변**(한글 라벨만). 다국어에서도 **번역하지 않고 `UrShop`** — 유어딜(UrDeal)과 같은 브랜드 취급. 아래 audit log 의 "링크샵" 표기는 *작성 당시 historical record*(소급 변경 X).
>
> 🏷️ **2026-08-26 대표 확정 — 사람을 "인플루언서 / 대행사" 로 나누지 않는다. 행위 2개로 말한다.** 둘은 실제로 정반대 일을 한다(인플루언서=**손님**을 만든다 / 대행사=**매대**를 만든다)는데 화면에선 똑같이 "남의 가게로 번다"로 보여 모호했다. **신분이 아니라 행위**이고, 경계는 이미 코드에 있다 — `seller_operators` 위임 권한 유무.
> - **담기(소개)** = 누구나. 남의 이용권을 내 유어샵에 담는다 → 팔리면 소개 커미션.
> - **운영(대행)** = 매장 사장님이 위임한 사람만. 그 매장을 대신 판다 → 운영 몫.
>
> 유어샵에는 셋이 **한 진열대**에 뜨고 배지만 다르다: `내 가게`(owner) · `관리 중`(operator) · `추천`(핀).
> ⚠️ 이건 새 규칙이 아니라 **이미 있는 규칙("사람 지칭에 인플루언서/크리에이터/큐레이터 금지")을 지키는 것**이다.

> 🏷️ **2026-06-27 대표 확정 — "공구권" → "이용권" 으로 통일** (이전: 식사권 → 공구권 → **이용권**). 이유: 경제는 즉시판매(모여서 공동구매 아님)인데 "공구권" 이 옛 멘탈모델을 끌고 다님 + "식사권" 은 식당 단정. 사용자-가시 "공구권"/"식사권" 156건(src+locales) 일괄 치환 완료. **"교환권"(기프티콘·KT, `deal_only=1`)·"동네딜"(로컬딜 리스트)·"공동구매/공구"(동사·일반어)는 불변** — 별개 개념. 코드 식별자(`meal_voucher`·`group-buy`·`curator`)도 불변(한글 라벨만). 아래 audit log 의 "공구권" 표기는 *작성 당시 historical record*(소급 변경 X).
>
> 🏷️ **2026-06-29 보강 — "식사권" 완전 제거** (대표 "응 통일해줘" → "이용권으로 일괄 정리해줘"). 06-27 치환 후 남아 있던 "식사권" 전부 정리: ① 일반 지칭(예 "내 식사권"·"식사권 등록/사용") → "이용권". ② **`meal_voucher` 카테고리 칩/필터 라벨 → "식사"**(형제: 미용/숙소/기타 — 우산말 "이용권"과 충돌 방지). ③ **알림 카테고리-종류 라벨(`getVoucherShortLabel`) → "{카테고리} 이용권"**(식사 이용권/미용 이용권/숙소 이용권/기타 이용권, fallback "이용권") — 옛 "식사권/미용권/…" 형태 폐기. 결과: 사용자-가시 "식사권" 0(코드 식별자 `meal_voucher`·설명 주석만 잔존). **규칙**: 신규 UI 일반 지칭=이용권 / 음식 카테고리 칩=식사 / 알림 카테고리 라벨="{카테고리} 이용권".

### 🏭 도매몰(유통스타트) 명칭 — **판매사 / 제조사** 로 무조건 통일 (2026-06-22 대표 확정 — 이전 '유통사' 역전)

> **2026-06-22 변경**: 구매자측 명칭을 **유통사 → 판매사**로 역전(대표 지시 "유통사가 아니라 판매사"). 공급자측 **제조사 유지**. 코드베이스 전체(src+locales) 사용자-가시 "유통사" 682건 일괄 치환 완료. 브랜드명 **"유통스타트"·일반어 "유통"은 불변**. 이전(2026-06-21) "유통사" 결정은 본 결정으로 폐기 — 아래 이력 audit log 의 "유통사" 표기는 *작성 당시 historical record*(소급 변경 X).

도매몰의 **모든 사용자-가시 라벨**은 아래 둘만 사용. 새 UI/문구/번역/약관/안내 작성 시 필수.

| 명칭 | 정의 | 비고 |
|---|---|---|
| **판매사** | 도매가로 사입해 재판매하는 B2B 회원(=구매자측) | `sellers`(is_distributor) |
| **제조사** | 도매몰에 상품을 공급하는 B2B 회원(=공급자측) | suppliers |

- ❌ **사용 금지(도매몰 사람/회원 지칭)**: "유통사", "공급사", "유통회원", "제조회원", "제조(브랜드)회원", "판매파트너", "사입 바이어", "셀러"(사람), "큐레이터". 괄호 병기("판매사(유통사)", "제조사(공급사)")도 금지 — **판매사 / 제조사 단독**.
- ✅ **유지 OK**: "공급가"/"공급가격"(가격 용어 — 회사 아님), "도매가", "공급하다/공급망"(동사·일반명사), "제조사 대시보드"·"판매사 대시보드"(도구 명칭), 오프라인 "매장"(가게 자체), 브랜드명 "유통스타트" + 일반어 "유통"(distribution).
- 법적 문서(이용약관/공급계약서)에서 법률상 당사자 정의가 필요하면 "판매사(이하 …)" 식으로 1회 정의 후 판매사/제조사로 통일.
- **코드 식별자는 무관**(suppliers/sellers/is_distributor/distributor_grade 등 내부 식별자 그대로 — 한글 라벨만 변경). 이 규칙은 사용자-가시 문자열에만 적용.


**규칙**:
- 사람을 가리킬 땐 **"유저" / "사업자 유저"** 만 사용. ❌ 사용 금지(사람 지칭): "큐레이터", "크리에이터", "인플루언서", "셀러"(사람 의미), "판매자", "매장 사장님"(신규 문구에서).
- **예외**: "셀러 대시보드"는 *도구 명칭*이라 유지 OK. 오프라인 가게 맥락의 "매장"은 문맥상 허용(가게 자체를 가리킬 때).
- **코드 식별자는 무관** — `CuratorPage`/`curator.routes`/`seller_type='influencer'`/`sellers` 테이블 등 내부 식별자는 그대로(전면 리네임 X). 이 규칙은 **사용자-가시 문자열**에만 적용.
- 능력 모델: 유저 → (사업자등록·판매승인) → 사업자 유저. 같은 `/u/{handle}` 링크에 기능이 *레이어로 추가*(신분 교체 아님). 라이브커머스는 영구중단(`LIVE_COMMERCE_SUSPENDED`).
- 🎯 **타겟 포지셔닝 (2026-06-18 대표)**: 사업자 유저의 메인 타겟 = **"자신의 쇼핑몰을 갖고 싶은 유저"**. 그들의 `/u/{handle}` 링크샵 = **본인 쇼핑몰**이고 **본인 상품이 주인공**. 이용권은 부가 채널(주인공 아님). → 사업자 유저 관련 신규 UI/문구/기본 강조는 "내 쇼핑몰" 언어·상품 우선으로(향후 구현 시 적용; 현재는 방향 메모만 — 코드 미변경).

> ⚠️ **원천징수율 hardcode 절대 금지** (2026-05-21 정정)
> - default 3.3% (사업소득 — 반복적 활동, 대부분 인플루언서)
> - 8.8% 는 기타소득만 (단발성 협업)
> - 마스터: `src/worker/utils/tax-withholding.ts` `WITHHOLDING_RATES`
> - sellers.tax_type 컬럼 ('business_income' default / 'other_income')
> - 새 코드는 `withholdAndLog()` 헬퍼만 호출 — 직접 0.088 / 0.033 곱셈 금지.

> ⚠️ **카카오 OAuth 룰** (2026-05-22 전수 점검)
> - 신규 카카오 endpoint 는 반드시 `safeRedirect()` (kakao.routes.ts) 사용 — open redirect 방어.
> - state CSRF: 모든 OAuth flow 는 `kakao_oauth_state` 쿠키 + URL state 검증.
> - 신규 사용자 생성 전 이메일 takeover 검사 — `KakaoAuthService.upsertUser` 의 `EMAIL_ALREADY_LINKED_TO_OTHER_METHOD` 패턴 따를 것.
> - access_token/refresh_token DB 저장 시 반드시 `encryptToken()` (DATA_ENCRYPTION_KEY).
> - 셀러-카카오 1:1 매핑: `idx_sellers_linked_user_unique` UNIQUE index 필수 (repair-schema 등록 완료).
> - kakao_id UNIQUE: `idx_users_kakao_id_unique` partial unique index (repair-schema 등록 완료).
> - `kakaotalk://` scheme redirect 는 sessionStorage 가드 (2026-04-29 사고).
> - 🍎 **iOS 쿠키 영속 룰 (2026-06-20 — 사파리/카톡 로그인 사고)**: iOS Safari/WebKit 은 **cross-site
>   OAuth 콜백 302 응답에서 set 한 쿠키를 미영속** 처리(Chrome 은 정상). 그래서:
>   - **소비자 세션**: `/sync/callback` 은 세션 쿠키를 302 에 의존하지 말고, 단명 서명 티켓을
>     fragment(`#st=`)로 넘겨 **same-origin `POST /api/auth/session/establish`** 로 httpOnly `ur_session`
>     을 200 응답에서 발급(first-party → iOS 영속). 토큰을 localStorage 에 두지 말 것.
>   - **역할 토큰(seller/agency/판매사/미래 역할)**: transfer 쿠키(`ur_pending_*`) **금지** — iOS 미영속.
>     반드시 **fragment(`#auth=`) + `worker/utils/pending-auth.ts` `encodePendingAuth()`** 로 전달.
>     새 역할은 `/sync/callback` 의 `pendingLs` 맵에 한 줄 추가(같은 `seller_`/`agency_`/`supplier_`
>     네임스페이스면 클라 허용목록 자동 통과). **XHR(JSON 응답) 로그인은 same-origin 200 이라 iOS-safe**
>     (공급자 `create-from-kakao`·유통 `become-distributor` 가 이미 이 방식).
>   - 진단: 관리자 `/api/_internal/kakao-login-diag` (브라우저별 success/error + 재시도).

> ⚠️ **Toss 결제 confirm 직접 fetch 절대 금지** (2026-05-22 옵션 B)
> - 5개 평행 흐름 (충전 / 주문 / 공구 / 숙소 / 교환권) 이 각자 fetch 호출 → 같은 버그 5번 재발.
> - 마스터: `src/worker/utils/toss-gateway.ts` `confirmTossPayment()`
> - 신규 토스 결제 endpoint 는 반드시 helper 호출. 직접 `fetch('https://api.tosspayments.com/...')` 금지.
> - circuit breaker / idempotency-key / amount validation / 에러 메시지 표준화 자동.
> - 키 type 검증도 helper (`decideTossFlow`, `detectTossKeyType`) 사용.

> ⚠️ **`(err as Error).message` 클라이언트 반환 절대 금지** (2026-05-22 보안)
> - DB 에러 메시지 (`UNIQUE constraint failed: users.email`) → 계정 enumeration 공격
> - 스택트레이스 누출 → 내부 구조 노출
> - 마스터: `src/worker/utils/safe-error.ts` `safeError(c, err, '한국어 generic 메시지', '[tag]')`
> - 패턴:
>   ```ts
>   } catch (err) {
>     return safeError(c, err, '주문 처리 중 오류가 발생했습니다', '[orders]')
>   }
>   ```
> - DEV 모드 (ENVIRONMENT=development) 에서만 `_debug` 필드에 detail 포함.

### 라이트 테마 — 셀러/어드민/에이전시 대시보드 (토글 무영향, 고정)
- **해당**: `/seller/*`, `/admin/*`, `/agency/*`
- **배경**: SellerLayout/AdminLayout/AgencyLayout 처리 (`#F4F5F7`)
- **🚨 절대 규칙** (사용자 명령, 위반 시 차단):
  - `dark:` variant 추가 절대 금지 — `scripts/check-dashboard-theme.sh` 자동 차단
  - 향후 다크 모드 활성 시에도 항상 화이트 유지
- ❌ 금지: `text-white` (컬러 버튼 위 제외), `dark:` variants

### 공통 규칙
- `text-white` 는 컬러 배경 버튼 위에서만 (bg-pink-500, bg-red-500 등)
- CSS 변수 (`text-foreground`, `bg-muted`) 대신 **명시적 색상 클래스**

## 💸 머니/정합성 코드 작성 룰 (2026-06-11 전 영역 감사에서 도출 — 새 코드는 처음부터 이대로)

> 감사에서 발견된 머니 버그 13건이 전부 아래 4가지 클래스였음. 새 결제/적립/취소/환불 코드는
> 작성 시점에 이 패턴을 따르면 후 감사가 필요 없음. warn 검사: `scripts/check-money-patterns.sh`.

1. **Claim-before-credit (CAS 선점 후 side-effect)** — 적립/차감/환급 같은 돈 side-effect 앞에는
   반드시 원자적 상태 선점: `UPDATE ... SET status='X' WHERE id=? AND status='이전상태'` 후
   `meta.changes === 0` 이면 side-effect 없이 멱등 반환. **사전 SELECT 체크만으로는 동시요청을 못 막음**
   (예: 숙소 confirm/취소, 예약 딜환급, 주문 confirm — 전부 이 패턴으로 수정됨).
2. **적립-역전 대칭** — 새 적립(커미션/보너스/포인트)을 만들면 **같은 commit 에서** 역전 함수를 만들고
   `refundOrderFully`(order-refund.ts) + `returns.routes.ts` 양쪽에 배선. 적립 경로가 둘(confirm/webhook)이면
   적립도 공용 멱등 헬퍼 1개로 (예: `creditOrderCommissions`).
3. **멱등 = UNIQUE index + INSERT OR IGNORE** — "이미 있는지 SELECT 후 INSERT" 금지(race).
   `INSERT OR IGNORE` + repair-schema 에 partial UNIQUE index 등록 + `meta.changes` 검사.
4. **status 플립 ≠ 취소** — 결제 캡처된(PAID/DONE/PREPARING/SHIPPING/DELIVERED) 주문을
   `status='CANCELLED'` 로만 바꾸면 고객 미환불 + 커미션 미역전. 반드시 `refundOrderFully` 경유
   또는 `REFUND_REQUIRED` 차단. bulk 엔드포인트도 동일.

**부수 룰**: 핸들러 안 inline `ALTER TABLE`/`CREATE INDEX` 금지 — `ensureXxx(DB)` + WeakSet 메모이즈
(per-request DDL). 신규 KV write 는 무료 1K/day 한도 고려(고볼륨이면 샘플링), SESSION_KV 에 분석용 write 금지.

## 🚨 DB 스키마 규칙 (요약 — 자세한 건 `docs/SCHEMA.md`)

- **SSOT**: `src/shared/db/production-schema.ts`
- 새 쿼리 작성 전 컬럼 확인 + INSERT 시 NOT NULL 포함 + try-catch
- 자주 틀리는 컬럼 alias: `stock` / `is_active` / `credit_amount`
- orders.status: 대문자 (`PAID`, `DONE`, …) / payment_status: 소문자 (`approved`, …)
- 🛡️ **products 컬럼 추가 금지(예산제, 2026-06-10)**: 새 도매/브랜드/전시 메타는 `product_supply_meta`(K-V 사이드테이블, `src/worker/utils/product-supply-meta.ts`) 사용. products ALTER 가 정말 필요하면 `scripts/products-column-baseline.json` 에 등록 + PR 사유 — CI 가 차단함
- 🛡️ **sellers 컬럼 추가 금지(2026-07-05 — 한도 도달)**: sellers 는 **정확히 100컬럼 = D1 결과셋 한도**. 새 셀러 메타/설정/플래그는 `seller_meta`(K-V 사이드테이블, `src/worker/utils/seller-meta.ts` — product_supply_meta 미러) 사용. ALTER 는 `scripts/sellers-column-baseline.json` 등록 필요 — CI 차단
- 검증: `bash scripts/check-schema-refs.sh`

## 🔒 API 엔드포인트 보안 규칙 (필수)

### 새 엔드포인트 체크리스트
1. **인증**: `requireAuth()` / `requireSeller()` / `requireAdmin()` / `requireAgency()` 필수
2. **권한 검증** (IDOR 방지):
   - `resource.seller_id === authenticatedSellerId` 같은 소유권 체크
   - body/query 의 user_id/seller_id 를 인증 없이 신뢰 금지
   - 토큰 발급/세션 생성 endpoint 는 호출자 본인 검증 필수
3. **입력 검증**: `Number.isFinite()` + 범위 체크 + 문자열 길이 + enum 허용 값
4. **서버 재계산**: 결제 금액은 절대 클라이언트 값 신뢰 금지
5. **Rate limit** (민감 엔드포인트 — `/login`, `/pay`, `/donate` 등):
   - `RATE_LIMIT_KV` Dashboard Bindings 등록 필수 (미등록 시 fail-OPEN)
   - 검증: `curl -I .../api/products` → `X-RateLimit-Limit` 헤더 존재
6. **Bot challenge (Turnstile)**:
   - `verifyTurnstile(c.env.TURNSTILE_SECRET, body.turnstile_token, ip)`
   - 적용: `/api/donations/init` (2026-05-03)
   - `TURNSTILE_SECRET` 미설정 시 fail-open
7. **Idempotency**: 결제 관련 Toss API 호출 시 `Idempotency-Key` 필수
8. **에러 처리**: try-catch + DEV 모드 로깅 (조용히 삼키지 말 것)
9. **i18n fallback**: `t('X', { defaultValue: '한글' })` (NOT `t('X') || '...'`)

### 절대 하지 말 것
- ❌ `debug-*` 엔드포인트 프로덕션 배포
- ❌ 클라이언트 값으로 금액 계산
- ❌ `.catch(() => {})` 로 에러 완전 무시
- ❌ 권한 체크 없는 POST/PATCH/DELETE
- ❌ `SELECT *` with LIMIT/OFFSET but no ORDER BY
- ❌ 하드코딩된 내부 API 토큰
- ❌ `Function('p', 'return import(p)')(...)` 에 사용자 입력 전달 (RCE)

## 🌍 i18n (다국어) 필수 규칙

셀러 대시보드 (`src/pages/Seller*.tsx`, `src/components/Seller*.tsx`) 수정 시:

1. 모든 UI 텍스트는 `t()` 함수 — 하드코딩 한국어 금지
2. 새 텍스트 → `public/locales/{ko,en,ja,zh,es,fr}/translation.json` **6개 언어 모두**
3. 키 네이밍: `common.*` (공통) / `seller.*` (셀러)
4. fallback 패턴: `t('X', { defaultValue: '한글' })` — `||` 연산자 금지

## 🔐 인증

- Bearer 토큰 우선, 세션 쿠키 차선
- 셀러/어드민: localStorage JWT 즉시 체크 (Firebase 대기 안 함)
- 유저: Firebase Auth + optimistic rendering
- 한국 (live.ur-team.com): 카카오 세션 쿠키 전용, Firebase 호출 0
- ProtectedRoute: `localStorage(user_type + user_id)` 동기 체크
- `isKorea()` 분기로 Firebase 코드 건너뜀

### Redirect / returnUrl 안전 규칙
OAuth 콜백·로그인·401 핸들러 등에서 외부 입력은 **반드시 `safeInternalPath()` 통과**:

```ts
import { safeInternalPath } from '@/utils/safe-internal-path'
const returnUrl = safeInternalPath(searchParams.get('returnUrl'), '/')
navigate(returnUrl)
```

자동 차단: `/login`, `/seller/login`, `/admin/login`, `/agency/login`, `/auth/*`, `/oauth/*`, 외부 URL, protocol-relative `//`, backslash, 제어문자.

**Worker 코드** (`src/features/*/api/*.routes.ts`, `src/worker/`) 는 alias `@/` import 못 함 → `kakao.routes.ts:safeRedirect()` 가 인라인으로 동일 규칙 유지. **양쪽 같이 갱신**.

### 외부 스킴 redirect 가드 (2026-04-29 사고 후)
`kakaotalk://`, `intent://`, `line://` redirect 는 **반드시 sessionStorage 가드** (webview reload 무한 재시도 방지). inline script + module script 가 같은 가드 공유 시 키 이름 명시 + 두 곳 동시 수정. 자세한 사고 경위: `docs/INCIDENTS.md`.

## 💰 딜 포인트 시스템

- 충전: 1원 = 1딜 (수수료 없음)
- 후원/상품 결제: 딜 즉시 차감
- 셀러 정산: 기본 5% 플랫폼 수수료 (`platform_settings.commission_rate_default`). 어드민이 셀러별로 `sellers.commission_rate` 조정 가능. 후원 수수료 별도 15%.
- 최소 후원: 500딜

> ⭐ **커미션 재원 확정 원칙 (2026-07-08 대표 확정 — 8월 promo flip 방향, 현재 코드 미변경)**: **유어딜 5% 는 *어떤* 커미션에도 일절 안 쓴다(순수 인프라비, PG 포함).** 판매 커미션(인플/벤더/어필리에이트) **그리고 에이전시 수수료까지** 전부 **매장 promo(5% 밖, `promo_funding_source=owner`) 재원**. 에이전시는 유어딜이 커미션을 주는 게 아니라 **매장-인플 조율로 매장 promo 마진에서 스스로 가져가는 독립 사업자**(= 쇼핑 벤더 모델의 오프라인판; 유어딜 정의 = 쇼핑 공구 벤더 중개 모델을 오프라인 이용권으로 이식). 누가 얼마 받든 **유어딜 5% 는 불변(원장 `platform:revenue`=5% 전액, 성장 커미션 debit 0, 예외 없음 — 깨지면 버그)**. 오늘 owner 스위치는 어필리에이트만 커버 → 8월 flip 이 나머지 전 축(에이전시 포함) 확장 + 불변식 #44 신설. **머니 경로라 flip 은 단독 세션 + staging 실결제.** SSOT·flip 체크리스트: `docs/design/commission-funding-restructure.md` §확정 원칙.

> 🔄 **2026-08-31 대표 재검토 — 위 원칙의 전제가 바뀌었다(확정 아님, 방향 메모).** 대표:
> *"매장 promo 재원은 이제 5%가 아니라 수수료 10%도 받기 때문에 지금은 변경된 얘기 같아."*
> 07-08 원칙은 **플랫폼 수수료가 5% 하나**이던 시절의 계산이다. 그 뒤 채널별 요율이 들어와
> (`fee_channel_rates_enabled=true` · **직접 10% / 중개 5%**) 직접 입점 매장에서는 원래 폭이 훨씬 넓다.
> ⇒ **"5% 는 커미션에 안 쓴다"를 지금 그대로 적용하지 말 것** — 대표가 전제 변경을 명시했다.
> 다만 **폐기된 것도 아니다**: 중개(5%) 매장에서는 07-08 계산이 여전히 그대로 유효하다.
> 재확정 전까지는 `promo_funding_source` flip 을 밀지 말고, 아래 8-31 결정 두 개로 간다.
>
> ⭐ **2026-08-31 대표 확정 2건** (라이브 실측 후 — 중개 매장은 `5% − PG 2.75% − 영입 2% = +0.25%` 로
> 사실상 0, 커미션 하나만 더 겹치면 적자):
>   1. **영입 2% 는 직접 입점(`store_channel='direct'`) 매장에만.** 적립 코드
>      (`influencer-store-intro-commission.ts` compute/credit 양쪽)에 채널 조건 추가.
>      🔴 **미지정 매장 처리를 먼저 정할 것** — 실측상 매장 11곳 중 채널이 박힌 곳은 1곳(그것도
>      brokered)뿐이라, 순진하게 `=== 'direct'` 로 막으면 **아무도 못 받는다**. 방향은
>      `fee-resolver` 의 fail-soft 와 일관되게: *매장에서 떼는* 쪽은 관대, *우리가 주는* 쪽은 엄격.
>   2. **예산 아비터를 켠다**(`commission_budget_enabled`) — 커미션 총합이
>      `플랫폼수수료 − PG준비금` 을 구조적으로 못 넘게. ⚠️ **프로덕션에 바로 켜지 말 것**:
>      위 2026-07-04 audit log 가 활성 전 staging 실결제를 조건으로 달아 뒀다.
> 둘 다 머니 경로 → **단독 세션 + staging 실결제.**
>
> ⭐ **2026-09-07 대표 확정(결재 Q4-2, "기본안대로 모두 승인") — 07-08 원칙 폐기.** 성장 커미션은 플랫폼 수수료 안에서 유어딜이 부담하되 주문당 총합 ≤ `수수료 − PG 준비금` 을 예산 아비터가 강제한다. 전 축 owner-promo flip·불변식 #44 는 추진하지 않는다. **아비터 ON 은 staging S1 뒤 대표가 켠다**(코드는 있고 기본 OFF). SSOT: `urdeal-platform-model.md` §5-3 ⭐ 2026-09-07 · 결재 파일 `docs/decisions/archive/2026-09-07-actor-benefit-conflicts.md`.

> ⭐ **2026-10-16 대표 확정 2건** (0.5% 지급 경로가 설정을 무시하던 것을 찾아 보고한 뒤):
> ***"0.5%는 안주는거야. 소개비는 매장 사장님이 설정했다면 매장에서 부담하는거."***
> - **유저 추천 보너스(공구 양쪽 0.5%)** — **안 준다.** 지급 경로가 둘이었고 하나(`referral-bonus.ts`)는
>   `platform_settings` 를 안 읽고 `REFERRAL_BONUS_BOTHSIDES_PCT` **0.5 상수**를 썼다(설정을 0 으로
>   내린 2026-08-23 뒤에도 계속 0.5%). 그 모듈·상수·어드민 정책표 행·**대외 제안서 2종의 행**을 전부
>   지웠다. 이제 진실은 `user_referral_bonus_pct` **하나**(라이브 0)다 — 되살리려면 그 설정을 올릴 것,
>   **상수를 다시 심지 말 것**. 가드 `referral-bonus-single-source-2026-10-16.test.ts`(주입 7건).
> - **소개비** — **매장이 설정했다면 매장 부담.** 살아 있는 레일은 `seller_influencer_deals`
>   (라이브 active 1건)와 상품별 `referral_commission_rate` 이고, 플랫폼이 깔아 주던 어필리에이트 2%는
>   이미 꺼져 있다(2026-08-22 대표 *"어필리에이트 전략은 빼려고 해"* → `affiliate_program_enabled` 행 부재).
>   ⚠️ 이름이 비슷해 0.5% 정리에 휩쓸리기 쉽다 — **그 둘은 지우지 말 것**(주입이 반대 방향을 고정).
> ✅ **E4 판정 통과(배포 후 라이브, 머지 `0e58ab293`)** — 지급 경로 둘 중 설정을 안 읽던 B 를 지웠다.
>   **배포 전에 기준점을 먼저 잡고** 양방향으로 쟀다(0 만 보면 *지워졌다*와 *원래 없었다*를 구분할 수 없다):
>   라이브 어드민 정책 청크에서 `공구 양쪽 보너스` **1 → 0** · `REFERRAL_BONUS_BOTHSIDES_PCT` **2 → 0** ·
>   `추천인 + 피추천인` **1 → 0**, 대조군 `원천징수` **4 → 4** · `어필리에이트`·`커미션` **1 · 1 유지**
>   (청크 해시 `DGJunL-A` → `Dj4TW5DE`). 원장 `referral_bonus`·`invite_reward` **배포 전후 0행**이고
>   대조군이 다섯 유형을 실수로 돌려주므로 그 0 은 쿼리가 빈 것이 아니다(`donate 10 · charge 9 · refund 7
>   · legacy_reconcile 4 · bucket_reclass 2`). 🔴 **반대 방향도 살아 있다** — 소개비 약정 **1건**(매장 15 ↔
>   인플 37 · **5%** · `active`) · 귀속 원장 **1건**(`broker_share`) · 설정 `user_referral_bonus_pct` **0** 이
>   유일한 출처로 남았다. ⚠️ **못 잰 것**: 지운 모듈은 **워커** 모듈이라 `_worker.js` 가 공개로 안 읽히고,
>   행동 증명은 **소개 링크로 딜 참여**가 필요해 세션이 못 한다(머니 경로) — **①만 보고 "통과" 라고 하지 않는다.**
>   🩸 측정하며 컬럼 이름을 두 번 짐작해 틀렸다(`is_active`→`status` · `commission_rate`→`commission_pct`).
>   **`pragma_table_info` 로 먼저 확인할 것.** 상세: `docs/handoff/2026-10-16-referral-bonus-single-source.md`

## 🆕 새 페이지 생성 체크리스트

1. **SEO**: `<SEO title="제목 - 유어딜" description="설명" url="/경로" />` 필수 (관리자/콜백 제외)
2. **테마**: 위 테마 규칙
3. **text-gray-900**: 화이트 테마 input/select/textarea 에 명시
   - 🛡️ **라이트 고정 standalone 페이지(로그인/가입/비번 — 레이아웃 밖)는 루트 div 에 `force-light-theme` 필수**: 전역 `.dark input` 규칙(특이도 0,5,1)이 다크모드에서 input 글자를 흰색으로 덮어써 `text-gray-900`(0,1,0)이 짐 → 안 보임. `force-light-theme`(또는 `admin/seller/agency-light-theme`)가 CSS `!important` 로 무력화. 어드민/셀러/에이전시 **대시보드 페이지는 레이아웃이 자동 적용**(직접 추가 불필요). `check-light-input-guard.mjs` 가 자동 감지.
4. **App.tsx**: lazy import + Route 추가
5. **console.log 금지**: `import.meta.env.DEV` 게이트 필수
6. **숫자 포매팅** (대시보드 ₩NaN 사고 — 2026-05-17): `value.toLocaleString()` 직접 호출 금지.
   DB row 값이 null/undefined 이거나 `a * b` 곱셈에 한쪽이 null 이면 `NaN` 노출.
   대신 `@/utils/format` 의 헬퍼 사용:
   ```ts
   import { formatNumber, formatWon, safeNum } from '@/utils/format'
   {formatWon(value)}                       // → ₩1,234 (null → ₩0)
   {formatNumber(value)}                    // → 1,234 (null → 0)
   formatNumber(safeNum(a) * safeNum(b))    // 산술 후 포매팅 — NaN 방지
   ```
7. **첫 페인트 표준 + 새 페이지 로딩 체크리스트(2026-07-12 대표 확정)**: `docs/LOADING_ARCHITECTURE.md` 의 "첫 페인트 표준" 표 + "✅ 새 페이지 로딩 체크리스트" **필수 준수** — ① 로더는 BrandLoader 만 ② 시드는 useState 동기 소비(+정체성 검증) ③ 목록→상세 prefetch 는 상세와 같은 엔드포인트/키(String 정규화) ④ 하드로드 진입점은 `generate-route-chunk-map.mjs` ROUTES + worker chunkSurface 동시 등재(청크 병렬화 — 가드 강제) ⑤ 쿼리 변경은 제자리 갱신 ⑥ 완성 후 `node scripts/probe-loading.mjs /path` 실측(풀 로더 1회·warm ≤1.5s)
8. **📱 모바일 뷰포트 높이/스크롤 (2026-06-22 — 동네딜 지도 하단 잘림 사고)**: 풀스크린/고정바 페이지는 아래 룰 준수. 위반 시 모바일에서 **하단(네비/적용버튼/리스트 끝)이 화면 밖으로 잘림**. **권장: 함정 제거 프리미티브 사용 — 풀높이 컨테이너 `<Screen>`/`<Screen fixed>`(`@/components/ui/screen`), flex 스크롤 영역 `<ScrollArea>`(`@/components/ui/scroll-area`)**. 직접 클래스 작성 시:
   - ❌ **`h-screen`/`min-h-screen`(=100vh) 금지** → ✅ **`h-[100dvh]`/`min-h-[100dvh]`**(또는 `<Screen>`). 모바일 100vh 는 주소창 포함 = 실제 보이는 영역보다 큼 → `bottom-0` 콘텐츠가 화면 밖. `calc(100dvh - …)` 와 컨테이너 단위도 dvh끼리 일치.
   - ❌ **`flex-1 overflow-y-auto` 에 `min-h-0` 빠뜨리기 금지** → ✅ **`flex-1 min-h-0 overflow-y-auto`**(또는 `<ScrollArea>`). flex 자식 기본 `min-height:auto` 라 콘텐츠보다 안 줄어듦 → 스크롤 안 되고 형제(footer/적용버튼)가 밀려 안 보임. 바텀시트/모달 스크롤 영역 필수.
   - 🛡️ 신규 라인은 `check-mobile-viewport.mjs`(pre-commit 래칫)가 자동 경고.
9. **🧱 파일/컴포넌트 크기 (2026-06-29 — god 파일 재발 방지)**: 페이지/라우트가 600줄 넘어가면 **그 시점에** 카드·모달·섹션·핸들러群을 같은이름 폴더(`foo-list/`, `my-vouchers/` 선례)로 추출. "일단 여기에 한 블록 더"가 god 파일(1300줄+)의 원인 — 처음부터 컴포넌트로. 단일 컴포넌트도 ~300줄 넘으면 분리 고려. 🛡️ `check-file-size.mjs`(래칫: 신규 600줄 초과 / baseline 동결 파일 성장 차단, `verify.yml`+audit-gate strict)가 자동 강제. 대형 파일을 줄였으면 `node scripts/check-file-size.mjs --rebaseline` 로 동결값 갱신.
10. **검증**: `bash scripts/quality-check.sh`

## 🚀 배포 아키텍처

⚠️ **Cloudflare Pages 단일 배포** (Workers 아님):
- `live.ur-team.com` → Pages `ur-live` (Custom Domain)
- `ur-live.pages.dev` → 동일 프로젝트 기본 도메인
- 구조: Pages with `_worker.js`. `wrangler deploy` (Workers용) 사용 금지.

### 🚨 빌드 명령 절대 룰 (2026-05-12 사고 후)

**원인**: `npx vite build` 만 실행하면 **`_worker.js` 가 갱신 안 됨** → 모든 worker 코드 변경이 production 에 반영 안 됨.

```jsonc
// package.json
"build": "npm run build:client && npm run build:worker && npm run build:prepare"
"build:client": "vite build"           ← client 만
"build:worker": "node scripts/build-worker.js"  ← worker 별도
```

- ✅ **올바른 명령**: `npm run build` (또는 PowerShell `.\scripts\deploy.ps1`)
- ❌ **금지**: `npx vite build` 단독 사용 — `_worker.js` 갱신 안 됨
- 🛡️ **자동 방어**: `scripts/validate-build-output.cjs` 가 `_worker.js` mtime 을
  `src/worker/`, `src/features/*/api/` 의 최신 mtime 과 비교 → 오래되면 빌드 실패.

### 권장 배포 명령

```powershell
# PC PowerShell — 안전 스크립트 (권장)
.\scripts\deploy.ps1 -Message "feat-XYZ"

# 또는 직접 명령
npm run build                                                            # ← 핵심: vite build 아님!
npx wrangler@3 pages deploy dist/client --project-name=ur-live `
  --commit-dirty=true --commit-message="ascii-only-no-korean"
```

> ⚠️ `commit-message` 는 **ASCII only** — 한글/em-dash/이모지 포함 시 CF API 가 거부 (`Invalid commit message, it must be a valid UTF-8 string` 에러).

### Secret/환경변수
- Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables and Secrets
- secret 은 한 번 저장하면 값 못 봄 — 외부 참조 시 별도 기록

### 자동 배포 규칙
- feature 브랜치 push → PostToolUse 훅이 자동 main 머지 + 푸시 (`scripts/auto-merge-main.sh`)
- 절대 feature 브랜치만 두지 말 것 — main 반영되어야 배포

### 변경 후 체크리스트
1. `bash scripts/check-schema-refs.sh`
2. `bash scripts/check-api-auth.sh`
3. `npx tsc --noEmit --skipLibCheck` (에러 0)
4. `npm run build`  ← **`vite build` 아님!** (위 빌드 룰 참조)
5. `git push origin <branch>` (훅이 main 자동 머지 + 배포)
6. Actions 탭 녹색 확인
7. 배포 후 `curl -i "https://urdeal.kr/api/version?cb=$RANDOM"` 등 핵심 endpoint smoke test
   > 🔴 **2026-08-04 정정**: 여기 오래 적혀 있던 `-X POST .../api/version` 은 **항상 404** 다
   > (그 라우트는 GET 전용). 캐시 우회가 목적이었으면 쿼리로 하면 되고, POST 로는 배포가 성공했는지
   > 실패했는지 **구분이 안 된다**. 같은 오류가 `uptime.yml` 의 생존 프로브에도 있었고
   > (4xx='정상' 규칙이라 조용히 통과), 이제 `check-live-contracts` 가 프로브 URL 의 실재를 검사한다.

### 절대 하지 말 것 (배포 관련)
- ❌ Service Worker / PWA 라이브러리 — 카카오 OAuth 차단 사고 (2026-04-27, `docs/INCIDENTS.md`)
- ❌ `_redirects` 에 `/* /index.html 200` — Workers 무한 루프
- ❌ `_headers` 에 2000자 초과 줄 — 배포 실패
- ❌ `wrangler.toml` 에서 `new_classes` (free plan 은 `new_sqlite_classes`)
- ❌ 파일 중간에 `import` 문 추가 — ES module 위반, 런타임 crash (2026-04-22 사고)
- ❌ Worker 코드에서 `await import('@/...')` — dynamic import + alias 조합 crash
  - 반드시 상대경로: `await import('../../features/foo')`
  - 예외: 순수 프론트엔드 (pages/components/shared/stores) 는 Vite 가 alias resolve → OK
  - 이중 방어: `esbuild.worker.config.js` alias + Pre-commit hook 차단

## 🛠️ 개발 환경 셋업 (새 컨트리뷰터 **+ 모든 원격 세션**)
1. `npm install`
2. `bash scripts/install-git-hooks.sh` — pre-commit 훅 설치
3. 이후 모든 커밋 전 자동 검증

> 🔴 **원격 세션(Claude Code on the web)은 세션마다 이걸 다시 돌려야 한다** (2026-08-25 실측).
> 컨테이너는 매번 새로 만들어지고 `.git/hooks/` 는 클론에 안 딸려 온다 —
> `ls .git/hooks/pre-commit` 이 비어 있으면 **그 세션의 모든 커밋이 pre-commit 가드를 통과하지
> 않은 것**이다(충돌 마커·테마·스키마·타입체크·워커빌드·주입중단 검사 전부).
>
> 🩸 그날 실제로 이랬다: 오전에 주입된 결함을 커밋했고(`git add -A` 가 `check-guard-mutations`
> 실행 중의 주입본을 집었다), 재발 방지로 `check-no-injection-in-progress.sh` 를 만들었는데
> **훅이 없어 그것도 안 돌고 있었다.** 설치한 뒤 30분 만에 같은 사고를 실제로 막았다
> (`DealCardMedia.tsx` 의 홈 카드 트래픽 보호 제거 주입분이 staged 됐다).
> ⇒ **가드를 만드는 것 · 등록되는 것 · 실제로 도는 것은 셋 다 다른 일이다.**
>
> ✅ **2026-11-01 — 이제 자동이다.** `.claude/hooks/session-start.sh` 가 **맨 앞에서** 설치한다(그 아래는
> 스크래퍼 상태에 따라 중간 `exit 0` 하므로 끝에 두면 조용히 안 깔린다). 시작 로그에
> `==> git 검사(pre-commit·pre-push) 설치 완료` 가 보이면 된 것이고, `⚠️ … 설치 실패` 면 직접 돌릴 것.
> 가드 `session-start-git-hooks-2026-11-01.test.ts`(주입 2).
## 🛡️ 영구 방어선 (사고 재발 방지)

과거 사고 패턴이 다시 commit / deploy 되는 것을 차단하는 자동 검사.

⚠️ **아래 목록은 이 표의 83행이고, 레포 전체 불변식은 그보다 많다** — 표에 행이 없는 가드가 있다
(이 문서 `## 🛡️ 감사 게이트` 절은 100개라고 적는다). **정확한 값은 `bash scripts/audit-gate.sh` 의
마지막 줄이 유일한 진실이다** — 이 숫자들은 가드를 추가할 때마다 낡는다.

📄 **표 전문(검사 항목 · Pre-commit · CI · 사고 출처와 경위) → `docs/GUARD_RAILS.md`**

🔴 **가드가 빨간불이면, 또는 새 가드를 만들면 그 파일의 해당 행을 읽을 것** — "사고 출처" 칸에
**그 가드가 왜 생겼는지와 그때 무엇을 놓쳤는지**가 있다. 그게 가드를 끄는 대신 **재조준**하게
만드는 유일한 근거다. `grep -n '<검사 이름>' docs/GUARD_RAILS.md`

<details><summary><b>검사 항목 83개 (이름만 — 상세는 위 파일)</b></summary>

- Hono v4 wildcard `cors()`
- 타입 에러 라이브 유출 (배포 타입체크 게이트)
- `vite build` 단독 사용
- `_worker.js` 신선도
- Hardcoded secret
- cron 무음 정지(실행기록 없음)
- 시드 버전 재사용(재시드 무음 스킵)
- 잠금표가 사라진 심볼을 지킴(낡은 지도)
- 비공개 라우트가 크롤에 열림
- sitemap 이 죽은 URL 제출(SEO 신뢰도)
- tsconfig 가 타입체크를 통째로 중단
- **가드가 있는데 안 돎**(레지스트리)
- 라우트 경로 중복(조용히 죽는 페이지)
- 규칙 버전 미bump(소급 적용 무음 누락)
- Firebase 토큰 인증 수용
- 시크릿 자재(키 본문) 유입
- **텍스트 가드가 자기 주석 제거기를 만듦**
- **CI 는 막는데 로컬은 안 막음**(57분 피드백)
- **로컬은 clean 인데 GitHub 은 충돌**(Verify 가 *부재*)
- **주입 앵커가 낡음**(가드가 지키는 척)
- **가드가 실패할 수 없음**(헛도는 검사)
- **머지 충돌 마커 커밋**
- **레인이 CPU 예산을 우회**(유어애즈 — 인플루언서·B2B 공통)
- **D1 바인딩 한도 초과**(묶음이 조용히 전부 실패)
- Schema drift
- API 인증 누락
- 대시보드 dark variant
- 다크/라이트 테마 일관성
- Service Worker 등록
- 파일 중간 import
- Silent error (warn)
- 머니 패턴 (warn, 차단 `STRICT_MONEY=1`)
- 대시보드 NaN/undefined (warn)
- CHECK 제약 위반
- SQL bind param mismatch **+ bind 통째 누락**
- NOT NULL INSERT 누락
- 존재하지 않는 컬럼 참조
- 존재하지 않는 테이블 참조
- products `SELECT *`/`p.*`
- products/sellers 새 컬럼 (예산제)
- PRODUCT_DETAIL_FIELDS 복구 가능성
- RQ initialData 신선도
- group_buy_status 종류판별
- 로그인 입력 글자 흰색(다크)
- input 자기 className 흰 글자(라이트)
- 배포-청크 자가복구(흰화면/무한로딩)
- 로더 연속성(로딩 2번 나뉨/블링크)
- 링크샵 소유권 단일화(내 가게인데 방문자로 보임)
- 카카오 OAuth iOS 쿠키 미영속
- 모바일 하단 네비 사라짐 (keyboard-open)
- CSV/엑셀 수식 인젝션
- 쿼리 fetch 에러가 빈화면/₩0 위장
- 도매주문 상태 무결성(정의 밖 status)
- ~~가격으로 로그인 유도(로그인했는데 '로그인하세요')~~ → **2026-10-11 폐기**
- 모달/시트가 하단 네비 뒤로 가려짐
- 대시보드 라우팅(다중역할/겸업 lock-out)
- 동네딜에 쇼핑 카테고리 유입(서비스 분리)
- god 파일 재발(페이지/라우트 비대화)
- 세션 컨텍스트 예산(prompt too long · 크레딧 과소비)
- DB 타임스탬프 KST 오표기(9시간 어긋남)
- 블로그 시드 최신성(낡은 명칭/기능 재유입)
- pagination NaN 크래시(비숫자 page/limit)
- 도매 공급가 모델 드리프트(폐기 함수)
- 잔액 컬럼 절대값 write(비원자)
- 커미션 예산 아비터 우회 [INV-CB]
- KV delete 무료한도 폭식
- 선언한 URL 이 라이브에서 죽음(예열/색인)
- 구 도메인이 사용자 표면에 남음
- **다크에서 안 보이는 글자**(밝은 면 위 밝은 글자)
- **로딩 밀림**(읽던 줄이 손가락 밑에서 움직인다)
- **손님 화면이 자기가 안 쓰는 코드를 받음**(남의 봉투)
- **첫 화면이 같은 것을 두 번 받음**(중복 요청)
- **화면별 첫 화면 무게가 조용히 늘어남**(헐거운 예산)
- **첫 화면에서 도는 코드가 조용히 늘어남**(실행 비용)
- **실사용 성능이 나빠져도 아무도 모름** · **그 감시 자신이 침묵하는 것**
- **거짓 cron 경보가 진짜를 가림**(`skipped=` 를 키만 보고 값을 안 봤다)
- **첫 화면 요청이 한 박자 늦게 출발**(동적 import 지연)
- **AI 검색·인용 크롤러를 돌려보냄**(robots 와 헤더의 비대칭)
- **빵부스러기가 없는 색인 표면**(검색결과에 생 URL)
- **크롤러 문서에 내부 링크 0**(허브 → 상세 길이 없다)
- **sitemap 이 제출한 URL 의 크롤러 본문이 빈다**(짝 주장이 깨짐)
- 깨진 이미지 아이콘 노출(cfImage `<img>` 무방비)
- **워크플로가 실패를 삼켜 `success` 를 찍음**(조용한 거짓)
- **휘발성 생성물을 추적해 머지마다 충돌**

</details>

**Bypass (정당 사유만):**
- commit message 에 `[SKIP_ROUTER_CHECK]` / `[SKIP_BUILD_CHECK]` / `[SKIP_SECRET_CHECK]` / `[STRICT_SILENT]` 등 명시
- 또는 `git commit -n` (모든 hook 우회) — CI 에서 reject 됨

**배포 흐름 (자동):**
```
git push origin main
   ↓
GitHub Actions (main.yml) auto-trigger
   ↓
[verify.yml steps] 안티패턴 / 빌드 / 타입 / secret 검증
   ↓
[main.yml steps] npm run build → wrangler pages deploy
   ↓
Pages 갱신 → live.ur-team.com 반영
```

**Worker / Cron 변경 시 추가 (드물게):**
```powershell
npx wrangler@3 deploy   # Workers 프로젝트 (cron 코드 동기화)
```
