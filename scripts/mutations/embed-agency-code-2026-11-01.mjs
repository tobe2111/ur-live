/**
 * 🧬 주입 — 에이전시 위젯 + "홈페이지에 넣기" (2026-11-01 대표 "모두 이상적으로")
 *    가드: src/tests/unit/embed-agency-code-2026-11-01.test.ts
 */
const T = 'src/tests/unit/embed-agency-code-2026-11-01.test.ts'
const W = 'src/worker/utils/embed-widget.ts'
const R = 'src/worker/routes/embed.routes.ts'
const A = 'src/pages/agency-console/AgencyStoresPanel.tsx'
const L = 'src/shared/embed-code-link.ts'
export default [
  {
    name: '에이전시위젯 — 머리띠를 다시 제목 하나로',
    file: W,
    find: "  const head = i.brand\n    ? `${LOGO}<span class=\"sep\"></span><span class=\"tt\">${esc(i.brand)}</span>`",
    replace: "  const head = false\n    ? `${LOGO}<span class=\"sep\"></span><span class=\"tt\">${esc(i.brand)}</span>`",
    test: T,
    why: '에이전시가 다시 유어샵·매장·지역과 똑같은 머리가 된다 — "우리가 운영한다"는 무게가 사라지는데 화면은 안 깨진다.',
  },
  {
    name: '에이전시위젯 — 갈 곳 없는 전체 보기를 되살린다',
    file: R,
    find: "    brand: agency.name,",
    replace: "    brand: agency.name, moreHref: withUtm('/', 'agency'),",
    test: T,
    why: '에이전시가 자기 사이트에 건 위젯이 손님을 **유어딜 홈**으로 보낸다(에이전시 공개 페이지는 없어서 갈 곳이 없다).',
  },
  {
    name: '에이전시위젯 — 운영 매장 0곳도 그린다',
    file: R,
    find: "meta: storeCount > 0 ? `운영 매장 ${storeCount}곳` : undefined,",
    replace: "meta: `운영 매장 ${storeCount}곳`,",
    test: T,
    why: '신뢰를 주려고 넣은 자리에 "운영 매장 0곳" 이 선다 — 없느니만 못하고, 데이터가 없는 새 에이전시에서 바로 난다.',
  },
  {
    name: '에이전시위젯 🔴 반대 — 유어샵에도 brand 를 넘긴다',
    file: R,
    find: "    kind: 'ushop', theme, title: `${name}님의 유어샵`,",
    replace: "    kind: 'ushop', theme, title: `${name}님의 유어샵`, brand: name,",
    test: T,
    why: '에이전시 하나를 고치려다 나머지 셋이 따라 바뀐다 — 남의 사이트에 이미 걸린 위젯들이 조용히 달라진다.',
  },
  {
    name: '홈페이지에넣기 — 번호를 몰라도 버튼을 그린다',
    file: A,
    find: '{agencyId != null && (',
    replace: '{true && (',
    test: T,
    why: '프로필이 아직 없을 때 `key=null` 로 코드 만들기 화면이 열린다 — 에이전시가 빈 위젯 코드를 복사해 홈페이지에 붙인다.',
  },
  {
    name: '홈페이지에넣기 — SPA 이동으로 연다',
    file: L,
    find: "  window.open(embedCodePath(type, key), '_blank', 'noopener,noreferrer')",
    replace: "  location.assign(embedCodePath(type, key))",
    test: T,
    why: '`/embed` 는 워커가 그리는 화면이라 같은 탭으로 떠나면 작업하던 콘솔·관리 화면을 잃는다(돌아올 길이 뒤로가기뿐).',
  },
]
