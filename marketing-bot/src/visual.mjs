// 게시물 이미지를 게시할 때마다 새로 만든다 (2026-11-09 대표 "같은 카드만 돌고, 가시성도 재미도 없다").
// 흐름: 캡션 → (Claude) 이미지 문구 계획 → 사진 찾기 → scripts/render-post.py 로 그리기
//       → marketing-data 브랜치에 올려 공개 URL 만들기 → igPublish.
// 어느 단계든 실패하면 null 을 돌려주고, daily-post 는 종전 카드 세트로 물러선다(게시가 멈추지 않게).
//
// 사진 우선순위: ① 대표 현장 메모 사진 ② 손님 딜이면 그 상품 사진 ③ Pixabay(PIXABAY_API_KEY) · Pexels(PEXELS_API_KEY)
//               ④ Openverse 의 CC0·퍼블릭도메인 ⑤ 없음(브랜드 블루 면 위 큰 글자).
// 구글 이미지 검색 결과는 대부분 저작권이 있어 쓰지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, DRY, log } from './lib.mjs';
import { vetPost } from './vet.mjs';

export const VISUAL_SYSTEM = `너는 큰 브랜드(네이버플러스스토어, 토스플레이스, NOL) 인스타그램 이미지를 만드는 에디터다.
캡션을 받아 이미지에 들어갈 문구만 JSON 으로 만든다.
- title: 표지 제목 1~2줄 배열. 줄당 12자 안팎. 메시지 하나, 굵게 읽히는 말. 마침표 없이.
- sub: 표지 부제 한 줄(22자 이내). 없어도 된다.
- slides: 안쪽 장 0~4개. 각 {"title": 14자 이내, "body": 45자 이내}. 단계·이유·조건처럼 나눌 게 있을 때만.
- cta: 마지막 장 한 줄(20자 이내, 안쪽 장이 있을 때만). 예: "자세한 조건은 프로필 링크에서".
- photo_query: 표지 사진 검색어(영어 2~4단어, 사람·가게·음식처럼 구체적인 장면).
- 캡션과 [확인된 사실]에 없는 숫자·조건·후기를 만들지 않는다. 느낌표·이모지·줄표(—) 금지.
JSON 하나만 출력한다.`;

export function parseVisual(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let v; try { v = JSON.parse(m[0]); } catch { return null; }
  const s = (x, n) => String(x ?? '').replace(/[!—]/g, '').trim().slice(0, n);
  const title = (Array.isArray(v.title) ? v.title : [v.title]).map((t) => s(t, 20)).filter(Boolean).slice(0, 2);
  if (!title.length) return null;
  const slides = (Array.isArray(v.slides) ? v.slides : []).map((x) => ({ title: s(x?.title, 22), body: s(x?.body, 70) })).filter((x) => x.title).slice(0, 4);
  return { title, sub: s(v.sub, 30), slides, cta: slides.length ? s(v.cta, 30) || '자세한 조건은 프로필 링크에서' : '', photo_query: s(v.photo_query, 60) };
}

// 이미지 안 글자도 게시물이다 — 같은 검수(숫자·금지어·상투구)를 통과해야 한다.
export function vetVisual(v, facts, fieldNote = false) {
  const all = [...v.title, v.sub, ...v.slides.flatMap((x) => [x.title, x.body]), v.cta].filter(Boolean).join('\n');
  return vetPost(all, { facts, minLen: 0, fieldNote });
}

async function download(url, dir, headers = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'urdeal-marketing-bot', ...headers }, redirect: 'follow' });
  if (!res.ok) throw new Error(`사진 다운로드 ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!/^image\//.test(type)) throw new Error(`이미지가 아님(${type})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10_000) throw new Error('사진이 너무 작음');
  const f = path.join(dir, `photo-${Date.now()}`);
  fs.writeFileSync(f, buf);
  return f;
}

