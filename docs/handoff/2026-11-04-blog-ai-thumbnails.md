# 2026-11-04 — 블로그 글별 AI 썸네일

## 완료분
- `BLOG_SEED_THUMBNAILS` 표 + 재시드가 `thumbnail_url` 채움(INSERT) / 표에 없으면 기존 사진 보존(UPDATE COALESCE). `BLOG_SEED_VERSION` 14 → 15.
- 사진 1장 반영: `public/assets/blog/voucher-how-to-use-v1.webp`(1200×675, 46KB).
- 가드 `blog-thumbnails-2026-11-04.test.ts` 5건 — 파일 삭제·COALESCE 제거 두 주입 모두 빨간불 확인 후 복구.
- 생성 기록·프롬프트·노드 표: `docs/design/blog-thumbnails-2026-11-04.md`.

## 이 작업을 이어서 하라고 했을 때의 첫 액션
1. 대표가 Figma 프레임 8:3~8:22 PNG 를 올렸으면 → 섬네일 미리보기와 눈으로 대조해 slug 를 정하고(design 문서 표), webp 변환 → 표에 추가 → 버전 +1.
2. 배포 뒤 `curl -s -A "$UA" https://urdeal.kr/api/blog/public/voucher-how-to-use | grep thumbnail_url` 가 `/assets/blog/...` 이면 E4.

## 틀리기 쉬운 것
- Figma `generate_image` 결과의 `image.url`(figma.com) 은 이 환경에서 403. `get_screenshot` 인라인 응답이 유일한 원본 경로였고, Starter 요금제 한도가 **생성 22회 + 스크린샷 1회** 뒤에 닫혔다. 다음엔 생성 1장 → 스크린샷 1장을 번갈아 할 것(생성을 다 하고 받으려다 20장이 미리보기만 남았다).
- Canva 도 미리보기 198px 만 오고 다운로드 도메인 차단.
- 관리자가 어드민에서 손으로 고친 글(manually_edited=1)은 재시드가 사진도 안 넣는다 — 그 글은 어드민 업로더로.

## 2차 (같은 날)
- 1차 PR tobe2111/ur-live#2189 머지(`44347c0` — auto-merge 가 clean 인데 멎어 손으로 머지).
- 대표가 네트워크 허용 목록에 figma/canva 도메인 추가 → `www.figma.com/api/mcp/asset/...` 200. 나머지 20장 반영, 버전 16.

## 3차 — 본문 사이 사진 42장
- 표 `blog-seed-images.ts` · 버전 17 · 크롤러 본문 이미지 지원 · 가드 3건 + 주입 2건.
- 오진 기록: 배포 직후 "사진 없음·이상한 글자" = 서버 첫 화면 목록 사본이 몇 분 낡았던 것(design 문서 🩸).

## 남은 것
- 없음. 배포 뒤 `/blog/gift-guide` 에서 본문 사진 2장 보이면 E4.
