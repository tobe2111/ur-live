/**
 * 🧬 주입 — 유어샵 **한 톤** + 로고 배선 (2026-09-30)
 *
 * 대표: *"지금 전체, 식사, 숙소 부분의 배경색은 다르잖아. 아예 모두 똑같이 배경색을 카드 색상이랑
 * 같게 한다면???"* → 시안 확인 후 *"일단 이 형태가 낫고"* · 그리고 *"유어딜 로고 좌측 상단에 있는거
 * 왜 제대로 적용이 안됐지? 검색, 찜, 내 이용권은 없어도 되고"*.
 *
 * 여기서 지키는 것은 **전부 에러 없이 조용히 되돌아간다.** 톤이 셋으로 갈려도, 로고가 다시 텍스트가
 * 돼도, 판(plate)이 돌아와도 빌드는 초록이고 화면은 "그냥 좀 지저분해" 진다 — 그게 이 레포가
 * 2026-09-02 로즈→블루 전환에서 실제로 당한 클래스다(양 끝만 갈고 가운데를 웜으로 남겼다).
 */
const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const CHIPS = 'src/pages/curator-page/PinCategoryChips.tsx'
const T_TOP = 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts'
const T_A3 = 'src/tests/unit/ushop-a3-p1.test.ts'
const PAGE = 'src/pages/CuratorPage.tsx'
const T_LIST = 'src/tests/unit/ushop-s3-list-2026-09-28.test.ts'