export async function searchPexels(query, key = process.env.PEXELS_API_KEY, fetchImpl = fetch) {
  if (!key || !query) return null;
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`;
  const j = await (await fetchImpl(u, { headers: { authorization: key } })).json();
  const ps = j.photos || [];
  if (!ps.length) return null;
  const p = ps[Math.floor(Math.random() * Math.min(ps.length, 8))];
  return { url: p.src?.large2x || p.src?.original, credit: `Pexels · ${p.photographer}`, source: 'pexels' };
}

// Pixabay — 상업 이용 무료·출처 표기 불요. 핫링크 금지라 내려받아 우리 쪽에 다시 올린다(publishImages).
// 2026-11-09: Pexels 가 신규 키 발급을 멈춰서(대표 확인) 이쪽을 먼저 쓴다.
export async function searchPixabay(query, key = process.env.PIXABAY_API_KEY, fetchImpl = fetch) {
  if (!key || !query) return null;
  const u = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&safesearch=true&per_page=20`;
  const j = await (await fetchImpl(u)).json();
  const hs = (j.hits || []).filter((h) => (h.imageWidth || 0) >= 1000);
  if (!hs.length) return null;
  const h = hs[Math.floor(Math.random() * Math.min(hs.length, 8))];
  return { url: h.largeImageURL, credit: `Pixabay · ${h.user}`, source: 'pixabay' };
}

