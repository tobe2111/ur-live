# 사업자 유저 가입 화면 — 2차 시안 (2026-09-21, 라이브 실측 재작성)

대표: *"너무 복잡함, 심플하게. 시안 필요"* → *"더 대기업스럽게 완성도있게"* →
*"구현된 형태는 어떻지? 사업자한테 OCR로 받고 있나? 그런 것들을 전반적으로 모두 확인한 뒤에
시안 다시 만들어볼래? OCR이랑 그리고 카카오맵 혹은 네이버지도로 간편하게도 할 수 있잖아."*

→ **대표 확정: 안 B** (*"응 안 B로 하는데 OCR은 지금 안되는거야?"*) — 구현 완료.

어느 서비스인가: **유어딜**. 도매·공구 서비스·유어애즈 무접촉. 머니 경로 **없음**
(요율을 가르는 `store_channel` 은 종전 `stampSignupStoreChannel` 그대로 — 언제나 `direct`).

## 다음 세션의 첫 액션

1. **배포 후 E4 판정 한 번** — 이 컨테이너엔 카카오 JS 키가 없어 실제로 가게를 골라 볼 수 없었다.
   라이브에서 `/seller/register/supplier` → 가게 하나 고르기 → 가입 → 그 셀러의 메타 확인:
   ```sql
   -- D1 DB_MAIN (CLAUDE.md "Cloudflare API 접근" 절차로 토큰 취득)
   SELECT key, value FROM seller_meta WHERE seller_id = (SELECT MAX(id) FROM sellers)
     AND key IN ('store_lat','store_lng','kakao_place_id','kakao_category','store_address','store_phone');
   SELECT id, business_name, address, phone FROM sellers ORDER BY id DESC LIMIT 1;
   ```
   **좌표 두 줄이 있으면 통과** — 종전엔 가입 문으로 들어온 매장에 좌표가 **한 번도** 없었다
   (매장 등록 문으로 들어온 seller 14 만 갖고 있었다).
   ⚠️ `sellers.phone` 이 **담당자 휴대폰(010-)** 인지도 함께 볼 것 — 가게 유선번호로 덮이면 알림톡이 안 간다.
2. 실사진 OCR 실측(S-OCR-1, `docs/STAGING_CHECKLIST.md`)은 여전히 **0회**다 — 다른 세션의 항목이지만
   안 B 와 짝이라 같이 보면 좋다(사진이 사업자 3칸, 지도가 가게 3칸).

## 🔴 이번 실측이 뒤집은 것 — 1차 시안의 전제

1차는 *"다섯 칸은 국세청 자동 승인에 필요하니 유지"* 였다. **사실이 아니었다.**

```
sellers 4행:  representative_name 비어 있음 4/4 · business_start_date 비어 있음 4/4
              nts_verified_at NULL 4/4 · nts_verify_result NULL 4/4
```
재검증 라우트(`internal-admin-tools.routes.ts:1049`)는 그 두 칸이 비면
`대표자명 / 개업일 누락 — 재검증 불가` 로 되돌아온다 ⇒ **국세청 자동 승인은 0회.**

⚠️ `NTS_API_KEY` 설정 여부는 **확정 못 했다** — `/api/version` 의 시크릿 목록은 큐레이션된 고정 목록이고
`Env` 타입에도 선언이 없다(`c.env as {NTS_API_KEY?}` 캐스팅). 다만 전제 필드가 비어 호출 조건 자체가
성립하지 않으므로 결론은 같다. **다음 세션이 "키가 없다"로 단정하지 말 것.**

## 실측 요약

| 축 | 코드 | 라이브 |
|---|---|---|
| 카카오맵 | `KakaoMapPicker` 선택 1회 = **8필드** | 매장 등록 문은 8개 전부 저장. **가입 문은 주소 1개만**(`AddressPickerField:61`) |
| 가입 폼의 주소 | `sellers.description` 안 `[주소: …]` 텍스트 | **읽는 코드 0건**(쓰기 전용). 셀러 4/4 `description` 비어 있음 |
| 네이버 지도 | 지역검색 API 는 서버에 있음 | **호출부 0건.** 지도는 100% 카카오. 네이버는 이미지 검색만 |
| OCR | `ocr-license.ts`(`@cf/meta/llama-3.2-11b-vision-instruct`) | 🔁 **오전 측정은 뒤집혔다 — 아래 "이번에 틀렸던 판단" ②** |
| OCR 게이트 | `ocr_auto_verify_enabled` | `platform_settings` 에 **키 자체 없음** = OFF(fail-closed) |

