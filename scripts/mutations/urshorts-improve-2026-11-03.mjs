/** 🧬 주입 — 유어쇼츠 개선(2026-11-03). 가드: src/tests/unit/urshorts-improve-2026-11-03.test.ts */
const TEST = 'src/tests/unit/urshorts-improve-2026-11-03.test.ts'
export default [
  {
    name: '🎬 쇼츠 개선 — 재생기가 다시 소리 켠 채 자동 재생(휴대폰에서 멈춘 채 뜬다)',
    file: 'src/pages/VideosPage.tsx',
    find: 'youTubePlayerVars({ autoplay: true, controls: false, muted: true })',
    replace: 'youTubePlayerVars({ autoplay: true, controls: false })',
    test: TEST,
    why: '휴대폰 브라우저는 소리 있는 자동 재생을 막는다 — 들어오면 멈춰 있다(대표 화면 그대로).',
  },
  {
    name: '🎬 쇼츠 개선 — mute 파라미터가 빠진다',
    file: 'src/shared/urshorts.ts',
    find: "  if (opts?.muted) p.mute = '1'\n",
    replace: '',
    test: TEST,
    why: '옵션을 넘겨도 유튜브에 안 간다 — 조용히 소리 켠 채 시작한다.',
  },
  {
    name: '🎬 쇼츠 개선 — 홈 버튼이 앱 안에서 온 사람에게도 뜬다(9-16 닫기 제거 결정 회귀)',
    file: 'src/pages/VideosPage.tsx',
    find: "const landedDirect = useLocation().key === 'default'",
    replace: 'const landedDirect = !!useLocation()',
    test: 'src/tests/unit/urshorts-improve-2026-11-03.test.ts',
    why: '앱 안에서 넘어온 사람은 뒤로가기가 있다 — 화면 위에 버튼이 하나 더 는다.',
  },
]
