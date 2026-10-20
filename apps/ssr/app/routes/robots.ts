/**
 * 베타(스테이징) robots.txt — 전체 색인 금지.
 *
 * beta.ur-team.com 이 본 사이트(live.ur-team.com)와 같은 콘텐츠를 SSR 로 내보내므로
 * 검색엔진이 색인하면 중복 콘텐츠 패널티 + 베타 URL 이 검색에 노출될 위험.
 * Phase 3 컷오버로 본 도메인이 이 워커를 가리키게 되면 이 라우트는 본 사이트
 * robots 정책으로 교체해야 함 (그 전까지는 무조건 Disallow).
 */
export function loader() {
  return new Response('User-agent: *\nDisallow: /\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
