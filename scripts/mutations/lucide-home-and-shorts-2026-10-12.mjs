/**
 * 🏠 홈 세 번째 아이콘 봉투 + 🎬 유어쇼츠 레일 신호 분리 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/lucide-shell-icons.test.ts · src/tests/unit/urshorts-core.test.ts
 *
 * 대표 *"메인에서 유어쇼츠가 늦게 로딩되네? 그리고 각 페이지마다도 로딩속도 개선이 필요해"*.
 * 둘 다 **에러가 안 나는 회귀**다 — 되돌려도 빌드는 초록이고 화면도 안 깨진다. 느려질 뿐이다.
 */
const LUCIDE = 'src/tests/unit/lucide-shell-icons.test.ts'
const SHORTS = 'src/tests/unit/urshorts-core.test.ts'

export default [
  {
    name: '🏠lucide 홈 봉투가 사라진다 (214개가 첫 페인트로 돌아온다)',
    file: 'vite.config.ts',
    find: "            if (LUCIDE_HOME_ICONS.has(icon[1])) return 'lucide-home'\n",
    replace: "",
    test: LUCIDE,
    why: '홈이 아이콘 11개 때문에 54.2KB raw 봉투를 통째로 받던 것으로 되돌아간다 — 빌드는 성공한다.',
  },
  {
    name: '🏠lucide 홈 목록에서 아이콘 하나가 빠진다 (그 하나가 큰 봉투를 다시 끌고 온다)',
    file: 'vite.config.ts',
    find: "  'chevron-left', 'dumbbell', 'flame', 'gift', 'locate-fixed',",
    replace: "  'chevron-left', 'dumbbell', 'gift', 'locate-fixed',",
    test: LUCIDE,
    why: '`flame`(홈 피드 카드) 하나만 빠져도 그 import 가 214개 봉투를 홈 폐쇄로 다시 들인다.',
  },
  {
    name: '🏠lucide 별칭만 적고 구현을 빠뜨린다 (2026-09-16 에 실제로 밟은 함정)',
    file: 'vite.config.ts',
    find: "  'loader-2', 'loader-circle',",
    replace: "  'loader-2',",
    test: LUCIDE,
    why: '별칭(`Loader2`)만 넣으면 구현(`loader-circle`)이 큰 봉투에 남는다 — 빌드는 성공하고 총량만 안 준다.',
  },
  {
    name: '🎬쇼츠 목록·썸네일이 다시 같은 시점을 쓴다 (직렬 두 왕복)',
    file: 'src/components/home/UrShortsRail.tsx',
    find: "      nearData ? null : watchFrom('1200px', () => setNearData(true)),",
    replace: "      nearData ? null : watchFrom('300px', () => setNearData(true)),",
    test: SHORTS,
    why: '레일이 눈에 들어온 **그때** 목록 요청이 시작되면 썸네일은 그 뒤다 — 사람이 보는 동안 빈 줄이 남는다.',
  },
  {
    name: '🎬쇼츠 썸네일 10장을 레일이 멀어도 받는다',
    file: 'src/components/home/UrShortsRail.tsx',
    find: "      near ? null : watchFrom('300px', () => setNear(true)),",
    replace: "      near ? null : watchFrom('1200px', () => setNear(true)),",
    test: SHORTS,
    why: '썸네일은 레일이 실제로 보여야 쓸모가 있다 — 목록(1.2KB)과 무게가 전혀 다르다.',
  },
]
