# 사업자 유저 가입 화면 — 2차 시안 (2026-09-21, 라이브 실측 재작성)

대표: *"너무 복잡함, 심플하게. 시안 필요"* → *"더 대기업스럽게 완성도있게"* →
*"구현된 형태는 어떻지? 사업자한테 OCR로 받고 있나? 그런 것들을 전반적으로 모두 확인한 뒤에
시안 다시 만들어볼래? OCR이랑 그리고 카카오맵 혹은 네이버지도로 간편하게도 할 수 있잖아."*

어느 서비스인가: **유어딜**. 도매·공구 서비스·유어애즈 무접촉. 머니 경로 **없음**(가입 화면 코드 0).

## 다음 세션의 첫 액션

1. **대표 선택 대기** — A~F 중. 덱 https://claude.ai/artifact/4YcRBe48GZiTYEPQSS34He
   배포 뒤 `urdeal.kr/design/variants?set=seller-signup`.
2. 고르면 `docs/design/seller-signup-simplify-2026-09-21.md` §5 의 표대로 구현.
   **뿌리는 `AddressPickerField.tsx:61` 한 줄**(주소 문자열 → place 객체 전체).
3. 안 E·F 는 선행 작업이 있다(§아래 "남은 결정").

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
| OCR | `ocr-license.ts`(`@cf/meta/llama-3.2-11b-vision-instruct`) | **3건 실행 / 0건 성공** |
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

## 이번에 틀렸던 판단

- **1차 시안 전체가 검증 안 된 전제 위에 있었다.** "국세청 자동 승인 때문에 다섯 칸" 이라고 문서와
  코드 주석이 말하길래 그대로 믿고 다섯 안을 그렸다. **라이브를 한 번도 안 봤다.**
  대표가 *"구현된 형태는 어떻지?"* 라고 물어서야 쟀고, 재 보니 0회였다.
  ⇒ **화면을 고치기 전에 그 화면이 만든 데이터를 먼저 볼 것.** 4행짜리 테이블이었고 5분이면 됐다.
- **"OCR 정확도 미실측" 이라고 문서에 적혀 있었지만 실제로는 결과가 남아 있었다.**
  `seller_meta` 에 3건이 저장돼 있다. 문서만 읽고 "미실측"으로 넘겼으면 안 F 를 낙관적으로 그렸을 것이다.
- **테스트 데이터로 결론을 낼 뻔했다.** 사업자번호가 `9999999991` 계열이라 합성인 건 금방 알았는데,
  거기서 멈췄으면 "합성이라 실패한 것"으로 오판했을 것이다. **이미지를 직접 열어 보니 반대였다** —
  실물보다 훨씬 쉬운 조건이었다. ⇒ 데이터가 가짜인지 판단하려면 **그 가짜가 쉬운지 어려운지**까지 봐야 한다.

## 검증 (E2)

- tsc **0** · `design-variants-2026-09-15.test.ts` 15건 + `urshop-naming.test.ts` 15건 pass
- `npm run build:client` **0** · pre-push 게이트
- 폰 렌더 **12장** 눈 확인 · 덱 렌더 확인
- ⚠️ **E4 아님** — 시안은 라이브 무영향. 갤러리 세트는 배포돼야 열린다.

## 남은 결정 (대표)

1. **A~F 중 무엇** — 세션 추천 **안 B**(치는 칸 2, 935px, 지도 8중 6).
2. **국세청 확인을 살릴 것인가** — 살리면 안 E(두 칸 더). 안 B 로 가고 나중에 붙여도 된다.
   살리려면 `NTS_API_KEY` 설정 여부 확인이 선행.
3. **등록증 읽기를 개선할 것인가** — 지금 모델로는 어렵다. 네이버 클로바 OCR 은 사업자등록증
   **전용 템플릿**이 있다(결재 `2026-09-16-ocr-license-automation.md` 선택지 2). 계약·비용이라 등급 C.
