// 시리즈 코너 — 글과 이미지의 "틀"을 정한다 (순수 데이터 + 고르기 함수, test/series.test.mjs).
//
// 2026-11-09 대표: "퀄리티가 너무 낮고 AI 티가 너무 난다" · "별거 없잖아, 가시성도 재미도 없고".
// 참고 계정(naver.plus.store · toss.place · nol.always)의 공통점:
//   ① 큰 사진 한 장 + 굵은 제목 두 줄이 전부다(제목이 곧 메시지).
//   ② 글 하나에 메시지 하나. 설명은 안쪽 장이나 캡션 2~4줄로.
//   ③ 이름 붙은 시리즈로 나온다("빵력장터", "이주의 NOL 소식") — 팔로워가 형식을 알아본다.
//   ④ 캡션은 짧고, 끝은 정보형 한 줄. 지어낸 일화가 없다.
// 종전 봇은 "규칙 설명(약관)"만 주제로 받고, "오늘 있었던 일·사장님께 들은 말로 시작하라"는 지시 때문에
// 없던 장면을 지어냈다. 코너가 그 자리를 대신한다.

export const SERIES = {
  'owner-note': {
    name: '사장님 운영노트',
    tracks: ['merchant'],
    guide: '유어딜 홍보가 아니라 동네 식당·카페·뷰티샵 사장님이 바로 써먹을 운영 팁 하나를 준다(정보 70%). 유어딜은 마지막 한 줄에서만 가볍게 연결한다. 통계·연구 결과·퍼센트를 지어내지 않는다.',
    topics: [
      '메뉴 사진은 어떻게 찍어야 맛있어 보이나 (빛 방향, 각도, 배경 정리)',
      '노쇼를 줄이는 예약 확인 문자 쓰는 법',
      '리뷰 답글: 칭찬 리뷰와 아쉬운 리뷰에 각각 어떻게 답하나',
      '비는 시간(평일 오후)에 손님을 부르는 방법',
      '처음 온 손님을 단골로 만드는 작은 습관',
      '할인을 걸 메뉴와 걸면 안 되는 메뉴 고르는 법 (첫 방문 메뉴 vs 마진 좋은 세트)',
      '가게 소개 글 첫 문장 쓰는 법',
      '인플루언서 체험단을 부를 때 손해 보지 않는 기준',
    ],
    photo: 'restaurant kitchen chef plating food',
  },
  'by-numbers': {
    name: '숫자로 보는 유어딜',
    tracks: ['merchant', 'creator'],
    guide: '[확인된 사실]에 있는 숫자 하나만 골라 제목으로 세운다(예: 0원, 10%, 1만원, 6자리). 그 숫자가 사장님/크리에이터에게 무슨 뜻인지 두세 문장으로만 설명한다. 다른 숫자를 늘어놓지 않는다.',
    photo: 'small restaurant counter smartphone payment',
  },
  'myth-fact': {
    name: '오해와 사실',
    tracks: ['merchant', 'creator'],
    guide: '오늘 주제에 대해 흔히 하는 오해 한 가지를 한 문장으로 말하고, 사실을 [확인된 사실] 범위 안에서 담백하게 말한다. 과장 없이.',
    photo: 'cafe owner thinking',
  },
  'udal-qna': {
    name: '유달이 상담소',
    tracks: ['merchant', 'creator'],
    guide: '마스코트 유달이(갈색 수달, 부산 사투리)가 "자주 받는 질문" 하나에 답한다. 질문은 특정 인물이 한 말로 꾸미지 말고 "자주 받는 질문"으로만 쓴다. 유달이 대사는 1~2줄, 사투리는 과하지 않게 B급 유머 한 스푼. 나머지 설명은 운영자 말투로 정리한다.',
    mascot: true,
    photo: 'korean street food alley night',
  },
  'quick-guide': {
    name: '3분 가이드',
    tracks: ['merchant', 'creator'],
    guide: '오늘 주제를 순서가 있는 짧은 단계로 보여준다. 캡션에는 번호 목록을 쓰지 말고, 단계는 이미지 안쪽 장에 나눈다. 캡션은 "이렇게 하면 된다"는 요지 2~3줄.',
    photo: 'person using smartphone in cafe',
  },
  'deal-pick': {
    name: '이번 주 동네딜',
    tracks: ['consumer'],
    guide: '오늘 상품 하나를 짧게 소개한다. 메뉴가 어떤 사람·어떤 상황에 맞는지 한두 문장, 상품 정보에 없는 가격·할인율·맛 평가는 쓰지 않는다. 먹어본 척하지 않는다.',
    photo: 'korean food table',
  },
  'field-note': {
    name: '현장노트',
    tracks: ['merchant', 'creator', 'consumer'],
    fieldNoteOnly: true,
    guide: '[현장 메모]에 적힌 실제 일만 쓴다. 메모에 없는 장면·대사·숫자를 보태지 않는다. 메모가 짧으면 글도 짧게.',
    photo: 'local shop street',
  },
};

