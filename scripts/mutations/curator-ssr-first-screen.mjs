/**
 * 🛍️ 유어샵 서버 첫 화면 (2026-10-09, 대표 "모두 다 하자") — 주입 매니페스트.
 * 가드: src/tests/unit/curator-ssr-first-screen-2026-10-09.test.tsx
 */
const TEST = 'src/tests/unit/curator-ssr-first-screen-2026-10-09.test.tsx'
const MOD = 'src/worker/utils/curator-ssr-body.ts'

export default [
  {
    name: '🛍️ 방문자의 `관리` 자리 예약이 사라진다(주인만 이름 칸이 좁아져 22px 밀림)',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: '              <span aria-hidden="true" className={`${manageBtnCls} invisible pointer-events-none`}>',
    replace: '              <span aria-hidden="true" className="hidden">',
    test: TEST,
    why: '이 예약이 이 첫 화면의 **전제**다 — 빠지면 주인 화면만 헤더가 148px 이 되어 아래가 전부 밀린다(실측).',
  },
  {
    name: '🛍️ 예약을 `<Link>` 로 바꿔 보이지 않는 채 탭 순서에 끼어든다',
    file: 'src/pages/curator-page/CuratorHeader.tsx',
    find: '              <span aria-hidden="true" className={`${manageBtnCls} invisible pointer-events-none`}>',
    replace: '              <Link to="/u/me/manage" aria-hidden="true" className={`${manageBtnCls} invisible pointer-events-none`}>',
    test: TEST,
    why: '보이지 않는 링크는 키보드·스크린리더에 잡힌다 — 자리를 비우는 것과 기능을 주는 것은 다르다.',
  },
  {
    name: '🛍️ 썸네일 폭이 PinRow 와 갈린다(사진을 두 번 받는다)',
    file: MOD,
    find: 'export const CURATOR_THUMB_WIDTH = 240',
    replace: 'export const CURATOR_THUMB_WIDTH = 480',
    test: TEST,
    why: 'URL 이 한 글자만 달라도 브라우저는 같은 사진을 다시 받는다(2026-09-02 에 111KB 를 그렇게 버렸다).',
  },
  {
    name: '🛍️ 순서를 SSOT 대신 시드 순서 그대로 쓴다(순번 배지가 다른 상품을 가리킨다)',
    file: MOD,
    find: '    const ordered = curatorHomePins(pins)',
    replace: '    const ordered = pins',
    test: TEST,
    why: '순번은 SNS 에서 "N번 이용권" 으로 부르는 **주소**다 — 서버와 마운트가 다르면 소개비가 샌다.',
  },
  {
    name: '🛍️ 사업자 유어샵도 그린다(React 는 SellerPublicPage 를 그리는데)',
    file: MOD,
    find: '    if (d.linked_seller) return \'\'',
    replace: '    if (false) return \'\'',
    test: TEST,
    why: '레이아웃이 통째로 다르다 — 그리면 마운트 때 화면이 바뀐다.',
  },
  {
    name: '🛍️ 빈 유어샵도 그린다(EmptyUrShop 문구가 주인/방문자로 갈린다)',
    file: MOD,
    find: '    if (pins.length === 0) return \'\'',
    replace: '    if (pins.length < 0) return \'\'',
    test: TEST,
    why: '빈 화면은 서버가 모르는 것(주인 여부)으로 갈린다 — 안 그리는 쪽이 맞다.',
  },
  {
    name: '🛍️ 브랜드 바의 `<a>` 래퍼가 사라진다(바가 5px 낮아져 아래 전부 밀린다)',
    file: MOD,
    find: '`<a href="/" aria-label="유어딜 홈" class="${CURATOR_FS_CLASS.brandLink}">${logoHtml(CURATOR_LOGO_SIZE)}</a>`',
    replace: 'logoHtml(CURATOR_LOGO_SIZE)',
    test: TEST,
    why: '감싸는 것 자체가 치수를 만든다(실측 36 → 31). 눈에 안 보이는 5px 가 줄 네 개를 밀어낸다.',
  },
  {
    name: '🛍️ 정렬 버튼 자리 예약이 사라진다(칩 줄이 1px 낮아진다)',
    file: MOD,
    find: '`<div class="${CURATOR_FS_CLASS.sortSlot}"><span class="${CURATOR_FS_CLASS.sortBtn} invisible">&nbsp;</span></div>`',
    replace: "''",
    test: TEST,
    why: '줄의 높이를 정하는 것은 칩(-mb-px)이 아니라 음수 마진 없는 정렬 칸이다 — 1px 도 밀림이다.',
  },
  {
    name: '🛍️ 아이콘 SVG 를 워커가 손으로 그린다(두 벌이 갈린다)',
    file: MOD,
    find: '    const iconSlots = `<span class="${CURATOR_FS_CLASS.iconBtn}"></span>`.repeat(snsCount + 1)',
    replace: '    const iconSlots = `<span class="${CURATOR_FS_CLASS.iconBtn}"><svg width="18" height="18"><path d="M1 1"/></svg></span>`.repeat(snsCount + 1)',
    test: TEST,
    why: 'lucide·SNS path 를 옮기면 아이콘이 바뀌는 날 조용히 갈린다 — 빈 칸만 예약하고 아이콘은 마운트 때 그 안에서 나타나게 한다.',
  },
  {
    name: '🛍️ 워커가 `/u/:handle/p/:id`(핀 귀속 경로)에도 그린다',
    file: 'src/worker/index.ts',
    find: "/^\\/u\\/[A-Za-z0-9_-]{1,40}\\/?$/.test(url.pathname)",
    replace: "url.pathname.startsWith('/u/')",
    test: TEST,
    why: '같은 CURATOR 슬롯이라 걸린다 — 그 경로는 다른 컴포넌트다(클릭 기록·소개비 귀속).',
  },
  {
    name: '🛍️ PC 에도 그린다(2열 그리드 + 전역 네비를 서버가 모른다)',
    file: 'src/worker/index.ts',
    find: "&& isMobileUserAgent(c.req.header('user-agent'))) {\n      // 🛍️ 2026-10-09",
    replace: ") {\n      // 🛍️ 2026-10-09",
    test: TEST,
    why: 'PC 는 `.ur-ushop-pc` 2열 + DesktopTopNav 라 서버가 반쪽만 그리면 가로·세로가 같이 움직인다.',
  },
  {
    name: '🛍️ 페이지가 순서 SSOT 를 안 쓰고 자기 가르기로 돌아간다',
    file: 'src/pages/CuratorPage.tsx',
    find: '  const homePins = useMemo(() => (data?.pins ? curatorHomePins(data.pins) : []), [data])',
    replace: '  const homePins = useMemo(() => (data?.pins ? [...data.pins] : []), [data])',
    test: TEST,
    why: '두 벌이 되는 순간 워커와 화면의 순번이 갈린다 — 에러가 아니라 거짓말이 된다.',
  },
]
