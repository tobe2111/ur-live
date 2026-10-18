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
- 확인되지 않은 가격/할인율/수치/조건을 지어내지 않는다. 주어진 상품 정보와 PARTNER_FACTS 만 쓴다.
- 사장님·크리에이터 대상 글에서 매출 증가율, 성공 사례, 방문자 수, 수익 예시, "업계 최저", 자동 승인/자동 송금, 트래픽 보장을 말하지 않는다.
- 과장, 허위 긴급성("마감 임박!!") 금지. 이모지는 0~2개.`;

// 입점/크리에이터 조건 — 레포 src/shared/partners-facts.ts · src/pages/partners/PartnerFaq.tsx · src/pages/CreatorsPage.tsx 기준.
// 저 파일들이 바뀌면 여기도 함께 고친다. 여기 없는 조건은 봇이 약속하지 않는다.
export const PARTNER_LINKS = {
  merchant: 'https://urdeal.kr/partners',
  merchantSignup: 'https://urdeal.kr/store/new',
  creator: 'https://urdeal.kr/creators',
  creatorApply: 'https://urdeal.kr/creators/apply',
  kakao: 'http://pf.kakao.com/_AITdn/chat',
  home: 'https://urdeal.kr/',
};
export const PARTNER_FACTS = `사장님(입점):
- 가입비·월 이용료·광고비 0원. 이용권이 팔리고 손님이 와서 쓴 뒤에만 수수료. 안 팔리면 0원.
- 수수료: 직접 입점 10%(사장님 몫 90%), 대행사 경유 매장 5%. 카드 수수료(현재 약 2.75%, 카드사 정책에 따라 바뀔 수 있음)는 유어딜이 자기 몫 안에서 냄.
- 손님은 방문 전에 온라인으로 먼저 결제 → 이용권이 손님 폰으로 발급. 예약만 하고 안 오는 일 없음.
- 정산은 실제 사용된 이용권만. 유효기간은 사장님이 정하고 지나면 미사용분은 자동 환불, 환불 응대는 유어딜이 함.
- 할인율·수량·유효기간은 사장님이 정함. 유어딜은 최소 할인율을 요구하지 않음.
- 등록 약 10분, 4단계: 카카오맵에서 내 가게 찾기 → 담당자 번호 → 운영 주체 선택 → 사업자등록증 사진. 등록증은 사람이 확인(자동 승인 아님).
- 첫 이용권 초안은 유어딜이 만들어 드리고 사장님은 확인·승인.
- 단말기·포스 연동·직원 교육 불필요. 쓰던 스마트폰으로 손님 QR 스캔, 매장 확인코드 6자리로도 처리 가능.
- 몇 장 팔렸고 그중 몇 명이 실제 방문(QR 사용)했는지 매장 화면에서 확인.
- 정산: 사용된 이용권을 주 단위로 모아 등록 계좌로. 최소 지급액 1만원(미만은 이월). 승인·송금은 사람이 확인.
- 대행사 경유: 대행사가 등록·운영 대행, 수수료 5%, 대행사 보수는 사장님과 대행사가 직접 정함, 대행사는 정산 계좌·사업자 정보 접근 불가, 권한은 언제든 회수 가능.
- 사장님이 딜마다 소개비 %를 정해 인플루언서 소개를 받을 수 있음(소개비는 매장이 정하고 매장이 냄).
- 유어딜은 아직 초기 서비스라 방문자 수를 약속하지 않음.
- 입점 안내 ${PARTNER_LINKS.merchant} · 바로 등록 ${PARTNER_LINKS.merchantSignup} · 문의 카카오 채널, jiwon@ur-team.com
인플루언서/크리에이터(소개 파트너):
- 시작 비용 0원. 카카오 로그인 1분이면 내 유어샵이 자동 생성.
- 3단계: 가입 → 동네 맛집·뷰티 딜을 내 유어샵에 담기 → 인스타·블로그·카톡에 내 링크 공유.
- 매장이 소개 몫을 건 딜이 내 링크로 팔리면 판매액의 소개비가 적립. 소개비율은 딜마다 매장이 정하고 고르기 전에 표시됨.
- 손님이 환불하면 적립도 자동 회수. 적립금은 정산 계좌로 출금(사업소득 원천징수 후 지급). 최소 지급액 1만원.
- 매장이 보낸 소개 제안 수신, 적립·정산 확인을 앱에서.
- 안내 ${PARTNER_LINKS.creator} · 신청 ${PARTNER_LINKS.creatorApply}`;

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
// Facebook 페이지: META_FB_PAGE_TOKEN 없으면 null (호출측에서 건너뜀). 이미지 있으면 /photos, 없으면 /feed
export async function fbPagePost(message, link, image) {
  const t = process.env.META_FB_PAGE_TOKEN;
  if (DRY) return { id: fakeId('fb') };
  if (!t) return null;
  const FB = 'https://graph.facebook.com/v21.0';
  const me = await metaCall(FB, t, 'GET', 'me', { fields: 'id,name' });
  return image
    ? metaCall(FB, t, 'POST', `${me.id}/photos`, { url: image, caption: `${message}\n\n${link}` })
    : metaCall(FB, t, 'POST', `${me.id}/feed`, { message, link });
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
