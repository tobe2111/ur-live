/**
 * 🧬 주입 — 유어샵 머리 2안: 긴 이름 한 줄 + 컴팩트 (2026-11-01 대표 확정 **2안**)
 *    가드: src/tests/unit/ushop-compact-head-2026-11-01.test.ts
 *          src/tests/unit/curator-ssr-first-screen-2026-10-09.test.tsx (서버↔화면 대조)
 *          src/tests/unit/ushop-d-2026-10-25.test.ts (한 줄 결과)
 *          src/tests/unit/ushop-a3-p1.test.ts (이름 칸 폭 = 주인/방문자 동일)
 *
 * 절반은 **반대 방향**이다 — 컴팩트하게 만든다는 이유로 지켜야 할 것을 지우는 쪽.
 */
const T = 'src/tests/unit/ushop-compact-head-2026-11-01.test.ts'
const SSR = 'src/tests/unit/curator-ssr-first-screen-2026-10-09.test.tsx'
const D = 'src/tests/unit/ushop-d-2026-10-25.test.ts'
const A3 = 'src/tests/unit/ushop-a3-p1.test.ts'
const SIZE = 'src/shared/ushop-name-size.ts'
const CAT = 'src/shared/ushop-pin-category.ts'
const H = 'src/pages/curator-page/CuratorHeader.tsx'
const W = 'src/worker/utils/curator-ssr-body.ts'
const P = 'src/pages/CuratorPage.tsx'
const CHIPS = 'src/pages/curator-page/PinCategoryChips.tsx'

