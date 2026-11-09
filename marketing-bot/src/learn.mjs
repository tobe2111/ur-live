// 성과로 스스로 배우는 장치 (2026-11-09 대표 "자동으로 머신러닝으로 개선해나가줘").
//
// 방식: 멀티암드 밴딧(톰슨 샘플링). 글마다 고른 선택지(시작 방식·분량·스레드 길이·시간대·형식…)를 기록하고,
// 매주 그 글의 성과(같은 플랫폼 평균 대비 배수)를 선택지별로 모아 "이 선택지가 얼마나 좋은가"의 분포를 만든다.
// 매일은 그 분포에서 한 번씩 뽑아 가장 높은 걸 고른다 → 잘 된 쪽을 더 자주 고르면서도 덜 써 본 쪽을 계속 시험한다.
// 데이터가 적을 때(하루 1~2개)도 안전하게: 처음엔 모두 평균(1.0)으로 보고, 글이 쌓일수록 차이를 믿는다.
//
// 두 번째 장치: 매주 잘된 글·안 된 글을 Claude 가 비교해 "글쓰기 교훈" 최대 4줄을 뽑는다(사실·숫자 금지, 스타일만).
// 교훈은 다음 주 글 지시문에 들어가고, 다음 주 성과로 다시 바뀐다.
import { BANNED_WORDS } from './vet.mjs';

export const PRIOR = { mean: 1, n: 2, sd: 0.6 };
export const DIMS = ['hook', 'format', 'len', 'slot', 'media', 'series', 'topic_tag'];

// 같은 플랫폼 평균 대비 배수(0~3). rows = [{ id, platform, metrics: { score } }]
export function rewards(rows = []) {
  const avg = {};
  for (const p of rows) { const a = (avg[p.platform] ||= { n: 0, s: 0 }); a.n++; a.s += p.metrics?.score || 0; }
  return new Map(rows.map((p) => {
    const b = avg[p.platform].s / avg[p.platform].n;
    return [String(p.id), b ? Math.min(3, (p.metrics?.score || 0) / b) : 1];
  }));
}

// 기록(variety.json 항목) + 보상 → { dim: { arm: { n, mean } } }
export function fitArms(log = [], reward = new Map(), dims = DIMS) {
  const acc = {};
  for (const e of log) {
    const r = reward.get(String(e.id));
    if (r == null) continue;
    for (const d of dims) {
      const arm = e[d];
      if (arm == null || arm === '') continue;
      const a = ((acc[d] ||= {})[String(arm)] ||= { n: 0, s: 0 });
      a.n++; a.s += r;
    }
  }
  const out = {};
  for (const [d, arms] of Object.entries(acc)) {
    out[d] = {};
    for (const [arm, a] of Object.entries(arms)) out[d][arm] = { n: a.n, mean: Math.round((a.s / a.n) * 100) / 100 };
  }
  return out;
}

