# 2026-11-09 [UNLOCK_LOADING] SSR 시드 JSON 의 `<` 전부 이스케이프 · 지오코딩 lazy 백필 횟수 제한

- **파일**: `src/worker/utils/ssr-payload.ts`(`escapeForScript`) · `src/features/group-buy/api/group-buy-public.routes.ts`(`POST /products/:id/ensure-geocode`)
- **대표 승인**: 보안 전수조사 3차 *"계속 진행"* (2026-11-09).

## 무엇을 왜
- 시드 JSON 은 `</script` 만 이스케이프했다. 사용자 문자열(상품명·유어샵 소개)에 `<!--<script>` 가 들어가면 HTML 파서가
  script data double-escaped 상태가 되어 닫는 태그를 삼키고 뒤 시드·본문을 깨뜨린다(첫 화면 DoS). JSON 의 `<` 는 문자열 안에만
  나오므로 전부 `<` 로 바꿨다 — 파싱 결과는 같다(클라는 전부 `JSON.parse` 로 읽는다 — 전수 확인).
- 지오코딩 lazy 백필은 로그인 없이 외부 API 호출을 일으킨다 → IP 당 분 30회.

## 불변으로 지킨 잠금 항목
- SSR 슬롯·타임아웃·SWR·엣지/KV 읽기 그대로. group-buy-public 의 `Cache-Control`/`CDN-Cache-Control` 분리·tiers parse 그대로.
- 페이로드 크기: `<` 1글자 → 6글자(시드 JSON 에 `<` 는 드물다).

## 가드 · 롤백
`src/tests/unit/security-hardening-3-2026-11-09.test.ts` ④⑤ + 주입 빨간불. 롤백: 해당 커밋 revert.
