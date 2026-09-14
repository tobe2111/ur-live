/**
 * 🧬 주입 — 모바일 홈 판매 진입점(대표 확정 2026-09-14, 안 1)
 *
 * 지키는 셋은 전부 **에러 없이 조용히 되돌아간다**. 자리가 올라가도, 노출 규칙이 사라져도,
 * 목적지가 갈려도 화면은 멀쩡히 그려지고 빌드도 초록이다. 그래서 시험이 있고,
 * 그 시험이 실제로 실패할 수 있는지는 여기서만 확인된다.
 */
const TEST = 'src/tests/unit/mobile-home-sell-entry-2026-09-14.test.ts'

export default [
  {
    name: '🏪판매 진입점이 피드 위로 올라간다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: `      <section className="mt-4">`,
    replace: `      <SellOnUrdealRow />
      <section className="mt-4">`,
    test: TEST,
    why:
      '2026-08-26 에 지도 핀 모달의 같은 문구를 뺀 이유가 **존재가 아니라 자리**였다 — ' +
      '손님이 가게를 보던 중에 끼어들었다. 위로 올리면 그때 뺀 것과 같은 물건이 된다.',
  },
  {
    name: '🏪사장님에게도 판매 진입점이 보인다',
    file: 'src/pages/mobile-home/SellOnUrdealRow.tsx',
    find: `  if (isSeller) return null`,
    replace: ``,
    test: TEST,
    why:
      '이미 가게를 연 사람에게 "내 가게도 올려보세요" 는 틀린 말이다. 마이페이지 타일이 ' +
      '같은 신호로 이미 숨기고 있으므로, 여기만 안 숨기면 두 화면이 서로 다른 말을 한다.',
  },
  {
    name: '🏪localStorage 가 막히면 사장님에게도 보이는 쪽으로 떨어진다',
    file: 'src/pages/mobile-home/SellOnUrdealRow.tsx',
    find: `catch { isSeller = true }`,
    replace: `catch { isSeller = false }`,
    test: TEST,
    why:
      '프라이빗 창·차단된 사이트 데이터에서 접근자는 **던진다**. false 로 떨어지면 ' +
      '이미 사장님인 사람에게 권유가 뜬다 — 조용히 틀리는 쪽이라 못을 박는다.',
  },
  {
    name: '🏪판매 진입점 목적지가 마이페이지 타일과 갈린다',
    file: 'src/pages/mobile-home/SellOnUrdealRow.tsx',
    find: `const SELL_PATH = '/store/new'`,
    replace: `const SELL_PATH = '/seller/register'`,
    test: TEST,
    why:
      '문이 둘이 되면 언젠가 한쪽만 고쳐진다. `/store/new` 는 카카오맵 검색이 안에 있는 ' +
      '매장 등록 문이고, 마이페이지 타일이 이미 그 문을 쓴다.',
  },
  {
    name: '🏪라이트에서 문장이 회색으로 흐려진다',
    file: 'src/pages/mobile-home/SellOnUrdealRow.tsx',
    find: `leading-snug text-gray-900 dark:text-gray-200`,
    replace: `leading-snug text-gray-600 dark:text-gray-300`,
    test: TEST,
    why:
      '대표 2026-09-14: "화이트 버전에서의 글자는 검정이어야 해." 여긴 스크롤 끝이라 ' +
      '더 물러설 곳이 없다 — 회색으로 한 단계만 내려도 안 읽히는 자리가 된다.',
  },
  {
    name: '🏪PC 홈에도 같은 줄이 붙는다',
    file: 'src/pages/pc-home/PcHomePage.tsx',
    find: `export default function PcHomePage`,
    replace: `const SellOnUrdealRow = () => null
export default function PcHomePage`,
    test: TEST,
    why:
      'PC 홈은 푸터가 있어 상시 문을 이미 갖는다. 두 벌이 되면 한쪽만 고쳐지는 사고가 ' +
      '나고, 이 줄은 모바일의 **푸터 부재**를 메우려고 만든 것이라 PC 에선 중복이다.',
  },
]
