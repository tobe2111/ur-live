// 매주 월요일: 최근 게시물 인사이트 → 플랫폼별 최적 시간대 → schedule.json 갱신 → 리포트 이슈.
import { DRY, log, readJson, writeJson, threads, insta, createIssue, claude, THREADS_USER_ID , opsAlert } from './lib.mjs';
import { TRACKS, DEFAULT_WEIGHTS, DEFAULT_CAMPAIGNS, categoryPerformance, adjustWeights, campaignToTrack } from './attribution.mjs';
import { myRecentPosts, utmFromText } from './live.mjs';

const mixCfg = readJson('data/content-mix.json', {});
const CAMPAIGNS = { ...DEFAULT_CAMPAIGNS, ...Object.fromEntries(TRACKS.map((t) => [t, mixCfg.tracks?.[t]?.campaign]).filter(([, v]) => v)) };

// 앱(D1) UTM 귀속 집계: /api/acquisition/utm-report (MARKETING_REPORT_TOKEN 필요). 없으면 null → '확인 불가'.
async function fetchUtmReport(days = 7) {
  const token = process.env.MARKETING_REPORT_TOKEN;
  const base = process.env.URDEAL_API_BASE || 'https://urdeal.kr';
  if (!token) { log('MARKETING_REPORT_TOKEN 없음 → 가입 귀속 확인 불가'); return null; }
  try {
    const r = await fetch(`${base}/api/acquisition/utm-report?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    return j?.success ? j.data.rows : null;
  } catch (e) { log(`UTM 리포트 실패: ${e.message}`); return null; }
}

const schedule = readJson('data/schedule.json', {});
const cutoff = Date.now() - 28 * 86400e3;
// 게시물은 저장 파일이 아니라 Threads·인스타에서 직접 받는다(live.mjs 머리말).
// 트랙은 Threads 글 끝 UTM 링크에서 되찾고, 슬롯은 게시 시각에 가장 가까운 슬롯으로 본다.
// 인스타 캡션엔 링크가 없어 트랙을 모른다(시간대 분석에만 쓰인다).
function nearestSlot(ms) {
  const k = new Date(ms + 9 * 3600e3);
  const m = k.getUTCHours() * 60 + k.getUTCMinutes();
  const slots = schedule.slots_kst || ['09:00', '12:30', '19:30'];
  return slots.map((s) => [s, Math.abs(m - (Number(s.split(':')[0]) * 60 + Number(s.split(':')[1] || 0)))]).sort((a, b) => a[1] - b[1])[0][0];
}
function enrich(p) {
  const utm = p.platform === 'threads' ? utmFromText(p.text) : null;
  return { ...p, posted_at: new Date(p.ms).toISOString(), slot_kst: nearestSlot(p.ms), link: utm?.link, track: utm ? campaignToTrack(utm.campaign, CAMPAIGNS) : null, content_id: utm?.content || p.id };
}
let posts = [];
let recent = [];

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
async function recruitSection(rows, clicks, utmRows) {
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
  for (const [k, a] of Object.entries(g)) out.push(`| ${k} | ${a.posts} | ${a.ig_reach} | ${a.th_views} | ${a.th_clicks ?? 'n/a'} | ${a.reels}/${a.carousels} | ${utmRows ? '아래 표' : '확인 불가'} |`);
  if (!Object.keys(g).length) out.push('| (데이터 없음) | 0 | - | - | - | - | 확인 불가 |');
  out.push('', '- IG 게시물 링크 클릭은 Graph API 미제공 → 표기 안 함.');
  out.push('', '### 가입 귀속 (UTM, 최근 7일)');
  if (!utmRows) out.push('- **확인 불가**: Actions 시크릿 MARKETING_REPORT_TOKEN(=Worker 시크릿 같은 값)이 없거나 API 응답 실패. 앱은 이제 가입·입점 신청·크리에이터 신청 때 utm_campaign/utm_content 를 저장합니다.');
  else {
    const sum = (k) => utmRows.reduce((a, r) => a + (r[k] || 0), 0);
    out.push(`- 사장님 입점 신청: **${sum('store_applies')}** · 크리에이터 신청: **${sum('creator_applies')}** · 회원가입: ${sum('signups')} · 랜딩: ${sum('landings')}`);
    out.push('', '| 소스 | 캠페인 | 랜딩 | 가입 | 입점 신청 | 크리에이터 신청 |', '|---|---|---|---|---|---|');
    for (const r of utmRows) out.push(`| ${r.source} | ${r.campaign} | ${r.landings} | ${r.signups} | ${r.store_applies} | ${r.creator_applies} |`);
    if (!utmRows.length) out.push('| (없음) | - | 0 | 0 | 0 | 0 |');
  }
  return out.join('\n');
}

async function main() {
  posts = (await myRecentPosts({ days: 28 })).map(enrich);
  recent = posts;
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
  const clicks = await threadsLinkClicks();
  const utmRows = await fetchUtmReport(7);
  const recruit = await recruitSection(rows, clicks, utmRows);
  // 주간 비율 자기조정(최근 7일 글 기준) → data/mix-state.json
  const weekAgo = Date.now() - 7 * 86400e3;
  const state = readJson('data/mix-state.json', null) || { weights: { ...DEFAULT_WEIGHTS }, history: [] };
  const perf = categoryPerformance({ posts: posts.filter((p) => Date.parse(p.posted_at) > weekAgo), threadsClicks: clicks, utmRows, campaigns: CAMPAIGNS });
  const adj = adjustWeights(state.weights, perf);
  const fmtW = (w) => TRACKS.map((t) => `${t} ${w[t]}%`).join(' / ');
  const mixLines = ['### 카테고리 비율 자동조정 (범위: 사장님 45-70 · 인플루언서 15-35 · 딜 10-25)',
    `- 지난주: ${fmtW(state.weights)}`, `- 이번주: **${fmtW(adj.weights)}** (${adj.reason})`,
    ...TRACKS.map((t) => `- ${t}: 글 ${perf[t].posts} · 클릭 ${perf[t].clicks} · 전환 ${perf[t].signups}`)].join('\n');
  const newState = { weights: adj.weights, updated_at: new Date().toISOString(), history: [...(state.history || []), { at: new Date().toISOString(), from: state.weights, to: adj.weights, reason: adj.reason }].slice(-26) };
  const body = `최근 4주 게시물 ${rows.length}개 기준 (점수 = 노출 + 10×반응)\n\n${lines.join('\n')}\n\n### 상위 게시물\n${top}\n\n${recruit}\n\n${mixLines}\n\n### 다음 주 제안\n${advice}\n\n클릭/구매는 UTM(utm_content) 기준으로 어드민에서 함께 확인하세요.`;
  // ⚠️ 최적 시간대·비율 조정을 저장할 곳이 아직 없다 — main 직접 push 는 룰셋이 막는다(live.mjs 머리말).
  //    이번 주 계산값은 리포트 이슈에만 남고 다음 게시에는 반영되지 않는다(후속: 상태 저장 경로).
  // marketing-data 브랜치에 저장된다(워크플로가 data/ 를 그 브랜치로 push). 게시물 자체는 실물 조회로 읽는다.
  if (!DRY) { writeJson('data/schedule.json', schedule); writeJson('data/mix-state.json', newState); }
  await createIssue(`[주간 SNS 리포트] ${new Date().toISOString().slice(0, 10)}`, body, ['marketing-report']);
}
main().catch(async (e) => { console.error(e.message); await opsAlert('마케팅 봇 주간 리뷰 실패', e.message); process.exit(1); });