export default [
  {
    name: '유어샵머리 — 이름 크기를 다시 고정값으로(축소가 죽는다)',
    file: H,
    find: 'style={{ fontSize: nameSize }} className="min-w-0 font-bold',
    replace: 'className="min-w-0 text-[17px] font-bold',
    test: T,
    why: '크기를 박으면 긴 이름이 칸을 넘겨 말줄임으로만 잘린다 — "아무리 길어도 1줄" 의 절반이 사라진다.',
  },
  {
    name: '유어샵머리 — 워커만 다른 크기를 쓴다(서버↔화면 드리프트)',
    file: W,
    find: '<h1 style="font-size:${nameSize}px"',
    replace: '<h1 style="font-size:17px"',
    test: T,
    why: '서버가 17px 로 그리고 화면이 15px 로 바꾸면 머리 높이가 바뀌어 아래가 전부 밀린다. 에러는 0이다.',
  },
  {
    name: '유어샵머리 — 한 줄 강제를 두 줄 허용으로 되돌린다',
    file: H,
    find: 'tracking-[-0.03em] truncate">{curator.name}',
    replace: 'tracking-[-0.03em] line-clamp-2 break-keep">{curator.name}',
    test: D,
    why: '대표가 "아무리 길어도 1줄" 이라고 못 박은 그 결정을 되돌린다.',
  },
  {
    name: '유어샵머리 — min-w-0 제거(flex 안에서 truncate 가 안 먹는다)',
    file: H,
    find: 'className="min-w-0 font-bold text-gray-900',
    replace: 'className="font-bold text-gray-900',
    test: T,
    why: 'flex 자식은 기본 min-width:auto 라 칸이 밀려 잘리지 않는다 — truncate 가 조용히 무력화된다.',
  },
  {
    name: '유어샵머리 — 버튼 묶음을 이름 줄로 되돌린다(두 줄의 원인)',
    file: H,
    find: '          {cluster}\n        </div>\n\n        {/* ③④',
    replace: '        </div>\n\n        {/* ③④',
    test: A3,
    why: '버튼이 이름 줄로 돌아가면 이름 칸이 다시 132px 이 되고, 주인/방문자 폭도 갈린다.',
  },
  {
    name: '유어샵머리 — 추정 폭을 ASCII 와 한글 같게(추정이 무의미해진다)',
    file: SIZE,
    find: "  if (c >= 0x20 && c <= 0x7e) return 0.56",
    replace: "  if (c >= 0x20 && c <= 0x7e) return 1",
    test: T,
    why: '한글과 ASCII 를 같은 폭으로 세면 영문 이름이 필요 없이 작아진다(추정이 아니라 글자 수 세기가 된다).',
  },
  {
    name: '유어샵머리 — 안전 여유를 없앤다(경계에서 두 줄)',
    file: SIZE,
    find: 'const SAFETY = 0.94',
    replace: 'const SAFETY = 1.25',
    test: T,
    why: '칸보다 넓게 보면 추정 오차가 두 줄 쪽으로 터진다 — 틀릴 땐 작아지는 쪽으로만 틀려야 한다.',
  },
  {
    name: '유어샵머리 — 단계를 하나로(축소 자체가 사라진다)',
    file: SIZE,
    find: 'export const USHOP_NAME_SIZES = [17, 15] as const',
    replace: 'export const USHOP_NAME_SIZES = [17] as const',
    test: T,
    why: '단계가 하나면 긴 이름이 줄어들지 않는다 — 대표 요구("자동으로 글자 크기 조정")가 통째로 죽는다.',
  },
  {
    name: '유어샵머리 — 칩 자리를 다시 무조건 예약(줄이 접히는데 서버는 그린다)',
    file: W,
    find: '(showUShopChips(pins) ? `<span class="${CURATOR_FS_CLASS.chip} invisible">&nbsp;</span>` : \'\')',
    // ⚠️ `replace` 는 **복원된 정상 코드의 부분문자열이면 안 된다** — 러너의 복원 검사가 오발한다
    //   (CLAUDE.md 가 적어 둔 `replace: 'return'` 과 같은 클래스). 그래서 `(1 ?` 로 모양을 바꾼다.
    replace: '(1 ? `<span class="${CURATOR_FS_CLASS.chip} invisible">&nbsp;</span>` : \'\')',
    test: SSR,
    why: '분류가 하나뿐인 유어샵(라이브 /u/jiwon1228)에서 화면은 그 줄을 접는데 서버는 그려 마운트 때 밀린다.',
  },
  {
    name: '유어샵머리 — 정렬 자리를 다시 무조건 예약',
    file: W,
    find: '(showUShopSort(pins) ? `<div class="${CURATOR_FS_CLASS.sortSlot}">',
    replace: '(true ? `<div class="${CURATOR_FS_CLASS.sortSlot}">',
    test: SSR,
    why: '같은 클래스의 밀림 — 진열이 적어 정렬이 안 뜨는 유어샵에서 서버만 그 칸을 그린다.',
  },
  {
    name: '유어샵머리 — 정렬 게이트를 걸러진 수로(거를 때마다 버튼이 깜빡인다)',
    file: P,
    find: '{showUShopSort(pins) && (',
    replace: '{showUShopSort(visiblePins) && (',
    test: T,
    why: '검색·분류로 걸러진 수를 기준으로 하면 거를 때마다 버튼이 사라졌다 나타난다 — 그 자체가 깜빡임이고, 서버 예약과도 갈린다.',
  },
  {
    name: '유어샵머리 — 칩 게이트를 부품에 다시 베껴 적는다(두 벌)',
    file: CHIPS,
    find: '  if (!showUShopChips(pins)) return null',
    replace: '  if (defs.length <= 2) return null',
    test: T,
    why: '같은 판정을 두 곳에 적으면 워커와 화면이 언젠가 갈린다 — 그때 칩 줄 자리가 어긋난다.',
  },
  {
    name: '유어샵머리 — SSOT 가 아이콘 모듈을 끌어온다(워커 번들이 터진다)',
    file: CAT,
    find: "export type UShopPinCategory =",
    replace: "import '@/components/icons/urdeal-icons'\nexport type UShopPinCategory =",
    test: T,
    why: 'voucher-types → urdeal-icons 를 워커가 읽으면 번들이 터진다 — 이 모듈을 순수하게 둔 이유가 그것이다.',
  },
  {
    name: '유어샵머리 — 소개를 다시 두 줄로(머리가 다시 자란다)',
    file: H,
    find: 'leading-snug line-clamp-1">{curator.bio}',
    replace: 'leading-snug line-clamp-2">{curator.bio}',
    test: T,
    why: '2안의 컴팩트는 소개 한 줄이 한 몫이다 — 두 줄로 돌리면 머리가 18px 자란다.',
  },
  {
    name: '유어샵머리 — 얼굴을 56 으로 되돌린다(이름 칸 상수와 어긋난다)',
    file: H,
    find: "const avatarCls = 'w-10 h-10 rounded-full",
    replace: "const avatarCls = 'w-14 h-14 rounded-full",
    test: T,
    why: '얼굴이 커지면 이름 칸이 294 → 278px 인데 상수는 그대로라, 경계 이름이 조용히 두 줄이 된다.',
  },
]
