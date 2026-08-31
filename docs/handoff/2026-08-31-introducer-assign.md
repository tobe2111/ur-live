# 2026-08-31 — 영입자 지정 UI + **id 공간 불일치 수리**

> ⛓️ 이 브랜치는 `claude/store-card-channel`(PR #1261) 위에 쌓였다 — 같은 매장 카드에 붙는다.
>   #1261 을 먼저 머지할 것.

## 대표 지시
> "응 그러자 해줘" — 영입자 지정 UI 를 지금 붙인다(영입 2% 까지 한 번에 QA 하려고).

## 🩸 화면을 붙이려다 **머니 버그**를 찾았다

`sellers.introduced_by_influencer_id` 를 **다섯 곳이 쓰는데 한 곳만 뜻이 달랐다.**

| 곳 | 무엇으로 보나 |
|---|---|
| 적립 `influencer-store-intro-commission` | **users.id** (`orders.user_id` 와 직접 비교 — 본인구매 가드) |
| 지급 `marketing.routes /payouts/process` | **users.id** (`creditFreePoints({ userId })`) |
| 조회 매장 카드 GET | **users.id** (`LEFT JOIN users u ON u.id = ...`) |
| 등록 귀속 `seller-stores.routes` | **users.id** (`SELECT id FROM users`) |
| **어드민 재배정 `reassign-influencer`** | **sellers.id** ❌ |

⚠️ **두 id 공간이 라이브에서 실제로 겹친다** — 셀러 3·5·6 ↔ 유저 3·5·6.
어드민이 그 API 로 셀러 5 를 영입자로 지정하면 2% 는 **유저 5** 에게 간다.
**에러가 안 난다.** 조회 화면도 `JOIN users` 라 "영입자 없음"처럼 보이거나 남의 핸들이 뜬다.

**왜 이랬나**: 2026-05-21 작성 당시엔 영입자가 셀러였다(`seller_type='influencer'`).
2026-08-26 *"신분이 아니라 행위"* 확정으로 유어샵을 연 누구나 영입자가 된 뒤 **이 자리만 안 따라왔다.**

**수리**: 검증을 `users` 로 맞췄다(나머지 넷과 같은 뜻). 에러 문구도 *"유저 id 를 입력하세요 — 셀러 id 가 아닙니다"*.

## 무엇을 만들었나

`src/pages/admin-merchant-commissions/IntroducerAssign.tsx` — 매장 카드 안.

- **확인 → 지정** 2단계. `GET /api/admin/users/:id` 로 이름·핸들을 보여 주고,
  **본 뒤에만** 지정 버튼이 열린다(`disabled={busy || !preview}`).
  id 공간이 겹치므로 번호만 보고 저장하는 길을 막는 것이 이 화면의 유일한 안전장치다.
- 사유 5자 이상 필수(기존 API 규칙 — 감사 기록에 남는다)
- 현재 영입자 표시 + 해제 버튼
- 안내에 **"직접 입점 매장에서만 지급"** 명시(#1254 규칙)

## 다음 세션 첫 액션 — QA 전체
1. 카카오 로그인 → 홍대돈까스(14) 운영권 → 이용권 1개 등록(금액 작게, **Toss 라이브 키**)
2. `/admin/merchant-commissions` → 매장 **14** → 채널 `direct` + 영입자 지정(유저 번호)
3. 결제 1건 → 원장 fee **10%** · `influencer_attributions` 에 **2% 1행**
4. 채널 `brokered` → 결제 1건 → fee **5%** · 영입 2% **미적립**(#1254)

## 못 막는 것
어드민이 옳은 번호를 넣는지는 코드가 못 막는다 — 화면이 "이 사람이 맞나요?" 로 보여 주는 것으로만 줄인다.
