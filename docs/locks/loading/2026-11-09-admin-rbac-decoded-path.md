# 2026-11-09 [UNLOCK_LOADING] nonce 제외 판정은 디코드된 경로로 · 소셜 위임 전 관리자 역할 검사

- **잠금 파일**: `src/worker/index.ts` (HTML nonce 리라이터의 `/api` 제외 조건 · ur-ads 위임 미들웨어) ·
  `src/worker/routes/repair-schema.routes.ts` (인증 게이트만 — 잠긴 `backfill: sellers.linked_user_id` UPDATE 는 무접촉)
- **대표 승인**: 보안 전수조사 보고 후 *"모두 다 순서대로 진행해줘"* (2026-11-09) — 수정 순서 6번 항목.

## 무엇을 왜

- 라우터(Hono)는 `%xx` 를 풀어서 경로를 고르는데, 관리자 역할 검사와 nonce 제외 판정은 원문(`new URL(c.req.url).pathname`)을
  봤다. 실측: `PUT /api/admin/tools/%73ettings` 가 `settings` 핸들러에 닿는 동안 검사는 다른 세그먼트로 읽었다.
  → 둘 다 `c.req.path`(디코드된 경로).
- `/api/admin/social/*` 은 RBAC 미들웨어보다 먼저 ur-ads 로 위임돼 뷰어도 쓰기를 할 수 있었다 → 위임 직전에 같은 RBAC.
- `repair-schema.routes.ts` 의 `/api/_internal/*`(DDL·백필·최고관리자 승격)는 `/api/admin` 밖이라 RBAC 가 없었다 → 최고관리자만.

## 불변으로 지킨 잠금 항목

- SSR inject 블록·`caches.default.match`·`ALLOWED_HOSTS`·셸 HTML nonce 부착 그대로. repair-schema 의 backfill SQL 그대로.
- `index.ts` 줄 수 동결값(2672) 안.

## 가드

`src/tests/unit/security-hardening-2026-11-09.test.ts` ④⑥ — 인코딩한 경로와 그냥 경로가 같은 판정을 받는지 실제 요청으로 본다.
주입 16건 전부 빨간불 확인.

## E4 판정 · 롤백

- 판정: 배포 후 최고관리자 계정으로 어드민 화면·`/api/_internal/repair-schema-quick` 정상 · 제한 역할 계정이 있다면 `%xx` 경로 403.
- 롤백: 이 커밋 revert.
