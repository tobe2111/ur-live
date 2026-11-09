# [LOADING_ADDITIVE] 2026-11-09 홈 거리순 피드 시드(새 SSR 슬롯 MAINNEAR)

- 대표: 폰 캡처(로그인 · 위치 저장 · '거리순' · 피드 '불러오는 중…') + *"아직 많이 느리네.. 최적화 계속 해"*.
- 원인: 위치를 저장한 손님은 피드가 거리순(`&near=`)이라 MAIN 시드(인기순)를 못 쓰고 앱 부팅 뒤 한국→LA 로 다시 받았다.
- 바꾼 것: `src/worker/index.ts` 가 위치 쿠키(`ur_loc`)가 있으면 같은 격자 키 거리순 피드를 **별도 슬롯**
  `__SSR_INITIAL_MAINNEAR__`(data-near=키)로 함께 싣는다 — 400ms 마감, 넘으면 버린다. MAIN 슬롯·경로·잠금 4페이지 inject 는 그대로.
  `GroupBuyFeed` 는 키가 같을 때만 initialData 로 쓴다. 판정·경계: `src/worker/utils/home-near-seed.ts`.
- 잠금표 예외 조항 "새 SSR slot 추가(기존 inject 패턴 따라)" 에 해당.
- 가드: `home-near-seed-2026-11-09.test.ts` + 주입 2건 · 옛 가드 `home-near-empty-label-2026-10-17` 재조준(위치 없는 MAIN 은 여전히 금지).