### OCR 3건 원문 (`seller_meta.ocr_business_registration`)
- 15 `unreadable` fill 0
- 16 `mismatch` fill 0.75 — bizName=**이테스트**(대표자 이름) · ownerName=**신규**(발급 사유) · bizNumber **null** · permitDate **null**
- 17 `unreadable` fill 0

🔑 **입력은 완벽하게 깨끗한 합성 등록증이었다**(이미지를 직접 열어 확인 — `docs/design/assets/…/ocr-input.png`).
사진이 아니라 글자가 또렷한 렌더 문서인데도 **사업자번호·개업일을 3회 다 못 읽었다.**
⇒ 실사진은 더 나쁘다. **안 F 를 "곧 됩니다"로 말하지 말 것.**

⚠️ 09-19 handoff 가 이미 같은 실측을 부분적으로 했고(합성 5회 → `match` 0회, fill 평균 0.70),
수리 2건(빈응답 재시도·도로명 띄어쓰기)이 `a014de2` 로 배포됐으나 **수리 후 재측정은 아직 안 됐다.**
위 3건 중 2건(16·17)은 00:01, 1건(15)은 00:45 — 수리 배포 시점과의 선후는 확인하지 않았다.

## 완료분 (이번 세션)

| 무엇 | 파일 |
|---|---|
| 시안 세트 6안 **재작성**(지도 중심) | `src/pages/design-variants/sets/seller-signup.tsx` |
| 지도 부품 추가 | `src/pages/design-variants/sets/seller-signup-parts.tsx`(`MapSearchTile`·`PickedStoreCard`·`NotOnMap`·`NotYet`) |
| 시안 문서 재작성 | `docs/design/seller-signup-simplify-2026-09-21.md` |
| 폰 렌더 12장 + OCR 입력 1장 | `docs/design/assets/seller-signup-simplify-2026-09-21/` |
| 아카이브·갤러리 목록 | `docs/design/README.md` · `variant-gallery.md` |

시안의 가게 값은 **라이브 seller 14 의 실제 값**을 썼다(홍대돈까스 · 전주 덕진구 · 음식점 > 일식 > 돈까스,우동).

### 안 B 구현 (대표 확정 뒤)

| 무엇 | 파일 |
|---|---|
| 🔴 **뿌리 한 줄** — picker 가 place 객체를 통째로 올린다 | `src/pages/seller-register/AddressPickerField.tsx` |
| `PickedStore` 타입 + 카카오 업종 → 우리 8종 매핑(순수) | `src/shared/store-place.ts` (신규) |
| 고른 가게 카드 | `src/pages/seller-register/PickedStoreCard.tsx` (신규) |
| '가게 정보' 카드 분리(페이지 618 → 569줄, 래칫 600) | `src/pages/seller-register/StoreSection.tsx` (신규) |
| `pickStore()` + payload 에 좌표·place_id·업종 · `[주소: …]` 조립 제거 | `src/pages/SellerRegisterSupplierPage.tsx` |
| body 8키 수용 → `stampSignupStorePlace` | `src/features/seller/api/seller-registration.routes.ts` |
| `sellers.address`(비었을 때만) + `seller_meta`(매장 등록 문과 **같은 키**) | `src/features/seller/api/seller-signup-meta.ts` |
| `seller.signup.pickHint`·`pickPlaceholder` 6개 언어 | `public/locales/*/translation.json` |
| 가드 19건(소스 12 + 순수 3 + **실제 렌더 4**) | `src/tests/unit/seller-signup-store-pick-2026-09-21.test.tsx` |
| 주입 15건 | `scripts/mutations/seller-signup-store-pick.mjs` |

