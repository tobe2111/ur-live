/**
 * 🧬 주입 — 에이전시 위젯 모션 간판 (2026-11-02 대표 "모션그래픽도 넣어서 최대한 고급지게")
 *    가드: src/tests/unit/embed-agency-motion-2026-11-02.test.ts
 */
const T = 'src/tests/unit/embed-agency-motion-2026-11-02.test.ts'
const A = 'src/worker/utils/embed-agency.ts'
const W = 'src/worker/utils/embed-widget.ts'
const R = 'src/worker/routes/embed.routes.ts'
export default [
  {
    name: '에이전시모션 — 움직임 줄이기 설정을 무시한다',
    file: A,
    find: '@media (prefers-reduced-motion:reduce){',
    replace: '@media (prefers-reduced-motion:no-preference) and (max-width:1px){',
    test: T,
    why: '어지럼증 때문에 움직임을 꺼 둔 사람에게도 띠가 계속 흐르고 숫자가 차오른다 — 화면은 멀쩡해 보인다.',
  },
  {
    name: '에이전시모션 — 숫자를 글자로 안 넣는다',
    file: A,
    find: "    + `<span class=\"sr\">${n}${unit}</span></div>`",
    replace: "    + '</div>'",
    test: T,
    why: 'CSS 카운터는 화면 읽기가 못 읽는다 — 운영 매장 수가 보조 기술 사용자에게서 통째로 사라진다.',
  },
  {
    name: '에이전시모션 — 사본 카드를 숨기지 않는다',
    file: A,
    find: "const aria = hidden ? ' aria-hidden=\"true\" tabindex=\"-1\"' : ''",
    replace: "const aria = ''",
    test: T,
    why: '흐르는 띠의 사본까지 탭 이동·화면 읽기에 잡혀 같은 이용권을 두 번씩 듣는다.',
  },
  {
    name: '에이전시모션 🔴 반대 — 모션 스타일이 모든 위젯에 섞인다',
    file: W,
    find: "export function doc(theme: EmbedTheme, title: string, body: string, extraCss = ''): string {",
    replace: "export function doc(theme: EmbedTheme, title: string, body: string, extraCss = '@property --n{syntax:\\'<integer>\\';inherits:false;initial-value:0}'): string {",
    test: T,
    why: '에이전시 하나를 꾸미려다 남의 사이트에 이미 걸린 유어샵·매장·지역 위젯 문서가 조용히 달라진다.',
  },
  {
    name: '에이전시모션 — 판매 중 수를 실린 장수로 센다',
    file: R,
    find: 'liveCount: Math.max(Number(live?.n || 0), cards.length),',
    replace: 'liveCount: cards.length,',
    test: T,
    why: '위젯 장수 상한(기본 8)이 곧 "판매 중 이용권" 이 된다 — 30개를 파는 에이전시 간판에 8개라고 적힌다.',
  },
]
