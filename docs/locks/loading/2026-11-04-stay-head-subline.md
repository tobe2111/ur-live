# [UNLOCK_LOADING] 2026-11-04 — 숙소 상세 서버 첫 화면의 제목 위 줄 = 이용권 머리와 같은 [유형 · 성급 · 지역]

- 대표: *"왜 기존 이용권이랑 숙소 이용권이 서로 다른거야"* → *"합쳐줘"* (잠금 파일 허가 2026-11-03 *"잠금 파일도 다 허가해줄테니"*).
- 바꾼 것: `worker/utils/stay-detail-ssr-body.ts` 가 h1 위에 성급만(`<span>N성급</span>`, 49건 중 37건은 빈 줄) 그리던 것을
  `staySubLine()`(shared/stay-head.ts) 결과로 — 화면 `StayHeadCard` 와 **같은 함수·같은 클래스**(`STAY_HEAD.metaRow`, 12px→13px).
- 경계는 그대로 h1 까지. 별점·가격은 h1 **아래**라 나중에 와도 위가 안 움직인다(가격은 날짜별 객실 조회 뒤).
- 줄이 비어도 div 는 그린다(4px) — 시험 `stay-detail-ssr-first-screen-2026-10-12` · 주입 `stay-detail-first-screen-2026-10-12`.
- 첫 화면 무게: stayDetail 218.8KB(예산 217.3 + 허용 1.5 안).
- ⚠️ 못 보는 것: 실제 프레임에서 안 튀는지 — 배포 뒤 라이브 캡처로 본다.
