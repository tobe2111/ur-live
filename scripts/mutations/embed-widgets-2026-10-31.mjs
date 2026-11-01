/**
 * 🧬 주입 — 홈페이지 삽입 위젯 /embed/* (2026-10-31 대표 "HTML 임베드를 여러개 만들어줘")
 *    가드: src/tests/unit/embed-widgets-2026-10-31.test.ts
 */
const T = 'src/tests/unit/embed-widgets-2026-10-31.test.ts'
const R = 'src/worker/routes/embed.routes.ts'
const W = 'src/worker/utils/embed-widget.ts'
export default [
  {
    name: '임베드 — 에이전시 위젯이 다른 에이전시 담당 이용권까지 보인다',
    file: R,
    find: 'AND NOT EXISTS (SELECT 1 FROM agency_products ap WHERE ap.product_id = p.id AND ap.agency_id != ?)',
    replace: 'AND (1=1 OR ? IS NULL)',
    test: T,
    why: '한 매장을 여러 에이전시가 맡는다. 남의 성과를 내 포트폴리오로 보이면 성과 분리가 깨진다.',
  },
  {
    name: '임베드 — 유어샵 핀이 리다이렉트를 안 거친다(소개 값 유실)',
    file: R,
    find: '() => `/api/curator/${encodeURIComponent(handle)}/p/${r.id}/redirect`',
    replace: 'undefined',
    test: T,
    why: '핀 클릭은 서버 리다이렉트가 ?aff= 를 심는다. 상세로 바로 보내면 위젯에서 팔린 것의 소개비가 안 잡힌다.',
  },
  {
    name: '임베드 — 유어샵 핀에 미승인 매장 이용권이 뜬다',
    file: R,
    find: "${consumerVisibleProductSql('p')} AND ${approvedSellerProductSql('p')}\n      ORDER BY pp.position",
    replace: "${consumerVisibleProductSql('p')}\n      ORDER BY pp.position",
    test: T,
    why: '승인 전 매장은 메인에 안 보인다(2026-09-16). 위젯이 남의 사이트에 띄우면 그 벽이 뚫린다.',
  },
  {
    name: '임베드 — 지역 위젯이 주소를 안 거른다',
    file: R,
    find: '.filter((r) => addressInRegion(r.restaurant_address, ref))',
    replace: '',
    test: T,
    why: '관광 사이트의 "강원 이용권" 칸에 서울 가게가 뜬다. 주소 판정은 지역 페이지와 같은 SSOT 여야 한다.',
  },
  {
    name: '임베드 — 상품명을 탈출 없이 넣는다',
    file: W,
    find: '+ `<span class="nm">${esc(c.name)}</span>${og}<span class="pr">${disc}${won(c.price)}</span></a>`',
    replace: '+ `<span class="nm">${c.name}</span>${og}<span class="pr">${disc}${won(c.price)}</span></a>`',
    test: T,
    why: '상품명은 사장님이 쓴다. 남의 사이트 iframe 안에서 마크업으로 해석되면 안 된다.',
  },
]
