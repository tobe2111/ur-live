# 서류 OCR — 읽고, 등록 매장과 맞춰 보기 (2026-09-16)

대표가 Workers AI 바인딩을 켜면서 결재 `docs/decisions/2026-09-16-ocr-license-automation.md` 가
**승인**으로 닫혔다. 그 1차 구현.

## 다음 세션의 첫 액션

1. **배포 후 실사진 1장으로 OCR 정확도를 재라.** 이게 유일한 미검증 축이다.
   ```
   POST /api/admin/sellers/<id>/business-registration/ocr   (어드민 토큰)
   ```
   볼 것: `extracted.fill`(0~1) · `addressCheck.verdict` · `summary`.
   ⚠️ **Pages 바인딩은 배포 후에야 붙는다** — 배포 전에 부르면 `AI_UNAVAILABLE` 이 정상이다.
2. 정확도가 쓸 만하면 **2차 PR: 영업신고증 업로드 축**. 코드 경로(`business_license`)는
   이미 다 있고 **셀러 업로드 UI + 저장 + 어드민 표시**만 없다.
3. 자동 승인 게이트(`platform_settings.ocr_auto_verify_enabled`) ON 은 **대표 판단(등급 C)** —
   staging 검증이 먼저다. 지금은 기본 OFF.

## 완료분

| 무엇 | 파일 |
|---|---|
| `AI` optional 바인딩 | `src/worker/types/env.ts` |
| 모델 응답 텍스트 추출 SSOT | `src/worker/utils/ai-text.ts` (신규) |
| 주소·상호 정규화/대조(순수) | `src/shared/korean-address.ts` (신규) |
| 두 서류 OCR + 자동승인 게이트 | `src/worker/utils/ocr-license.ts` (신규) |
| 판정 + 원장 조회 + 보관 | `src/worker/utils/document-verify.ts` (신규) |
| 어드민 나란히 보기 | `src/features/admin/api/admin-seller-ocr.routes.ts` (신규) |
| 가드 29건 + 주입 7건 | `*-2026-09-16.test.ts` · `scripts/mutations/ocr-document-verify.mjs` |

## 🩸 이번에 틀렸던 판단 (제일 값진 부분)

### 1. 결재 문서의 원장 숫자가 틀렸다 — 269,708 이 아니라 6,590
문서는 *"영업신고증을 대조할 공개 원장 269,708건"* 을 근거로 *"OCR 이 위조까지 잡는다"* 고 적었다.
실측하니 그 대부분이 원장이 아니었다: 학원 139,477 · **카카오 플레이스 스크랩 96,832** · 병원 26,809.
**진짜 인허가 원장은 6,590건**(하루 300건씩 신규 인허가만) = 전국 음식점의 1% 미만.
⇒ 원장 대조는 **걸리면 양성, 없으면 무신호**. 주력을 **서류 주소 ↔ 카카오맵 매장 주소**로 바꿨다.
⚠️ 다음 세션이 그 269,708 을 다시 인용하지 말 것.

### 2. 죽은 코드가 켜지는 순간 살아나는 자동 승인
`seller-profile.routes.ts` 의 `ocr-verify` 가 게이트 없이 `business_registration_status='verified'`
를 썼다. 2026-05-27 작성 후 AI 바인딩이 없어 한 번도 안 돌았을 뿐, **바인딩이 켜진 그날부터 살아난다.**
게이트 뒤로 옮겼다. ⇒ *"코드에 있다 ≠ 살아 있다"* 의 역방향: **"안 돌던 코드는 켜지는 날 갑자기 돈다."**

### 3. 내가 만든 주입 하나가 헛돌았다
`주소 파서가 도로명 안 숫자를 집는다` 주입이 초록이었다 — 파서에 방어가 **둘**(도로명 뒤만 보기 +
앵커된 정규식)이라 하나만 지워서는 결함이 재현되지 않았다. 순진한 구현으로 통째 교체해 빨간불 확인.
⇒ **방어가 겹쳐 있으면 하나만 지우는 주입은 아무것도 증명하지 않는다.**

### 4. `Env.AI` 를 더했더니 남의 파일 두 개가 깨졌다
`ocr.routes.ts`(메뉴 OCR)·`disputes.routes.ts` 가 자체 좁은 타입으로 캐스팅하고 있었다.
같은 줄(`result.description || result.response`)이 세 곳이라 `aiText()` SSOT 로 뽑아 셋 다 정리.

## 🍽️ 영업신고증 축 — 같은 PR 에서 완료 (2026-09-16 대표 *"남은거 다 해줘"*)

등록증만으로는 축이 반쪽이었다. 둘은 **다른 서류이고 증명하는 것도 다르다** —
등록증(세무서)은 *정산 대상자*를, 영업신고증(구청)은 *그 소재지에서 팔아도 된다*를 증명한다.
그리고 영업신고증만 **관리번호가 공개 원장에 실린다**(위 §1 대로 커버리지는 1% 미만이라 보너스).