**덤으로 닫힌 것**: `kakao_place_id` 가 가입 문에서도 남아, 매장 등록 문의 중복 검사
(`seller_meta.kakao_place_id` 역조회 → `STORE_EXISTS`)가 같은 가게를 알아본다.
종전엔 가입 문으로 들어온 매장이 그 검사에 **보이지 않았다.**

## 이번에 틀렸던 판단

- **1차 시안 전체가 검증 안 된 전제 위에 있었다.** "국세청 자동 승인 때문에 다섯 칸" 이라고 문서와
  코드 주석이 말하길래 그대로 믿고 다섯 안을 그렸다. **라이브를 한 번도 안 봤다.**
  대표가 *"구현된 형태는 어떻지?"* 라고 물어서야 쟀고, 재 보니 0회였다.
  ⇒ **화면을 고치기 전에 그 화면이 만든 데이터를 먼저 볼 것.** 4행짜리 테이블이었고 5분이면 됐다.
- **"OCR 정확도 미실측" 이라고 문서에 적혀 있었지만 실제로는 결과가 남아 있었다.**
  `seller_meta` 에 3건이 저장돼 있다. 문서만 읽고 "미실측"으로 넘겼으면 안 F 를 낙관적으로 그렸을 것이다.
- 🔁 **② 그리고 그 OCR 결론이 반나절 만에 뒤집혔다 — 대표에게 "안 됩니다" 라고 말한 뒤에.**
  내 세 건은 **09:01·09:45 KST** 측정인데, 같은 날 오전에 다른 세션들이 수리를 셋 넣었다
  (`a014de2` 09:24 빈 응답 재시도 · `eebeb2c` 10:13 문자열 감싼 JSON · **`3d575e7` 11:17 #1491
  가입 전 OCR 통로 신설** · `532945e` 11:47 한 글자 오독 `near`). 같은 서류로 다시 재니
  **fill 1.0 이 3회 연속**이고 사업자번호·개업일·대표자가 전부 정확했다(상호만 한 글자 오독).
  🔴 **그런데 그 "3회 연속" 도 오판이었다** — 같은 날 12:4x 에 4회 더 재니 `match` 1 · `review` 1 ·
  **`unreadable` 2** 로 **회차마다 다르다**(절반은 아예 못 읽는다). 하루에 **두 번** 같은 실수를
  했다: 좁은 관측 창으로 단정한 것. ⇒ **OCR 은 "된다/안 된다" 가 아니라 "절반쯤 된다" 가 사실이다.**
  내가 "가입 전 OCR 통로가 없다" 고 문서에 적는 동안 **다른 세션이 그걸 만들고 있었다.**
  ⇒ **어제(심지어 두 시간 전) 측정을 오늘 사실로 말하지 말 것.** 세션이 여러 개 동시에 돈다 —
  보고 직전에 `git log origin/main` 을 한 번 보는 것으로 이 사고는 막을 수 있었다.
- **테스트 데이터로 결론을 낼 뻔했다.** 사업자번호가 `9999999991` 계열이라 합성인 건 금방 알았는데,
  거기서 멈췄으면 "합성이라 실패한 것"으로 오판했을 것이다. **이미지를 직접 열어 보니 반대였다** —
  실물보다 훨씬 쉬운 조건이었다. ⇒ 데이터가 가짜인지 판단하려면 **그 가짜가 쉬운지 어려운지**까지 봐야 한다.

## 검증 (E2)

- tsc **0** · `npm run build` **0**
- 가입 관련 유닛 **83건 pass**(신규 19 + 기존 64)
- 주입 **15건 신규 + 재조준분 전부 빨간불 확인**(`--only "가게고르기"` · `--only "가입C"`)
- 430px 실제 렌더로 '고르기 전' 화면 눈 확인(칸 순서·탈출구)
- ⚠️ **E4 아님** — 이 컨테이너엔 `VITE_KAKAO_JAVASCRIPT_KEY` 가 없어 **실제로 가게를 골라 볼 수 없다**
  (picker 가 직접 입력으로 떨어진다). 좌표가 `seller_meta` 에 남는지는 배포 후 §다음 세션의 첫 액션.

## 이 변경이 **못 하는 것**

