# 2026-10-24 — zod 3 → 4 이행 (GHSA-mrhx-c7xc-m3w5 해소)

## 한 것
- 버전: `zod` 3.25.76 → **4.6.7**.
- 깨진 자리 둘을 고쳤다.
  ① `order.routes` 의 `z.record(z.string())` → `z.record(z.string(), z.string())` (tsc 가 잡음)
  ② `validation-schemas.validateOrError` 의 `(error as any).errors` → `issues` (`as any` 때문에 tsc 가 못 봤고, 런타임 TypeError 가 났을 자리. 호출자는 0)
- `payment.routes.ts`(잠금) 코드는 바꾸지 않았다. 같은 스키마가 zod 4 에서도 같은 판정을 내는지 시험으로 고정했다.
- `.audit-allowlist.json` 에서 zod 항목을 제거했다. vite 항목은 남겼다(5→6 은 별건).
- 가드 `zod4-migration-2026-10-24.test.ts` + 주입 2건(둘 다 빨간불 확인).
- 검증: tsc(앱·워커) 0 · zod 를 쓰는 모듈의 시험 27파일 426건 pass · `npm run build` 0 · 화면 예산 25 안 · 워커 gzip 1.04MB(게이트 7MB).

## 남은 것
- **staging 실결제 1회**: `STAGING_CHECKLIST.md` S-ZOD4.
- zod 기본 오류 문구가 영어로 조금 달라졌다(예: `Too small: expected string to have >=1 characters`). 이 문구를 화면에 그대로 띄우는 곳은 `auth.routes` 의 400 응답뿐이다.

## 틀렸던 판단
- 처음 대표께 *"payment.routes 에서 import·문법을 바꿔야 한다"* 고 말했는데, 실제로는 한 줄도 안 바꿔도 됐다.
