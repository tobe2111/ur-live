# 유어샵 카톡 공유 카드 — 새까맣던 것 (2026-09-28)

대표가 카톡 스크린샷을 보내며: ***"카카오로 링크 공유했는데 이 형태 너무한데?"***
(`urdeal.kr/u/jiwon1228` 공유 카드가 글자 몇 줄만 있는 까만 판)

## 1. 원인 — 둘이 겹쳤고 **둘 다 에러를 안 낸다**

라이브 SVG 를 직접 받아 보고 확정했다. 카드는 멀쩡히 생성되고 있었다.

```
GET /api/og/curator/jiwon1228 → 200, 1,826 B
  <image> 4개(프로필 1 + 핀 3) 전부 들어 있음
  href: https://media.ur-team.com/… · /api/media/…
```

① **사진을 SVG **바깥**에서 불러왔다.** 카카오 스크래퍼는 SVG 를 그림으로 굽기만 하고
   **그 안의 외부 하위 리소스는 가져오지 않는다** → 렌더된 카드에 사진 0장.
② **안 그려진 자리가 티도 안 났다.** 바탕 `#11141C` 과 빈 칸 `#1D1F29` 이 거의 같은 검정.

⇒ 사진이 다 빠진 채로 "원래 저런 디자인" 처럼 보였다. 공유해 본 사람만 아는 종류다.

## 2. 수정

| 무엇 | 파일 |
|---|---|
| 사진을 **카드 안에** 박는다(`data:` URI, cdn-cgi 로 작게 받아 base64) | `src/worker/utils/og-inline-image.ts` (신규) |
| 카드 재설계 — 흰 면 + 브랜드 블루 밴드, 타일이 줄을 꽉 채움 | `src/worker/utils/og-curator-card.ts` (신규, 라우트에서 분리) |
| 라우트 배선(프로필 + 타일 인라인, 받는 크기를 카드와 같은 식으로) | `src/worker/routes/og-image.routes.ts` |
| og:image 주소에 `?v=2` — 카카오 스크랩 캐시 무효화 | `src/worker/index.ts` |
| 가드 13건 + 주입 12건 (전부 빨간불 확인) | `…/ushop-og-card-2026-09-28.test.ts` · `scripts/mutations/ushop-og-card.mjs` |

**왜 흰 카드인가**: 카톡 대화방은 대개 어둡다. 다크 카드는 배경에 묻혀 "링크가 깨진 것처럼" 보인다.
🎫 디자인 시스템의 화이트 면 + 브랜드 블루 밴드(티켓 은유)를 따랐다.

**사진 0장이어도 멀쩡하다** — 빈 칸 4개 대신 타일 줄을 통째로 빼고 신원 블록을 가운데로 키운다.
스크래퍼가 사진을 못 받는 날은 반드시 오고, 그때가 종전 카드의 모습이었다.

## 3. 검증

- **네트워크를 완전히 끊고** 브라우저로 렌더 → 사진이 나온다(= 인라인이 실제로 먹었다는 증거).
  사진 있음 / 없음 / 긴 이름 3종 모두 눈으로 확인.
- tsc 0 · 신규 13건 pass · 주입 12건 전부 빨간불.
- 🩸 **주입 러너가 내 가드의 헛돎을 하나 잡았다**: `hasTiles = true` 로 뒤집어도 빈 칸이 안 생겨서
  통과했다(빈 타일을 그리는 코드가 이미 없으니 당연). 주입을 **진짜 옛 결함**(타일 배열을 4개로
  패딩)으로 재조준해 빨간불 확인. *검사가 무엇을 재고 있는지 매번 의심할 것.*

## 4. 다음 세션의 첫 액션 — 배포 후 판정

```
1) curl -s 'https://urdeal.kr/u/jiwon1228' -A 'Kakaotalk-scrap' | grep og:image
   → …/api/og/curator/jiwon1228?v=2   (?v=2 가 없으면 배포가 안 된 것)
2) curl -s 'https://urdeal.kr/api/og/curator/jiwon1228?v=2' | grep -o 'href="[^"]*"' | cut -c1-30
   → 전부 `href="data:image/jpeg` 여야 한다. `href="http` 가 하나라도 있으면 실패.
3) 대표가 카톡에 다시 공유 → 사진이 보이는지. ⚠️ 카카오 캐시 때문에 **기존 채팅방의 옛 카드는
   그대로 남는다**(회수 불가). 새로 공유한 것만 새 카드다.
```

## 5. 남은 것

- **`/api/og/group-buy/:id` 에 같은 결함이 남아 있다**(`<image href>` 외부 참조). 다만 이용권 상세
  페이지의 og:image 는 **상품 사진 원본 URL 직접**이라 카톡에서 잘 뜨고, 그 SVG 라우트를 og:image 로
  쓰는 페이지가 **하나도 없다**(실측). 그래서 이번 범위에서 뺐다 — 쓰기 시작하면 같이 고칠 것.
