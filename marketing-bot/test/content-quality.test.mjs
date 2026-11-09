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
  assert.match(src, /publishTagged\(\{ media_type: 'IMAGE', image_url, text \}\)/);
  assert.match(src, /r \|\| await publishTagged\(\{ media_type: 'TEXT', text \}\)/, '이미지 실패 시 글만');
  assert.ok(src.indexOf('// ---- Instagram') < src.indexOf('// ---- Threads ----'), '인스타 표지를 먼저 만들어 스레드가 같이 쓴다');
  assert.match(src, /\[1, 3, 5\]\.includes\(k\.getUTCDay\(\)\)/);
  assert.match(src, /릴스 게시 실패 → 캐러셀로 다시/);
  assert.match(src, /\['merchant', 'consumer'\]\.includes\(track\)/);
  assert.match(src, /pickSeries\(track, trackHist, dayIdx, \{ weights: seriesState\?\.weights \}\)/);
});

// ---- 2026-11-09 3차(대표 "2,4"): 인스타 스토리 · 스레드 이어 쓰기 ----
import { storyArgs, makeStory } from '../src/visual.mjs';

test('스토리 이미지: 세로 1080x1920, 글꼴 있으면 안내 한 줄', () => {
  const a = storyArgs('c.jpg', 's.jpg', '/f/P.otf').join(' ');
  assert.match(a, /1080:1920/);
  assert.match(a, /피드에서 이어 보기/);
  assert.doesNotMatch(storyArgs('c.jpg', 's.jpg', null).join(' '), /drawtext/, '글꼴 없으면 글자 없이');
});

test('스토리 만들기: 실제 이미지', { skip: !(hasFfmpeg && process.env.FONT_HEAVY && fs.existsSync(process.env.FONT_HEAVY)) }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
  const [cover] = render({ out_dir: path.join(dir, 'out'), fonts: { heavy: process.env.FONT_HEAVY, semi: process.env.FONT_SEMI }, series: '오해와 사실', title: ['가입비', '없어요'] }, dir);
  const out = makeStory(cover, dir);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout.trim();
  assert.equal(probe, '1080,1920');
});

