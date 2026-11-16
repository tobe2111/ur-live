import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionOf, factsFromDeal } from '../src/deal-facts.mjs';
import { placeProblems, vetPost } from '../src/vet.mjs';

const HONGDAE = { id: 2915, name: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트', restaurant_name: '홍대돈까스', restaurant_address: '전북특별자치도 전주시 덕진구 가리내10길 10', price: 7500, original_price: 14500 };

test('주소에서 지역을 뽑는다', () => {
  assert.equal(regionOf('전북특별자치도 전주시 덕진구 가리내10길 10'), '전주시 덕진구');
  assert.equal(regionOf('서울 서초구 방배중앙로 165'), '서울 서초구');
  assert.equal(regionOf(''), '');
});

test('사실 묶음에 주소·가격·차이가 들어간다', () => {
  const f = factsFromDeal(HONGDAE);
  assert.match(f.text, /전주시 덕진구/);
  assert.match(f.text, /7,500원/);
  assert.match(f.text, /14,500원/);
  assert.match(f.text, /7,000원/);
  assert.equal(f.region, '전주시 덕진구');
});

test('사고 재현: 전주 매장을 홍대로 쓰면 반려', () => {
  const facts = factsFromDeal(HONGDAE).text;
  const bad = '홍대에서 바삭한 돈가스 한 접시. #홍대맛집 #돈까스';
  const p = placeProblems(bad, facts);
  assert.ok(p.some((x) => x.includes('"홍대"')), p.join('|'));
  assert.ok(p.some((x) => x.includes('#홍대맛집')), p.join('|'));
  assert.ok(vetPost(bad, { facts, minLen: 0 }).some((x) => x.includes('지명')));
});

test('가게 이름 속 지명과 실제 지역은 통과', () => {
  const facts = factsFromDeal(HONGDAE).text;
  const ok = '전주 덕진구 홍대돈까스, 버크셔 돈가스 세트가 14,500원에서 7,500원. #전주맛집 #동네맛집';
  assert.deepEqual(placeProblems(ok, facts), []);
});

test('위치 없는 사실이면 어떤 지명도 반려', () => {
  const facts = '상품: 코스요리 이용권\n매장 위치: 확인 안 됨 — 지역·동네 이름과 지역 해시태그를 쓰지 않는다';
  assert.ok(placeProblems('강남 코스요리 #강남맛집', facts).length >= 2);
  assert.deepEqual(placeProblems('유달이가 부산 사투리로 한마디', facts), []);
});
