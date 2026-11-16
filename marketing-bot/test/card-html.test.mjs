import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDeckHtml, photoMode, slideCount } from '../src/card-html.mjs';
import { dealDeck, shortRegion, parseVisual, toPilSpec } from '../src/visual.mjs';
import { factsFromDeal } from '../src/deal-facts.mjs';
import { parseDeckReview } from '../src/judge.mjs';

const DEAL = factsFromDeal({ id: 2915, name: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트', restaurant_name: '홍대돈까스', restaurant_address: '전북특별자치도 전주시 덕진구 가리내10길 10', price: 7500, original_price: 14500 });

test('작은 사진은 액자, 큰 사진은 꽉 채움', () => {
  assert.equal(photoMode({ w: 540, h: 720 }), 'framed');
  assert.equal(photoMode({ w: 1080, h: 1350 }), 'full');
});

test('딜 카드: 가격·위치·매장 정보는 확인된 사실에서 나온다', () => {
  const d = dealDeck(DEAL, { hasPhoto: true });
  assert.equal(d.kicker, '전주 덕진 · 홍대돈까스');
  const price = d.slides.find((x) => x.type === 'price');
  assert.equal(price.was, '14,500');
  assert.equal(price.now, '7,500');
  assert.equal(price.save, '7,000원 아껴요');
  assert.ok(d.slides.some((x) => x.type === 'photo'));
  assert.match(String(d.end.title), /^전주 가는 친구에게/);
  assert.ok(d.end.rows.some((r) => r.k === '위치' && r.v === '전주시 덕진구 가리내10길 10'));
  assert.ok(!JSON.stringify(d).includes('홍대 가는'));
});

test('사진이 없으면 사진 장을 넣지 않는다', () => {
  assert.ok(!dealDeck(DEAL, { hasPhoto: false }).slides.some((x) => x.type === 'photo'));
});

test('지역 줄임', () => {
  assert.equal(shortRegion('전주시 덕진구'), '전주 덕진');
  assert.equal(shortRegion('서울 서초구'), '서울 서초');
});

test('HTML: 장 수·진행 막대·이스케이프', () => {
  const d = dealDeck(DEAL, { hasPhoto: false });
  const spec = { fonts: {}, title: ['<b>돈가스</b>'], kicker: d.kicker, slides: d.slides, end: d.end };
  const html = buildDeckHtml(spec);
  assert.equal(slideCount(spec), 1 + d.slides.length + 1);
  assert.equal((html.match(/<section class="s /g) || []).length, slideCount(spec));
  assert.ok(html.includes('&lt;b&gt;돈가스'));
  assert.ok(!html.includes('<b>돈가스</b>'));
  assert.ok(html.includes('7,500'));
});

test('이미지 문구 파싱: 장 종류와 항목', () => {
  const v = parseVisual(JSON.stringify({ title: ['광고비 없이', '손님 먼저'], slides: [
    { type: 'steps', label: '순서', title: '신청부터', items: ['신청', '등록', '판매'] },
    { type: 'rows', title: '수수료', rows: [{ k: '직접 입점', v: '10%' }] },
    { type: 'weird', title: '요점' },
  ], cta: '내 가게도 올려보기' }));
  assert.equal(v.slides[0].type, 'steps');
  assert.equal(v.slides[0].items.length, 3);
  assert.equal(v.slides[1].type, 'point'); // 줄이 하나뿐인 표는 요점으로
  assert.equal(v.slides[2].type, 'point');
});

test('PIL 물러서기용 spec 변환', () => {
  const d = dealDeck(DEAL, { hasPhoto: true });
  const p = toPilSpec({ out_dir: '/x', fonts: { heavy: 'h', semi: 's' }, title: ['t'], slides: d.slides, end: d.end });
  assert.ok(p.slides.every((x) => x.title));
  assert.equal(p.slides[0].title, '7,500원');
});

test('카드 눈 검사 판정', () => {
  assert.equal(parseDeckReview('{"ok":true,"score":5,"fix":["a"]}').ok, false);
  assert.equal(parseDeckReview('{"ok":true,"score":8,"fix":[]}').ok, true);
  assert.equal(parseDeckReview('엉망').ok, true);
});

test('인스타는 월·수·금, 스레드는 인스타 쉬는 날 카드를 새로 만들지 않는다', () => {
  const src = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(src, /process\.env\.IG_DAYS \|\| '1,3,5'/);
  const th = src.slice(src.indexOf('async function threadsImage'), src.indexOf('// ---- Threads ----'));
  assert.ok(!th.includes('makeVisual'), '스레드용 카드를 따로 만들면 안 된다');
});
