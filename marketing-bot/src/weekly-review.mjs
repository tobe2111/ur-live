// 매주 월요일: 최근 게시물 인사이트 → 플랫폼별 최적 시간대 → schedule.json 갱신 → 리포트 이슈.
import { DRY, log, readJson, writeJson, threads, insta, createIssue, claude, THREADS_USER_ID } from './lib.mjs';

const posts = readJson('data/posts.json', []);
const schedule = readJson('data/schedule.json', {});
const cutoff = Date.now() - 28 * 86400e3;
const recent = posts.filter((p) => p.id && !p.dry && !p.skipped && Date.parse(p.posted_at) > cutoff);

async function metrics(p) {
  try {
    if (p.platform === 'threads') {
      const r = await threads('GET', `${p.id}/insights`, { metric: 'views,likes,replies,reposts,quotes' });
      const m = Object.fromEntries((r.data || []).map((d) => [d.name, d.values?.[0]?.value ?? d.total_value?.value ?? 0]));
      return { ...m, score: (m.views || 0) + 10 * ((m.likes || 0) + (m.replies || 0) + (m.reposts || 0) + (m.quotes || 0)) };
    }
    const r = await insta('GET', `${p.id}/insights`, { metric: 'reach,likes,comments,saved,shares' });
    const m = Object.fromEntries((r.data || []).map((d) => [d.name, d.values?.[0]?.value ?? d.total_value?.value ?? 0]));
    return { ...m, score: (m.reach || 0) + 10 * ((m.likes || 0) + (m.comments || 0) + (m.saved || 0) + (m.shares || 0)) };
  } catch (e) { log(`인사이트 실패 ${p.id}: ${e.message}`); return null; }
}

// 모집 성과(트랙/UTM 캠페인별). Actions 에서 읽을 수 있는 건 Meta 인사이트뿐:
// 가입(/store/new)·크리에이터 신청은 Cloudflare D1(user_acquisition 등)에 있고 Actions 시크릿으로 읽는 API 가 없어 "확인 불가"로 표기한다.
const campaignOf = (p) => { try { return new URL(p.link || p.bio_link).searchParams.get('utm_campaign')?.replace(/^\d{8}-/, '') || p.track || '?'; } catch { return p.track || '?'; } };
async function threadsLinkClicks() {
  // Threads 사용자 인사이트 clicks: 링크 URL 별 누적 클릭 (link_total_values). 미지원/권한 없음이면 null.
  try {
    const r = await threads('GET', `${THREADS_USER_ID}/threads_insights`, { metric: 'clicks', since: String(Math.floor(cutoff / 1000)), until: String(Math.floor(Date.now() / 1000)) });
    const d = (r.data || []).find((x) => x.name === 'clicks');
    if (!d) return null;
    return Object.fromEntries((d.link_total_values || []).map((v) => [v.link_url, v.value]));
  } catch (e) { log(`Threads clicks 실패: ${e.message}`); return null; }
}
async function recruitSection(rows) {
  const clicks = await threadsLinkClicks();
  const g = {};
  for (const p of rows) {
    const key = `${p.track || '?'} / ${campaignOf(p)}`;
    const a = (g[key] ||= { posts: 0, th_views: 0, ig_reach: 0, th_clicks: clicks ? 0 : null, reels: 0, carousels: 0 });
    a.posts++;
    if (p.platform === 'threads') {
      a.th_views += p.metrics.views || 0;
      if (clicks && p.link) for (const [u, v] of Object.entries(clicks)) if (u === p.link || u.includes(`utm_content=${p.content_id}`)) a.th_clicks += v;
    } else a.ig_reach += p.metrics.reach || 0;
    if (p.media_type === 'REELS') a.reels++;
    if (p.media_type === 'CAROUSEL') a.carousels++;
  }
  const out = ['### 모집 성과 (트랙 / UTM 캠페인)', '| 트랙 / 캠페인 | 게시 | IG 도달 | Threads 조회 | Threads 링크 클릭 | 릴스/캐러셀 | 가입·신청 |', '|---|---|---|---|---|---|---|'];
  for (const [k, a] of Object.entries(g)) out.push(`| ${k} | ${a.posts} | ${a.ig_reach} | ${a.th_views} | ${a.th_clicks ?? 'n/a'} | ${a.reels}/${a.carousels} | 확인 불가 |`);
  if (!Object.keys(g).length) out.push('| (데이터 없음) | 0 | - | - | - | - | 확인 불가 |');
  out.push('', '- IG 게시물 링크 클릭은 Graph API 미제공(프로필 링크 클릭은 계정 단위만) → 표기 안 함.',
    '- 가입·신청 수(/store/new 입점 신청, /creators/apply 크리에이터 신청)는 Cloudflare D1 에만 있고 Actions 에서 읽을 수 있는 API/시크릿이 없어 **확인 불가**. 어드민 유입 리포트(utm_source → user_acquisition)에서 캠페인별로 확인하세요.');
  return out.join('\n');
}

async function main() {
  const rows = [];
  for (const p of recent) { const m = await metrics(p); if (m) { p.metrics = m; rows.push(p); } }
  const lines = [];
  for (const platform of ['threads', 'instagram']) {
    const bySlot = {};
    for (const p of rows.filter((r) => r.platform === platform)) (bySlot[p.slot_kst] ||= []).push(p.metrics.score);
    const avg = Object.entries(bySlot).map(([s, v]) => [s, v.reduce((a, b) => a + b, 0) / v.length, v.length]).sort((a, b) => b[1] - a[1]);
    lines.push(`### ${platform}`, avg.length ? avg.map(([s, a, c]) => `- ${s} KST: 평균 점수 ${a.toFixed(1)} (${c}개)`).join('\n') : '- 데이터 없음');
    if (avg.length && avg[0][2] >= 2) { schedule.best = { ...(schedule.best || {}), [platform]: avg[0][0] }; lines.push(`→ 최적 슬롯: **${avg[0][0]}**`); }
  }
  const top = rows.sort((a, b) => b.metrics.score - a.metrics.score).slice(0, 3).map((p) => `- ${p.platform} ${p.content_id} (${p.track || (p.promo ? '홍보' : '유용')}) 점수 ${p.metrics.score}`).join('\n') || '- 없음';
  const advice = rows.length ? await claude('너는 유어딜 운영자를 돕는 마케팅 분석가다. 3줄 이내 한국어로 다음 주 개선점만. 광고비 집행 제안 금지.', JSON.stringify(rows.map((r) => ({ p: r.platform, slot: r.slot_kst, track: r.track, promo: r.promo, m: r.metrics }))).slice(0, 6000), 300) : '데이터가 쌓이면 제안합니다.';
  const recruit = await recruitSection(rows);
  const body = `최근 4주 게시물 ${rows.length}개 기준 (점수 = 노출 + 10×반응)\n\n${lines.join('\n')}\n\n### 상위 게시물\n${top}\n\n${recruit}\n\n### 다음 주 제안\n${advice}\n\n클릭/구매는 UTM(utm_content) 기준으로 어드민에서 함께 확인하세요.`;
  if (!DRY) { writeJson('data/schedule.json', schedule); writeJson('data/posts.json', posts); }
  await createIssue(`[주간 SNS 리포트] ${new Date().toISOString().slice(0, 10)}`, body, ['marketing-report']);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