- 폰트: 이 컨테이너 렌더에서 라틴이 세리프로 떨어졌다. 카드를 굽는 건 **카카오 쪽 렌더러**라
  우리가 폰트를 못 고른다 → 스택을 한글 폰트 → Arial → sans-serif 로 **명시**해 뒀다(최선).

---

# 🎟️ 이용권 일부 환불 (같은 날, 별건 — 머니 경로)

대표: ***"일부 환불 가능하게 해줘."*** 결재 기록: `docs/decisions/2026-09-28-voucher-partial-refund.md`.

## 설계 — 금액이 아니라 **장 단위**

`shared/partial-voucher-refund.ts` 머리말이 SSOT. 요지: 45,000원 3장에서 7,000원을 무르면
**몇 장을 회수할지 답이 없다** → 종전 코드는 한 장도 회수 안 했다 → 키만 채워 길을 열면
"총액 −1원 넣고 이용권 3장 그대로" 가 된다. ⇒ 장수만 받고 **금액은 서버가 계산**한다.

## 완료분 (전부 게이트 `voucher_partial_refund_enabled` 기본 OFF)

| 무엇 | 파일 |
|---|---|
| 장수 → 회수할 장·금액 계산(순수) | `src/shared/partial-voucher-refund.ts` 🆕 |
| 실행(CAS 선점 → 토스/딜 → 무른 장만 회수 → 혼합딜 비례) | `src/worker/utils/voucher-partial-refund.ts` 🆕 |
| 회수를 **특정 장으로 한정**(additive 인자) | `voucher-settlement-clawback.ts` |
| 라우트 위임 2줄 + `cancel_qty` | `worker/routes/order.routes.ts` |
| 손님 화면 — 이용권이면 장수 입력 | `MyOrdersPage.tsx` · `my-orders/CancelOrderModal.tsx` |
| 게이트 토글 + OPS_GATES + 값 검증 | `money-switch-fields.ts` · `admin-system-monitoring.routes.ts` · `platform-settings-validation.ts` |
| 가드 17건 + 주입 15건 | `voucher-partial-refund-2026-09-28.test.ts` · `scripts/mutations/voucher-partial-refund.mjs` |

## 🩸 이번에 틀렸던 판단

1. **"손님이 환불 버튼을 눌러도 안 된다"** — 아니다. **전액 취소는 이미 잘 된다**(`refundOrderFully` 경유).
   근거로 삼은 400 은 `POST /api/orders/refund` 에 있는데 **앱에서 아무도 안 부른다**(주석이 가리키는
   `useOrder.ts` 는 없는 파일). 문서를 옮기고 호출부를 확인하지 않은 오류 — 대표께 두 번 잘못 보고했다.
2. **주입 러너가 내 가드 둘을 헛돈다고 잡았다** — 하필 제일 중요한 둘이었다:
   ⓐ 게이트 — 함수 *존재*만 검사해서 **호출을 지워도 초록**이었다 → 호출 형태(`if (!(await …))`)로 앵커 교체.
   ⓑ 선점 순서 — SQL 문자열의 **위치**만 봐서 결과를 안 쓰는 변수에 담아도 초록 → `const reserve = await`
     + `reserve.meta.changes` 분기까지 검사.
   *"검사가 무엇을 재고 있는지"* 를 매번 의심할 것.
3. `order.routes.ts` 가 동결선(1346)보다 **5줄 많다**. 위임 2줄 + import 1줄이 정당한 증가라
   `[SKIP_SIZE]` 로 넘겼다 — 다음에 이 파일을 만지는 세션은 줄이고 `--rebaseline` 할 것.

## 다음 세션의 첫 액션 — **staging 실결제 P17** (대표 카드 필요)

`docs/STAGING_CHECKLIST.md` P17 에 절차와 판정 기준이 있다. 요지: 3장 사서 1장 쓰고,
게이트 OFF 에서 403 → ON 에서 1장 환불 → **그 1장만** `refunded` 이고 나머지 2장 `unused`.
**통과 전에는 게이트를 켜지 않는다.**

## 남은 것
- **커미션 비례 역전 없음**(의도). 무른 장의 어필리에이트·영입 몫이 남는다 — 적게 회수하는 쪽.
- 손님 화면이 **남은 장수를 미리 모른다**. 서버가 clamp 하고 응답의 `refunded_qty` 로 알려 준다.
  불편하면 `GET /api/orders/:id/refundable-vouchers` 같은 작은 조회를 붙이는 게 다음 후보.