// 재현 가능한 난수(같은 날 같은 결과 — 재실행해도 같은 선택)
export function rng(seed) {
  let x = (Math.abs(Math.floor(seed)) * 2654435761 + 1013904223) >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
function normal(rand) { const u = Math.max(1e-9, rand()), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// 사후 평균·폭: 사전(평균 1, 글 2개 분량)과 관측을 섞는다
export function posterior(stat) {
  const n = stat?.n || 0, m = stat?.mean ?? PRIOR.mean;
  return { mean: (PRIOR.mean * PRIOR.n + m * n) / (PRIOR.n + n), sd: PRIOR.sd / Math.sqrt(PRIOR.n + n) };
}

// 톰슨 샘플링: candidates 중 하나. exclude 는 피할 것(어제와 같은 것 등), 다 빠지면 무시.
export function thompsonPick(candidates = [], stats = {}, seed = 0, { exclude = [] } = {}) {
  const pool = candidates.filter((c) => !exclude.includes(String(c)));
  const list = pool.length ? pool : candidates;
  if (!list.length) return null;
  const rand = rng(seed);
  let best = null, bestV = -Infinity;
  for (const c of list) {
    const p = posterior(stats[String(c)]);
    const v = p.mean + p.sd * normal(rand);
    if (v > bestV) { bestV = v; best = c; }
  }
  return best;
}

// ---- 글쓰기 교훈 ----
export const LESSON_SYSTEM = `너는 SNS 글 편집장이다. 같은 계정의 반응 좋았던 글과 반응 없던 글을 비교해, 다음 글에 바로 적용할 글쓰기 교훈을 뽑는다.
- 최대 4개, 각 50자 이내 한 문장. 첫 줄·길이·말투·구성·단어 선택 같은 *쓰는 방식*만.
- 숫자, 수수료·조건 같은 사실, 성과 약속, 특정 가게 이름은 쓰지 않는다.
- 데이터로 뒷받침되는 것만. 차이가 안 보이면 적게 쓴다.
- JSON 배열만 출력: ["...", "..."]`;
export function parseLessons(text) {
  let arr;
  try { arr = JSON.parse(String(text || '').replace(/^[^[]*/, '').replace(/[^\]]*$/, '')); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s || '').trim())
    .filter((s) => s.length >= 6 && s.length <= 60 && !/\d/.test(s) && !BANNED_WORDS.some((w) => s.includes(w)))
    .slice(0, 4);
}
export function lessonInput(rows = [], reward = new Map(), k = 3) {
  const scored = rows.filter((p) => p.text).map((p) => ({ p, r: reward.get(String(p.id)) ?? 1 })).sort((a, b) => b.r - a.r);
  if (scored.length < 2 * k) return null;
  const fmt = (x) => `[${x.p.platform}, 평균의 ${x.r.toFixed(2)}배]\n${String(x.p.text).replace(/https?:\/\/\S+/g, '').trim().slice(0, 400)}`;
  return `반응 좋았던 글:\n${scored.slice(0, k).map(fmt).join('\n\n')}\n\n반응 없던 글:\n${scored.slice(-k).map(fmt).join('\n\n')}`;
}
export function lessonsBlock(lessons = []) {
  return lessons.length ? `\n[지난 성과에서 배운 점 — 매주 자동 갱신, 위 규칙과 부딪히면 위 규칙이 이긴다]\n${lessons.map((l) => `- ${l}`).join('\n')}\n` : '';
}

// 사람이 읽는 요약(주간 리포트)
export function armsReport(arms = {}) {
  const lines = [];
  for (const d of DIMS) {
    const a = arms[d];
    if (!a) continue;
    const sorted = Object.entries(a).sort((x, y) => posterior(y[1]).mean - posterior(x[1]).mean);
    lines.push(`- ${d}: ${sorted.map(([k, v]) => `${k} ${v.mean}배(${v.n}개)`).join(' · ')}`);
  }
  return lines.length ? lines.join('\n') : '- 아직 학습할 글이 없습니다(선택지 기록은 2026-11-10 부터).';
}

// 기록 + 실물(시간대·미디어 종류)을 합친 학습용 목록. 기록에 없는 실물 글도 시간대·형식만으로 들어간다.
const MEDIA = { REELS: 'reel', VIDEO: 'reel', CAROUSEL_ALBUM: 'carousel', CAROUSEL: 'carousel', IMAGE: 'image', TEXT_POST: 'text' };
export function learnLog(vlog = [], rows = []) {
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const seen = new Set();
  const out = vlog.filter((e) => e.id).map((e) => {
    seen.add(String(e.id));
    const r = byId.get(String(e.id));
    return r ? { ...e, slot: e.slot || r.slot_kst, media: e.media || MEDIA[r.media_type] } : e;
  });
  for (const r of rows) if (!seen.has(String(r.id))) out.push({ id: r.id, platform: r.platform, slot: r.slot_kst, media: MEDIA[r.media_type] });
  return out;
}