| 자리 | 무엇 |
|---|---|
| `src/components/seller/FoodPermitUpload.tsx` | 셀러 대시보드 '서류' 탭. 자기완결(조회·업로드·저장) |
| `POST /api/seller/food-permit` | 저장. **소유자만**(운영자 403) · `/api/media/...` 형태만 수용 |
| `seller_meta.food_permit_url` | 저장 자리. **sellers ALTER 아님**(100컬럼 = D1 한도) |
| `GET /api/seller/business-info` | additive 동봉 + **운영자 마스킹 목록에 포함** |
| `POST …/business-registration/ocr?kind=business_license` | 같은 라우트, `kind` 로 갈림. 기본값은 등록증(종전 호출부 불변) |

### 🔑 이번 축에서 조심한 것 셋
1. **이름 충돌** — 레포 안에서 `business_license_url` 은 이미 *사업자등록증*이다
   (`suppliers`·도매 가입 폼). 같은 이름을 영업신고증에 쓰면 둘이 언제 갈렸는지 아무도 모른다 ⇒ `food_permit_url`.
2. **SSRF** — 이 URL 은 어드민 OCR 이 **서버에서 fetch** 한다. 임의 URL 을 저장하게 두면
   셀러가 우리 워커로 원하는 주소를 두드리게 만들 수 있다 ⇒ `/api/media/...` 한 형태만.
3. **마스킹** — 주소·연락처는 가리면서 그게 전부 찍힌 사진 한 장을 주면 마스킹이 무의미하다.

## 🩸 그리고 이 축을 파다 **기존 결함**을 하나 더 잡았다 — 대시보드 등록증 5MB 거절

대표가 *"영업신고증도 사진 크기 문제 없지?"* 라고 물어 재 보다가 나왔다.
2026-09-15 에 *"거절 대신 압축"* 으로 고친 것은 **가입 폼 두 문**(`BusinessCertUpload`·
`StoreRegisterModal`)뿐이었고, **셀러 대시보드의 등록증 제출은 그대로 남아 있었다**:

```ts
if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하 이미지만 가능합니다'); return }
```

폰 카메라 원본은 3~8MB 가 예사다. 이미 가입한 사장님이 등록증을 내려 하면 **거기서 막히고
할 수 있는 일이 없다**(에러도 아니고 그냥 안 된다). 같은 처방으로 고쳤다.
⚠️ 다만 상한이 다르다 — 이 화면은 `/api/seller/upload-image`(**5MB**), 가입 폼은
`/api/upload/business-cert`(**10MB**). 클라 상한이 서버보다 크면 "올렸는데 실패" 가 되므로
테스트가 **서버 상수를 읽어 비교**한다(`food-permit-2026-09-16.test.ts` ④).

⇒ 교훈: **결함을 고칠 때 "같은 일을 하는 문이 몇 개인가" 를 먼저 세라.** 이 레포의 등록증 업로드는
문이 셋이었고, 09-15 는 둘만 고쳤다.

## 🩸 그리고 축 전체가 **죽은 코드**였다 — 부르는 화면이 없었다

대표 *"다했어? 끝까지 해줘"* 에 답하려고 배선을 훑다 나왔다. 라우트(`admin-seller-ocr.routes.ts`)
· 판정(`document-verify.ts`) · 대조(`korean-address.ts`) 를 전부 만들고 **어드민 버튼을 안 만들었다.**
결재 §안전 레일 ① 이 요구한 것이 정확히 그 화면인데(*"추출값을 어드민 화면에 나란히 띄운다"*),
라우트는 마운트돼 있고 테스트는 초록이라 **아무 신호도 없었다** — 이 레포가 반복해 당한
*"코드에 있다 ≠ 살아 있다"* 의 교과서적 형태다.

**수리**: `pages/admin/business-verification/OcrComparePanel.tsx`(신규) 를 `/admin/business-verification`
카드마다 렌더. 버튼 두 개(등록증·영업신고증) · [서류에서 읽은 값 ↔ 등록된 매장] 3열 대조 ·
판정 배지 · 원장 문구. **승인·반려 버튼은 건드리지 않는다**(패널 밖, 기존 그대로).
서버는 대기 목록에 `has_food_permit` 을 additive 로 동봉해 **있는 서류만** 버튼을 띄운다.

🩸 **그리고 이걸 막으려고 쓴 가드가 그 자리에서 헛돌았다** — `toMatch(/<OcrComparePanel\b/)` 는
`{false && <OcrComparePanel …/>}` 로 꺼도 **문자열이 남아 초록**이었다(import 줄도 같은 함정).
주입 러너가 잡았고, **모양이 아니라 "그 줄이 게이트 없이 렌더되는가"** 로 앵커를 바꿨다.
⇒ 배선 가드는 *존재*가 아니라 *도달*을 재야 한다.