- **두 문을 합치지 않는다.** `/store/new` 도 여전히 셀러를 만든다(가입=`linked_user_id` 있는 행,
  매장 등록=빈 행 + `seller_operators`). 중복을 줄일 뿐이다. 합치는 것은 **별건이고 등급이 다르다**(정산 귀속).
- **지도에 없는 가게는 좌표가 없다.** 카카오 키가 있으면 주소 칸이 버튼이라 직접 타이핑이 안 된다
  (종전과 동일). 그 사장님은 가게명만 적고 주소는 승인 후 프로필에서 채운다.
- **고른 가게가 진짜 그 사장님 가게인지 확인하지 않는다.** 그건 등록증과 사람이 대조하는 일이다(승인 큐).

## 🩸 같은 날 실측이 드러낸 것 둘 (이 PR 범위 밖, 다음 세션용)

### ① 서류 승인은 **한 번도 난 적이 없고**, 그게 막는 것은 판매가 아니라 현금 인출이다

라이브 실측(2026-09-21 12:4x KST):
```
sellers 7행:  status  approved 4 · pending 1 · suspended 2
              business_registration_status  ← 7행 **전원 pending**
              food_permit_url (영업신고증)   ← **0건**
```
- `status`(판매 승인)는 어드민이 손으로 누른다. **서류를 보지 않는다.**
  seller 14(유일한 실제 매장)는 `business_registration_image_url` 이 **비어 있는데 approved** 다.
- `business_registration_status`(서류 승인)가 막는 곳은 **현금 인출 한 곳**뿐이다
  (`seller-settlements.routes.ts:130` → 412 `BUSINESS_REGISTRATION_REQUIRED`) + 원천징수 면제 판정
  (`tax-withholding.ts:85`). 당근 모델 그대로다 — 들여보내고, 돈 나갈 때 막는다.
- ⇒ 두 승인이 **다른 것**인데 화면·문서가 그 차이를 말하지 않는다.

### ② 영업신고증 — ✅ **대표 확정 2건으로 정리됐다 (2026-09-21)**

> 1. *"1번은 알겠어. **판매 전으로 하자**."*
> 2. *"등록증이 없어도 **승인 되게끔 해줘**. 어차피 내가 보고 승인해야하잖아."*

**⇒ 보여 주되, 막지 않는다.** 판매가 시작되는 순간은 어드민이 승인 버튼을 누를 때이므로
그 화면에 서류가 보이게 하고, **코드로는 아무것도 잠그지 않는다.**

| 무엇 | 파일 |
|---|---|
| 업종 판정 SSOT(순수) — `needsFoodPermit(store_category, kakao_category)` | `src/shared/food-permit.ts` (신규) |
| 목록에 `food_permit_url`·`needs_food_permit` 얹기(같은 `getSellerMeta`, 쿼리 추가 0) | `seller-permit-flag.ts` |
| `/api/admin/sellers` 에 배선 | `admin-sellers.routes.ts` |
| 승인 카드의 영업신고증 칸 | `admin-seller-approval/FoodPermitBlock.tsx` (신규) |

🔴 **다음 세션에게**: 내가 *"승인 버튼이 서류를 보게 하자"* 고 제안했고 **대표가 기각했다.**
같은 제안을 다시 올리지 말 것 — 가드 ⑨⑩(`food-permit-before-sale-2026-09-21.test.ts`)이
그 회귀를 빨간불로 잡는다(주입 `🔴 승인 버튼이 서류로 막힌다`·`🔴 … "승인 불가" 라고 거짓말한다`).

⚠️ 법적 의무 여부(식품위생법)는 세션이 단정하지 말 것 — 대표·전문가 판단 영역이다.
`needsFoodPermit` 은 **화면에 한 줄 띄울지**를 고르는 휴리스틱이고, 틀려도 아무것도 안 막는다.

### 💰 OCR 비용 (2026-09-21 실측, Cloudflare GraphQL)

```
2026-09-21  @cf/meta/llama-3.2-11b-vision-instruct   호출 84회   뉴런 2,936.2
⇒ 호출당 약 35 뉴런
```
| | 호출 | 뉴런/건 |
|---|---|---|
| 종전 | 1~2 | 35~70 |
| **병렬 4회(읽히면 1라운드)** | 4 | **약 140** |
| 최악(2라운드) | 8 | 280 |

