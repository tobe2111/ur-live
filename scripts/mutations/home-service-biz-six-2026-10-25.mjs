/**
 * 🏪 가게 관리 6종 (2026-10-25) · 주입 매니페스트.
 *
 * 이 조가 막는 것은 **요약이 남의 틀로 위장하는 것**이다(추가 전 폴백이 숙소 틀이라 새 카테고리가
 * `'- -실 · -'` 로 사장님 알림톡에 나갔다). 그리고 **같은 요청이 두 경로로 들어오는 것**도 막는다.
 *
 * 가드: src/tests/unit/home-service-biz-six-2026-10-25.test.ts
 */
const TEST = 'src/tests/unit/home-service-biz-six-2026-10-25.test.ts'
const SRC = 'src/shared/home-service.ts'

export default [
  {
    name: '가게6종 🧾 요약 분기가 사라진다(폴백으로 떨어져 남의 틀이 알림톡에 나간다)',
    file: SRC,
    find: "  if (category === 'store_fridge') return `${d.address || '-'} · ${d.biz || '-'} · ${d.unit || '-'} · ${d.symptom || '-'} · ${d.urgency || '-'}`\n",
    replace: '',
    test: TEST,
    why: '수리 전 라이브 그대로다 — `requestSummary` 는 if 체인이라 분기가 없으면 **마지막 폴백**으로 떨어진다. 그 폴백이 숙소 틀이던 동안 6종 전부 `\'… · - -실 · - · -\'` 로 나왔다. 에러 0건이고 요청도 정상 접수되므로 **사장님이 받는 문장만 틀린다**(아무 신호가 없다).',
  },
  {
    name: '가게6종 🏚️ 폴백이 숙소 틀로 되돌아간다',
    file: SRC,
    find: "  return `${d.address || '-'} · ${d.biz || '-'}`",
    replace: "  return `${d.address || '-'} · ${d.lodging || '-'} ${d.rooms || '-'}실 · ${d.service || '-'} · ${d.cycle || '-'}`",
    test: TEST,
    why: '폴백은 "요약 틀을 안 만들었다" 의 신호여야 한다. 숙소 틀로 되돌리면 다음에 카테고리를 더하는 사람이 **그 카테고리가 숙소처럼 보이는 문장**을 받게 되고, 빈칸 검사만으로는 그게 숙소인지 새 카테고리인지 구분되지 않는다.',
  },
  {
    name: '가게6종 🔁 꺼낸 품목이 수리 안으로 되돌아간다(요청이 두 경로로)',
    file: SRC,
    find: "options: ['전기', '배관·누수', '문·유리', '바닥·벽', '기타'] },",
    replace: "options: ['전기', '배관·누수', '간판', '냉장·냉동 설비', '에어컨', '문·유리', '기타'] },",
    test: TEST,
    why: '알림은 **카테고리 단위**다. 수리 안에 남겨 두면 같은 "냉장고 고장" 요청이 수리로도 들어와 전기·배관 업체에게 함께 가고, 전용 카테고리를 고른 냉장 설비 업체는 그 요청을 못 본다. 대표 표의 "수리 안에서 따로 꺼낼 1순위" 를 되돌리는 방향이다.',
  },
  {
    name: '가게6종 🗑️ 추가한 카테고리가 목록에서 빠진다',
    file: SRC,
    find: "    key: 'store_drain',",
    replace: "    key: 'store_pest',",
    test: TEST,
    why: '대표 지시 *"위 업종들도 받아야 해"* 의 직접 회귀다. 키가 겹치면 뒤 항목이 조용히 가려져(배열이라 중복이 허용된다) 그 업종 요청을 **받을 수 없다** — 화면엔 카드가 하나 덜 보일 뿐이라 결함으로 안 보인다.',
  },
  {
    name: '가게6종 📍 지역 칸이 없는 칸을 가리킨다(사장님 지역 매칭이 조용히 0건)',
    file: SRC,
    find: "    voucherKeywords: ['냉장', '냉동', '쇼케이스', '제빙기'],\n    regionFields: ['address'],",
    replace: "    voucherKeywords: ['냉장', '냉동', '쇼케이스', '제빙기'],\n    regionFields: ['store_address'],",
    test: TEST,
    why: '`regionFields` 는 **그 요청을 어느 지역 사장님에게 보낼지** 고르는 키다. 없는 칸을 가리키면 지역이 안 잡혀 알림이 **한 명에게도 안 간다** — 요청은 정상 접수되고 손님은 견적을 기다리므로 가장 조용한 실패다.',
  },
  {
    name: '가게6종 🔗 crossSell 목적지가 없는 카테고리를 가리킨다',
    file: SRC,
    find: "crossSell: { to: 'store_sign', title: '간판도 함께 받아 보시겠어요?'",
    replace: "crossSell: { to: 'store_signboard', title: '간판도 함께 받아 보시겠어요?'",
    test: TEST,
    why: '신청을 마친 손님에게 "같이 하실래요?" 를 띄우는데 목적지가 없으면 그 버튼이 빈 화면으로 보낸다. 키 오타는 타입이 잡아 주지만(유니온) 문자열을 넓히는 변경이 함께 들어오면 통과할 수 있다.',
  },
  {
    name: '가게6종 📏 선택 칸을 요약에 넣는다(알림톡에 빈칸이 박힌다)',
    file: SRC,
    find: "  if (category === 'store_sign') return `${d.address || '-'} · ${d.biz || '-'} · ${d.work || '-'} · ${d.kind || '-'}`",
    replace: "  if (category === 'store_sign') return `${d.address || '-'} · ${d.biz || '-'} · ${d.work || '-'} · ${d.kind || '-'} · ${d.width || '-'}m`",
    test: TEST,
    why: '`width`(가로 길이)는 `required: false` 다. 요약에 넣으면 안 적은 손님의 알림톡에 `\'· -m\'` 이 박힌다 — 카카오 템플릿은 조건부 줄을 못 쓰므로 그 글자가 그대로 사장님에게 간다.',
  },
]
