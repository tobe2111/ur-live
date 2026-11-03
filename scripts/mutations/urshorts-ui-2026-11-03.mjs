/** 🧬 주입 — 유어쇼츠 재생 버튼·아래 카드(2026-11-03). 가드: src/tests/unit/urshorts-ui-2026-11-03.test.ts */
const TEST = 'src/tests/unit/urshorts-ui-2026-11-03.test.ts'
export default [
  {
    name: '🎬 유어쇼츠 — 멈춤 버튼이 화면 한가운데로 돌아간다(유튜브 버튼과 두 개)',
    file: 'src/pages/VideosPage.tsx',
    find: ' style={{ transform: `translateY(-${YT_TITLE_CLIP_PX / 2}px)` }} data-testid="shorts-paused"',
    replace: ' data-testid="shorts-paused"',
    test: TEST,
    why: '유튜브 재생기 한가운데는 36px 위라 두 버튼이 어긋나 둘로 보인다(대표 신고 그대로).',
  },
  {
    name: '🎬 유어쇼츠 — 멈춤 버튼이 다시 반투명(유튜브 버튼이 비친다)',
    file: 'src/pages/VideosPage.tsx',
    find: 'h-[76px] w-[76px] place-items-center rounded-full bg-black/85',
    replace: 'h-16 w-16 place-items-center rounded-full bg-black/45',
    test: TEST,
    why: '작고 옅으면 아래 유튜브 버튼이 겹쳐 보인다.',
  },
  {
    name: '🎬 유어쇼츠 — 인기 이용권 카드가 다시 반투명',
    file: 'src/pages/videos/NearbyPassesCard.tsx',
    find: 'snap-start shrink-0 w-[156px] flex items-center gap-2 rounded-2xl bg-white p-2',
    replace: 'snap-start shrink-0 w-[156px] flex items-center gap-2 rounded-2xl bg-white/95 p-2',
    test: TEST,
    why: '아래 Shorts 글자·검은 띠가 비쳐 카드가 찢어진 것처럼 보인다.',
  },
]
