// 참고 계정 벤치마크 수집 (읽기 전용): Instagram Graph API business_discovery 로
// config/reference-accounts.json 의 계정별 최근 게시물 ~12개를 GET 으로만 조회 → data/reference-accounts/YYYYMMDD.json.
// 절대 게시/댓글/수정하지 않음 — 이 파일은 GET 외 요청을 보내지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, IG_USER_ID, DRY, log, readJson, writeJson, kstDateStr } from './lib.mjs';

const FB = 'https://graph.facebook.com/v21.0';
const FIELDS = 'caption,media_type,like_count,comments_count,timestamp,permalink';
const PERM_CODES = new Set([10, 190, 200, 210, 230]);

export function permissionHint(err) {
  const code = err?.code;
  if (code === 190) return '토큰 만료/무효 — META_FB_PAGE_TOKEN 재발급 필요';
  if (PERM_CODES.has(code) || (code >= 200 && code < 300)) {
    return '권한 부족 — 토큰에 instagram_basic + pages_read_engagement (business_discovery) 권한, 그리고 IG 비즈니스 계정이 연결된 페이지 토큰이어야 함';
  }
  return '';
}

async function graphGet(p, params, token, fetchImpl = fetch) {
  const u = new URL(`${FB}/${p}`);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) u.searchParams.set(k, v);
  const res = await fetchImpl(u, { method: 'GET' });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) { const e = new Error(`Meta GET ${p}: ${JSON.stringify(j.error || j).slice(0, 300)}`); e.meta = j.error || {}; throw e; }
  return j;
}

export async function fetchAccount(username, limit, token, fetchImpl = fetch) {
  const fields = `business_discovery.username(${username}){username,followers_count,media_count,media.limit(${limit}){${FIELDS}}}`;
  const j = await graphGet(IG_USER_ID, { fields }, token, fetchImpl);
  const bd = j.business_discovery || {};
  return {
    username: bd.username || username,
    followers_count: bd.followers_count ?? null,
    media_count: bd.media_count ?? null,
    posts: (bd.media?.data || []).map(({ id, ...m }) => m),
  };
}

async function main() {
  const cfg = readJson('config/reference-accounts.json', { accounts: [] });
  const limit = cfg.limit || 12;
  const token = process.env.META_FB_PAGE_TOKEN;
  if (!DRY && !token) { console.error('::error::META_FB_PAGE_TOKEN secret 이 비어 있음 — repo Settings > Secrets 에 등록 필요'); process.exit(1); }
  const out = { fetched_at: new Date().toISOString(), accounts: [] };
  let permFail = false;
  for (const a of cfg.accounts) {
    if (DRY) { out.accounts.push({ label: a.label, username: a.username, posts: [], dry: true }); continue; }
    try {
      const r = await fetchAccount(a.username, limit, token);
      out.accounts.push({ label: a.label, ...r });
      const likes = r.posts.reduce((s, p) => s + (p.like_count || 0), 0);
      const cmts = r.posts.reduce((s, p) => s + (p.comments_count || 0), 0);
      const n = r.posts.length || 1;
      log(`@${r.username} (${a.label}) 팔로워 ${r.followers_count ?? '?'} · 최근 ${r.posts.length}개 평균 좋아요 ${Math.round(likes / n)} · 댓글 ${Math.round(cmts / n)}`);
    } catch (e) {
      const hint = permissionHint(e.meta);
      if (hint) permFail = true;
      const notFound = e.meta?.code === 110 || /cannot be found|Invalid user id/i.test(e.message);
      console.log(`::warning::@${a.username} (${a.label}) 실패: ${notFound ? '계정을 찾을 수 없음 (핸들 확인 또는 비즈니스/크리에이터 계정 아님) ' : ''}${hint || e.message}`);
      out.accounts.push({ label: a.label, username: a.username, error: e.message.slice(0, 300) });
    }
  }
  if (!DRY) {
    fs.mkdirSync(path.join(ROOT, 'data/reference-accounts'), { recursive: true });
    writeJson(`data/reference-accounts/${kstDateStr()}.json`, out);
  }
  const ok = out.accounts.filter((a) => !a.error).length;
  log(`요약: ${ok}/${out.accounts.length} 계정 수집 완료`);
  if (permFail) { console.error('::error::Meta 권한 오류 — META_FB_PAGE_TOKEN 권한(instagram_basic, pages_read_engagement) 및 IG 비즈니스 계정 연결 확인'); process.exit(1); }
  if (!DRY && ok === 0 && out.accounts.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