// 오늘 트랙에서 쓸 코너. 최근에 안 쓴 것부터(같은 트랙 기록 기준), 현장 메모가 있으면 무조건 현장노트.
// weights(주간 리뷰가 data/series-state.json 에 남김)가 있으면 "오래 안 쓴 절반" 안에서 반응 좋은 코너를 더 자주 고른다.
// 반쪽 안에서만 고르므로 한 코너만 계속 나오지는 않는다.
export function pickSeries(track, history = [], seed = 0, { fieldNote = false, weights = null } = {}) {
  if (fieldNote) return { id: 'field-note', ...SERIES['field-note'] };
  const ids = Object.keys(SERIES).filter((id) => !SERIES[id].fieldNoteOnly && SERIES[id].tracks.includes(track));
  if (!ids.length) return { id: 'by-numbers', ...SERIES['by-numbers'] };
  const last = new Map();
  history.forEach((p, i) => { if (!p.skipped && p.series) last.set(p.series, i); });
  const score = (id) => (last.has(id) ? last.get(id) : -1);
  let id;
  if (weights && Object.keys(weights).length && ids.length > 1) {
    const pool = [...ids].sort((a, b) => score(a) - score(b) || ids.indexOf(a) - ids.indexOf(b)).slice(0, Math.ceil(ids.length / 2));
    const w = pool.map((x) => Math.max(0.1, Number(weights[x]) || 1));
    const total = w.reduce((a, b) => a + b, 0);
    let r = ((Math.abs(seed) * 2654435761) % 1000) / 1000 * total;
    id = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { if (r < w[i]) { id = pool[i]; break; } r -= w[i]; }
  } else {
    const min = Math.min(...ids.map(score));
    const tied = ids.filter((x) => score(x) === min);
    id = tied[Math.abs(seed) % tied.length];
  }
  return { id, ...SERIES[id] };
}

// 코너별 반응 → 가중치. rows = [{ id, platform, metrics: { score } }], idToSeries = Map(게시물 id → 코너 id).
// 플랫폼마다 숫자 크기가 달라(인스타 도달 vs 스레드 조회) 플랫폼 평균으로 나눈 비율을 쓴다.
// 글이 2개 미만인 코너는 1(보통)로 둔다. 범위 0.5~2.
export function seriesWeights(rows = [], idToSeries = new Map()) {
  const avg = {};
  for (const p of rows) { const a = (avg[p.platform] ||= { n: 0, s: 0 }); a.n++; a.s += p.metrics?.score || 0; }
  const g = {};
  for (const p of rows) {
    const sid = idToSeries.get(String(p.id));
    const base = avg[p.platform].s / avg[p.platform].n;
    if (!sid || !base) continue;
    (g[sid] ||= []).push((p.metrics?.score || 0) / base);
  }
  const weights = {}, counts = {};
  for (const [sid, v] of Object.entries(g)) {
    counts[sid] = v.length;
    weights[sid] = v.length < 2 ? 1 : Math.round(Math.min(2, Math.max(0.5, v.reduce((a, b) => a + b, 0) / v.length)) * 100) / 100;
  }
  return { weights, counts };
}

// 운영노트는 자기 주제 목록을 쓴다(약관 주제가 아니라 사장님 일상 고민).
export function seriesTopic(series, trackTopic, history = [], seed = 0) {
  if (!series.topics?.length) return trackTopic;
  const used = new Set(history.filter((p) => p.series === series.id).slice(-series.topics.length + 1).map((p) => p.topic));
  const fresh = series.topics.filter((t) => !used.has(t));
  const pool = fresh.length ? fresh : series.topics;
  return pool[Math.abs(seed) % pool.length];
}