⚠️ **무료 할당량과 단가는 확인 못 했다** — `developers.cloudflare.com` 이 이 환경 프록시에서
차단(EGRESS_BLOCKED)이고, 요금제 조회(`/accounts/{id}/subscriptions`)는 토큰 권한 밖이다
(읽기 4종만 — CLAUDE.md 가 Edit 추가 요청을 금지). **대표가 대시보드에서 확인할 자리.**
세션이 기억으로 "10,000/일" 같은 숫자를 단정하지 말 것.

⚠️ **배포 후 재측정이 한도를 먹는다**: 20회 재측정 = 80회 호출 ≈ 2,800 뉴런.
오늘 이미 2,936 을 썼다 ⇒ **재측정은 10회로 줄이거나 날짜를 넘겨서** 할 것.

### 🩸 CI 가 잡은 것 — **코드를 바꾸면 기존 주입이 이빨을 잃었는지도 봐야 한다**

OCR 을 병렬로 바꾼 커밋에서 Verify 가 빨간불이었다. 실패한 건 **옛 주입**이다:
```
❌ 🙅 JSON 없는 산문 응답이 재시도 없이 unreadable 로 끝난다
   결함을 심었는데 테스트가 **통과** — 이 가드는 아무것도 안 지킨다
```
원인은 내 변경이었다. 병렬화하면서 `if (r.ok) parsed.push(r)` 게이트가 생겼고 **그게 산문을
어차피 걸러낸다**(파싱이 JSON 을 못 찾으면 `ok:false`). 그래서 옛 방어선(`isBlank`)을
무력화해도 동작이 같아졌다 — 그 주입은 더 이상 결함을 심지 못한다.

**퇴보가 아니라 구조가 그 실패 모드를 흡수한 것**이므로, 주입을 **지우지 않고 진짜 방어선으로
겨눴다**: 못 읽은 답이 `parsed` 에 들어가면 첫 라운드에서 `parsed.length === 0` 이 깨져
**두 번째 라운드를 못 돈다**(빈 응답이 절반인 모델에서 그 한 라운드가 전부다).
`isBlank` 주석에도 *"이제 정합성이 아니라 절약"* 이라고 못 박았다.

⇒ **새 주입만 검증하고 기존 것을 안 돌린 게 실수였다.** 코드 구조를 바꿨으면
`--only` 로 **그 파일을 겨눈 주입 전부**를 다시 돌릴 것(이번엔 9건).

### ⚠️ GitHub 이 run 을 안 만드는 일이 있다 (2026-09-21 실측)

수정 커밋 `6c33179` 을 푸시했는데 **`PR Verification` run 이 27분 동안 생기지 않았다.**
큐 지연이 아니다 — 그 커밋의 check-suites 에 **GitHub Actions 스위트 자체가 없었다**
(Render·Cloudflare·Claude 셋뿐). 같은 시각 다른 PR 들의 Verify 는 정상 생성됐다.

- `workflow_dispatch` 로 띄우려 했으나 **MCP·앱 토큰 둘 다 403**(이 세션은 워크플로를 못 띄운다).
- ⇒ 빈 커밋으로 흔들지 않는다(CLAUDE.md 금지). **실제로 필요한 커밋**(이 기록)으로 재발화시킨다.
- 다음 세션이 같은 걸 만나면: 먼저 `commits/<sha>/check-suites` 로 **Actions 스위트가 있는지**
  확인할 것. 없으면 큐 지연이 아니라 이벤트 누락이다.

### 🩸 오늘 세 번 같은 실수를 했다 — 시험이 **키 이름만** 셌다
`payload 에 store_phone 이 있나` · `다수결이 정답을 고르나` · `needs_food_permit 을 얹나` —
셋 다 **이름이 소스에 남아 있으면 통과**했고, 값을 통째로 무력화해도 초록이었다.
주입이 셋 다 잡았다. ⇒ **이름이 아니라 값의 출처**(`= needsFoodPermit(`)를 앵커로 쓸 것.

## 🎲 OCR 안정화 (대표 *"너가 완벽히 처리 후에 자동 승인 게이트 켤게"*)

