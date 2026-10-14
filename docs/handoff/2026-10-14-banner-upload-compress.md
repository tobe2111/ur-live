# 2026-10-14 · 배너 이미지 업로드 — 화면 "최대 10MB" ↔ 실제 천장 1MB

대표 지시: *"배너 업로드 문제도 해결해줘"* (직전 보고의 "따로 고칠 문제 하나").

## 무엇이 깨져 있었나
- `/admin/banners` 의 이미지 업로드(`BannerMediaUpload.tsx`)가 **원본을 그대로** `/api/upload/image` 로 보냈다.
  그 엔드포인트 본문 천장은 1MB(`shared/upload-limits.ts`) → 1MB 넘는 배너 사진은 전부 413.
- 화면은 "JPG · PNG · WebP · GIF · 최대 10MB" 라고 안내했다(10배 거짓).
- 가드 `upload-body-limit-2026-10-11.test.ts` ② 가 이 파일을 **영상 사유로 통째 면제**해 이미지 경로까지 눈에서 빠졌다.

## 한 것
- `prepareImageForUpload` 에 `hero: true`(2400px · 0.85MB — 히어로 권장 폭 `BANNER_SLOT_SPECS.hero.recommendedWidth`).
- `banner-upload-plan.ts`: 사진=압축 · GIF=압축 안 함(움직임 보존, 1MB 넘으면 MP4 안내) · 영상=10MB 클라 가드.
- 가드 면제 제거 + 배선 목록에 추가 + 신규 `banner-upload-2026-10-14.test.ts` + 주입 5건(전부 빨간불 확인).

## 다음 세션의 첫 액션 (E4)
배포 후 어드민 `/admin/banners` 에서 3MB 이상 폰 사진을 히어로 이미지로 올려 URL 이 채워지는지(대표 화면 확인).

## 틀렸던 판단
- 처음엔 배너 전용 압축을 따로 짰다 — `lib/prepare-upload.ts` 라는 SSOT 가 이미 있었다. 그걸 확장하는 쪽으로 바꿨다.
- 가드 면제는 **파일 단위**라 사유(영상)보다 넓게 먹는다. 면제를 늘리지 말 것.

## 남은 것 (별건)
- `components/upload/ImageUpload.tsx`(어드민 블로그·몰·숙소 등록)는 자체 캔버스 압축이 있으나 GIF 는 원본 통과 → 1MB 넘는 GIF 는 413. 안내 문구도 "10MB". 같은 클래스 — 대표 판단 시 정리.
