# 인계 — 홈 섹션 어드민 편집(직접 고르기 · 순서 변경) (2026-08-04)

#1046(홈 쇼케이스 ①③④) 머지 후, 대표가 **"직접 고르기 만들어줘 · 섹션 순서도 어드민에서 되게"** 지시.
설계 SSOT: `docs/design/home-showcase-2026-08.md`

## 다음 세션의 첫 액션

배포 후 `/admin/home-sections` 에서:
1. 소스 **"직접 고름"** 으로 섹션 생성 → 목록에 **"담긴 상품 0개 (홈 미노출)"** 가 주황색으로 뜨는지
2. **"상품 담기"** → 검색 → 담기 → 위/아래로 순서 조정 → 저장 → 홈에 그 순서대로 뜨는지
   (캐시를 비우므로 **즉시** 반영돼야 한다. 120초 기다려야 하면 무효화가 안 도는 것)
3. 목록의 **위/아래 화살표**로 섹션 순서 변경 → 홈 줄 순서가 따라오는지

## 완료분

| 무엇 | 어디 |
|---|---|
| 상품 담기 패널(검색·담기·순서·상한) | `src/pages/admin/home-sections/SectionProductPicker.tsx` (신규) |
| 섹션 순서 위/아래 | `AdminHomeSectionsPage` `moveSection` → `POST /api/sections/reorder` |
| manual 0건 경고 | 목록에 "담긴 상품 0개 (홈 미노출)" |
| 공개 캐시 무효화 | `invalidateSectionsCache` — 생성·수정·삭제·상품교체·순서·상품제거 6곳 |
| 어드민 목록에 매장명 | `/api/sections/admin` SELECT 에 `p.restaurant_name` |

검증: tsc 0 · build 0 · **vitest 4981 pass(379 파일)** · audit-gate **ALL GREEN 87** · critical-chunks 17 불변.
불변식 **31건**(+7) — 결함 4개 주입해 빨강 확인.

## ⚠️ 이번에 확인한 것 / 틀릴 뻔한 것

1. **"어드민 mutation 이 401 날 것"이라고 의심했는데 아니었다 — 라이브로 확인했다.**
   `src/lib/api.ts` 인터셉터는 `/api/sections/admin`(GET)엔 admin_token 을 붙이지만
   `POST /api/sections` · `/:id/products` · `/reorder` 는 **어느 패턴에도 안 걸려 헤더가 안 붙는다.**
   그래서 깨진 줄 알았는데, `requireAuth` 의 **httpOnly 세션 쿠키 경로**(`parseSessionCookie`)가
   메서드 무관으로 통과시킨다 → 실제 브라우저에선 정상 동작.
   **라이브 실측**(쿠키만, Authorization 없이 `POST /api/sections` → **HTTP 201**)으로 확정.
   ⇒ 코드만 읽고 "안 될 것"이라 단정했으면 없는 버그를 고치느라 시간을 썼을 것이다.
   ⚠️ 다만 **Bearer 전용 경로로 바뀌면**(SSR 토큰 쿠키 분기는 GET/HEAD 만 허용) 이 페이지가 조용히
   깨진다 — 인터셉터에 `/api/sections` 를 추가하거나 페이지에서 명시 헤더를 붙여야 한다.

2. **프로덕션에 테스트 행을 만들 때는 그게 라이브에 뜨는지 먼저 생각할 것.**
   위 검증에서 `source:'popular'` 로 probe 섹션을 만들었는데, 그건 **규칙 섹션이라 상품이 채워져
   홈에 "__auth_probe__" 라는 제목이 실제로 뜬다.** 곧바로 지워서 노출은 없었지만,
   "상품 0건이면 안 보인다"를 믿고 만든 것이 애초에 틀린 전제였다(0건이 아니었다).
   ⇒ 프로덕션 probe 는 **manual + 상품 0건**으로 만들 것. 그건 구조적으로 안 보인다.

3. `api.ts` 의 admin 패턴은 `/api/<feature>/admin/*` 형태다 — 새 어드민 API 를 만들 때
   경로를 `/api/foo/admin/...` 으로 잡으면 토큰이 자동으로 붙고, 아니면 안 붙는다.

## 남은 결정 / 대기

- **섹션 수정(제목·규칙·더보기 링크 변경)** 화면은 아직 없다. `PUT /api/sections/:id` 는 이미
  새 필드를 다 받으므로 UI 만 붙이면 된다. 지금은 지우고 다시 만들어야 한다.
- **드래그 앤 드롭** 순서 변경은 안 했다(위/아래 버튼). 섹션이 3~5개 규모라 버튼으로 충분하다고 봤다.
- 모바일 홈(지도)은 여전히 쇼케이스 미적용 — 대표 판단 대기.
