/** 🧬 주입 — 유어쇼츠 목록 한 벌이 조용히 풀리면 가드가 잡는가. 가드: src/tests/unit/urshorts-list-cache-2026-11-09.test.ts */
const T = 'src/tests/unit/urshorts-list-cache-2026-11-09.test.ts'
export default [
  {
    name: '🎬 뷰어가 다시 자기 fetch 로 목록을 받는다(카드 누름 → 첫 프레임 +0.5s)',
    file: 'src/pages/VideosPage.tsx',
    find: '    loadShortsAll()',
    replace: "    fetch('/api/urshorts?all=1').then((r) => r.json()).then((r) => (r?.success && Array.isArray(r.data) ? r.data : []))",
    test: T,
    why: '목록 화면이 이미 받은 전량을 뷰어가 또 기다린다 — 2026-11-09 실측 1.4s 의 절반.',
  },
  {
    name: '🎬 캐시가 빈 목록을 저장한다(한 번 빈 응답이면 탭 수명 내내 빈 화면)',
    file: 'src/shared/urshorts-list-cache.ts',
    find: 'if (list.length) full = list; return list',
    replace: 'full = list; return list',
    test: T,
    why: '일시 오류로 빈 배열이 오면 그 탭에서 유어쇼츠가 영영 비어 보인다.',
  },
  {
    name: '🎬 뷰어 첫 렌더가 peek 를 안 쓴다(목록에서 와도 로더부터)',
    file: 'src/pages/VideosPage.tsx',
    find: 'useState<UrShortItem[] | null>(() => peekShortsAll())',
    replace: 'useState<UrShortItem[] | null>(null)',
    test: T,
    why: '전량이 손에 있는데 effect 가 돌 때까지 비어 있다 — 한 프레임이 아니라 재생기 생성 시점이 밀린다.',
  },
]
