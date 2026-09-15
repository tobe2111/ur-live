# 🧺 장바구니 켜기 — 머니 버그 수리 + 딜/원 분리 + 게이트 등재 (2026-09-15)

대표: *"장바구니 켜줘 최대한 다 끝까지 다 해줘. 장바구니 페이지 시안도 궁금하고"*

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

## 🩸 CI 함정 하나 — **PR 을 push 뒤에 열면 Verify 가 안 돈다**(2026-09-15 신규)

같은 날 `verify.yml` 에서 `push:` 트리거를 뺐다(취소된 push-run 이 필수 검사 실패본으로 남아
머지를 막던 문제 — 그 결정 자체는 근거가 있다). 그 부작용이 이 PR 에서 처음 드러났다:

```
git push (새 브랜치)        → push 이벤트로는 이제 run 이 안 생긴다
PR 을 MCP 로 open           → pull_request(opened) 가 run 을 안 만들었다 (실측)
결과                        → PR 에 `Cloudflare Pages` 하나뿐. **Verify 가 아예 없다**
```

이 레포가 반복해 당하는 **"실패가 아니라 조용한 부재"** 다 — 빨간불이 아니라 검사가 없다.
필수 검사라 머지는 막히니 위험하진 않지만, 모르면 "왜 CI 가 안 끝나지" 로 한참 기다린다.

**대처**: `actions_run_trigger`(workflow_dispatch)는 **403**(앱 토큰 권한 밖). ⇒ **커밋을 하나 더
밀어 `synchronize` 를 일으키는 것이 유일한 방법**이다. 그러니 **PR 을 먼저 열고 그다음에 푸시**하거나,
푸시 뒤 PR 을 열었다면 **Verify 가 붙었는지 확인**할 것(`pull_request_read method=get_check_runs`).

## 남은 결정 / 대기

- ⛔ **S-CART 15항목 staging 실결제** — 대표 몫(진짜 카드 필요). 특히 S-CART-2(서로 다른 매장 2종
  발급) · S-CART-3(셀러별 정산) · **S-CART-13(교환권 거절)**.
- 켜는 순서: **① 서버 게이트(어드민, 즉시·배포 불필요) → ② `VOUCHER_CART_UI_ENABLED`(코드+배포)**.
  ①만 켜면 담기 버튼이 없어 신규 유입이 0 이라 **막다른 길이 안 생긴다**.
  ②만 켜면 담기는 되고 결제가 403 — 그 상태로 배포된 적이 있다(같은 날 수리).
- 롤백: 어드민에서 `voucher_cart_enabled = 'false'` — 두 엔드포인트가 즉시 403. **1초.**
