# [LOADING_ADDITIVE] 2026-11-11 — 유어샵 핀 공유 주소를 서버가 바로 넘겨준다 (대표 *"1번 일단 해봐. 어차피 소개하는 그 고유 링크로 들어오는거 아니야?"*)

검은 화면(첫 응답 전 대기, 한국 회선 1~2초)을 더 줄일 길을 찾다가 확인한 것: 소개 링크의 실체는 `/u/{handle}/p/{productId}`(`usePinAction` 의 공유 URL)인데, 이 주소가 **문서를 두 번** 받고 있었다.

```
종전  /u/h/p/123 → 200 앱 껍데기(+ 유어샵 시드 조회) → JS 부팅 → location.replace(/api/curator/h/p/123/redirect) → 302 → /pass/123?aff=…
지금  /u/h/p/123 → 302(같은 핸들러를 워커 안에서 호출) → /pass/123?aff=…
```

## 잠금표 접촉(추가만)
`src/worker/index.ts` — 문서 요청(GET/HEAD) 구간의 별칭 301 줄 끝에 한 토막 + import(2672줄 유지). SSR inject 블록 무접촉.

## 머니 경로
접촉 없음. 클릭 기록(`logPinClick`)과 목적지 판정(`?aff=`·`?ref=`)은 **같은 핸들러**(`curator.routes.ts` `/:handle/p/:productId/redirect`)가 그대로 한다 — 요청 헤더(UA·쿠키·리퍼러)를 그대로 넘긴다. 앱 안 이동용 라우트(`CuratorPinClientRedirect`)도 그대로.

## 롤백
워커의 그 한 토막을 지우면 종전(앱 껍데기 → 클라 리다이렉트)으로 돌아간다.

## 못 보는 것 / 남은 것
- 실제 응답은 배포 뒤 `curl -I https://urdeal.kr/u/<handle>/p/<id>` 로 302 · `Location` 을 본다.
- 도착 주소가 `?aff=` 쿼리를 달고 있어 **재방문 즉시 표시(shell-sw)는 여전히 손대지 않는다**(쿼리가 있으면 투명 — 2026-04-27 사고의 울타리). `?aff=` 만 허용하는 것은 그 울타리를 넓히는 일이라 관찰(~11/16) 뒤 대표 결재로.

## 가드
`pin-link-server-redirect-2026-11-11.test.ts` 4건 · 주입 5건(둘은 반대 방향).
