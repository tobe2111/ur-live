// 실행: node --test test/content-quality.test.mjs  (marketing-bot 폴더에서)
// 2026-11-09 대표 "퀄리티가 낮고 AI 티가 난다" — 실제로 나간 글에서 뽑은 사례로 고정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vetPost } from '../src/vet.mjs';
import { PARTNER_FACTS } from '../src/lib.mjs';
import { SERIES, pickSeries, seriesTopic, BRAND_WRITING } from '../src/series.mjs';
import { parseVisual, vetVisual, render, publishImages } from '../src/visual.mjs';
import { parseNote, isOwnerNote } from '../src/field-notes.mjs';
import { HOOKS } from '../src/variety.mjs';
import { HUMAN_STYLE } from '../src/lib.mjs';
import { loadStyles } from '../src/style.mjs';

const ctx = { facts: PARTNER_FACTS };

test('실제로 나간 지어낸 일화가 걸린다', () => {
  const real = '주방 마감하고 앉아 계신 사장님이랑 수수료 얘기를 하다가, 저희 숫자를 그냥 다 적어두기로 했어요. 직접 입점하시면 판매액의 10%가 수수료예요. 가입비, 월 이용료, 광고비는 없어요.';
  assert.ok(vetPost(real, ctx).some((p) => p.includes('지어낸 일화')));
  assert.ok(vetPost('"광고는 하는데 누가 보고 오는지 모르겠어요." 지난주에 들은 말이에요. 유어딜은 팔린 뒤에만 수수료가 붙어요. 가입비도 광고비도 없습니다.', ctx).some((p) => p.includes('지어낸 일화')));
});

test('현장 메모가 있으면 일화는 허용(대표가 보낸 실제 일)', () => {
  const t = '어제 망원동 국숫집 사장님을 뵈었는데 QR 찍는 걸 처음 해 보시고 생각보다 쉽다고 하시더라고요. 쓰던 휴대폰 하나면 돼요.';
  assert.ok(!vetPost(t, { ...ctx, fieldNote: true }).some((p) => p.includes('지어낸 일화')));
});

test('양자택일 질문 마무리·줄표가 걸린다', () => {
  const real = '닭도리탕은 한 번 생각나기 시작하면 다른 메뉴로 잘 안 넘어가더라고요. 이용권은 방문 전에 미리 결제하면 폰으로 발급돼요.\n\n그런데 닭도리탕 드실 때 마지막은 밥 볶음파세요, 사리 추가파세요?\n\n#유어딜';
  assert.ok(vetPost(real, ctx).some((p) => p.includes('양자택일')));
  assert.ok(vetPost('가입비는 0원이에요 — 팔린 뒤에만 수수료가 붙고, 안 팔리면 낼 돈이 없어요. 등록은 10분이면 됩니다. 자세한 건 링크에서.', ctx).some((p) => p.includes('줄표')));
});

test('평범한 정보 글은 통과한다', () => {
  const ok = '가입비, 월 이용료, 광고비 모두 0원이에요. 이용권이 팔리고 손님이 매장에서 쓴 뒤에만 수수료가 생겨요. 안 팔리면 낼 돈이 없습니다. 입점 안내는 프로필 링크에 있어요.';
  assert.deepEqual(vetPost(ok, ctx), []);
});

test('프롬프트에 일화를 지어내라는 지시가 남아 있지 않다', () => {
  assert.ok(!HUMAN_STYLE.includes('매번 다른 방식으로 시작한다: 오늘 있었던 일'));
  assert.ok(HUMAN_STYLE.includes('지어내지 않는다'));
  for (const h of HOOKS) assert.ok(!/있을 법한 짧은 장면|솔직히 저도/.test(h.guide), h.id);
  for (const p of loadStyles().patterns) assert.ok(!/들은 말|지난주에/.test(p.example + p.how), p.id);
  assert.ok(BRAND_WRITING.includes('지어내지 않는다'));
});

