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
    name: '에이전시위젯 — 머리띠에서 회사 이름을 뺀다',
    // 🔁 2026-11-02 재조준 — 에이전시는 전용 화면(embed-agency.ts)이 그린다.
    file: 'src/worker/utils/embed-agency.ts',
    find: '<span class="x">×</span><span class="tt">${esc(i.brand)}</span>',
    replace: '<span class="tt">유어딜</span>',
    test: T,
    why: '에이전시가 다시 유어딜 이름만 걸린 위젯이 된다 — "우리가 운영한다"는 무게가 사라지는데 화면은 안 깨진다.',
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
    file: 'src/worker/utils/embed-agency.ts',
    find: "i.storeCount > 0 ? stat('운영 매장', i.storeCount, '곳') : '',",
    replace: "stat('운영 매장', i.storeCount, '곳'),",
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
    name: '홈페이지에넣기 — 에이전시 화면에 입구가 되살아난다',
    file: A,
    // 🔁 2026-11-03 재조준 — 대표 *"홈페이지에 넣기는 빼줘"* 로 입구를 걷었다. 되살아나지 않게 지킨다.
    find: '{canManage && <FlatRow icon={<ShopPlusIcon className="h-[18px] w-[18px]" aria-hidden="true" />} label="매장 대신 등록" hint="유어딜에 없는 매장" onClick={() => setSheet(\'register\')} last={!trailingRows} />}',
    replace: '<FlatRow icon={null} label="홈페이지에 넣기" hint="코드 받기" onClick={() => openEmbedCode(\'agency\', 1)} />',
    test: T,
    why: '대표가 빼라고 한 입구다.',
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
