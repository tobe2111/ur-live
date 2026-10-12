/**
 * 🎫 홈 상단 배너 2:1 전환 + 홈 패널 테마 추종 (2026-10-12 대표 확정) — 주입 매니페스트.
 * 가드: src/tests/unit/home-top-banner-and-near-default.test.ts · home-panel-light-island.test.ts
 *
 * 대표가 NOL·리뷰노트를 보내며 *"이정도 배너 퀄리티는 되어야 하지 않나?"* → 시안 → 확정 셋:
 *   ① 96px 띠 → 2:1  ② 전폭 → 거터 14px(패널과 같은 리듬)  ③ 부드러운 좌우 넘김.
 * 아래 주입들은 그 셋이 **조용히** 되돌아가는 것을 막는다 — 되돌려도 에러가 안 나고 화면도 안 깨진다.
 */
const BANNER = 'src/tests/unit/home-top-banner-and-near-default.test.ts'
const PANEL = 'src/tests/unit/home-panel-light-island.test.ts'

export default [
  {
    name: '🎫2:1 배너가 다시 전폭이 된다 (거터 제거 — "따로 논다"의 원인)',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: "className={`flex gap-7 px-[14px] ${many ?",
    replace: "className={`flex gap-7 ${many ?",
    test: BANNER,
    why: '거터 14px 는 `.ur-home-panel`(모바일)과 같은 값이다. 빼면 배너만 전폭이 되어 아래 패널과 다시 따로 논다.',
  },
  {
    name: '🎫2:1 카드 폭 계산에서 거터가 두 번 빠진다 (실측 334px · 다음 장 42px 삐져나옴)',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: "${many ? 'snap-start shrink-0 w-full' : 'flex-1'}",
    replace: "${many ? 'snap-start shrink-0 w-[calc(100%-1.75rem)]' : 'flex-1'}",
    test: BANNER,
    why: '스크롤러가 이미 px-3.5 를 갖고 있어 100% 가 362 다. 한 번 더 빼면 의도 없는 미리보기가 생긴다.',
  },
  {
    name: '🎫2:1 장수 계산 상수가 실제 gap 과 어긋난다 (숫자가 손가락과 따로 논다)',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: 'const STRIP_GAP_PX = 28',
    replace: 'const STRIP_GAP_PX = 12',
    test: BANNER,
    why: '2026-10-12 에 gap 을 두 번 바꾸며 이 상수를 안 고쳐 실제로 어긋났다 — 가드가 그걸 잡았다.',
  },
  {
    name: '🎫2:1 숫자를 누를 수 없게 된다 (부드러운 넘김이 손가락 전용이 됨)',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: '          onClick={() => goTo((active + 1) % banners.length)}\n',
    replace: '',
    test: BANNER,
    why: '스와이프를 모르는 사람에게 둘째 장이 영원히 안 보인다. 대표 지시 "부드럽게 넘김"의 절반이 이것이다.',
  },
  {
    name: '🎫2:1 숫자 알약이 배너 밖으로 나간다 (줄이 하나 더 생겨 다시 따로 논다)',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: 'className="absolute right-[26px] bottom-3',
    replace: 'className="mt-2 mx-auto block',
    test: BANNER,
    why: '대표 확정 "2로 가자"의 요지는 숫자가 배너 **안**에 있는 것이다(점 줄을 없앤 이유가 그 층이었다).',
  },
  {
    name: '🎫2:1 포함 블록이 사라져 숫자가 레일과 함께 흘러간다',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: '      <div className="relative">\n',
    replace: '',
    test: BANNER,
    why: 'relative 가 없으면 absolute 가 바깥 블록을 기준으로 잡혀 알약이 엉뚱한 자리에 선다.',
  },
  {
    name: '🎫2:1 사진 위 어두운 오버레이가 사라진다 (밝은 사진에서 흰 글자가 안 읽힘)',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: '{bg && <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75',
    replace: '{false && <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75',
    test: BANNER,
    why: '어떤 사진이 올라올지 모른다. 덮개가 없으면 밝은 사진 위에서 제목이 통째로 사라진다.',
  },
  {
    name: '🌓 홈 패널이 다시 하드코딩 흰색이 된다 (테마 추종 폐기)',
    file: 'src/index.css',
    find: '  background: var(--surface);\n  border-radius: 18px;',
    replace: '  background: #fff;\n  border-radius: 18px;',
    test: PANEL,
    why: '2026-10-12 대표 확정(테마 추종)을 되돌린다. 다크에서 흰 판이 돌아오는데 에러는 0이다.',
  },
  {
    name: '🌓 모바일 홈 패널에 light-island 가 돌아온다',
    file: 'src/components/home/HomeSections.tsx',
    find: '<section className="ur-home-panel">',
    replace: '<section className="ur-home-panel light-island">',
    test: PANEL,
    why: '섬을 붙이면 --surface 가 #FFFFFF 로 되박혀 토큰을 고쳐도 다크에서 흰 판이 된다.',
  },
]