test('일일 게시 배선: 스토리는 피드 게시 뒤·실패해도 진행, 스레드 이어 쓰기는 답글로·검수 통과 시만', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.ok(src.indexOf('igStory(gen.story_url)') > src.indexOf('r = await igPublish(media'), '피드 게시 뒤에 스토리');
  assert.match(src, /IG 스토리 실패\(게시는 정상\)/);
  assert.match(src, /reply_to_id: r\.id/);
  assert.match(src, /if \(fu\.problems\.length\) log\(`Threads 이어 쓰기 검수 걸림 → 생략/);
  const lib = fs.readFileSync(new URL('../src/lib.mjs', import.meta.url), 'utf8');
  assert.match(lib, /media_type: 'STORIES', image_url/);
});

// ---- 2026-11-09 4차(대표 "사람이 쓴 것처럼, 길게 쓴다고 다가 아니야" · "1~2 다 하자") ----
import { threadsTopicTag, THREADS_TOPICS, pickEncore, encoreCandidates, ENCORE } from '../src/series.mjs';
import { FORMATS } from '../src/variety.mjs';
import { DEAI_SYSTEM, deAi } from '../src/style.mjs';

// 2026-11-08 실제 인스타 게시분(408자, 문단 6개) — 이제 걸려야 한다
const LONG_REAL = `수수료 얘기는 입점 안내에서 제일 뒤로 밀리곤 하는데, 저는 앞에 두는 게 맞다고 생각해요.

직접 입점하시면 판매가의 10%, 사장님 몫은 90%예요. 대행사를 거쳐 들어오는 매장은 5%고요. 가입비, 월 이용료, 광고비는 0원이에요. 이용권이 팔리고 손님이 매장에서 실제로 쓴 뒤에만 수수료가 생겨요.

카드 수수료는 사장님 몫에서 따로 빠지지 않고 유어딜 몫 안에서 내요. 지금은 약 2.75%인데, 카드사 정책에 따라 달라질 수 있어요. 바뀌면 그대로 말씀드릴게요.

안 팔리면 0원이라는 건 저희 쪽 부담이기도 해요. 그래서 조건은 길게 설명하기보다 숫자로 먼저 보여드리고 싶었어요.

입점 안내는 프로필 링크에서 보실 수 있고, 궁금한 건 카카오 채널로 편하게 물어봐 주세요.

#유어딜 #소상공인`;
const IG = { minLen: 60, maxPlain: 230, maxParas: 3 };

test('길이: 실제 게시됐던 긴 글은 이제 걸린다(길이·문단·자기 글 설명)', () => {
  const p = vetPost(LONG_REAL, { facts: '10% 90% 5% 2.75% 0원', ...IG }).join(' / ');
  assert.match(p, /길다\(/);
  assert.match(p, /문단이 많다/);
  assert.match(p, /자기 글에 대한 말/);
});
test('길이: 짧은 사람 글은 통과', () => {
  const ok = '수수료는 판매가의 10%. 사장님 몫은 90%예요.\n가입비도 광고비도 없고, 손님이 이용권을 쓴 뒤에만 나가요.\n조건은 프로필 링크에 있어요.\n\n#유어딜 #소상공인';
  assert.deepEqual(vetPost(ok, { facts: '10% 90%', ...IG }), []);
});
test('지어낸 장면·운영자 취향을 막는다(11-07 실제 게시분)', () => {
  const a = vetPost('이번에 딜 목록을 정리하다가 달빛한스푼 닭도리탕이 눈에 들어와서 소개해요. 국물 맛이 좋다고 소문난 곳이라 골라 봤어요.', { minLen: 10 });
  assert.ok(a.some((x) => x.includes('지어낸')), a.join());
  const b = vetPost('저는 닭도리탕을 고를 때 감자가 푹 익은 쪽이 취향이거든요. 이번 주 딜에 올려뒀어요.', { minLen: 10 });
  assert.ok(b.some((x) => x.includes('지어낸')), b.join());
});
test('분량 지시가 짧아졌다(300자 형식 없음)', () => {
  for (const f of FORMATS) { const n = Number(f.match(/(\d+)자/)[1]); assert.ok(n <= 170, f); }
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /230자 안팎|350자 이내/);
  assert.match(src, /instagram: \{ minLen: 60, maxPlain: 230, maxParas: 3 \}/);
  assert.match(src, /'threads-reply'\);/, '이어 쓰기는 더 짧은 상한');
});
test('다듬기: 줄이기만 하고, 글을 늘리면 초안을 쓴다', async () => {
  assert.match(DEAI_SYSTEM, /초안보다 짧거나 같아야/);
  const draft = '수수료는 10%예요. 가입비는 없어요.';
  assert.equal(await deAi(draft, 'x', async () => draft + ' 그래서 저희는 늘 사장님 편에서 생각하려고 노력하고 있어요. 앞으로도 잘 부탁드려요.'), draft);
  assert.equal(await deAi(draft, 'x', async () => '수수료 10%. 가입비 없어요.'), '수수료 10%. 가입비 없어요.');
});
test('스레드 주제 태그: 트랙별로 돌고, 규칙(1~50자·마침표/& 없음)을 지킨다', () => {
  for (const [t, list] of Object.entries(THREADS_TOPICS)) {
    for (const tag of list) { assert.ok(tag.length >= 1 && tag.length <= 50 && !/[.&#]/.test(tag), tag); }
    assert.equal(threadsTopicTag(t, 0), list[0]);
    assert.equal(threadsTopicTag(t, list.length + 1), list[1 % list.length]);
  }
  assert.equal(threadsTopicTag('없는트랙', 0), THREADS_TOPICS.merchant[0]);
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /threadsPublish\(\{ \.\.\.p, topic_tag \}\)/);
  assert.match(src, /주제 태그 거부 → 태그 없이/, '태그가 거부돼도 글은 나간다');
});
test('다시 보기 후보: 2주 넘고 평균의 1.3배 이상, 트랙을 아는 글만', () => {
  const now = Date.parse('2026-11-30T00:00:00Z'), d = 864e5;
  const rows = [
    { id: 'a', platform: 'threads', ms: now - 20 * d, text: '좋았던 글 https://urdeal.kr/?utm_x=1', metrics: { score: 300 } },
    { id: 'b', platform: 'threads', ms: now - 3 * d, text: '최근 글', metrics: { score: 200 } }, // 너무 최근
    { id: 'c', platform: 'threads', ms: now - 20 * d, text: '보통 글', metrics: { score: 100 } },
    { id: 'd', platform: 'instagram', ms: now - 16 * d, text: '인스타 좋았던 글', metrics: { score: 90 } },
    { id: 'e', platform: 'instagram', ms: now - 16 * d, text: '인스타 보통', metrics: { score: 20 } },
    { id: 'f', platform: 'instagram', ms: now - 16 * d, text: '트랙 모름', metrics: { score: 95 } },
  ];
  const c = encoreCandidates(rows, new Map([['a', 'merchant'], ['c', 'merchant'], ['d', 'creator'], ['e', 'creator']]), new Map([['a', 'by-numbers']]), now);
  assert.deepEqual(c.map((x) => x.id).sort(), ['a', 'd']);
  assert.equal(c.find((x) => x.id === 'a').text, '좋았던 글', '링크는 뺀다');
  assert.equal(c.find((x) => x.id === 'a').series, 'by-numbers');
});
test('다시 보기 고르기: 오늘 트랙, 아직 안 쓴 것, 반응 높은 순', () => {
  const cands = [{ id: '1', track: 'merchant', text: 'x', ratio: 1.5 }, { id: '2', track: 'merchant', text: 'y', ratio: 2 }, { id: '3', track: 'creator', text: 'z', ratio: 3 }];
  assert.equal(pickEncore(cands, 'merchant').id, '2');
  assert.equal(pickEncore(cands, 'merchant', new Set(['2'])).id, '1');
  assert.equal(pickEncore(cands, 'consumer'), null);
  assert.equal(pickEncore(undefined, 'merchant'), null);
  assert.ok(ENCORE.guide.includes('원글보다 짧게'));
});
test('다시 보기 배선: 일요일, 현장 메모가 이기고, 인스타는 릴스, 한 번만', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /k\.getUTCDay\(\) === 0/);
  assert.match(src, /if \(fieldNote\) \{ encore = null;/);
  assert.match(src, /reel: reelDay \|\| !!encore/);
  assert.match(src, /photo: generated\?\.photo_url, encore_of,/, 'variety.json 에 encore_of 를 남겨 같은 글을 두 번 안 쓴다');
  assert.match(src, /\.\.\.\(encore \? \[encore\.text\] : \[\]\)/, '원글과 거의 같은 글은 검수에서 막는다');
});

// ---- 2026-11-09 5차(대표 "스레드도 인기글들 참고해서 말투까지") ----
import { splitExamples, pickExamples, styleBlock, STYLE_LABEL } from '../src/threads-style.mjs';

test('스레드 참고: 이슈 본문을 --- 로 나누고 링크·사진을 뺀다', () => {
  const ex = splitExamples('첫 글 줄 하나\n줄 둘 https://x.y/z\n---\n![a](https://img)\n두 번째 글이에요 꽤 길게\n---\n짧');
  assert.deepEqual(ex, ['첫 글 줄 하나\n줄 둘', '두 번째 글이에요 꽤 길게']);
  assert.equal(STYLE_LABEL, '스레드참고');
});
test('스레드 참고: 대표가 고른 글 우선, 매일 다른 조합, 중복 없음', () => {
  assert.deepEqual(pickExamples(['a', 'b'], ['c', 'a'], 3, 0), ['a', 'b', 'c']);
  assert.deepEqual(pickExamples(['a', 'b'], [], 3, 1), ['b', 'a']);
  assert.deepEqual(pickExamples([], [], 3, 0), []);
  assert.equal(styleBlock([]), '');
  assert.match(styleBlock(['x']), /말투·길이·줄바꿈.*문장·표현·내용은 가져오지 않는다/);
});
test('스레드 참고 배선: 스레드 프롬프트에 붙고, 베끼면 검수(유사도)에 걸린다', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /링크는 내가 끝에 붙일게\.\$\{styleBlock\(threadsExamples\)\}/);
  assert.match(src, /platform === 'threads' \? threadsExamples : \[\]/);
  const wr = fs.readFileSync(new URL('../src/weekly-review.mjs', import.meta.url), 'utf8');
  assert.match(wr, /threads_top: threadsTop/);
  assert.match(wr, /t\.length <= 160/, '예전 긴 글은 참고로 안 쓴다');
});

// ---- 2026-11-09 6차(대표 "모두 다"): 시간 시험 · 새 딜 모음 · 저장 한 줄 · 콜라보 ----
import { slotFor, allSlots, EXTRA_SLOTS } from '../src/variety.mjs';
import { newRealDeals, digestCaption, digestSpec } from '../src/visual.mjs';
import { collabFor } from '../src/series.mjs';

test('시간 시험: 평소엔 최적 시간, 5일 중 하루는 다른 시간대, 두 플랫폼은 다른 날', () => {
  const sch = { rotation_until: '2026-10-30', slots_kst: ['09:00', '12:30', '19:30'], best: { threads: '19:30', instagram: '19:30' } };
  assert.deepEqual(allSlots(sch), ['09:00', '12:30', '19:30', '21:30']);
  assert.ok(EXTRA_SLOTS.includes('21:30'));
  const th = [], ig = [];
  for (let d = 100; d < 130; d++) { th.push(slotFor('threads', sch, d, '2026-11-10')); ig.push(slotFor('instagram', sch, d, '2026-11-10')); }
  const explore = (a) => a.filter((s) => s !== '19:30');
  assert.equal(explore(th).length, 6, '30일 중 6일 시험');
  assert.equal(explore(ig).length, 6);
  assert.deepEqual([...new Set(explore(th))].sort(), ['09:00', '12:30', '21:30'], '다른 시간대를 고루');
  assert.ok(th.some((s, i) => s !== '19:30' && ig[i] === '19:30'), '같은 날 둘 다 빠지지 않는다');
  assert.equal(slotFor('threads', { ...sch, best: {} }, 101, '2026-11-10'), allSlots(sch)[101 % 4], '최적이 없으면 순환');
  const src = fs.readFileSync(new URL('../../.github/workflows/sns-daily-post.yml', import.meta.url), 'utf8');
  assert.match(src, /cron: '30 12 \* \* \*'/, '21:30 KST 회차');
});
test('새 딜 모음: 실제 사진·최근 7일 딜만, 캡션은 목록 그대로', async () => {
  const now = Date.parse('2026-11-14T03:00:00Z');
  const data = [
    { id: 1, name: '닭도리탕', restaurant_name: '달빛한스푼', image_url: 'https://media.ur-team.com/a.jpg', created_at: '2026-11-12 04:00:00' },
    { id: 2, name: '라떼 2잔', restaurant_name: '시범카페', image_url: '/api/media/uploads/demo/h/x.png', created_at: '2026-11-12 04:00:00' },
    { id: 3, name: '돈가스', restaurant_name: '홍대돈까스', image_url: 'https://d2.cloudfront.net/b.jpg', created_at: '2026-10-01 00:00:00' },
    { id: 4, name: '파스타', restaurant_name: '노바', image_url: 'https://media.ur-team.com/cdn-cgi/image/w=600/https://media.ur-team.com/c.jpg', created_at: '2026-11-13 10:00:00' },
  ];
  const deals = await newRealDeals(async () => ({ json: async () => ({ data }) }), now);
  assert.deepEqual(deals.map((d) => d.id), [1, 4], '시범 사진·오래된 딜은 뺀다');
  assert.equal(deals[1].photo, 'https://media.ur-team.com/c.jpg', '원본 사진 주소');
  const cap = digestCaption(deals);
  assert.match(cap, /새로 들어온 딜 2곳/);
  assert.match(cap, /달빛한스푼, 닭도리탕/);
  const sp = digestSpec(deals, ['/a', '/b'], '/o', {});
  assert.equal(sp.slides.length, 2);
  assert.equal(sp.slides[1].photo, '/b', '장마다 자기 매장 사진');
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /k\.getUTCDay\(\) === 6/);
  assert.match(src, /gen\.source !== 'digest'/, '새 딜 표지를 스레드에 쓰지 않는다');
});
test('콜라보: 아이디가 있는 매장만, 이름이 글에 나올 때, 최대 3', () => {
  const stores = { 달빛한스푼: 'dalbit_spoon', 홍대돈까스: '', 노바: '@nova.pasta', 나쁜아이디: 'a b', 가게하나: 'g1', 가게둘: 'g2', 가게셋: 'g3' };
  assert.deepEqual(collabFor(['달빛한스푼 닭도리탕', '입점 매장 · 홍대돈까스'], stores), ['dalbit_spoon']);
  assert.deepEqual(collabFor(['노바, 파스타 · 나쁜아이디'], stores), ['nova.pasta']);
  assert.equal(collabFor(['가게하나 가게둘 가게셋 달빛한스푼'], stores).length, 3);
  assert.deepEqual(collabFor([undefined, ''], stores), []);
  const lib = fs.readFileSync(new URL('../src/lib.mjs', import.meta.url), 'utf8');
  assert.match(lib, /collaborators: JSON\.stringify\(collaborators\.slice\(0, 3\)\)/);
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /콜라보 초대 실패 → 혼자 게시/);
  const cfg = JSON.parse(fs.readFileSync(new URL('../config/store-instagram.json', import.meta.url), 'utf8'));
  assert.ok(cfg.stores && typeof cfg.stores === 'object');
});
test('저장 한 줄: 마지막 장에 그린다', () => {
  const py = fs.readFileSync(new URL('../scripts/render-post.py', import.meta.url), 'utf8');
  assert.match(py, /나중에 다시 보려면 저장해 두세요/);
  assert.match(py, /own = s\.get\('photo'\)/);
});

