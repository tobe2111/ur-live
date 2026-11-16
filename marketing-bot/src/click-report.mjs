// 주간 리포트: 스레드 링크 클릭을 "어디로 갔나(페이지)"와 "어디서 왔나(게시물·답글)"로 나눈다 (2026-11-16 대표 "계속 개선해줘").
// 클릭 자료는 Threads 인사이트(link_total_values: 주소별 누적 클릭) 하나뿐이다 — 가입 수는 앱 UTM 표가 따로 센다.
// 답글 링크는 utm_content=reply-* (reply-intent.mjs), 나머지는 게시물 링크다.
const PAGES = [
  [/\/store\/new/, '입점 바로 등록'],
  [/\/partners/, '입점 안내'],
  [/\/creators\/apply/, '크리에이터 신청'],
  [/\/creators/, '크리에이터 안내'],
];
export function pageOf(url = '') {
  const path = String(url).split('?')[0];
  for (const [re, name] of PAGES) if (re.test(path)) return name;
  return '딜·기타';
}
export function originOf(url = '') {
  return /[?&]utm_content=reply-/.test(String(url)) ? '답글' : '게시물';
}
export function clickBreakdown(clicks = null) {
  if (!clicks) return null;
  const byPage = {}, byOrigin = { 게시물: 0, 답글: 0 };
  for (const [u, v] of Object.entries(clicks)) {
    const n = Number(v) || 0;
    byPage[pageOf(u)] = (byPage[pageOf(u)] || 0) + n;
    byOrigin[originOf(u)] += n;
  }
  return { byPage, byOrigin, total: byOrigin.게시물 + byOrigin.답글 };
}
export function clickLines(clicks = null) {
  const b = clickBreakdown(clicks);
  const head = '### 링크 클릭 — 어디로 갔고 어디서 왔나 (스레드, 최근 4주)';
  if (!b) return `${head}\n- 확인 불가: 스레드 클릭 인사이트를 못 읽었습니다.`;
  if (!b.total) return `${head}\n- 아직 클릭이 없습니다.`;
  const pages = Object.entries(b.byPage).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  return `${head}\n- 페이지별: ${pages}\n- 게시물 ${b.byOrigin.게시물} · 댓글 답글 ${b.byOrigin.답글} (총 ${b.total})`;
}
