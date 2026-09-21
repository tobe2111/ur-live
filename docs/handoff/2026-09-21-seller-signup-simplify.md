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

### ② 영업신고증 — 화면은 "음식점 필수" 라 말하고, 코드는 아무것도 강제하지 않는다

- 받을 자리는 있다: `FoodPermitUpload`(셀러 대시보드 '서류' 탭) → `seller_meta.food_permit_url`.
- 그 부품의 부제는 **"(선택)"** 이고, 가입 화면 '승인까지 남은 것' 은 **"영업신고증 — 음식점 필수"** 다.
- **강제하는 코드가 없다.** 현금 정산 게이트도 사업자등록증만 본다. 라이브 보유 **0건**.
- ⇒ 말과 강제가 어긋나 있다. 어느 쪽으로 맞출지는 **대표 결정**(등급 C 는 아니지만 정책 결정).
  ⚠️ 법적 의무 여부(식품위생법)는 세션이 단정하지 말 것 — 대표·전문가 판단 영역이다.

## 남은 결정 (대표)

1. **국세청 확인을 살릴 것인가** — 살리면 안 E(대표자명·개업일이 실제로 일하게 된다).
   지금 그 두 칸은 OCR 이 채우지만 **아무도 안 읽는다**(자동 승인 0회). 안 B 와 충돌하지 않는다.
   살리려면 `NTS_API_KEY` 설정 여부 확인이 선행.
2. **등록증 읽기를 더 올릴 것인가** — 지금 모델로 **상호 한 글자**가 남아 `match` 가 안 나온다
   (= 자동 승인 게이트에 못 올린다). 네이버 클로바 OCR 은 사업자등록증 **전용 템플릿**이 있다
   (결재 `2026-09-16-ocr-license-automation.md` 선택지 2). 계약·비용이라 등급 C.
3. **OCR 자동 승인 게이트** — 결재 `docs/decisions/2026-09-21-ocr-auto-verify-gate.md`(다른 세션).