// ---- 2026-11-09 7차(대표 "자동으로 머신러닝으로 개선해나가줘") ----
import { rewards, fitArms, thompsonPick, posterior, parseLessons, lessonInput, lessonsBlock, learnLog, armsReport, rng } from '../src/learn.mjs';

test('학습: 성과 배수 → 선택지별 평균', () => {
  const rows = [
    { id: 'a', platform: 'threads', metrics: { score: 300 } }, { id: 'b', platform: 'threads', metrics: { score: 100 } },
    { id: 'c', platform: 'instagram', metrics: { score: 50 } }, { id: 'd', platform: 'instagram', metrics: { score: 50 } },
  ];
  const rw = rewards(rows);
  assert.equal(rw.get('a'), 1.5); assert.equal(rw.get('b'), 0.5); assert.equal(rw.get('c'), 1);
  const arms = fitArms([{ id: 'a', hook: 'number' }, { id: 'b', hook: 'udal' }, { id: 'c', hook: 'number', len: '1' }, { id: 'x', hook: 'why' }], rw);
  assert.deepEqual(arms.hook, { number: { n: 2, mean: 1.25 }, udal: { n: 1, mean: 0.5 } });
  assert.deepEqual(arms.len, { 1: { n: 1, mean: 1 } });
  assert.match(armsReport(arms), /hook: number 1\.25배\(2개\)/);
});
test('톰슨 샘플링: 잘 된 쪽을 더 자주, 덜 써 본 쪽도 가끔, 같은 날은 같은 선택', () => {
  const stats = { good: { n: 10, mean: 1.8 }, bad: { n: 10, mean: 0.4 } };
  const picks = { good: 0, bad: 0, new: 0 };
  for (let d = 0; d < 400; d++) picks[thompsonPick(['good', 'bad', 'new'], stats, d)]++;
  assert.ok(picks.good > picks.new && picks.new > picks.bad, JSON.stringify(picks));
  assert.ok(picks.new > 20, '안 써 본 것도 시험한다');
  assert.equal(thompsonPick(['good', 'bad'], stats, 5), thompsonPick(['good', 'bad'], stats, 5), '재실행해도 같은 선택');
  assert.equal(thompsonPick(['a', 'b'], {}, 1, { exclude: ['a'] }), 'b', '어제 것은 뺀다');
  assert.equal(thompsonPick(['a'], {}, 1, { exclude: ['a'] }), 'a', '다 빠지면 무시');
  assert.equal(posterior(undefined).mean, 1, '데이터 없으면 평균');
  assert.ok(posterior({ n: 1, mean: 3 }).mean < 2, '글 하나로는 크게 안 믿는다');
  const r = rng(3); const v = [r(), r(), r()]; assert.ok(v.every((x) => x >= 0 && x < 1));
});
test('교훈: 숫자·금지어·긴 문장은 버리고 4개까지', () => {
  const got = parseLessons('결과: ["첫 줄을 질문 대신 사실로 시작한 글이 반응이 좋다", "수수료 10%를 앞에 둔다", "지금 바로 써야 한다", "짧게", "두 줄 안에 메시지 하나만 둔다", "줄바꿈을 자주 해 호흡을 짧게 한다", "유달이 대사는 한 줄로 끝낸다", "다섯번째도 괜찮은 교훈이다"]');
  assert.deepEqual(got, ['첫 줄을 질문 대신 사실로 시작한 글이 반응이 좋다', '두 줄 안에 메시지 하나만 둔다', '줄바꿈을 자주 해 호흡을 짧게 한다', '유달이 대사는 한 줄로 끝낸다']);
  assert.deepEqual(parseLessons('엉망'), []);
  assert.equal(lessonsBlock([]), '');
  assert.match(lessonsBlock(['x 교훈']), /위 규칙이 이긴다/);
  const rows = Array.from({ length: 6 }, (_, i) => ({ id: String(i), platform: 'threads', text: `글${i} https://u.kr`, metrics: { score: i } }));
  const inp = lessonInput(rows, rewards(rows));
  assert.match(inp, /반응 좋았던 글/); assert.doesNotMatch(inp, /https/);
  assert.equal(lessonInput(rows.slice(0, 4), rewards(rows)), null, '글이 적으면 안 뽑는다');
});
test('학습 기록: 실물 글의 시간대·형식을 붙이고, 기록 없는 글도 넣는다', () => {
  const out = learnLog([{ id: '1', hook: 'number' }], [{ id: '1', platform: 'instagram', slot_kst: '19:30', media_type: 'CAROUSEL_ALBUM' }, { id: '2', platform: 'threads', slot_kst: '09:00', media_type: 'TEXT_POST' }]);
  assert.deepEqual(out, [{ id: '1', hook: 'number', slot: '19:30', media: 'carousel' }, { id: '2', platform: 'threads', slot: '09:00', media: 'text' }]);
});
test('학습 배선: 고르기·기록·주간 갱신', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /thompsonPick\(HOOKS\.map/);
  assert.match(src, /thompsonPick\(FORMATS\.map/);
  assert.match(src, /arms\.len/);
  assert.match(src, /lessonsBlock\(learnState\?\.lessons/);
  assert.match(src, /format, len, slot: slot_kst, media, topic_tag \}\)\)/, '선택지를 기록해야 배울 수 있다');
  const wr = fs.readFileSync(new URL('../src/weekly-review.mjs', import.meta.url), 'utf8');
  assert.match(wr, /writeJson\('data\/learn-state\.json'/);
  assert.match(wr, /지난 교훈 유지/);
});

