/** 🧬 주입 — 숙소 상세 머리의 가격 줄 자리 예약. 가드: src/tests/unit/stay-head-price-reserve-2026-11-11.test.tsx */
const T = 'src/tests/unit/stay-head-price-reserve-2026-11-11.test.tsx'
export default [
  { name: '숙소가격자리 — 예약을 뺀다(가격이 오면 아래가 68px 밀린다)', file: 'src/pages/stay-detail/StayHeadCard.tsx', find: '{pricePending && !(minPrice != null && minPrice > 0) && <div className={STAY_HEAD.pricePending} aria-hidden="true" />}', replace: '', test: T, why: '2026-11-11 라이브 rAF 추적 — 머리 73 → 141px, CLS 0.03~0.045.' },
  { name: '숙소가격자리 — 가격이 와도 예약을 남긴다(가격 위에 빈 칸 68px)', file: 'src/pages/stay-detail/StayHeadCard.tsx', find: '{pricePending && !(minPrice != null && minPrice > 0) && <div', replace: '{pricePending && <div', test: T, why: '반대 방향 — 예약과 가격이 같이 그려져 머리가 68px 더 길어진다.' },
  { name: '숙소가격자리 — 화면이 조회 완료를 안 알린다(매진 숙소에 빈 칸이 영영 남는다)', file: 'src/pages/StayDetailPage.tsx', find: '.finally(() => { setRoomsLoading(false); setRoomsTried(true) })', replace: '.finally(() => { setRoomsLoading(false) })', test: T, why: '가격이 없는 숙소는 머리 아래 68px 빈 칸이 계속 남는다.' },
  { name: '숙소가격자리 — 예약 높이가 가격 줄과 갈린다', file: 'src/shared/stay-head.ts', find: "pricePending: 'mt-3 h-14',", replace: "pricePending: 'mt-3 h-8',", test: T, why: '예약이 실제 줄보다 낮으면 그 차이만큼 다시 밀린다.' },
]
