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

## 🧱 2026-08-31 후속 — 파일크기 래칫에 걸려 재배정 핸들러를 SSOT 로 합쳤다

**CI 가 잡은 것**: `admin-sellers.routes.ts` 1078줄 → 1091줄. 래칫은 "줄이는 건 OK, 키우는 건 차단"이라
rebaseline 이 아니라 **분리**가 답이다.

**그런데 줄 수 때문에 쪼갠 게 아니다.** 열어 보니 `reassign-agency` 와 `reassign-influencer` 가
존재확인 테이블·컬럼 이름만 다르고 나머지(낙관적 잠금·상호배제·감사로그·409)가 **글자 단위 복제본**이었다.
**이 PR 이 고친 버그가 정확히 그 복제 때문에 생겼다** — 2026-08-26 에 "영입자는 신분이 아니라 행위"로
바뀌면서 네 곳이 `users.id` 로 옮겨갔는데, 복제본 한쪽만 `sellers` 에 남았다.

⇒ `src/features/admin/api/admin-sellers/reassign-introducer.ts` 하나로 합치고 라우트는 위임만 한다.
956줄(−135). 가드에 **위임 고정** 단언을 추가했다(복제본이 다시 생기면 빨간불).

### 합치면서 고친 것 하나 더

분리 전 코드는 `new_influencer_id` 필드가 **빠지면** `undefined` 를 그대로 bind 해 D1 이 던졌다(500).
그걸 무심코 `null` 로 접으면 **오타 한 번에 영입자가 해제**된다(붙어 있던 2% 가 사라짐).
그래서 **필드 없음 = 400** · **명시적 null = 해제** 로 갈랐다. 화면(`IntroducerAssign`)은 항상 필드를
보내므로 영향 없고, `reassign-agency` 는 프런트 호출자가 아예 없다.

### 이번에 헛돌 뻔한 검사 (다음 세션 참고)

`button-system.test.ts` 가 로컬에서 빨간불이었는데 **내 변경과 무관**했다 — 4일 전(08-27) `dist/` 잔재를
읽고 있었다. 새로 빌드하니 통과. 그런데 **CI 에서는 이 검사가 실패할 수 없다**: 유닛테스트가 step 5,
`Build client` 가 step 96 이라 그 시점엔 `dist/` 가 없어 `if (!f) return` 으로 빈다.
레포가 반복해 당한 "가드가 실패할 수 없음" 클래스다. 이 PR 범위 밖이라 별도 과제로 남긴다.

### 검증

- tsc 0 · vitest 6,787 pass(537 파일, 위 잔재 1건 제외) · file-size GREEN(changed-only vs main)
- 주입 지도 585건 성함 · **주입 3건 빨간불 확인 후 복원**
  (users→sellers 되돌림 / 확인 없이 지정 / **라우트가 반대편 종류로 위임**)
