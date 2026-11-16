import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pageOf, originOf, clickBreakdown, clickLines } from '../src/click-report.mjs';

test('클릭 분해: 페이지와 출처(게시물·답글)를 가른다', () => {
  assert.equal(pageOf('https://urdeal.kr/store/new?utm_source=threads'), '입점 바로 등록');
  assert.equal(pageOf('https://urdeal.kr/creators/apply?x=1'), '크리에이터 신청');
  assert.equal(pageOf('https://urdeal.kr/creators'), '크리에이터 안내');
  assert.equal(pageOf('https://urdeal.kr/pass/12'), '딜·기타');
  assert.equal(originOf('https://urdeal.kr/store/new?utm_content=reply-1234-20261116'), '답글');
  assert.equal(originOf('https://urdeal.kr/partners?utm_content=th-1'), '게시물');
  const b = clickBreakdown({ 'https://urdeal.kr/partners?utm_content=th-1': 5, 'https://urdeal.kr/store/new?utm_content=reply-9': 2 });
  assert.deepEqual(b.byOrigin, { 게시물: 5, 답글: 2 });
  assert.equal(b.byPage['입점 안내'], 5);
  assert.equal(b.total, 7);
});

test('클릭 줄: 못 읽으면 "확인 불가", 없으면 0 으로 꾸미지 않는다', () => {
  assert.match(clickLines(null), /확인 불가/);
  assert.match(clickLines({}), /아직 클릭이 없습니다/);
  assert.match(clickLines({ 'https://urdeal.kr/store/new?utm_content=reply-9': 3 }), /댓글 답글 3/);
});

test('배선: 주간 리포트 본문에 클릭 분해가 들어간다', () => {
  const src = fs.readFileSync(new URL('../src/weekly-review.mjs', import.meta.url), 'utf8');
  assert.match(src, /\$\{clickLines\(clicks\)\}/);
});