export default [
  {
    name: '한톤 — 로고를 다시 손으로 적는다 (워드마크 SSOT 미사용)',
    file: HEADER,
    find: '            <UrDealLogo size={19} />',
    replace: '            <span className="text-[15px] font-bold tracking-[-0.03em]">urdeal</span>',
    test: T_TOP,
    why:
      '2026-09-30 이전이 정확히 이 모양이었다. 라이브 실측이 `font: Pretendard`(Poppins 아님) · ' +
      '브랜드 원 마침표 `false` 였고, **폰트는 이미 로드돼 있었다**(`poppinsLoaded: true`) — ' +
      '이 자리만 SSOT 를 안 쓴 배선 누락이다. 에러도 경고도 안 나고 자간·굵기·점만 조용히 갈린다.',
  },
  {
    name: '한톤 — GNB 세 개(검색·찜·내 이용권)가 브랜드 바로 돌아온다',
    file: HEADER,
    find: "          </Link>\n        </div>",
    replace:
      "          </Link>\n" +
      "          <nav className=\"ml-auto flex items-center gap-4\">\n" +
      "            <Link to=\"/my-vouchers\">{t('nav.myVouchers', { defaultValue: '내 이용권' })}</Link>\n" +
      "          </nav>\n        </div>",
    test: T_TOP,
    why:
      '대표가 직접 뺀 항목이다(*"검색, 찜, 내 이용권은 없어도 되고"*). 남의 가게에서 가장 눈에 띄는 ' +
      '자리에 유어딜로 나가는 링크를 두면 손님을 밖으로 내보내는 셈이고, 같은 목적지는 하단 탭이 이미 담는다.',
  },
  {
    name: '한톤 — 분류 줄이 다시 흰 알약 + 들림이 된다',
    file: CHIPS,
    find: "${on ? 'border-brand text-gray-900 dark:text-white' : 'border-transparent text-gray-400 dark:text-gray-500'}",
    replace: "${on ? 'bg-brand text-white' : 'bg-white dark:bg-[#1D1F29] shadow-lift rounded-full'}",
    test: T_A3,
    why:
      '알약은 **자기 배경으로** 존재를 주장하는 부품이다. 페이지·카드·칩이 한 톤이 된 뒤에는 ' +
      '흰 알약이 흰 바탕 위에 그림자로만 떠 있는 모양이 되고, 그게 대표가 "지저분하다" 고 한 자리다.',
  },
  {
    name: '한톤 — 페이지 바탕이 다시 웜으로 갈린다 (톤이 둘)',
    file: PAGE,
    find: '      <div className="min-h-[100dvh] bg-surface text-gray-900 dark:text-white pb-28">',
    replace: '      <div className="min-h-[100dvh] bg-warm dark:bg-[#11141C] text-gray-900 dark:text-white pb-28">',
    test: T_LIST,
    why:
      '2026-09-30 이전 값이다. 되돌리면 바탕·카드·칩 세 톤이 다시 겹치는데 **화면은 정상으로 뜬다** — ' +
      '대표가 "지저분하다 · 전문성 없어 보인다" 로 읽은 상태가 조용히 복귀한다.',
  },
  {
    name: '한톤 — 줄 사이를 실선 대신 판 여백으로 되돌린다',
    file: PAGE,
    // 🔁 2026-09-30 재조준(#1579 안 A 머지) — PC 2열이 같은 줄에 붙었다. 불변식은 그대로 폰 실선이다.
    find: 'className="max-w-3xl mx-auto px-4 pb-4 divide-y divide-rule lg:divide-y-0 lg:grid lg:gap-2 ur-ushop-rows"',
    replace: 'className="max-w-3xl mx-auto px-4 pb-4 space-y-2 lg:grid lg:gap-2 ur-ushop-rows"',
    test: T_LIST,
    why:
      '판(카드) 사이 여백은 바탕이 달라야 일한다. 한 톤에서는 흰 판이 흰 바탕 위에 그림자로만 떠 ' +
      '있어서, 목록이 "줄" 이 아니라 **떠다니는 조각들**로 보인다.',
  },
  {
    name: '한톤 — DealRow 기본 표면까지 plain 으로 바꾼다 (다섯 화면 동시 변경)',
    file: 'src/components/deal/DealRow.tsx',
    find: "surface = 'card',",
    replace: "surface = 'plain',",
    test: T_LIST,
    why:
      '유어샵 하나를 위해 기본값을 바꾸면 `DealRow` 를 쓰는 **다른 다섯 화면**(교환권 목록·내 이용권· ' +
      '인플루언서 탐색 …)이 같이 납작해진다. 그 화면들은 바탕이 `bg-warm` 이라 거기선 판이 실제로 일한다. ' +
      '“한 화면의 처방을 공용 부품의 기본값으로 올리지 않는다” 가 이 레포가 반복해 배운 규칙이다.',
  },
  {
    name: '한톤 — chrome 과 진열대를 나누는 실선을 뺀다',
    file: PAGE,
    find: 'px-4 pt-2 border-b border-rule flex items-center gap-2 empty:hidden',
    replace: 'px-4 pt-2 flex items-center gap-2 empty:hidden',
    test: T_LIST,
    why:
      '종전엔 헤더(surface)와 본문(warm)의 **톤 차이**가 구분선 역할을 했다(b2 확정안). 한 톤이 되며 ' +
      '그 자리가 안 보이게 됐으니 실선 하나가 그 일을 물려받았다. 빼면 이름·탭·첫 상품이 한 덩어리가 된다.',
  },
  {
    // 🩸 2026-09-30 신설 — **CI 의 `contrast` 가 실제로 잡은 결함**을 고정한다(아래 why 참조).
    name: '한톤 — 분류 줄의 개수를 다시 안 보이는 회색으로',
    file: CHIPS,
    find: "'text-gray-400 dark:text-gray-500'}`}>{n}",
    replace: "'text-gray-300 dark:text-gray-600'}`}>{n}",
    test: T_A3,
    why:
      '이 값이 이 PR 의 첫 판이었고 CI 의 `contrast` 가 **다크 2.15:1** 로 잡았다. 그리고 재 보니 ' +
      '라이트가 더 나빴다(**1.50:1**) — 그 워크플로는 다크만 렌더하므로 라이트 쪽은 아무도 안 보고 있었다. ' +
      '개수는 대표가 직접 요청한 **정보**라 안 읽히면 없는 것과 같다.',
  },
  {
    name: '한톤 — 분류 줄에서 개수를 뺀다 (대표 직접 요청 항목)',
    file: CHIPS,
    find: '>{n}</span>',
    replace: '></span>',
    test: T_A3,
    why:
      '대표: *"각 이용권마다 숫자도 달아줘."* 숫자가 없으면 탭은 "무엇이 있다" 만 말하고 ' +
      '"몇 개 있다" 를 못 말한다 — 진열대에서 그 둘은 다른 정보다.',
  },
]
