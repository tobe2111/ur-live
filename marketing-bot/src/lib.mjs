// 공통 유틸: 설정, 데이터 파일, Claude API, Meta API, GitHub 이슈. 외부 의존성 없음 (Node 22+).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DRY = process.env.DRY_RUN === '1';
export const IG_USER_ID = '28641841168830624';
export const THREADS_USER_ID = '29196793233237833';
const IG = 'https://graph.instagram.com';
const TH = 'https://graph.threads.net/v1.0';

export const HARD_RULES = `절대 규칙:
- 가짜 후기/리뷰 작성 금지. 고객인 척 금지. 항상 유어딜 운영자 본인 1인칭으로만 말한다.
- 다른 사람 게시물에 댓글 달기 금지, DM 발송 금지, 광고비 집행 제안 금지.
- 확인되지 않은 가격/할인율/수치를 지어내지 않는다. 주어진 상품 정보만 쓴다.
- 과장, 허위 긴급성("마감 임박!!") 금지. 이모지는 0~2개.`;

export function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}
export function writeJson(rel, data) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2) + '\n');
}
export const log = (...a) => console.log(`[${new Date().toISOString()}]${DRY ? ' [DRY]' : ''}`, ...a);

export function kstNow(d = new Date()) { return new Date(d.getTime() + 9 * 3600e3); }
export function kstDateStr(d = new Date()) { return kstNow(d).toISOString().slice(0, 10).replace(/-/g, ''); }

export function utmLink(product, source, campaignSlug, contentId, d = new Date()) {
  const u = new URL(product.url);
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', `${kstDateStr(d)}-${campaignSlug}`);
  u.searchParams.set('utm_content', contentId);
  return u.toString();
}

// ---------- Claude ----------
export async function claude(system, user, maxTokens = 800) {
  if (DRY || !process.env.ANTHROPIC_API_KEY) {
    if (!DRY) throw new Error('ANTHROPIC_API_KEY missing');
    return `[DRY 샘플 응답] ${user.slice(0, 60)}`;
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, system: `${system}\n\n${HARD_RULES}`, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return j.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
}

// ---------- Meta (Threads / Instagram) ----------
async function metaCall(base, token, method, p, params = {}) {
  const u = new URL(`${base}/${p}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  let res;
  if (method === 'GET') { for (const [k, v] of body) u.searchParams.set(k, v); res = await fetch(u); }
  else res = await fetch(u, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`Meta ${method} ${p}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return j;
}
const fakeId = (p) => `dry-${p}-${Date.now()}`;
export function threads(method, p, params) {
  const t = process.env.META_THREADS_ACCESS_TOKEN;
  if (DRY) return Promise.resolve(method === 'GET' ? { data: [] } : { id: fakeId('th') });
  if (!t) throw new Error('META_THREADS_ACCESS_TOKEN missing');
  return metaCall(TH, t, method, p, params);
}
export function insta(method, p, params) {
  const t = process.env.META_IG_ACCESS_TOKEN;
  if (DRY) return Promise.resolve(method === 'GET' ? { data: [] } : { id: fakeId('ig') });
  if (!t) throw new Error('META_IG_ACCESS_TOKEN missing');
  return metaCall(IG, t, method, p, params);
}

// ---------- GitHub issues (Actions 에서 GITHUB_TOKEN 사용) ----------
export async function createIssue(title, body, labels = []) {
  const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN;
  if (DRY || !repo || !token) { log(`(issue 미생성) ${title}\n${body.slice(0, 400)}`); return null; }
  const h = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  for (const name of labels) {
    await fetch(`https://api.github.com/repos/${repo}/labels`, { method: 'POST', headers: h, body: JSON.stringify({ name, color: 'd93f0b' }) }).catch(() => {});
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, { method: 'POST', headers: h, body: JSON.stringify({ title, body, labels }) });
  if (!res.ok) throw new Error(`GitHub issue ${res.status}`);
  const j = await res.json();
  log(`issue #${j.number} 생성`);
  return j.number;
}

// 상품 이미지: config 에 image_url 이 없으면 상품 페이지의 og:image 를 시도
export async function productImage(product) {
  if (product.image_url) return product.image_url;
  if (DRY) return null;
  try {
    const html = await (await fetch(product.url)).text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    return m && /^https:\/\//.test(m[1]) ? m[1] : null;
  } catch { return null; }
}
