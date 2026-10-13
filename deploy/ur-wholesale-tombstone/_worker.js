// 🪦 ur-wholesale 묘비 (2026-10-12) — 도매몰 철거 뒤 이 Pages 프로젝트에 남은 것은
//   운영 DB 가 연결된 **소비자 앱의 사본**(ur-wholesale.pages.dev)뿐이었다. 쓰는 곳은 0 이다.
//   프로젝트 삭제는 대시보드에서 대표가 한다(세션 토큰은 읽기 전용). 그때까지 모든 요청에
//   410 만 준다 — DB·KV 바인딩은 남아 있어도 이 코드가 한 번도 건드리지 않는다.
export default {
  async fetch() {
    return new Response('410 Gone — 유통스타트 도매몰은 운영을 종료했습니다.\n', {
      status: 410,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
        'cache-control': 'no-store',
      },
    })
  },
}