## ✅ 머지·배포 완료 — [E3] (2026-09-16)

- 스쿼시 머지 `535de060` (PR #1474). 배포 4종 전부 성공(Pages · Worker cron · ur-wholesale · ur-ads).
- 라이브 번들 교체 확인: `index-CjohCfCM.js` → `index-3wwlMoSZ.js`.
- **Workers AI 바인딩이 라이브에 살아 있다**(대표가 Pages production 에 붙인 것). 무비용 프로브로 확인 —
  서류 없는 셀러로 OCR 을 부르면 `AI_UNAVAILABLE` 이 아니라 **`제출된 사업자등록증 이미지가 없습니다`**
  가 온다(= `if (!c.env.AI)` 를 통과해 그 다음 단계까지 갔다는 뜻).
  ```
  curl -sS -X POST "https://live.ur-team.com/api/admin/sellers/14/business-registration/ocr" \
    -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" -H 'Content-Type: application/json' --data '{}'
  ```
  ⚠️ 이 프로브는 **추론을 안 태운다** — 서류가 없어 모델 호출 전에 끊긴다. 바인딩 확인용으로 재사용할 것.
- Notion 개발 업데이트 로그 2행 기록 완료.

## ⛔ E4 는 아직 — 판정에 **실물 서류**가 필요하다

`GET /api/admin/sellers/business-registration/pending` 이 **0건**이다(2026-09-16 실측).
읽을 사진이 없어서 정확도를 못 쟀다. 막힌 게 아니라 **입력이 없는 것**이다.

**다음 세션의 첫 액션**: 위 대기 목록을 다시 조회 → 1건이라도 있으면
`POST /api/admin/sellers/:id/business-registration/ocr` (필요시 `?kind=business_license`) 를 5건 돌려
`extracted.fill` 평균과 `verdict` 분포를 기록하고 `docs/STAGING_CHECKLIST.md` 의 S-OCR-1~10 을 채운다.
0건이면 **대표에게 실사진 한 건을 요청**하고 그 전엔 게이트 이야기를 꺼내지 말 것.

## 🩸 이번 세션에서 가드가 헛돈 것 — **세 번**, 전부 같은 클래스

전부 *"문자열이 남아 있어서 통과"* 다. 주입 러너가 셋 다 잡았다.
1. 주소 파서 — 방어가 **둘**이라 하나만 지우면 재현이 안 됐다(순진한 구현으로 통째 교체해야 빨간불).
2. 어드민 패널 배선 — `toMatch(/<OcrComparePanel\b/)` 가 `{false && <OcrComparePanel …/>}` 로 꺼도 초록
   (import 줄도 같은 함정). ⇒ **그 줄이 게이트 없이 렌더되는가**로 교체.
3. 영업신고증 버튼 게이트 — 같은 게이트가 둘(버튼·보기 링크)이 되자 버튼을 열어 놔도
   **링크 쪽이 단언을 만족**시켰다. ⇒ 버튼 블록이 그 게이트 **안에** 있는지 본다.

⇒ **배선 가드는 *존재*가 아니라 *도달*을 재야 한다.**
⚠️ 그리고 정규식 함정 하나: `<button[^>]*` 는 **화살표 함수의 `>`** 에서 멈춘다. `[\s\S]{0,N}?` 를 쓸 것.

## 🧰 이번에 새로 안 운영 사실

- **Verify 가 두 번 조용히 안 붙었다**(`49356bc50` · `fb8379901`). `check-runs` 만 보면 "안 붙음"과
  "도는 중"이 **똑같아 보인다** → `GET /actions/runs?branch=<브랜치>` 로 판정하고, 없으면 main 병합 푸시로 재부착.
- **머지는 세션이 한다**(CLAUDE.md 신규 절). MCP 쓰기가 rate limit 이어도 `curl https://api.github.com/...`
  는 **앱 설치 토큰**이라 별도 버킷이고 멀쩡하다. 이번 머지도 curl 로 했다.
- main 병합 충돌은 **자동 생성 3파일**에서 난다 — `route-chunk-map.ts` · `auto-reference.ts` ·
  `docs/proposals/*.md`. 전부 **main 것을 받고** 재생성시키면 된다.

## 남은 결정 / 대기

- **자동 승인 게이트 ON** — 대표 판단(등급 C). 실사진 정확도 실측이 선행.
- **영업신고증 OCR 정확도** — S-OCR-7~10(배포 후 실사진). 등록증과 서식이 달라 `fill` 을 따로 잰다.
- OCR 단가(Neuron) 는 이 환경에서 확인 못 했다(Cloudflare 문서·요금 API 프록시 차단).
  대표 대시보드의 Workers AI 페이지가 현재 플랜·일일 무료량을 보여 준다.