test('시리즈: 트랙에 맞는 코너를 고르고, 최근 쓴 건 피하고, 현장 메모면 현장노트', () => {
  const a = pickSeries('merchant', [], 0);
  assert.ok(SERIES[a.id].tracks.includes('merchant'));
  assert.notEqual(pickSeries('merchant', [{ series: a.id }], 0).id, a.id);
  assert.equal(pickSeries('consumer', [], 3).id, 'deal-pick');
  assert.equal(pickSeries('merchant', [], 0, { fieldNote: true }).id, 'field-note');
  for (let i = 0; i < 30; i++) assert.notEqual(pickSeries('creator', [], i).id, 'field-note');
  const s = { id: 'owner-note', ...SERIES['owner-note'] };
  assert.ok(s.topics.includes(seriesTopic(s, 'x', [], 2)));
  assert.equal(seriesTopic({ id: 'myth-fact', ...SERIES['myth-fact'] }, '약관 주제', [], 0), '약관 주제');
});

test('이미지 문구 파싱: 줄수·길이 제한, 느낌표·줄표 제거', () => {
  const v = parseVisual('설명 {"title":["가입비 0원!","팔린 뒤에만 — 수수료"],"sub":"안 팔리면 낼 돈이 없어요","slides":[{"title":"등록 10분","body":"카카오맵에서 내 가게 찾기부터"}],"photo_query":"korean restaurant owner"}');
  assert.deepEqual(v.title, ['가입비 0원', '팔린 뒤에만  수수료']);
  assert.equal(v.cta, '자세한 조건은 프로필 링크에서');
  assert.equal(parseVisual('그냥 글'), null);
  assert.equal(parseVisual('{"title":[]}'), null);
});

test('이미지 안 글자도 검수한다 — 지어낸 숫자가 걸린다', () => {
  const bad = parseVisual('{"title":["매출 30% 증가"],"slides":[]}');
  assert.ok(vetVisual(bad, PARTNER_FACTS).length > 0);
  const good = parseVisual('{"title":["가입비 0원","팔린 뒤에만 수수료"],"slides":[]}');
  assert.deepEqual(vetVisual(good, PARTNER_FACTS), []);
});

test('현장 메모: 사진/글 분리, 레포 주인이 연 이슈만', () => {
  const n = parseNote('망원동 국숫집 첫 QR 사용\n\n![IMG_1](https://github.com/user-attachments/assets/abc)\n<img width="300" src="https://github.com/user-attachments/assets/def" />\nhttps://github.com/user-attachments/assets/ghi\n');
  assert.equal(n.text, '망원동 국숫집 첫 QR 사용');
  assert.equal(n.photos.length, 3);
  assert.ok(isOwnerNote({ author_association: 'OWNER', user: { login: 'x' } }, 'tobe2111'));
  assert.ok(!isOwnerNote({ author_association: 'NONE', user: { login: 'stranger' } }, 'tobe2111'));
  assert.ok(!isOwnerNote({ author_association: 'OWNER', pull_request: {} }, 'tobe2111'));
});

test('이미지 업로드: marketing-data 브랜치 raw URL 을 돌려준다', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-'));
  const f = path.join(dir, 'slide-1.jpg'); fs.writeFileSync(f, 'x');
  const calls = [];
  const fake = async (u, o = {}) => { calls.push([o.method || 'GET', u]); return { ok: o.method === 'PUT' || o.method === 'HEAD', json: async () => ({}), text: async () => '' }; };
  const urls = await publishImages([f], 'test-key', { GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 't' }, fake);
  assert.deepEqual(urls, ['https://raw.githubusercontent.com/o/r/marketing-data/marketing-bot/data/cards/test-key/slide-1.jpg']);
  assert.ok(calls.some(([m, u]) => m === 'PUT' && u.includes('contents/marketing-bot/data/cards/test-key/slide-1.jpg')));
  fs.rmSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'cards', 'test-key'), { recursive: true, force: true });
});