// 큰 회사 계정처럼 쓰는 규칙 — 모든 코너 공통
export const BRAND_WRITING = `[글 원칙 — 큰 브랜드 계정처럼]
- 글 하나에 메시지 하나. 첫 줄만 읽어도 무슨 얘기인지 안다.
- 짧게. 인스타 캡션은 2~4줄, 스레드는 1~3문장. 길게 설명하지 않는다.
- 없던 일을 지어내지 않는다: "사장님께 들은 말", "지난주에 만난", "오늘 아침에", "얘기를 하다가" 같은 장면·대사·일화 금지(현장 메모가 있을 때만 그 내용 그대로).
- 먹어본 척, 가본 척 금지. 고객인 척 금지.
- 끝을 "A파세요, B파세요?" 같은 양자택일 질문이나 "여러분은 어떠세요?"로 맺지 않는다. 마무리는 정보형 한 줄.
- 줄표(—), 느낌표 연발, "솔직히 말씀드리면", "사실 저도" 같은 AI 상투구를 쓰지 않는다.

[사람이 쓴 글처럼 — 2026-11-09 대표 "길게 쓴다고 다가 아니야"]
- 할 말만 쓰고 멈춘다. 빼도 뜻이 통하는 문장은 쓰지 않는다(앞말 되풀이, 이유 덧붙이기, "그래서 ~하고 싶었어요" 같은 자기 글 설명).
- 모든 문장을 "~요"로 끝내지 않는다. "사장님 몫은 90%." 처럼 명사로 끝나는 짧은 문장을 섞는다.
- 접속사("그런데", "그래서", "또한", "다만")로 문장을 잇지 않는다. 문장을 끊는다.
- 맛·분위기 묘사, 운영자 취향("저는 ~가 취향이에요"), 떠오르는 장면 묘사를 쓰지 않는다.
- 조건을 여러 개 늘어놓지 않는다. 오늘 메시지에 필요한 사실 한두 개만.
- 나쁜 예(길고 설명조): "수수료 얘기는 입점 안내에서 제일 뒤로 밀리곤 하는데, 저는 앞에 두는 게 맞다고 생각해요. 직접 입점하시면 판매가의 10%, 사장님 몫은 90%예요. … 그래서 조건은 숫자로 먼저 보여드리고 싶었어요."
- 좋은 예(같은 내용, 사람이 쓴 길이): "수수료는 판매가의 10%. 사장님 몫은 90%예요.\n가입비도 광고비도 없고, 손님이 이용권을 쓴 뒤에만 나가요.\n조건은 프로필 링크에 있어요."
  (예시 문장은 베끼지 않는다. 길이와 온도만 참고.)`;

// ---- 스레드 주제 태그 (2026-11-09 대표 승인 "1~2 다 하자") ----
// 스레드는 글 하나에 주제 태그 하나를 달 수 있고, 그 주제를 보는 사람에게도 글이 뜬다(API: topic_tag, 1~50자, 마침표·& 금지).
// 트랙별로 독자가 찾아볼 법한 주제를 돌려 쓴다.
export const THREADS_TOPICS = {
  merchant: ['자영업', '소상공인', '식당창업'],
  creator: ['인플루언서', '블로그체험단'],
  consumer: ['맛집', '동네맛집'],
};
export function threadsTopicTag(track, seed = 0) {
  const list = THREADS_TOPICS[track] || THREADS_TOPICS.merchant;
  return list[Math.abs(seed) % list.length];
}

// ---- 다시 보기: 반응 좋았던 글을 새 형식으로 (2026-11-09 대표 승인) ----
// 주간 리뷰가 data/encore.json 에 "2주 넘게 지났고 반응이 평균보다 30% 이상 좋았던 글"을 남긴다.
// 일요일(KST)에 오늘 트랙과 같은 후보가 있으면 그 글의 메시지를 새 문장·새 형식(인스타는 릴스)으로 다시 쓴다.
// 한 글은 한 번만 다시 쓴다(data/variety.json 의 encore_of).
export const ENCORE = {
  id: 'encore',
  name: '다시 보기',
  guide: '[반응 좋았던 글]과 같은 메시지를 완전히 새로 쓴다. 첫 문장·구성·표현을 모두 바꾸고 원글 문장을 다시 쓰지 않는다. 원글보다 짧게. 원글에 없던 사실을 보태지 않는다.',
  photo: 'local shop street',
};
export function pickEncore(candidates = [], track, used = new Set()) {
  return (candidates || []).filter((c) => c?.id && c.text && c.track === track && !used.has(String(c.id)))
    .sort((a, b) => (b.ratio || 0) - (a.ratio || 0))[0] || null;
}
// 주간 리뷰용: rows = [{ id, platform, ms, text, metrics: { score } }] → 후보 목록
export function encoreCandidates(rows = [], idToTrack = new Map(), idToSeries = new Map(), now = Date.now(), { minAgeDays = 14, minRatio = 1.3, max = 5 } = {}) {
  const avg = {};
  for (const p of rows) { const a = (avg[p.platform] ||= { n: 0, s: 0 }); a.n++; a.s += p.metrics?.score || 0; }
  return rows
    .filter((p) => p.text && p.ms && now - p.ms >= minAgeDays * 864e5)
    .map((p) => {
      const base = avg[p.platform].s / avg[p.platform].n;
      return { id: String(p.id), platform: p.platform, ratio: base ? Math.round(((p.metrics?.score || 0) / base) * 100) / 100 : 0,
        track: idToTrack.get(String(p.id)) || p.track || null, series: idToSeries.get(String(p.id)) || null,
        text: String(p.text).replace(/https?:\/\/\S+/g, '').trim().slice(0, 600), posted_at: new Date(p.ms).toISOString() };
    })
    .filter((c) => c.ratio >= minRatio && c.track)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, max);
}
