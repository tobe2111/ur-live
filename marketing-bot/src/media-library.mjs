// 자료 창고 (2026-11-16 대표 "온라인에서 이미지 및 컨텐츠와 영상들 계속 확보해서 만들도록").
// 상업 이용이 허락된 무료 소스에서만 사진·영상을 매일 조금씩 모아 data/media-library.json 에 쌓는다.
//   - Pixabay 사진·영상 (Pixabay Content License: 상업 이용 가능, 출처 표기 불요. 핫링크 금지 → 쓸 때 API 로 새 주소를 받아 내려받는다)
//   - Openverse 의 CC0·퍼블릭도메인 사진(출처 표기 불요)
// 구글·핀터레스트 이미지는 저작권 때문에 쓰지 않는다(2026-11-09 결정).
// 모은 것은 Claude 가 미리보기를 보고 점수(1~10)를 매겨 7점 이상만 남긴다 — 게시 때 다시 고르느라 헤매지 않게.
// 가게 이름이 나오는 글(소비자 딜)에는 이 창고를 쓰지 않는다(visual.mjs noStock). 사장님·크리에이터 글의 분위기 사진·릴스 배경용이다.
//
// 실행: node src/media-library.mjs   (워크플로가 게시 전에 돌린다. 실패해도 게시는 계속)
import path from 'node:path';
import { ROOT, DRY, log, readJson, writeJson, claude } from './lib.mjs';

export const LIB_FILE = 'data/media-library.json';
export const PIXABAY_LICENSE = 'Pixabay Content License (상업 이용 가능, 출처 표기 불요)';
export const MAX_IMAGES = 300;
export const MAX_VIDEOS = 80;
export const MAX_AUDIO = 40;
export const MIN_SCORE = 7;

// 주제: 트랙별로 실제 글에 쓰이는 장면(영어 검색어). 하루 2개씩 돌아가며 모은다.
export const TOPICS = [
  { q: 'restaurant owner kitchen', tracks: ['merchant'] },
  { q: 'small restaurant counter', tracks: ['merchant'] },
  { q: 'cafe owner barista', tracks: ['merchant'] },
  { q: 'chef plating food', tracks: ['merchant'] },
  { q: 'shop owner smartphone', tracks: ['merchant'] },
  { q: 'hair salon interior', tracks: ['merchant'] },
  { q: 'food photography smartphone', tracks: ['creator'] },
  { q: 'woman filming video phone', tracks: ['creator'] },
  { q: 'vlogger cafe', tracks: ['creator'] },
  { q: 'korean food table', tracks: ['consumer', 'merchant'] },
  { q: 'korean street food night', tracks: ['consumer', 'creator'] },
  { q: 'friends eating restaurant', tracks: ['consumer', 'creator'] },
  { q: 'seoul street night', tracks: ['consumer', 'creator'] },
  { q: 'qr code payment phone', tracks: ['merchant', 'consumer'] },
];

