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

## 후속 (같은 날, 대표 *"나머지 문제들도 다 해결해줘"*) — 사진 업로드 여섯 자리
배너 PR(#1776) 머지 뒤 전수: 업로드 14자리 중 **6자리가 천장 검사 없이** 보내고, 압축 **전** 5MB·10MB 가드로
폰 사진을 거절하고 있었다. 전부 공용 `prepareImageForUpload` 로 옮겼다.
- 상품 사진(`components/ImageUpload.tsx`) · 블로그·몰·숙소(`components/upload/ImageUpload.tsx` — 자체 캔버스 압축 폐기, 1600px 유지)
  · 리뷰 사진 · 매장 사진(`ImageField`) · 이용권 사진(`PhotoGalleryEditor`) · 셀러 프로필 사진
- 헬퍼에 `size` 옵션(자리별 목표, 천장 아래로 `SIZE_TARGET_CAP_MB` 0.9MB 로 눌러 담음) + 천장 안 GIF 는 그대로(움직임 보존)
  + `uploadTooLargeMessage()` 공용 문구
- 거짓 안내 정리: 상품 사진 6개 언어 `imageFormatHint`("최대 10MB") · 블로그 업로드 "최대 10MB" · 등록증 "10MB 이하"
  · 어드민 배너 "용량 2MB 이하"(지켜지지 않던 숫자 → 원본 25MB SSOT `UPLOAD_SOURCE_MAX_BYTES` 파생)
- 가드 `upload-prepare-everywhere-2026-10-14.test.ts` + 주입 6건(전부 빨간불 확인)

## 남은 것
- 없음(사진 경로). 영상(배너 10MB)·문서(등록증 2.2MB)는 서버 카브아웃으로 따로 지킨다.
- E4: 배포 후 상품 등록·매장 사진에서 5MB 넘는 폰 사진이 올라가는지(로그인 필요 — 대표 화면 확인).

## 함께 고친 것 — 렌더 스모크 빨간불(main 에서도 재현)
- `render-smoke` 가 #1741(10-13) 이후 모든 PR 에서 빨간불: 셀러 환불 큐의 "런타임 에러 0" 이 `NetworkError` 로 깨짐.
- 원인: `index.html` 폰트 지연 로더가 `document.fonts.load(...)` 에 거절 처리가 없었다 → 폰트를 못 받으면 처리 안 된 오류.
- 수리: 거절도 재시도로(`.then` 두 번째 인자). 가드 `font-lazy-first-visit` ⑥ + 주입 1건. 로컬 스모크 38/38.
- 🧭 판단: "내 PR 탓이 아니다" 로 멈추지 않고 main 에서 재현 → 원인 커밋(aaa78fdd6) 특정 → 한 줄 수리. 이 레포는 세션이 여럿이라 빨간 체크를 다들 남 탓으로 넘기면 아무도 안 고친다.
