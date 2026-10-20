# 2026-09-02 — 리뷰 자격: 이용권은 "사용한 사람만" (별도 브랜치)

**레일**: 🎟️ 유어딜(소비자) · **머니 경로**: 없음(결제·정산·원장 무접촉 — 단, 리뷰 **리워드 딜 지급 조건**이 바뀐다) · **롤백**: `reviews.routes.ts` 의 `checkReviewEligibility` 호출 블록 제거 + `review-eligibility.ts` 삭제

대표 *"리뷰는 이용권 사용한 사람만 쓸 수 있게끔 되어있지?"* → **아니었다**. 게이트는 '구매'(orders.status)만 봤고, 이용권은 결제
즉시 DONE 이라 매장에 가기 전에도 리뷰·리워드가 났다. 사용 기록(`vouchers.status='used'`)은 있었는데 리뷰가 안 봤다.

**수정** (`src/features/reviews/api/reviews.routes.ts`):
- 종류 판정 = 결제수단 SSOT `getProductFlow` (카테고리 이름으로 안 가른다 — CLAUDE.md 🚦 절의 함정).
- 이용권(`group_buy_toss`): `vouchers WHERE product_id·user_id·status='used'` 1장 이상. 없으면 403 `VOUCHER_NOT_USED`
  "이용권을 사용한 뒤에 리뷰를 쓸 수 있어요". 리워드 주문 = 사용한 그 장의 `order_id`.
- 교환권(`voucher_deal`)·쇼핑: 종전 구매 게이트 그대로. 어드민 예외·셀러 self-review 차단 불변.
- 클라(`ProductReviews.tsx`): `VOUCHER_NOT_USED` 도 서버 문구 그대로 토스트(기존 403 분기에 code 추가만).

**가드**: `review-requires-voucher-use.test.ts` 4건 + 주입 1건(되돌려-검증 빨간불 확인).
**staging**: `docs/STAGING_CHECKLIST.md` **P13** — 사용 전 403 + 리워드 0 / 사용 후 등록 + 리워드 1회.

