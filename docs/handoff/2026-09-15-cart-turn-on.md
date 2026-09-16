# 🧺 장바구니 켜기 — 머니 버그 수리 + 딜/원 분리 + 게이트 등재 (2026-09-15)

대표: *"장바구니 켜줘 최대한 다 끝까지 다 해줘. 장바구니 페이지 시안도 궁금하고"*

## ✅ 판정 (2026-09-15 · PR #1447 머지·배포 완료)

**[E4 라이브 판정됨]** — 배포 번들을 브라우저로 렌더해 실측했다(`scratchpad/live-cart-verdict.mjs`:
라이브를 localhost 로 통째 중계 + `/api/cart` 만 목으로 채운다. 읽기 전용).

| 확인 | 결과 |
|---|---|
| 딜/원 분리 (`74,500원` / `13,500딜` 두 줄) | ✅ |
| 합산값 `88,000` 이 화면 어디에도 없음 | ✅ |
| 섞임 안내 문장 | ✅ |
| 주문 버튼 비활성 | ✅ |
| `voucher_cart_enabled` 어드민 게이트 현황판 등재 | ✅ (`GET /api/admin/ops-status`) |

**게이트 상태**: ① 서버 `voucher_cart_enabled` = **`true`** (2026-09-15 켬, 어드민 API 로 실측 확인) ·
② `VOUCHER_CART_UI_ENABLED` = **`false`** (코드, 변경 없음).
⇒ **API 는 열렸고 화면 진입점은 없다.** 일반 사용자에게는 아무 변화가 없고, 대신 S-CART 를
실제로 돌려 볼 수 있다(게이트가 꺼져 있으면 그 표 자체를 못 돈다).

🔑 **①을 켠 판단 근거**: 노출이 0 임을 실측했다 — 그 시점 전체 `cart_items` 중 이용권 카테고리 행이
**0건**이었고(D1 조회), 담기 버튼은 ②가 막고 있다. 그리고 ①이 꺼져 있으면 대표가 실결제 테스트를
시작조차 못 한다. **②는 켜지 않았다** — 그건 실제로 돈이 움직이는 단계이고, 롤백이 배포라
어드민 1초가 아니다. CLAUDE.md 의 "머니 게이트는 staging 실결제 뒤" 룰이 가리키는 자리가 여기다.

## 다음 세션의 첫 액션

```bash
# ① 게이트가 어디까지 켜졌는지 — 어드민 게이트 현황판
curl -sS "https://live.ur-team.com/api/admin/system-monitoring/ops-status" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;print([g for g in json.load(sys.stdin)['data']['gates'] if g['key']=='voucher_cart_enabled'])"
```
**판정**: `value` 가 `null`/`'false'` 면 서버 게이트 OFF. `'true'` 면 결제 레일이 열려 있다.
그리고 `src/shared/feature-flags.ts` 의 `VOUCHER_CART_UI_ENABLED` 가 담기 버튼을 가른다(**2겹**).

⛔ **둘 다 켜기 전 조건은 `docs/STAGING_CHECKLIST.md` 의 S-CART 15항목(실결제)이다.**
이 세션은 **실결제를 못 했다**(진짜 카드가 필요하다). 그래서 코드·가드·손잡이까지만 준비했다.

## 완료분

| 무엇 | 왜 |
|---|---|
| 🔴 **교환권(딜) ↔ 이용권(카드) 분리** — 클라 `classifyCart` + 서버 `cart-lines.ts` | **머니 버그였다.** 둘 다 "배송 없음"이라 한 덩어리로 갈렸고, 13,500딜짜리 교환권이 카드 레일로 갔다 |
| 🔴 **요약이 딜과 원을 안 더한다** — `CartSummary` 두 줄 + CTA 통화 분기 | 라이브 번들 렌더에서 총액이 **88,000원 = 74,500원 + 13,500딜** 이었다. 어디서도 청구되지 않는 금액 |
| 섞였으면 **누르기 전에** 말한다 — CTA 비활성 + 이유 문장 | 종전엔 "N원 주문하기" 로 보이고 누른 뒤 모달로 거절했다 |
| `voucher_cart_enabled` **OPS_GATES 등재 + 어드민 손잡이** | 만들 때 빠뜨려 **어드민에서 켤 화면이 없었다** |
| `check-gate-registry` 에 **바인드+이름상수** 탐지 추가 | 그 게이트를 스캐너가 못 본 이유. `const GATE_KEY` + `.bind(GATE_KEY)` 형태를 통째로 놓쳤다 |
| S-CART-13·14·15 추가 + 인덱스 표에 S-CART 행 | 켜려는 사람이 읽을 절차 |

