# 2026-10-31 홈페이지 삽입 위젯 (/embed/*)

## 다음 세션의 첫 액션
배포 후 라이브 판정(E4):
- `curl -sI https://urdeal.kr/embed/u/jiwon1228` → 200 · `content-security-policy` 에 `frame-ancestors *` · `x-frame-options` **없음** · `x-robots-tag: noindex`
- 브라우저로 `https://urdeal.kr/embed?type=ushop&key=jiwon1228` 열어 미리보기 iframe 이 뜨는지
- 다른 출처(예: 아무 정적 HTML 파일)에 iframe 을 넣어 실제로 뜨는지 — 위 헤더가 판정이지만 눈으로 한 번
- 카드 클릭 → `/api/curator/jiwon1228/p/:id/redirect` → `/pass/:id?aff=` 로 가는지

## 완료
- `src/worker/routes/embed.routes.ts`(라우트 6) · `src/worker/utils/embed-widget.ts`(그리기) · `src/worker/utils/embed-builder.ts`(코드 만들기)
- `src/worker/index.ts` 마운트 1줄(잠금 항목 무접촉 — SSR inject·캐시·#root 불변, 줄 수 불변)
- 가드 `src/tests/unit/embed-widgets-2026-10-31.test.ts` 15건(진짜 SQLite) + 주입 `scripts/mutations/embed-widgets-2026-10-31.mjs` 5건 전부 빨간불 확인
- 동반: `follow-redirects` override ^1.16.1 → ^1.16.2 (새 high advisory GHSA-mrwp-f3q8-3g9p 로 pre-push npm audit 가 막혀서. 패치 릴리스)

## 이번에 틀렸던 판단
- 탈출 시험이 `alt` 속성의 탈출된 이름으로 통과하고 있었다(본문을 안 탈출해도 초록). 주입이 잡았다 → 본문 span 으로 앵커.
- 첫 시안 페이지에서 "B·C·D 는 /embed/ 를 만들면 된다" 고 했는데 C(떠 있는 버튼)는 남의 페이지에 스크립트를 싣는 별개 일이다. 이번엔 안 만들었다.

## 남은 결정/대기
- "홈페이지에 넣기" 버튼을 에이전시 콘솔·유어샵 관리·마이 '내 가게' 에 넣을지(지금은 `/embed` 에서 아이디 직접 입력)
- 에이전시 번호를 에이전시가 볼 화면이 없다 — 위 버튼과 함께 풀 것