export async function searchOpenverse(query, fetchImpl = fetch) {
  if (!query) return null;
  const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm&page_size=15&mature=false`;
  const j = await (await fetchImpl(u, { headers: { 'user-agent': 'urdeal-marketing-bot' } })).json();
  const rs = (j.results || []).filter((r) => (r.width || 0) >= 900 && (r.height || 0) >= 900);
  if (!rs.length) return null;
  const r = rs[Math.floor(Math.random() * Math.min(rs.length, 6))];
  return { url: r.url, credit: `Openverse · ${r.license}`, source: 'openverse' };
}

// 실제 입점 매장 사진 (2026-11-09 대표 "할 수 있는 거 다" — 실제 매장 사진 우선).
// 사이트 공개 목록의 대표 사진 + data/products.json. 데모 상품 사진(/uploads/demo/)은 진짜 가게가 아니라 뺀다.
// og:image 는 1200x630 가로로 잘린 주소라 원본 주소를 꺼내 쓴다.
export const originalPhotoUrl = (u) => String(u || '').replace(/^https:\/\/[^/]+\/cdn-cgi\/image\/[^/]+\//, '');
export const isRealStorePhoto = (u) => /^https:\/\//.test(u || '') && !/\/uploads\/demo\//.test(u);
export async function realStorePhotos(products = [], fetchImpl = fetch, base = process.env.URDEAL_API_BASE || 'https://urdeal.kr') {
  const out = [];
  try {
    const j = await (await fetchImpl(`${base}/api/group-buy/products?limit=50`, { headers: { 'user-agent': 'Mozilla/5.0 (urdeal-marketing-bot)' } })).json();
    for (const p of j?.data || []) if (isRealStorePhoto(p.image_url)) out.push({ url: originalPhotoUrl(p.image_url), name: p.restaurant_name || p.name, id: p.id });
  } catch (e) { log(`매장 사진 목록 실패: ${e.message}`); }
  for (const p of products) if (isRealStorePhoto(p.image_url)) out.push({ url: originalPhotoUrl(p.image_url), name: p.name, id: p.id });
  return [...new Map(out.map((x) => [x.url, x])).values()];
}

// 최근에 쓴 사진은 뒤로 미룬다(같은 가게 사진이 매일 표지에 서지 않게). recent = 최근 쓴 사진 URL 목록.
export const freshStorePhotos = (list = [], recent = []) => list.filter((x) => !recent.includes(x.url));

// 사진 크기(가로·세로). Pillow 가 없으면 null(검사 생략).
export function imageSize(file) {
  const r = spawnSync('python3', ['-c', 'import sys;from PIL import Image;i=Image.open(sys.argv[1]);print(i.width,i.height)', file], { encoding: 'utf8', timeout: 20_000 });
  if (r.status !== 0) return null;
  const [w, h] = r.stdout.trim().split(/\s+/).map(Number);
  return w && h ? { w, h } : null;
}

// 사진 하나를 골라 로컬 파일로. 반환 { file, credit, source, url } 또는 null
export async function findPhoto({ notePhotos = [], productPhoto = null, storePhotos = [], query = '', dir }) {
  const tries = [
    ...notePhotos.map((url) => async () => ({ url, credit: '유어딜 현장', source: 'field-note', auth: true })),
    ...(productPhoto ? [async () => ({ url: originalPhotoUrl(productPhoto), credit: '입점 매장', source: 'product', minSide: 700 })] : []),
    ...storePhotos.map((p) => async () => ({ url: p.url, credit: `입점 매장 · ${p.name || ''}`.trim(), source: 'store', minSide: 700 })),
    () => searchPixabay(query),
    () => searchPexels(query),
    () => searchOpenverse(query),
  ];
  for (const t of tries) {
    try {
      const c = await t();
      if (!c?.url) continue;
      const headers = c.auth && process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
      const file = await download(c.url, dir, headers);
      if (c.minSide) {
        const sz = imageSize(file);
        if (sz && Math.min(sz.w, sz.h) < c.minSide) { log(`사진이 작아서 건너뜀(${sz.w}x${sz.h}): ${c.url}`); continue; }
      }
      return { file, credit: c.credit, source: c.source, url: c.url };
    } catch (e) { log(`사진 후보 실패: ${e.message}`); }
  }
  return null;
}

export function fontsReady(env = process.env) {
  return !!(env.FONT_HEAVY && env.FONT_SEMI && fs.existsSync(env.FONT_HEAVY) && fs.existsSync(env.FONT_SEMI));
}

export function render(spec, specDir) {
  const specFile = path.join(specDir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const r = spawnSync('python3', [path.join(ROOT, 'scripts', 'render-post.py'), specFile], { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) throw new Error(`이미지 그리기 실패: ${(r.stderr || '').slice(-300)}`);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

// marketing-data 브랜치에 올려 공개 URL 을 만든다(Contents API). 로컬 data/cards/ 에도 남겨
// 워크플로의 data 커밋이 이 파일을 지우지 않게 한다(그 단계는 data/ 스냅샷으로 브랜치를 다시 쓴다).
export async function publishImages(files, key, env = process.env, fetchImpl = fetch) {
  const repo = env.GITHUB_REPOSITORY, token = env.GITHUB_TOKEN;
  if (!repo || !token) throw new Error('GITHUB_REPOSITORY/GITHUB_TOKEN 없음 — 이미지 공개 URL 을 만들 수 없음');
  const urls = [];
  const localDir = path.join(ROOT, 'data', 'cards', key);
  fs.mkdirSync(localDir, { recursive: true });
  for (const f of files) {
    const name = path.basename(f);
    fs.copyFileSync(f, path.join(localDir, name));
    const rel = `marketing-bot/data/cards/${key}/${name}`;
    const h = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
    const api = `https://api.github.com/repos/${repo}/contents/${rel}`;
    const prev = await fetchImpl(`${api}?ref=marketing-data`, { headers: h });
    const sha = prev.ok ? (await prev.json()).sha : undefined;
    const res = await fetchImpl(api, { method: 'PUT', headers: h, body: JSON.stringify({ message: `chore(marketing-bot): card ${key}/${name} [skip ci]`, content: fs.readFileSync(f).toString('base64'), branch: 'marketing-data', ...(sha ? { sha } : {}) }) });
    if (!res.ok) throw new Error(`이미지 업로드 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    // 영상은 jsDelivr — raw 는 mp4 를 octet-stream 으로 줘서 Meta 가 거절한다(lib.mjs publicMediaUrl 과 같은 이유).
    // 브랜치 이름(@marketing-data)은 jsDelivr 가 최대 12시간 옛 커밋으로 기억하므로 방금 만든 커밋 sha 로 고정한다.
    if (/\.mp4$/i.test(name)) {
      const sha = (await res.json().catch(() => ({})))?.commit?.sha;
      urls.push(`https://cdn.jsdelivr.net/gh/${repo}@${sha || 'marketing-data'}/${rel}`);
    } else urls.push(`https://raw.githubusercontent.com/${repo}/marketing-data/${rel}`);
  }
  // raw CDN 에 뜰 때까지 잠깐 기다린다(Meta 가 404 를 받으면 컨테이너가 실패한다)
  for (const u of urls) {
    for (let i = 0; i < 12; i++) {
      const r = await fetchImpl(u, { method: 'HEAD' }).catch(() => null);
      if (r?.ok) break;
      await new Promise((ok) => setTimeout(ok, 5000));
    }
  }
  return urls;
}

