// UTM 링크 · 카테고리 비율 자기조정 · 가입 귀속 — 순수 함수 (네트워크 없음, test/attribution.test.mjs 가 직접 잰다).

// 카테고리(트랙) ↔ utm_campaign. 봇 글의 utm_campaign 은 이 값 그대로다(날짜는 utm_content 에).
export const TRACKS = ['merchant', 'creator', 'consumer'];
export const DEFAULT_WEIGHTS = { merchant: 60, creator: 25, consumer: 15 };
export const DEFAULT_BOUNDS = { merchant: [45, 70], creator: [15, 35], consumer: [10, 25] };
export const DEFAULT_CAMPAIGNS = { merchant: 'merchant-recruit', creator: 'creator-recruit', consumer: 'consumer-deal' };

const SAFE = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/**
 * 게시물마다 고유한 UTM 링크.
 * utm_source=플랫폼 · utm_medium=social · utm_campaign=카테고리 · utm_content=<글 id>-<YYYYMMDD>
 */
export function buildUtmLink(url, { platform, campaign, contentId, date }) {
  const u = new URL(url);
  u.searchParams.set('utm_source', SAFE(platform));
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', SAFE(campaign));
  u.searchParams.set('utm_content', SAFE(`${contentId}-${date}`));
  return u.toString();
}

export function campaignToTrack(campaign, campaigns = DEFAULT_CAMPAIGNS) {
  const c = String(campaign || '').replace(/^\d{8}-/, '');
  for (const t of TRACKS) if (campaigns[t] === c || t === c) return t;
  return null;
}

/**
 * 하루 인덱스 → 트랙. 가중치(합 100)를 황금비 저불일치 수열로 고르게 섞는다
 * (12일 연속 같은 트랙 같은 뭉침 없이, 장기 비율은 가중치와 같다).
 */
export function pickTrackByWeights(idx, weights = DEFAULT_WEIGHTS) {
  const total = TRACKS.reduce((a, t) => a + Math.max(0, Number(weights[t]) || 0), 0) || 1;
  const x = ((idx * 0.6180339887498949) % 1 + 1) % 1;
  let acc = 0;
  for (const t of TRACKS) {
    acc += Math.max(0, Number(weights[t]) || 0) / total;
    if (x < acc) return t;
  }
  return TRACKS[TRACKS.length - 1];
}

/** 카테고리별 성과 집계: posts(글 수) · clicks(링크 클릭+랜딩) · signups(가입+입점 신청+크리에이터 신청). */
export function categoryPerformance({ posts = [], threadsClicks = null, utmRows = null, campaigns = DEFAULT_CAMPAIGNS }) {
  const perf = Object.fromEntries(TRACKS.map((t) => [t, { posts: 0, clicks: 0, signups: 0, landings: 0, store_applies: 0, creator_applies: 0, user_signups: 0 }]));
  for (const p of posts) {
    const t = TRACKS.includes(p.track) ? p.track : null;
    if (!t) continue;
    perf[t].posts++;
    if (threadsClicks && p.platform === 'threads' && p.link) {
      const content = (() => { try { return new URL(p.link).searchParams.get('utm_content'); } catch { return null; } })();
      for (const [u, v] of Object.entries(threadsClicks)) {
        if (u === p.link || (content && u.includes(`utm_content=${content}`))) perf[t].clicks += Number(v) || 0;
      }
    }
  }
  for (const r of utmRows || []) {
    const t = campaignToTrack(r.campaign, campaigns);
    if (!t) continue;
    perf[t].landings += r.landings || 0;
    perf[t].user_signups += r.signups || 0;
    perf[t].store_applies += r.store_applies || 0;
    perf[t].creator_applies += r.creator_applies || 0;
  }
  for (const t of TRACKS) {
    const a = perf[t];
    a.clicks += a.landings;
    // 카테고리 목적에 맞는 전환: 입점 글=입점 신청, 크리에이터 글=크리에이터 신청, 딜 글=가입
    a.signups = t === 'merchant' ? a.store_applies : t === 'creator' ? a.creator_applies : a.user_signups;
  }
  return perf;
}

/**
 * 주간 비율 자기조정. 점수/글 = (클릭 + 20×가입) / 글 수.
 * 가장 잘한 카테고리로, 가장 못한 카테고리에서 최대 step 포인트를 옮긴다(범위 안에서만). 합계는 100 유지.
 * 데이터가 부족하면(어느 카테고리든 글 < minPosts, 또는 신호 0) 그대로 둔다.
 */
export function adjustWeights(weights, perf, { bounds = DEFAULT_BOUNDS, step = 5, minPosts = 2, signupWeight = 20 } = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const clamp = (t, v) => Math.min(bounds[t][1], Math.max(bounds[t][0], v));
  for (const t of TRACKS) w[t] = clamp(t, Math.round(Number(w[t]) || 0));
  const fixSum = () => { // 반올림·클램프 뒤 합을 100 으로 (범위 안에서)
    let diff = 100 - TRACKS.reduce((a, t) => a + w[t], 0);
    for (const t of TRACKS) {
      if (!diff) break;
      const room = diff > 0 ? bounds[t][1] - w[t] : bounds[t][0] - w[t];
      const d = diff > 0 ? Math.min(diff, room) : Math.max(diff, room);
      w[t] += d; diff -= d;
    }
  };
  fixSum();
  const rate = {};
  for (const t of TRACKS) {
    const p = perf[t] || {};
    rate[t] = p.posts ? ((p.clicks || 0) + signupWeight * (p.signups || 0)) / p.posts : null;
  }
  const scored = TRACKS.filter((t) => rate[t] !== null && (perf[t].posts || 0) >= minPosts);
  if (scored.length < TRACKS.length) return { weights: w, changed: false, reason: `데이터 부족(카테고리별 글 ${minPosts}개 미만) — 유지`, rate };
  if (scored.every((t) => rate[t] === 0)) return { weights: w, changed: false, reason: '클릭·가입 신호 0 — 유지', rate };
  const order = [...TRACKS].sort((a, b) => rate[b] - rate[a]);
  const best = order[0];
  if (rate[best] === rate[order[order.length - 1]]) return { weights: w, changed: false, reason: '카테고리 성과 동률 — 유지', rate };
  for (const worst of [...order].reverse()) {
    if (worst === best || rate[worst] >= rate[best]) continue;
    const move = Math.min(step, bounds[best][1] - w[best], w[worst] - bounds[worst][0]);
    if (move > 0) {
      w[best] += move; w[worst] -= move;
      return { weights: w, changed: true, reason: `${worst} → ${best} ${move}%p (글당 점수 ${rate[worst].toFixed(2)} → ${rate[best].toFixed(2)})`, rate, from: worst, to: best, move };
    }
  }
  return { weights: w, changed: false, reason: `${best} 가 이미 상한 — 유지`, rate };
}
