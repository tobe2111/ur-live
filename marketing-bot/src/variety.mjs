// 반복 방지·다양화 도우미 (순수 함수 — test/variety.test.mjs)
// 문제: 미디어/주제를 dayIdx % N 으로만 골라 같은 카드·같은 첫 문장이 계속 나왔다.
// 해결: 최근 기록(posts.json)을 보고 "가장 오래 안 쓴 것"을 고르고, 글의 시작 방식(훅)·형식도 돌려 쓴다.

// 최근 게시 기록에서 key(예: 'media_set')별 마지막 사용 위치. 안 쓴 건 -1.
function lastUsed(history, field) {
  const m = new Map();
  history.forEach((p, i) => { if (!p.skipped && p[field] != null) m.set(p[field], i); });
  return m;
}

// 후보 중 가장 오래 안 쓴 것(동률이면 seed 로 돌림). keyOf 로 후보의 식별자를 뽑는다.
export function pickLeastRecent(candidates, history, field, keyOf, seed = 0) {
  const uniq = [];
  const seen = new Set();
  for (const c of candidates) { const k = keyOf(c); if (!seen.has(k)) { seen.add(k); uniq.push(c); } }
  if (!uniq.length) return null;
  const used = lastUsed(history, field);
  const score = (c) => (used.has(keyOf(c)) ? used.get(keyOf(c)) : -1);
  const min = Math.min(...uniq.map(score));
  const tied = uniq.filter((c) => score(c) === min);
  return tied[Math.abs(seed) % tied.length];
}

// 캐러셀 이미지를 회전시켜 표지(첫 장)를 바꾼다. 같은 세트를 다시 써도 피드에서 다르게 보인다.
export function rotateImages(images, times) {
  if (!images?.length) return images;
  const k = ((times % images.length) + images.length) % images.length;
  return [...images.slice(k), ...images.slice(0, k)];
}

// 글 시작 방식(훅). 매번 다른 걸 쓰고, 최근 쓴 건 피한다.
export const HOOKS = [
  { id: 'headline', guide: '핵심 메시지를 제목처럼 한 줄로 먼저 던지고, 이어서 짧게 설명한다. 장면·일화를 지어내지 않는다.' },
  { id: 'number', guide: '[확인된 사실]의 숫자 하나로 시작한다(예: 0원, 10%). 숫자는 꾸미지 않는다.' },
  { id: 'myth', guide: '사장님들이 흔히 오해하는 점 하나를 짚으며 시작한다("~하면 손해 아닌가 싶으시죠" 같은 느낌, 질문 오프너는 금지).' },
  { id: 'oneliner', guide: '짧고 툭 던지는 한 문장으로 시작하고, 이어서 담담하게 설명한다.' },
  { id: 'udal', guide: '유어딜 마스코트 "유달이"가 부산 사투리로 한마디 툭 던지며 시작한다(예: "아이고 사장님, 광고비 또 나갔십니꺼"). 유달이 대사는 1~2줄만, 나머지는 운영자 말투로 정리한다. 유치하지 않게, B급 유머 한 스푼.' },
  { id: 'why', guide: '"왜 이렇게 만들었나"를 구조의 이유로 설명하며 시작한다(예: 안 팔리면 0원인 이유). 회의·대화 장면을 지어내지 않는다.' },
  { id: 'compare', guide: '"보통은 이런데, 저희는 이렇게 했어요" 식의 담담한 비교로 시작한다. 다른 회사 이름은 쓰지 않는다.' },
];

export const FORMATS = [
  '아주 짧게: 두 줄, 90자 안팎.',
  '짧게: 세 줄, 140자 안팎.',
  '한 줄 + 설명: 첫 줄 한 문장, 이어서 한두 줄, 170자 안팎.',
];

export function pickHook(history, seed = 0) {
  return pickLeastRecent(HOOKS, history, 'hook', (h) => h.id, seed);
}
export function pickFormat(seed = 0) { return FORMATS[Math.abs(seed) % FORMATS.length]; }

// 최근 글들의 첫 문장 — "이렇게 시작하지 마라"로 프롬프트에 넣는다.
export function recentOpeners(texts, n = 8) {
  return texts.slice(-n).map((t) => String(t).trim().split(/[.!?\n]/)[0].slice(0, 50)).filter(Boolean);
}