### 20회 실측이 문제를 둘로 갈랐다
```
빈 응답             10 / 20  (50%)   ← 순차 재시도 1회를 **이미 쓴 뒤**의 숫자
읽혔을 때 사업자번호   9 / 9   (100%)
읽혔을 때 개업일      9 / 9   (100%)
읽혔을 때 대표자      9 / 10
읽혔을 때 상호        3 / 9          ← 오독 (`클`→`글`)
```
⇒ **값 정확도가 아니라 읽히느냐가 전부다.** 그리고 가입 폼이 채우는 세 칸은 읽히면 사실상 완벽하다.
상호 오독은 남지만 **가입 화면에서 상호는 지도가 준다**(안 B) — 실질 영향이 작다.

### 처방
- **병렬 4회 × 최대 2라운드.** 순차 2회에 50% 빈손 = 단발 성공률 약 29%(0.71²≈0.5).
  순차로 한 자릿수까지 내리려면 8회쯤인데 사장님이 8배를 기다린다. 병렬이면 지연은 1회분.
  산술 기대: (0.71⁴)² ≈ **6%**.
- **필드별 다수결**(`mergeOcrResults`, 순수). 공백을 지워 묶는다 —
  `전북 특별자치도`(4회) + `전북특별자치도`(3회)는 같은 답이고, 묶어야 오독을 이긴다.
- **영문 필드명 필터**(`looksLikeFieldName`). 실측 1회에 `"address":"business_location"`.
  언더스코어를 **요구**해 영문 상호(`GS25`)는 살린다.
- 파싱을 `parseOcrText`(순수)로 분리 — 네트워크 없이 시험한다.

### ⚠️ 판정은 배포 후다
여기서는 가짜 모델을 쓴다. **배포 후 같은 방법으로 20회 재측정**해 빈손률이 50% → 한 자릿수인지 본다:
```bash
# CLAUDE.md 어드민 절차로 $TOK 취득 후
for i in $(seq 1 20); do curl -sS -X POST \
  "https://live.ur-team.com/api/admin/sellers/15/business-registration/ocr" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  -H 'Content-Type: application/json' --data '{}' \
 | python3 -c "import sys,json;d=json.load(sys.stdin);e=d.get('extracted') or {};print(d.get('verdict'),e.get('fill'),e.get('bizNumber'),e.get('permitDate'))"; done
```
⚠️ **동시 4회가 모델 레이트리밋을 치는지**도 함께 볼 것(`읽기 실패:` 메시지가 늘면 그 신호다).
그러면 `OCR_PARALLEL_ATTEMPTS` 를 2~3 으로 내리고 `OCR_ROUNDS` 를 올린다.

### 🩸 이번에도 내 시험이 한 번 헛돌았다
다수결 픽스처에서 **우연히 첫 답이 정답**이라, 그룹핑을 통째로 꺼도 초록이었다
(주입 `🗳️ 다수결이 그냥 첫 답을 고른다` 가 잡았다). **병렬이라 응답 순서가 보장되지 않는데**
순서에 기댄 픽스처를 썼다 → 오독을 첫 자리에 둔 케이스(⑭-2)를 추가.

## 남은 결정 (대표)

1. **국세청 확인을 살릴 것인가** — 살리면 안 E(대표자명·개업일이 실제로 일하게 된다).
   지금 그 두 칸은 OCR 이 채우지만 **아무도 안 읽는다**(자동 승인 0회). 안 B 와 충돌하지 않는다.
   살리려면 `NTS_API_KEY` 설정 여부 확인이 선행.
2. **등록증 읽기를 더 올릴 것인가** — 지금 모델로 **상호 한 글자**가 남아 `match` 가 안 나온다
   (= 자동 승인 게이트에 못 올린다). 네이버 클로바 OCR 은 사업자등록증 **전용 템플릿**이 있다
   (결재 `2026-09-16-ocr-license-automation.md` 선택지 2). 계약·비용이라 등급 C.
3. **OCR 자동 승인 게이트** — 결재 `docs/decisions/2026-09-21-ocr-auto-verify-gate.md`(다른 세션).