// ---- 2026-11-09 8차(대표 "계속 개선"): 여러 개 써서 고르기 · 표지 눈 검사 ----
import { parsePick, pickBest, parseCoverReview, reviewCover, STOCK_SOURCES } from '../src/judge.mjs';

test('고르기: 후보 번호를 읽고, 이상하면 첫 번째', async () => {
  assert.equal(parsePick('후보 2', 3), 1);
  assert.equal(parsePick('9', 3), 0);
  assert.equal(parsePick('', 3), 0);
  assert.equal(await pickBest(['하나'], async () => '1'), 0, '하나면 안 묻는다');
  let seen = '';
  assert.equal(await pickBest(['가', '나', '다'], async (s, u) => { seen = u; return '3'; }, ['짧게 쓴다']), 2);
  assert.match(seen, /\[배운 점\][\s\S]*짧게 쓴다/);
  assert.equal(await pickBest(['가', '나'], async () => { throw new Error('x'); }), 0, '실패해도 게시는 막지 않는다');
});
test('표지 눈 검사: JSON 판정, 실패는 통과로', async () => {
  assert.deepEqual(parseCoverReview('{"ok": false, "reason": "워터마크"}'), { ok: false, reason: '워터마크' });
  assert.equal(parseCoverReview('엉망').ok, true);
  assert.equal((await reviewCover('/없는/파일.jpg', 'x', async () => '{}')).ok, true);
  assert.deepEqual(STOCK_SOURCES, ['pixabay', 'pexels', 'openverse'], '실제 매장·현장 사진은 검사 대상이 아니다');
  const v = fs.readFileSync(new URL('../src/visual.mjs', import.meta.url), 'utf8');
  assert.match(v, /if \(!rv\.ok\) \{ photo = null; files = draw\(null, 'out-plain'\); \}/);
});
test('여러 개 써서 고르기 배선: 통과한 것만 고르고, 하나도 없으면 다시 쓰기', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /const passed = drafts\.filter\(\(d\) => !vetPost\(d, ctx\)\.length\)/);
  assert.match(src, /pickBest\(passed, claude, learnState\?\.lessons/);
  assert.match(src, /let body = drafts\[0\];\n  let problems = vetPost\(body, ctx\);/);
});