// 글꼴이 있을 때만(CI 워크플로가 받아 둔다) 실제로 그려 본다
test('이미지 그리기: 표지 + 안쪽 장 + 마지막 장', { skip: !(process.env.FONT_HEAVY && fs.existsSync(process.env.FONT_HEAVY)) }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-'));
  const files = render({ out_dir: path.join(dir, 'out'), fonts: { heavy: process.env.FONT_HEAVY, semi: process.env.FONT_SEMI }, series: '숫자로 보는 유어딜', title: ['가입비 0원', '팔린 뒤에만 수수료'], sub: '안 팔리면 낼 돈이 없어요', slides: [{ title: '등록 10분', body: '카카오맵에서 내 가게 찾기부터 시작해요' }], cta: '자세한 조건은 프로필 링크에서' }, dir);
  assert.equal(files.length, 3);
  for (const f of files) assert.ok(fs.statSync(f).size > 20_000);
});

test('Pixabay: 키 없으면 건너뛰고, 있으면 큰 세로 사진을 고른다', async () => {
  const { searchPixabay } = await import('../src/visual.mjs');
  assert.equal(await searchPixabay('food', ''), null);
  let asked = '';
  const fake = async (u) => { asked = u; return { json: async () => ({ hits: [{ imageWidth: 640, largeImageURL: 'small' }, { imageWidth: 1280, largeImageURL: 'https://pixabay.com/big.jpg', user: 'kim' }] }) }; };
  const r = await searchPixabay('korean food', 'k', fake);
  assert.equal(r.url, 'https://pixabay.com/big.jpg');
  assert.match(asked, /orientation=vertical/);
});

// ---- 2026-11-09 2차: 릴스 · 스레드 이미지 · 실제 매장 사진 · 코너 가중치 ----
import { seriesWeights } from '../src/series.mjs';
import { reelPlan, reelArgs, makeReel, isRealStorePhoto, originalPhotoUrl, freshStorePhotos, realStorePhotos } from '../src/visual.mjs';
import { spawnSync } from 'node:child_process';

test('코너 가중치: 반응 좋은 코너를 더 자주 고르되, 오래 안 쓴 절반 안에서만', () => {
  const merchantIds = Object.keys(SERIES).filter((id) => !SERIES[id].fieldNoteOnly && SERIES[id].tracks.includes('merchant'));
  // 가중치 없으면 종전과 같다
  assert.equal(pickSeries('merchant', [], 0, { weights: null }).id, pickSeries('merchant', [], 0).id);
  // 방금 쓴 코너는 가중치가 아무리 커도 안 나온다(반쪽 밖)
  const hist = merchantIds.slice(0, Math.floor(merchantIds.length / 2)).map((series) => ({ series }));
  const recentId = hist[hist.length - 1].series;
  for (let seed = 0; seed < 40; seed++) assert.notEqual(pickSeries('merchant', hist, seed, { weights: { [recentId]: 100 } }).id, recentId);
  // 후보 둘 중 가중치 큰 쪽이 더 자주
  const pool = merchantIds.slice(Math.floor(merchantIds.length / 2));
  const cnt = {};
  for (let seed = 0; seed < 300; seed++) { const id = pickSeries('merchant', hist, seed, { weights: { [pool[0]]: 2, [pool[1]]: 0.5 } }).id; cnt[id] = (cnt[id] || 0) + 1; }
  assert.ok((cnt[pool[0]] || 0) > (cnt[pool[1]] || 0), JSON.stringify(cnt));
});

test('코너 가중치 계산: 플랫폼 평균 대비 비율, 2개 미만은 1, 범위 0.5~2', () => {
  const rows = [
    { id: 'a', platform: 'instagram', metrics: { score: 300 } }, { id: 'b', platform: 'instagram', metrics: { score: 300 } },
    { id: 'c', platform: 'instagram', metrics: { score: 100 } }, { id: 'd', platform: 'instagram', metrics: { score: 100 } },
    { id: 't', platform: 'threads', metrics: { score: 5 } },
  ];
  const map = new Map([['a', 'udal-qna'], ['b', 'udal-qna'], ['c', 'myth-fact'], ['d', 'myth-fact'], ['t', 'by-numbers']]);
  const { weights, counts } = seriesWeights(rows, map);
  assert.equal(weights['udal-qna'], 1.5);
  assert.equal(weights['myth-fact'], 0.5);
  assert.equal(weights['by-numbers'], 1); // 1개뿐
  assert.equal(counts['by-numbers'], 1);
});