// 릴스 배경 음악(2026-11-16): Openverse 오디오 중 CC0(출처 표기 불요·상업 이용 가능) 음악만.
// 들어 볼 수 없어 Claude 채점 대신 조건으로 거른다: CC0 · 음악 분류 · 20초~4분.
export const AUDIO_TOPICS = ['upbeat acoustic', 'happy ukulele', 'lofi chill', 'cafe jazz', 'bright instrumental pop', 'warm piano'];
export async function searchOpenverseAudio(q, fetchImpl = fetch) {
  const u = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(q)}&license=cc0&category=music&page_size=20&mature=false`;
  const j = await (await fetchImpl(u)).json();
  return (j.results || []).filter((r) => String(r.license || '').toLowerCase() === 'cc0' && r.url && (r.duration == null || (r.duration >= 20000 && r.duration <= 240000)))
    .map((r) => ({
      id: `openverse-audio-${r.id}`, kind: 'audio', source: 'openverse', source_id: r.id, url: r.url, page_url: r.foreign_landing_url, author: r.creator || '',
      license: 'CC0 (출처 표기 불요)', duration_ms: r.duration ?? null, title: r.title || '', tags: (r.tags || []).map((t) => t.name).join(', '),
    }));
}

export function emptyLibrary() { return { items: [], topics_last: {}, updated_at: null }; }

// 오래 안 모은 주제부터 n 개
export function pickTopics(lib, n = 2) {
  const last = lib.topics_last || {};
  return [...TOPICS].sort((a, b) => (last[a.q] || '').localeCompare(last[b.q] || '')).slice(0, n);
}

export async function searchPixabayImages(q, key, fetchImpl = fetch) {
  const u = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true&min_width=1080&per_page=30`;
  const j = await (await fetchImpl(u)).json();
  return (j.hits || []).map((h) => ({
    id: `pixabay-img-${h.id}`, kind: 'image', source: 'pixabay', source_id: h.id, page_url: h.pageURL, author: h.user,
    license: PIXABAY_LICENSE, w: h.imageWidth, h: h.imageHeight, tags: h.tags || '', preview: h.webformatURL,
  }));
}

export async function searchPixabayVideos(q, key, fetchImpl = fetch) {
  const u = `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&safesearch=true&per_page=20`;
  const j = await (await fetchImpl(u)).json();
  return (j.hits || []).filter((h) => h.duration >= 4 && h.duration <= 40 && (h.videos?.large?.width || h.videos?.medium?.width || 0) >= 1080).map((h) => ({
    id: `pixabay-vid-${h.id}`, kind: 'video', source: 'pixabay', source_id: h.id, page_url: h.pageURL, author: h.user,
    license: PIXABAY_LICENSE, duration: h.duration, w: h.videos?.large?.width || h.videos?.medium?.width, h: h.videos?.large?.height || h.videos?.medium?.height,
    tags: h.tags || '', preview: h.videos?.large?.thumbnail || h.videos?.medium?.thumbnail || h.videos?.small?.thumbnail,
  }));
}