// 오래된 카드 폴더 정리(최근 30회분만 남긴다)
export function pruneCards(keep = 30) {
  const dir = path.join(ROOT, 'data', 'cards');
  if (!fs.existsSync(dir)) return;
  const ds = fs.readdirSync(dir).sort();
  for (const d of ds.slice(0, Math.max(0, ds.length - keep))) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
}

// 릴스: 만든 장들을 짧은 세로 영상(1080x1920, 30fps)으로 잇는다. 장마다 천천히 확대 + 부드러운 전환.
// 소리는 무음 트랙(음원 저작권 문제가 없게). 대표가 앱에서 음악을 얹고 싶으면 게시 후 편집으로.
export const REEL_DUR = { cover: 2.8, inner: 2.6, last: 2.2, fade: 0.4 };
export function reelPlan(n) {
  const d = Array.from({ length: n }, (_, i) => (i === 0 ? REEL_DUR.cover : i === n - 1 && n > 1 ? REEL_DUR.last : REEL_DUR.inner));
  const offsets = [];
  let t = 0;
  for (let i = 0; i < n - 1; i++) { t += d[i] - REEL_DUR.fade; offsets.push(Math.round(t * 100) / 100); }
  const total = d.reduce((a, b) => a + b, 0) - REEL_DUR.fade * (n - 1);
  return { d, offsets, total: Math.round(total * 100) / 100 };
}
export function reelArgs(files, out) {
  const { d, offsets, total } = reelPlan(files.length);
  const args = ['-y'];
  files.forEach((f) => args.push('-i', f));
  args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=44100:cl=stereo');
  const parts = files.map((_, i) => {
    const fr = Math.round(d[i] * 30);
    // 확대(최대 6%) → 세로 화면 가운데. 위아래는 같은 장을 흐리고 어둡게 깐 면(검은 띠보다 덜 비어 보인다)
    return `[${i}:v]split[a${i}][b${i}];`
      + `[a${i}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:2,eq=brightness=-0.22,loop=${fr}:1:0,fps=30,setsar=1[bg${i}];`
      + `[b${i}]scale=1188:1485,zoompan=z='min(1+0.06*on/${fr},1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${fr}:s=1080x1350:fps=30,setsar=1[fg${i}];`
      + `[bg${i}][fg${i}]overlay=0:285:shortest=1,format=yuv420p[v${i}]`;
  });
  let last = 'v0';
  offsets.forEach((o, i) => { parts.push(`[${last}][v${i + 1}]xfade=transition=fade:duration=${REEL_DUR.fade}:offset=${o}[x${i}]`); last = `x${i}`; });
  args.push('-filter_complex', parts.join(';'), '-map', `[${last}]`, '-map', `${files.length}:a`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart', out);
  return args;
}
export function makeReel(files, dir) {
  if (files.length < 2) return null;
  const out = path.join(dir, 'reel.mp4');
  const r = spawnSync('ffmpeg', reelArgs(files, out), { encoding: 'utf8', timeout: 180_000 });
  if (r.status !== 0 || !fs.existsSync(out)) { log(`릴스 만들기 실패: ${(r.stderr || r.error?.message || '').slice(-300)}`); return null; }
  return out;
}

// 스토리용 세로 이미지: 표지를 가운데 두고 위아래는 같은 장을 흐리게, 아래에 "피드에서 이어 보기" 한 줄.
export function storyArgs(cover, out, font) {
  const text = font ? `,drawtext=fontfile='${font.replace(/'/g, "\\'")}':text='피드에서 이어 보기':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=1720` : '';
  return ['-y', '-i', cover, '-filter_complex',
    `[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:2,eq=brightness=-0.22[bg];`
    + `[b]scale=1080:1350[fg];[bg][fg]overlay=0:285${text}`,
    '-frames:v', '1', '-q:v', '3', out];
}
export function makeStory(cover, dir, font = process.env.FONT_SEMI) {
  const out = path.join(dir, 'story.jpg');
  const r = spawnSync('ffmpeg', storyArgs(cover, out, font && fs.existsSync(font) ? font : null), { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0 || !fs.existsSync(out)) { log(`스토리 이미지 실패: ${(r.stderr || r.error?.message || '').slice(-200)}`); return null; }
  return out;
}

const MASCOT = path.join(ROOT, '..', 'public', 'assets', 'mascot', 'udal-social-wave.webp');

// 전체: 성공하면 { images: [url...], set, credit, source, title } · 아니면 null
// reel: true 면 같은 장으로 릴스 영상도 만든다 → { video_url, cover_url } 가 붙는다(실패하면 사진만).
export async function makeVisual({ claudeFn, caption, facts, series, key, notePhotos = [], productPhoto = null, storePhotos = [], fieldNote = false, reel = false }) {
  if (!fontsReady()) { log('이미지 생성 건너뜀 — 글꼴 없음(FONT_HEAVY/FONT_SEMI)'); return null; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'urdeal-card-'));
  try {
    const user = `[시리즈] ${series.name}\n[확인된 사실]\n${facts}\n\n[캡션]\n${caption}`;
    let v = parseVisual(await claudeFn(VISUAL_SYSTEM, user, 900));
    if (v && vetVisual(v, facts, fieldNote).length) {
      const problems = vetVisual(v, facts, fieldNote);
      log(`이미지 문구 검수 걸림 → 다시: ${problems.join(' / ')}`);
      v = parseVisual(await claudeFn(VISUAL_SYSTEM, `${user}\n\n방금 만든 문구가 아래 문제로 반려됐다. 고쳐라:\n- ${problems.join('\n- ')}`, 900));
      if (v && vetVisual(v, facts, fieldNote).length) v = null;
    }
    if (!v) { log('이미지 문구를 만들지 못함 → 종전 카드로'); return null; }
    const photo = await findPhoto({ notePhotos, productPhoto, storePhotos, query: v.photo_query || series.photo, dir });
    const files = render({
      out_dir: path.join(dir, 'out'),
      fonts: { heavy: process.env.FONT_HEAVY, semi: process.env.FONT_SEMI },
      photo: photo?.file, series: series.name, title: v.title, sub: v.sub, slides: v.slides, cta: v.cta,
      mascot: series.mascot && fs.existsSync(MASCOT) ? MASCOT : undefined,
    }, dir);
    log(`이미지 ${files.length}장 생성 (사진: ${photo ? `${photo.source} · ${photo.credit}` : '없음 — 브랜드 면'}) 제목: ${v.title.join(' / ')}`);
    const video = reel ? makeReel(files, dir) : null;
    const story = makeStory(files[0], dir);
    if (video) log(`릴스 영상 생성 (${reelPlan(files.length).total}초)`);
    const base = { set: `gen-${key}`, credit: photo?.credit, source: photo?.source || 'none', photo_url: photo?.url, title: v.title.join(' ') };
    if (DRY) return { ...base, images: files, ...(video ? { video_url: video, cover_url: files[0] } : {}), ...(story ? { story_url: story } : {}) };
    const urls = await publishImages([...files, ...(video ? [video] : []), ...(story ? [story] : [])], key);
    pruneCards();
    const images = urls.filter((u) => /\/slide-\d+\.jpg$/.test(u));
    const video_url = urls.find((u) => /\.mp4$/i.test(u));
    const story_url = urls.find((u) => /\/story\.jpg$/.test(u));
    return { ...base, images, ...(video_url ? { video_url, cover_url: images[0] } : {}), ...(story_url ? { story_url } : {}) };
  } catch (e) {
    log(`이미지 생성 실패 → 종전 카드로: ${e.message}`);
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
