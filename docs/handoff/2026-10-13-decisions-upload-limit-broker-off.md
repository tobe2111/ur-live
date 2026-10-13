# 2026-10-13 — 결재 2건 집행 (업로드 천장 · 에이전시 몫 스위치)

대표: *"기본안대로 모두 승인 3,4번 은 빼고. 일단 그 2가지는 자세히 설명해줘 시안을 보여주면서 하거나"*

## 한 것
1. **에이전시 몫 스위치 OFF** (`docs/decisions/2026-10-11-broker-share-switch-off.md`)
   - 어드민에 이 스위치를 켜고 끄는 화면이 없다 → 세션이 어드민 API 로 `false` 로 바꾸고 다시 읽어 확인.
   - 다시 켤 때: `PUT /api/admin/tools/settings {"broker_share_enabled":"true"}` (조건: 에이전시 1단계 + S-BROKER).
2. **업로드 천장 — 두 엔드포인트만** (`docs/decisions/2026-10-11-upload-body-limit.md`)
   - 등록증 2.2MB · 히어로 영상 10MB(+경계). 이미지 업로드는 1MB 그대로.
   - 값은 `src/shared/upload-limits.ts` `API_BODY_LIMIT_OVERRIDES` 한 곳(Map — 프로토타입 키 차단).
     워커 `bodyLimitByPath(apiBodyLimitFor)` · 업로드 라우트 · 클라 등록증 가드 4곳이 전부 여기서 받는다
     (종전엔 클라 10MB · 라우트 10MB · 미들웨어 1MB 로 세 군데가 다른 말을 했다).
   - `worker/index.ts` 는 잠금표 파일이지만 잠긴 항목(SSR inject·`caches.default`)엔 안 닿는다. 줄 수 2671 → 2666.
   - 가드: `upload-body-limit-2026-10-11.test.ts` ①-2 신설(열린 곳·닫힌 곳·미들웨어 동작) + 주입 5건 추가,
     `--only '📤'` 13건 전부 빨간불 확인. `food-permit`·`cert-upload-compress` 두 시험은 손 숫자 → SSOT 이름으로 재조준.

## 다음 세션의 첫 액션
- 배포 후 E4: 1.5MB 짜리 등록증을 `/api/upload/business-cert` 에 올려 413 이 아니라 200 인지
  (`curl -F file=@cert.jpg https://urdeal.kr/api/upload/business-cert` — 비인증 엔드포인트, rateLimit 10/10분).
  그리고 `/api/upload/image` 에 1.5MB 를 보내면 **여전히 413** 인지(반대 방향).

## 남은 것
- 3번(이용권 공유 카드)·4번(`/pass/:id` 제목)은 대표가 **설명·시안을 먼저** 보겠다고 했다 — 결재 open 유지.
- 별건 발견(안 고침): 배너 **이미지** 업로드(`BannerMediaUpload` image 모드)는 압축 없이 `/api/upload/image`(1MB)로
  가는데 화면 문구는 "최대 10MB" — 1MB 넘는 히어로 사진은 413. 히어로는 고해상이 필요해 일반 압축(0.5MB)이 답이
  아닐 수 있어 판단 필요.
