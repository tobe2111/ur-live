// 참고 계정 벤치마크 수집 (읽기 전용): Instagram Graph API business_discovery 로
// config/reference-accounts.json 의 계정별 최근 게시물 ~12개를 GET 으로만 조회 → data/reference-accounts/YYYYMMDD.json.
// 절대 게시/댓글/수정하지 않음 — 이 파일은 GET 외 요청을 보내지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, IG_USER_ID, DRY, log, readJson, writeJson, kstDateStr, claude } from './lib.mjs';

// business_discovery 는 graph.instagram.com(META_IG_ACCESS_TOKEN)에서 동작하지 않음(2026-10-24 code 100 확인) — 페이지 토큰 + graph.facebook.com 만 사용.

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
  out.top = topPosts(out.accounts).map(({ account, score, caption, like_count, comments_count, media_type, permalink }) => ({ account, score: +score.toFixed(5), like_count, comments_count, media_type, permalink, caption }));
  if (!DRY) {
    fs.mkdirSync(path.join(ROOT, 'data/reference-accounts'), { recursive: true });
    writeJson(`data/reference-accounts/${kstDateStr()}.json`, out);
  }
  const ok = out.accounts.filter((a) => !a.error).length;
  if (!DRY && ok) await updateLearnedPatterns(topPosts(out.accounts));
  log(`요약: ${ok}/${out.accounts.length} 계정 수집 완료`);
  if (permFail) { console.error('::error::Meta 권한 오류 — META_FB_PAGE_TOKEN 권한(instagram_basic, pages_read_engagement) 및 IG 비즈니스 계정 연결 확인'); process.exit(1); }
  if (!DRY && ok === 0 && out.accounts.length) process.exit(1);
}

// 반응 상위 게시물: 팔로워 대비 (좋아요 + 댓글*3) — 계정 크기 차이를 보정, 계정당 최대 perAccount 개
export function topPosts(accounts, n = 6, perAccount = 2) {
  const all = [];
  for (const a of accounts) {
    if (a.error || !a.posts?.length) continue;
    const f = Math.max(a.followers_count || 1, 1);
    a.posts
      .filter((p) => p.caption)
      .map((p) => ({ account: a.username, label: a.label, score: ((p.like_count || 0) + 3 * (p.comments_count || 0)) / f, ...p }))
      .sort((x, y) => y.score - x.score)
      .slice(0, perAccount)
      .forEach((p) => all.push(p));
  }
  return all.sort((x, y) => y.score - x.score).slice(0, n);
}

export const PATTERN_SYSTEM = `너는 소상공인 대상 SNS 글의 '패턴'만 뽑는 분석가다. 아래는 사장님 대상 계정들에서 반응이 좋았던 캡션이다.
- 각 글이 왜 반응이 좋았는지 '구조'만 추상화해 패턴 3~5개를 만든다 (첫 줄 훅, 전개, 마무리).
- example 은 네가 새로 지은 한 문장이다. 원문 문장·고유명사·브랜드명을 절대 옮기지 않는다.
- 출력은 JSON 배열만: [{"id":"영문-kebab","hook":"짧은 이름","how":"쓰는 법 한 문장","example":"직접 지은 예시"}]`;

// 원문 8글자 이상을 그대로 옮긴 example 은 버린다 (베끼기 방지)
export function copiesSource(example, captions) {
  const norm = (t) => t.replace(/\s+/g, '');
  const e = norm(example);
  for (const c of captions.map(norm)) for (let i = 0; i + 8 <= e.length; i++) if (c.includes(e.slice(i, i + 8))) return true;
  return false;
}
export function parsePatterns(text, captions) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  let arr; try { arr = JSON.parse(m[0]); } catch { return []; }
  return (Array.isArray(arr) ? arr : [])
    .filter((p) => p && p.id && p.hook && p.how && p.example && !copiesSource(String(p.example), captions))
    .slice(0, 5)
    .map((p) => ({ id: `learned-${String(p.id).slice(0, 40)}`, hook: String(p.hook), how: String(p.how), example: String(p.example) }));
}

// 상위 게시물 → 패턴 추출 → data/reference-patterns.json (style.mjs 가 자동으로 섞어 씀). 실패해도 수집은 성공 처리.
export async function updateLearnedPatterns(top, claudeFn = claude) {
  if (!top.length) { log('상위 게시물 없음 — 패턴 갱신 생략'); return null; }
  const captions = top.map((p) => p.caption);
  const user = top.map((p, i) => `#${i + 1} (${p.label}, ${p.media_type}, 좋아요 ${p.like_count ?? '?'}, 댓글 ${p.comments_count ?? '?'})\n${p.caption.slice(0, 600)}`).join('\n\n');
  try {
    const patterns = parsePatterns(await claudeFn(PATTERN_SYSTEM, user, 1200), captions);
    if (!patterns.length) { console.log('::warning::패턴 추출 결과가 비어 있음 — 기존 패턴 유지'); return null; }
    const out = { updated_at: new Date().toISOString(), source: top.map((p) => p.permalink).filter(Boolean), patterns };
    if (!DRY) writeJson('data/reference-patterns.json', out);
    log(`참고 패턴 ${patterns.length}개 갱신: ${patterns.map((p) => p.hook).join(' / ')}`);
    return out;
  } catch (e) {
    console.log(`::warning::패턴 추출 실패 (기존 패턴 유지): ${e.message.slice(0, 200)}`);
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
