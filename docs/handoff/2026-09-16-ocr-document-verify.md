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

## 남은 결정 / 대기

- **자동 승인 게이트 ON** — 대표 판단(등급 C). 실사진 정확도 실측이 선행.
- **영업신고증 업로드 축** — 2차 PR.
- OCR 단가(Neuron) 는 이 환경에서 확인 못 했다(Cloudflare 문서·요금 API 프록시 차단).
  대표 대시보드의 Workers AI 페이지가 현재 플랜·일일 무료량을 보여 준다.
