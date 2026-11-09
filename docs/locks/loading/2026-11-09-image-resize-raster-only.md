# 2026-11-09 [UNLOCK_LOADING] 이미지 변환 프록시는 래스터 이미지만 · nonce 리라이터는 /api 제외

- **잠금 파일**: `src/worker/index.ts` (`/api/image/resize` · HTML nonce 리라이터 블록)
- **대표 승인**: 보안 전수조사 보고 후 *"모두 다 순서대로 진행해줘"* (2026-11-09) — 수정 순서 4번 항목.

## 무엇을 왜

- `/api/image/resize` 의 원본 폴백이 상류 `Content-Type` 을 그대로 복사해 1년 `immutable` 로 내보냈다.
  허용 호스트에 누구나 파일을 올리는 곳이 있어, 이미지가 아닌 문서가 우리 출처에서 열릴 수 있었다.
  → 래스터 이미지(`jpeg·png·webp·gif·avif·bmp·ico`)만 통과, 그 외 415. 응답에 `nosniff` +
  `Content-Security-Policy: default-src 'none'; sandbox`. 수리 전 캐시된 비-이미지 엣지 캐시는 적중 시 버린다.
- HTML nonce 리라이터가 경로를 가리지 않고 모든 `text/html` 의 `<script>` 에 nonce 를 붙였다.
  → `/api/*` 는 건너뛴다(셸 HTML 은 `/api` 밖이고, `/api` 아래에 스크립트를 의도해 내보내는 HTML 은 0 — 전수 grep).

## 불변으로 지킨 잠금 항목

- `ALLOWED_HOSTS` 목록은 한 줄도 안 바꿨다(제거 금지 항목).
- SSR inject 블록·`caches.default.match`·R2 썸네일 경로·변환(cdn-cgi) 경로 그대로. 셸 HTML 의 nonce 동작 그대로.

## 가드

`src/tests/unit/security-hardening-2026-11-09.test.ts` ④ + 주입 `scripts/mutations/security-hardening-2026-11-09.mjs`
(래스터 검사 제거 · `/api` 제외 제거 — 둘 다 빨간불 확인).

## E4 판정 · 롤백

- 판정: 배포 후 `GET /api/image/resize?url=<허용 호스트의 일반 jpg>` 200 `image/*` · 카드 이미지 정상 표시.
- 롤백: 이 커밋 revert.
