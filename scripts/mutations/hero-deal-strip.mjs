/**
 * 🎞️ 홈 히어로 이용권 띠 (2026-09-28 대표 확정 — 시안 ② + "좌우로 자연스럽게 계속 이동") — 주입 매니페스트.
 * 가드: src/tests/unit/hero-deal-strip-2026-09-28.test.tsx
 */
const TEST = 'src/tests/unit/hero-deal-strip-2026-09-28.test.tsx'
const SSOT = 'src/shared/home-hero-strip.ts'
const STRIP = 'src/components/home/HeroDealStrip.tsx'

export default [
  {
    name: '🎞️ 히어로 띠가 아래 매대 첫 줄과 같은 딜을 돌린다',
    file: SSOT,
    find: 'export const HERO_STRIP_SKIP = 4',
    replace: 'export const HERO_STRIP_SKIP = 0',
    test: TEST,
    why:
      '같은 딜이 히어로와 바로 아래 카드에 40px 간격으로 두 번 나온다. 에러가 아니라 "매대가 좁아 ' +
      '보인다"로만 나타나서 아무도 결함으로 신고하지 않는다 — 시안 1차에서 실제로 그랬다.',
  },
  {
    name: '🎞️ 한 벌이 밴드보다 좁아져 루프 이음매에 빈 칸이 생긴다',
    file: SSOT,
    find: 'export const HERO_STRIP_MIN_PER_LOOP = 5',
    replace: 'export const HERO_STRIP_MIN_PER_LOOP = 2',
    test: TEST,
    why:
      '띠는 [같은 벌 2개]를 이어 붙이고 한 벌 폭만큼 밀어 무한 루프를 만든다. 한 벌이 밴드(최대 900px)' +
      '보다 좁으면 미는 동안 오른쪽에 **빈 칸**이 지나간다. 딜이 많은 지역에서는 안 보이고 적은 곳에서만 ' +
      '가끔 보여서, 보는 사람마다 재현이 안 되는 종류다.',
  },
  {
    name: '🎞️ 타일이 세로 사진을 다시 가운데로 자른다 (대표가 신고한 바로 그 증상)',
    file: SSOT,
    find: "    gravity: 'auto',",
    replace: '',
    test: TEST,
    why:
      '우리 사진 70장 중 37%가 세로다. `gravity` 가 빠지면 리사이저가 가운데를 자르고, 그러면 ' +
      '2026-09-28 대표 신고("그냥 확대해서 올라가버리는거잖아")로 되돌아간다. ' +
      '⚠️ `cropFrag` 는 gravity 가 있을 때만 height·fit 도 붙이므로 **한 줄이 셋을 끈다**.',
  },
  {
    name: '🎞️ 히어로 타일이 매대 카드와 같은 큰 URL 을 쓴다 (트래픽 2~6배)',
    file: SSOT,
    find: 'export const HERO_TILE_REQUEST_WIDTH = 384',
    replace: 'export const HERO_TILE_REQUEST_WIDTH = 800',
    test: TEST,
    why:
      '실측(딜 8개): 전용 384×288 q62 = 106KB vs 카드와 공유 width=800 = 652KB. 히어로는 첫 화면이라 ' +
      '**아무도 안 내려가도 무조건 받는다** — 카드 URL 재사용이 공짜처럼 보이지만 손익분기가 방문자의 84%다. ' +
      '화면은 똑같이 보이므로 눈으로는 절대 안 잡힌다.',
  },
  {
    name: '🎞️ 띠 전체를 첫 화면에 한꺼번에 받는다',
    file: STRIP,
    find: "loading={eager ? 'eager' : 'lazy'}",
    replace: "loading=\"eager\"",
    test: TEST,
    why:
      '타일 16장(두 벌)이 전부 eager 가 되면 첫 화면이 106KB → 그 이상으로 뛴다. 둘째 벌은 같은 URL 이라 ' +
      '캐시 적중이지만, 첫 벌의 뒤쪽은 한 바퀴 도는 동안에나 필요한 것들이다.',
  },
  {
    name: '🎞️ 둘째 벌이 스크린리더에 다시 읽힌다 (목록이 두 배로 들린다)',
    file: STRIP,
    find: 'tabIndex={clone ? -1 : undefined}',
    replace: '',
    test: TEST,
    why:
      '무한 루프를 만들려고 같은 링크를 두 벌 그린다. `aria-hidden` 과 `tabIndex={-1}` 은 **한 쌍**이어야 ' +
      '한다 — 한쪽만 남으면 "숨겨졌는데 포커스는 가는" 더 나쁜 상태가 되고, 눈으로는 전혀 안 보인다.',
  },
  {
    name: '🎞️ 커서를 올려도 안 멈춘다',
    file: 'src/index.css',
    find: '.ur-hero-band:hover .ur-hero-marquee,\n.ur-hero-band:focus-within .ur-hero-marquee { animation-play-state: paused; }',
    replace: '',
    test: TEST,
    why:
      '읽으려는 타일이 지나가 버리면 누를 수가 없다. 키보드 포커스(`:focus-within`)도 같이 — 그쪽이 ' +
      '빠지면 탭으로 이동하는 사람은 초점이 화면 밖으로 흘러가 버린다.',
  },
  {
    name: '🎞️ 미는 거리를 CSS 에 숫자로 박는다',
    file: 'src/index.css',
    find: 'to   { transform: translateX(calc(-1 * var(--ur-hero-loop, 0px))); }',
    replace: 'to   { transform: translateX(-2587px); }',
    test: TEST,
    why:
      '거리는 **장수에 따라 달라진다**(한 벌 폭 = 장수 × 199px). 숫자를 박으면 딜이 적은 지역에서 ' +
      '이음매가 벌어지거나 두 벌이 겹쳐 지나간다 — 서울에서 테스트하면 절대 안 보인다.',
  },
  {
    name: '🎞️ 띠가 배경 래퍼 안으로 들어가 클릭이 안 된다',
    file: 'src/components/home/HomeHeroDefault.tsx',
    find: '      {showStrip && <HeroDealStrip tiles={tiles} />}',
    replace: '',
    test: TEST,
    why:
      '2026-09-06 에 사진으로 똑같이 당했다 — `pointer-events-none` 배경 래퍼 안에 있어 클릭이 ' +
      '**구조적으로 불가능**했고 그걸 안내 문구로 때우고 있었다. 렌더가 통째로 빠지면 색면만 남는다.',
  },
  {
    name: '🎞️ 어드민 히어로 배너를 띠가 덮는다',
    file: 'src/components/home/HomeHeroDefault.tsx',
    find: 'const showStrip = !adminMedia && tiles.length > 0',
    replace: 'const showStrip = tiles.length > 0',
    test: TEST,
    why:
      '어드민이 돈 들여 올린 히어로 배너가 조용히 안 보이게 된다. 배너는 마운트 후 fetch 라 ' +
      '**잠깐 떴다가 띠로 바뀌는** 모양이 되어, 올린 사람은 "가끔 보인다"고만 느낀다.',
  },
]