export async function searchOpenverseImages(q, fetchImpl = fetch) {
  const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=20&mature=false`;
  const j = await (await fetchImpl(u)).json();
  return (j.results || []).filter((r) => (r.width || 0) >= 1080 && (r.height || 0) >= 1080).map((r) => ({
    id: `openverse-${r.id}`, kind: 'image', source: 'openverse', source_id: r.id, url: r.url, page_url: r.foreign_landing_url, author: r.creator || '',
    license: `${String(r.license || '').toUpperCase()} (출처 표기 불요)`, w: r.width, h: r.height, tags: (r.tags || []).map((t) => t.name).join(', '), preview: r.thumbnail || r.url,
  }));
}

export const RATE_SYSTEM = `너는 한국 로컬 가게 플랫폼 '유어딜' 인스타그램의 사진 편집자다. 미리보기 한 장을 보고 JSON 하나만 출력한다:
{"score": 1~10, "reason": "한 줄"}
높은 점수: 선명하고 자연광·실제 같은 장면, 한국 동네 가게·음식·사장님·폰 사용과 잘 어울림, 글자를 얹을 여백이 있음.
낮은 점수(4 이하): 워터마크·다른 브랜드 로고·간판 글자가 크게 보임, 얼굴이 크게 나와 초상권 걱정, 흐림, 일러스트·3D·AI 같은 느낌, 서양 느낌이 너무 강함, 불쾌하거나 어색함.`;

export function parseRating(text) {
  try {
    const j = JSON.parse(String(text || '').replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
    const s = Number(j.score);
    return { score: Number.isFinite(s) ? Math.max(1, Math.min(10, s)) : null, reason: String(j.reason || '').slice(0, 100) };
  } catch { return { score: null, reason: '판정 실패' }; }
}

export async function rateItem(item, claudeFn, fetchImpl = fetch) {
  const res = await fetchImpl(item.preview, { headers: { 'user-agent': 'urdeal-marketing-bot' } });
  if (!res.ok) throw new Error(`미리보기 ${res.status}`);
  const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) throw new Error(`미리보기가 이미지가 아님(${type})`);
  const data = Buffer.from(await res.arrayBuffer()).toString('base64');
  return parseRating(await claudeFn(RATE_SYSTEM, [
    { type: 'image', source: { type: 'base64', media_type: type, data } },
    { type: 'text', text: `${item.kind === 'video' ? '영상 첫 화면' : '사진'} · 검색어: ${item.query}` },
  ], 150));
}

// 점수 낮은 것·오래 쓴 것부터 버려 상한을 지킨다
export function prune(items, maxImages = MAX_IMAGES, maxVideos = MAX_VIDEOS) {
  const keep = (kind, max) => items.filter((x) => x.kind === kind)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.used?.length || 0) - (b.used?.length || 0) || String(b.added_at).localeCompare(String(a.added_at)))
    .slice(0, max);
  return [...keep('image', maxImages), ...keep('video', maxVideos), ...keep('audio', MAX_AUDIO)];
}

// 하루치 모으기. perRun = 이번에 새로 채점할 최대 개수(Claude 비용 상한).
export async function collect(lib, { key = process.env.PIXABAY_API_KEY, claudeFn = claude, fetchImpl = fetch, now = new Date(), perRun = 16, topics } = {}) {
  lib = lib || emptyLibrary();
  const have = new Set(lib.items.map((x) => x.id));
  const rejected = new Set(lib.rejected || []);
  const picked = topics || pickTopics(lib, 2);
  const cands = [];
  for (const t of picked) {
    const add = (arr) => { for (const x of arr) if (!have.has(x.id) && !rejected.has(x.id)) { cands.push({ ...x, query: t.q, tracks: t.tracks }); have.add(x.id); } };
    if (key) {
      try { add((await searchPixabayImages(t.q, key, fetchImpl)).slice(0, 6)); } catch (e) { log(`자료 창고: Pixabay 사진 실패(${t.q}) ${e.message}`); }
      try { add((await searchPixabayVideos(t.q, key, fetchImpl)).slice(0, 3)); } catch (e) { log(`자료 창고: Pixabay 영상 실패(${t.q}) ${e.message}`); }
    }
    try { add((await searchOpenverseImages(t.q, fetchImpl)).slice(0, 3)); } catch (e) { log(`자료 창고: Openverse 실패(${t.q}) ${e.message}`); }
    lib.topics_last = { ...(lib.topics_last || {}), [t.q]: now.toISOString() };
  }
  // 음악: 하루 한 검색어, 조건 통과분 최대 3곡(채점 없음)
  const aq = [...AUDIO_TOPICS].sort((a, b) => String(lib.topics_last?.[`audio:${a}`] || '').localeCompare(String(lib.topics_last?.[`audio:${b}`] || '')))[0];
  let audioAdded = 0;
  try {
    for (const x of (await searchOpenverseAudio(aq, fetchImpl))) {
      if (audioAdded >= 3 || have.has(x.id) || rejected.has(x.id)) continue;
      lib.items.push({ ...x, query: aq, tracks: ['merchant', 'creator', 'consumer'], score: MIN_SCORE, note: '조건 통과(CC0 음악·길이)', added_at: now.toISOString(), used: [] });
      have.add(x.id); audioAdded++;
    }
  } catch (e) { log(`자료 창고: Openverse 음악 실패(${aq}) ${e.message}`); }
  lib.topics_last = { ...(lib.topics_last || {}), [`audio:${aq}`]: now.toISOString() };
  let kept = 0, dropped = 0;
  for (const c of cands.slice(0, perRun)) {
    let r;
    try { r = await rateItem(c, claudeFn, fetchImpl); } catch (e) { log(`자료 창고: 채점 실패 ${c.id} ${e.message}`); continue; }
    if (r.score == null) continue;
    if (r.score >= MIN_SCORE) { lib.items.push({ ...c, score: r.score, note: r.reason, added_at: now.toISOString(), used: [] }); kept++; }
    else { rejected.add(c.id); dropped++; }
  }
  lib.rejected = [...rejected].slice(-2000);
  lib.items = prune(lib.items);
  lib.updated_at = now.toISOString();
  log(`자료 창고: 주제 ${picked.map((t) => t.q).join(', ')} · 후보 ${cands.length} · 채택 ${kept} · 탈락 ${dropped} · 보유 사진 ${lib.items.filter((x) => x.kind === 'image').length} / 영상 ${lib.items.filter((x) => x.kind === 'video').length} / 음악 ${lib.items.filter((x) => x.kind === 'audio').length}(새로 ${audioAdded})`);
  return lib;
}

const words = (s) => new Set(String(s || '').toLowerCase().split(/[^a-z가-힣]+/).filter((w) => w.length > 2));
// 고르기: 트랙이 맞고, 최근 30일 안 쓴 것 중 검색어가 겹치고 점수 높은 것
export function pickMedia(lib, { kind = 'image', track, query = '', now = new Date(), avoidDays = 30 } = {}) {
  const qw = words(query);
  const cutoff = new Date(now.getTime() - avoidDays * 864e5).toISOString();
  const pool = (lib?.items || []).filter((x) => x.kind === kind && (!track || (x.tracks || []).includes(track)) && !(x.used || []).some((u) => u.at > cutoff));
  if (!pool.length) return null;
  const rank = (x) => [...words(`${x.query} ${x.tags}`)].filter((w) => qw.has(w)).length * 2 + (x.score || 0) - (x.used?.length || 0);
  return pool.sort((a, b) => rank(b) - rank(a))[0];
}

// 쓸 때 실제로 받을 주소. Pixabay 는 핫링크 금지·주소가 바뀌므로 id 로 새로 묻는다.
export async function resolveMediaUrl(item, key = process.env.PIXABAY_API_KEY, fetchImpl = fetch) {
  if (item.source === 'openverse') return item.url;
  if (item.source !== 'pixabay' || !key) return null;
  const api = item.kind === 'video' ? 'https://pixabay.com/api/videos/' : 'https://pixabay.com/api/';
  const j = await (await fetchImpl(`${api}?key=${encodeURIComponent(key)}&id=${encodeURIComponent(item.source_id)}`)).json();
  const h = (j.hits || [])[0];
  if (!h) return null;
  return item.kind === 'video' ? (h.videos?.large?.url || h.videos?.medium?.url || null) : (h.largeImageURL || null);
}

export function markUsed(lib, id, key, now = new Date()) {
  const x = (lib?.items || []).find((i) => i.id === id);
  if (x) x.used = [...(x.used || []), { at: now.toISOString(), post: key }].slice(-10);
  return lib;
}

// 출처 기록 한 줄(게시 기록·주간 리포트용)
export const creditLine = (x) => `${x.source === 'pixabay' ? 'Pixabay' : 'Openverse'} · ${x.author || '작자 미상'} · ${x.license} · ${x.page_url || ''}`.trim();

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'src', 'media-library.mjs')) {
  // 워크플로가 하루 여러 번 깨우므로 하루(KST) 한 번만 모은다
  const prev = readJson(LIB_FILE, null);
  const kst = (d) => new Date(new Date(d).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  if (prev?.updated_at && kst(prev.updated_at) === kst(new Date()) && process.env.FORCE_COLLECT !== '1') { log('자료 창고: 오늘 이미 모음 — 건너뜀'); process.exit(0); }
  const lib = await collect(prev);
  if (!DRY) writeJson(LIB_FILE, lib);
  else log('[DRY] 자료 창고 저장 생략');
}
