import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isInvalidLinkError, fallbackLink, swapLinkInText } from '../src/cta.mjs';

test('링크 거절: 2026-11-17 스레드 오류를 알아보고, 신청 페이지를 안내 페이지로 바꾼다(UTM 유지)', () => {
  const err = new Error('Meta POST x/threads_publish: {"error_subcode":4279047,"error_user_msg":"The post you\'re trying to publish has an invalid link attachment."}');
  assert.ok(isInvalidLinkError(err));
  assert.ok(!isInvalidLinkError(new Error('Media Not Found 4279009')));
  const u = 'https://urdeal.kr/store/new?utm_source=threads&utm_content=th-20261117';
  assert.equal(fallbackLink(u), 'https://urdeal.kr/partners?utm_source=threads&utm_content=th-20261117');
  assert.equal(fallbackLink('https://urdeal.kr/creators/apply?a=1'), 'https://urdeal.kr/creators?a=1');
  assert.equal(fallbackLink('https://urdeal.kr/partners?a=1'), null);
  assert.equal(swapLinkInText(`10분이에요.\n\n${u}`, u, fallbackLink(u)), '10분이에요.\n\nhttps://urdeal.kr/partners?utm_source=threads&utm_content=th-20261117');
});

test('배선: 스레드 본글과 댓글 답글 둘 다 링크 거절 시 안내 페이지로 다시 올린다', () => {
  const post = fs.readFileSync(new URL('../src/daily-post.mjs', import.meta.url), 'utf8');
  assert.match(post, /isInvalidLinkError\(e\) \? fallbackLink\(link\)/);
  assert.match(post, /text: swapLinkInText\(text, link, alt\)/);
  const rep = fs.readFileSync(new URL('../src/reply-comments.mjs', import.meta.url), 'utf8');
  assert.match(rep, /swapLinkInText\(reply, link, alt\)/);
});