test('실제 매장 사진: 데모 사진은 빼고, 가로로 잘린 og:image 는 원본으로', async () => {
  assert.equal(isRealStorePhoto('https://media.ur-team.com/uploads/seller/26/a.jpg'), true);
  assert.equal(isRealStorePhoto('/api/media/uploads/demo/h/x.jpg'), false);
  assert.equal(isRealStorePhoto('https://urdeal.kr/api/media/uploads/demo/h/x.jpg'), false);
  assert.equal(originalPhotoUrl('https://urdeal.kr/cdn-cgi/image/width=1200,height=630,fit=cover/https://media.ur-team.com/u/a.jpg'), 'https://media.ur-team.com/u/a.jpg');
  const fake = async () => ({ json: async () => ({ data: [
    { id: 1, image_url: 'https://media.ur-team.com/u/a.jpg', restaurant_name: '달빛' },
    { id: 2, image_url: '/api/media/uploads/demo/h/x.jpg', restaurant_name: '데모' },
  ] }) });
  const list = await realStorePhotos([{ id: 1, name: '달빛', image_url: 'https://media.ur-team.com/u/a.jpg' }], fake);
  assert.deepEqual(list.map((x) => x.url), ['https://media.ur-team.com/u/a.jpg']);
  assert.deepEqual(freshStorePhotos(list, ['https://media.ur-team.com/u/a.jpg']), []);
});

test('릴스 계획: 장마다 길이, 전환 겹침, 총 길이', () => {
  const p = reelPlan(4);
  assert.deepEqual(p.d, [2.8, 2.6, 2.6, 2.2]);
  assert.deepEqual(p.offsets, [2.4, 4.6, 6.8]);
  assert.equal(p.total, 9);
  const args = reelArgs(['a.jpg', 'b.jpg'], 'o.mp4');
  assert.ok(args.includes('anullsrc=r=44100:cl=stereo'), '무음 소리 트랙');
  assert.ok(args.join(' ').includes('1080:1920'), '세로 9:16');
  assert.equal(args[args.length - 1], 'o.mp4');
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
test('릴스 만들기: 실제 영상(세로 1080x1920, 소리 트랙 포함)', { skip: !(hasFfmpeg && process.env.FONT_HEAVY && fs.existsSync(process.env.FONT_HEAVY)) }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  const files = render({ out_dir: path.join(dir, 'out'), fonts: { heavy: process.env.FONT_HEAVY, semi: process.env.FONT_SEMI }, series: '3분 가이드', title: ['폰 하나로', '사용 처리'], slides: [{ title: '앱 열기', body: '쓰던 스마트폰 그대로' }], cta: '자세한 조건은 프로필 링크에서' }, dir);
  const out = makeReel(files, dir);
  assert.ok(out && fs.statSync(out).size > 50_000);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout;
  assert.match(probe, /video,1080,1920/);
  assert.match(probe, /audio/);
  assert.equal(makeReel(files.slice(0, 1), dir), null, '한 장이면 릴스 안 만든다');
});

test('일일 게시 배선: 스레드에 이미지, 릴스는 주 3회·실패 시 캐러셀, 매장 사진은 사장님·손님 글만', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /threadsPublish\(\{ media_type: 'IMAGE', image_url, text \}\)/);
  assert.match(src, /r \|\| await threadsPublish\(\{ media_type: 'TEXT', text \}\)/, '이미지 실패 시 글만');
  assert.ok(src.indexOf('// ---- Instagram') < src.indexOf('// ---- Threads ----'), '인스타 표지를 먼저 만들어 스레드가 같이 쓴다');
  assert.match(src, /\[1, 3, 5\]\.includes\(k\.getUTCDay\(\)\)/);
  assert.match(src, /릴스 게시 실패 → 캐러셀로 다시/);
  assert.match(src, /\['merchant', 'consumer'\]\.includes\(track\)/);
  assert.match(src, /pickSeries\(track, trackHist, dayIdx, \{ weights: seriesState\?\.weights \}\)/);
});
