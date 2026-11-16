// 오늘의 시기 한 줄 (2026-11-16 대표 "계속 개선해줘" — 매일 아침 트렌드 엮기).
// 실시간 트렌드(스레드 키워드 검색)는 앱 심사가 필요해 못 쓴다. 대신 누구나 아는 날짜·계절을 글의 첫 장면으로만 쓴다.
// 규칙: 숫자·사실이 아니라 "장면"이다. [확인된 사실]을 대신하지 않고, 지금 일어나는 일을 지어내지 않는다.
// 날짜가 해마다 바뀌는 날(설·추석·수능)은 넣지 않는다 — 틀린 날짜를 쓰느니 안 쓴다.

// [시작 MM-DD, 끝 MM-DD, 장면, 어울리는 트랙]
export const MOMENTS = [
  ['02-10', '02-14', '밸런타인데이 앞둔 주', ['consumer', 'merchant']],
  ['03-01', '03-10', '새 학기·새 출발 시즌', ['creator', 'merchant']],
  ['03-11', '03-14', '화이트데이 앞둔 주', ['consumer']],
  ['04-01', '04-15', '벚꽃·봄나들이 시즌', ['consumer', 'creator']],
  ['05-01', '05-08', '가정의 달 첫 주(어린이날·어버이날)', ['consumer', 'merchant']],
  ['05-09', '05-15', '스승의 날 앞둔 주', ['consumer']],
  ['06-20', '07-10', '장마철', ['merchant', 'consumer']],
  ['07-15', '08-20', '휴가철', ['consumer', 'creator', 'merchant']],
  ['09-01', '09-10', '가을 시작, 선선해지는 저녁', ['consumer']],
  ['10-25', '10-31', '핼러윈 주간', ['consumer', 'creator']],
  ['11-05', '11-11', '빼빼로데이 앞둔 주', ['consumer']],
  ['11-12', '11-30', '연말 모임 예약이 슬슬 잡히는 때', ['merchant', 'consumer']],
  ['12-01', '12-20', '연말 회식·송년회 시즌', ['merchant', 'consumer']],
  ['12-21', '12-25', '크리스마스 주간', ['consumer', 'merchant']],
  ['12-26', '12-31', '한 해 마무리 주간', ['merchant', 'creator', 'consumer']],
  ['01-01', '01-10', '새해 첫 주, 새해 다짐', ['creator', 'merchant']],
];

const SEASONS = { 12: '겨울', 1: '겨울', 2: '겨울', 3: '봄', 4: '봄', 5: '봄', 6: '여름', 7: '여름', 8: '여름', 9: '가을', 10: '가을', 11: '가을' };
const DOW = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const DOW_SCENE = { 1: '한 주가 시작되는 월요일', 5: '주말을 앞둔 금요일', 6: '바쁜 토요일', 0: '쉬어 가는 일요일' };

// kst = KST 로 옮긴 Date(getUTC* 가 KST 값을 준다)
export function momentFor(kst, track) {
  const md = `${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
  const hit = MOMENTS.find(([a, b, , tracks]) => md >= a && md <= b && (!track || tracks.includes(track)));
  const dow = kst.getUTCDay();
  return { moment: hit ? hit[2] : null, season: SEASONS[kst.getUTCMonth() + 1], day: DOW_SCENE[dow] || DOW[dow] };
}

export function seasonBlock(kst, track) {
  const m = momentFor(kst, track);
  const now = [m.moment, `${m.season}`, m.day].filter(Boolean).join(' · ');
  return `\n[오늘의 시기 — 첫 장면으로만 써도 된다(안 써도 된다)] ${now}
- 시기는 공감을 여는 장면일 뿐이다. 그 시기 때문에 손님이 늘어난다·매출이 오른다 같은 말은 하지 않는다. 날짜·숫자를 새로 만들지 않는다.`;
}