**다음 세션 첫 액션**: 배포 후 이용권을 사서 **사용 전** 리뷰 → 403 문구, 매장 사용 후 → 등록·리워드 1회. 교환권 리뷰가 여전히 구매만으로 되는지 1회.
**Notion**: 기록 완료(개발 업데이트 로그, 2026-09-02 — 1차 #1314 분).

---

## 2차 (같은 날) — 라이브 실측으로 드러난 자기 결함 3건 + 주입 지도 10건 복구

대표 *"확인 안된 것 여기서 자세히 알려줄래?"* → *"모두 진행해"*. 브랜치 `claude/review-gate-voucher-category`.

### 🩸 내가 낸 결함 — 배송 상품 8개의 리뷰가 **영구 차단**돼 있었다

라이브 D1(읽기 전용)로 게이트 대상 348개를 세어 보니 **340개는 이용권 카테고리인데 8개가 아니었다**:
id 6 Canvas Tote Bag(living) · 2306 테스트(living) · 2682~2687 판매자 5의 식품 6종(한우 등심·참기름·명란젓·어묵탕
밀키트·쌀조청·갈치). 원인은 `group_buy_status` 다 — migration 0146 이 **모든 상품에 DEFAULT 'active'** 를 박아서
결제수단 판정(`getProductFlow`)만으로는 배송되는 물건까지 이용권으로 분류된다. 배송 물건은 매장에서 쓸 일이
없어 `used` 가 될 수 없고 ⇒ 구매자가 리뷰를 **영영 못 쓴다**.

⇒ 판정에 **수령 방식**(`isVoucherCategory`)을 AND 로 더했다. CLAUDE.md 🚦 절의 *"카테고리 이름으로 딜 결제를
가르지 말 것"* 은 **결제수단** 판정 이야기고, 여기서 필요한 건 결제수단 **and** 수령 방식이다 — 둘 다 봐야 맞다.

### 나머지 2건

- **user_id 정규화 불일치** — 발급(`group-buy.routes`)은 `resolveUserIdString` 로 쓰는데 내 조회는 `String(user.id)`
  였다. 카카오 세션(isDbId)에서는 같은 값이라 라이브 영향은 없었지만, 갈리는 계정에선 자기 이용권을 못 찾아
  **매장에 다녀온 사람이 "다녀오세요" 를 본다**. 같은 헬퍼로 통일.
- **조회 실패가 자격 없음으로 위장** — `.catch(() => null)` 이라 테이블 부재·일시 오류가 403 "이용권을 사용한 뒤에"
  로 나갔다. try/catch 로 갈라 **503 `REVIEW_ELIGIBILITY_UNAVAILABLE`**("지금은 리뷰를 등록할 수 없어요").

### 🧬 곁다리로 드러난 것 — 주입 지도가 **10건을 조용히 잃고 있었다**

이 브랜치의 주입을 등록하려고 `check-guard-mutations.mjs` 를 열었더니, 엔트리 하나가 **앞 항목과 한 객체로 융합**
돼 있었다. JS 객체 리터럴은 같은 키가 두 번 나오면 **뒤엣 것이 이기고 앞 항목은 통째로 사라진다** — 문법 오류도
카운트 경고도 없다. 세어 보니 main 에 **10건**이 그 상태였다(배열은 694개가 도는데 지도에는 704개).
이 파일 주석에 남은 *"2026-08-17 병합 사고 흔적"* 이 같은 사고의 1건째였다 — 즉 **재발이고, 아무도 못 봤다.**

- 10건 전부 갈라서 되살렸고, **각각 되돌려-검증을 돌려 10건 모두 실제로 빨간불이 되는 것을 확인**했다.
- 그중 `📱 xl 전용 레일` 은 되살리자마자 **낡은 지도**로 드러났다(표적 `LinkshopVisitorRails` 는 09-02 에 삭제됨).
  같은 불변식을 남은 레일(`ConsumerFrameRails`)로 표적 교체.
- **재발 차단**: `check-guard-mutations.mjs` 에 **자기 무결성 검사** 신설 — 자기 소스를 파싱해 한 객체에 같은 키가
  두 벌 있으면 즉시 실패(+ 소스 객체 수 ≠ 배열 길이도 실패). 모든 모드(`--map-only` 포함)에서 먼저 돈다.
  ⚠️ `MUTATIONS.length` 로는 **절대 못 잡는다** — 융합된 항목은 애초에 세어지지 않는다. 그래서 텍스트를 본다.
  되돌려-검증: 융합을 일부러 재주입 → 빨간불 확인 후 복원.

### 곁다리 2 — 판정을 모듈로 뺐다

수리를 얹으니 `reviews.routes.ts` 가 618줄이 돼 **600줄 래칫**에 걸렸다(CLAUDE.md 🧱). 판정 본체를
`src/features/reviews/api/review-eligibility.ts`(98줄, `checkReviewEligibility`)로 분리 — 라우트 561줄.
⚠️ 분리의 대가는 **배선이 눈에 안 보인다**는 것이라, 주입을 하나 더 얹었다(`if (!verdict.ok)` → `if (false)`):
호출은 남고 판정만 죽으면 게이트가 통째로 사라지는데 에러도 로그도 없다.

### 검증

`tsc 0` · `review-requires-voucher-use.test.ts` 7건 pass(새 계약 3건 각각 되돌려-검증 빨간불 확인) ·
`guard-mutations --map-only` 708건 성함 · 리뷰 주입 5건 빨간불 · 복구 10건 개별 빨간불 ·
guard-registry 121 · file-size OK(561줄) · sql bind/column/table 0 · 주입 잔재 0.

### 못 한 것

`vouchers` 테이블에 **`used` 행이 하나도 없다**(전체 1행, 그것도 expired). 즉 "사용 → 리뷰 열림" 경로는
**프로덕션에서 한 번도 실행된 적이 없다.** 이 브랜치도 그 경로를 코드로만 검증했다 —
`docs/STAGING_CHECKLIST.md` **P13** 가 여전히 유일한 실증 수단이고, 실구매가 필요하다.

**Notion**: 1차(#1314) 기록 완료. **2차(#1324)는 머지 후 기록** — 아직 드래프트다.
