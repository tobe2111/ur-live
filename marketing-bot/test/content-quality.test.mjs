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