가드: `voucher-cart-checkout-2026-09-15.test.ts`(+⑦ 12건) · **신규** `cart-deal-vs-won-2026-09-15.test.tsx`(11건, **렌더해서 잰다**) · `gate-registry-and-display-2026-09-07.test.ts`(+1).
주입: `cart-deal-vs-won.mjs`(11) + `voucher-cart-checkout.mjs`(+4) — **전부 되돌려-검증 빨간불 확인**.

## 이번에 틀렸던 판단 — 이게 제일 값지다

1. **"둘 다 배송이 없다"를 "같은 결제 수단"으로 읽었다.** `isNoShippingProduct` 하나로 갈랐는데
   그건 *배송비* 판정이지 *결제 수단* 판정이 아니다. `/checkout` 은 교환권만 담기면 이미
   **딜 모드를 강제**하고 있었는데(2026-05-21) 새 레일이 그 처리를 물려받지 않았다.
   ⇒ 기존 화면이 *이미 하고 있던 분기*를 새 경로가 승계했는지 반드시 확인할 것.
2. **테스트 39건이 전부 초록인데 화면이 틀렸다.** 소스 문자열로 재고 있었고 `deal_only` 라는
   낱말은 그 파일들 곳곳에 있다. **라이브 번들을 실제로 렌더해서야** 보였다
   (`scratchpad/cart-shot2.mjs` — `dist/client` 를 로컬에 띄우고 `/api/cart` 를 목으로 채운다).
   ⇒ 금액이 화면에 찍히는 변경은 **렌더 테스트**로 재라(그래서 신규 가드는 `render()` 를 쓴다).
3. **렌더 하네스가 3/5 에서 "로그인이 필요합니다" 로 떨어졌다.** 원인은 목 누락이 아니라
   **401 인터셉터**다 — `/api/auth/session/health` 가 라이브로 새어 나가 `session:false` 를 받고
   `clearAuthData('user')` 를 돌린다. 그 엔드포인트까지 목해야 한다.
4. **첫 로드에 이미 전체 선택돼 있다**(`selectionInitedRef`). 하네스에서 "전체선택"을 누르면
   오히려 **해제**된다 — 0/3 을 보고 클릭이 안 먹은 줄 알았다.

## 🩸 CI 함정 — **충돌이 있으면 Verify 가 빨간불이 아니라 *아예 안 뜬다*** (2026-09-15)

PR #1447 에 `Cloudflare Pages` 하나만 붙고 **Verify 가 없었다.** 빨간불이 아니라 부재다 —
이 레포가 반복해 당하는 클래스라 한참 원인을 헤맸다.

**진짜 원인**: `pull_request` 이벤트는 GitHub 이 *head 를 base 에 병합한 커밋* 위에서 돈다.
그 병합이 안 되면(`mergeable_state: "dirty"`) **run 자체가 만들어지지 않는다.**
푸시를 두 번 더 해도 마찬가지였다. `origin/main` 을 머지하니 즉시 Verify 가 붙었다.

🩸 **내가 처음 내린 진단은 틀렸다.** *"오늘 `verify.yml` 에서 `push:` 를 뺀 부작용이라
push → PR open 순서에서 어느 이벤트도 run 을 안 만든다"* 고 적고 그 내용으로 커밋까지 했다.
그럴듯했지만 **재현이 안 됐다** — 그 가설대로면 그다음 푸시(synchronize)에서는 돌았어야 했는데
안 돌았다. 그 불일치를 무시하지 말았어야 했다.

⇒ **다음 세션의 판정 순서**: Verify 가 안 보이면 먼저 `pull_request_read method=get` 으로
`mergeable_state` 를 본다. `dirty` 면 머지가 답이고, 토큰·트리거를 의심할 일이 아니다.
(참고: `actions_run_trigger`(workflow_dispatch)는 앱 토큰 권한 밖 — **403**. 수동 킥은 불가.)

## 남은 결정 / 대기

- ⛔ **S-CART 15항목 staging 실결제** — 대표 몫(진짜 카드 필요). 특히 S-CART-2(서로 다른 매장 2종
  발급) · S-CART-3(셀러별 정산) · **S-CART-13(교환권 거절)**.
- 켜는 순서: **① 서버 게이트(어드민, 즉시·배포 불필요) → ② `VOUCHER_CART_UI_ENABLED`(코드+배포)**.
  ①만 켜면 담기 버튼이 없어 신규 유입이 0 이라 **막다른 길이 안 생긴다**.
  ②만 켜면 담기는 되고 결제가 403 — 그 상태로 배포된 적이 있다(같은 날 수리).
- 롤백: 어드민에서 `voucher_cart_enabled = 'false'` — 두 엔드포인트가 즉시 403. **1초.**
