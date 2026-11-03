# [UNLOCK_LOADING] 2026-11-03 — 카드→상세 사진 전환이 숙소에서 ~4초 화면을 얼리던 것

- 파일: `src/lib/deal-view-transition.ts` (2026-11-02 [UNLOCK_LOADING] 시안 D3 의 전환)
- 대표: *"숙소 이용권만 클릭하면 로딩이 상대적으로 길어. 왜그렇지?"* (잠금 파일 수정은 같은 날 대표 허가 *"잠금 파일도 다 허가"*)
- 실측(라이브, 폰 크기 Chromium, 홈 → 카드 클릭): 숙소 카드만 `TimeoutError: Transition was aborted because of timeout in DOM update` + `/api/_errors/log`. 이용권 카드는 없음.
- 원인: `waitForHero` 가 `requestAnimationFrame` 으로 폴링했다. 전환 도중엔 그리기가 멈춰 rAF 가 안 돈다 → 상세 첫 사진(`[data-vt-hero]`)이 첫 확인에 없으면 약속이 안 끝나고, 브라우저가 ~4초 뒤 끊었다. 이용권 상세는 청크를 미리 받아 첫 확인에 사진이 이미 있었고, 숙소는 청크(`lz-gbDetailL`·`AmenityIcon`)를 누른 뒤 받아 매번 걸렸다.
- 고친 것: 타이머 폴링(16ms) + 300ms 상한 `setTimeout`. 미리받기·캐시·청크는 무변경.
- 가드: `deal-transition-timer-2026-11-03.test.ts`(rAF 를 멈춘 상태에서 300ms 안에 끝나는지) + 주입 1건.
