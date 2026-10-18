// 🔁 유어쇼츠 레일 — 다시 마운트돼도 목록 요청 한 번 (2026-10-18)
const TEST = 'src/tests/unit/urshorts-rail-single-flight-2026-10-18.test.tsx'

export default [
  {
    name: '[urshorts-flight] 단일 비행을 끈다 — 다시 마운트될 때마다 목록을 또 받는다',
    file: 'src/components/home/UrShortsRail.tsx',
    find: '  const cur = freshRailList()\n  if (cur) return cur.p',
    replace: '  const cur = freshRailList()\n  if (false && cur) return cur.p',
    test: TEST,
    why: 'HomeSections 가 섹션 도착 전후로 레일을 다른 자리에 그려 다시 마운트한다 — 그때마다 /api/urshorts 가 한 번 더 나간다(check-duplicate-fetch 간헐 빨간불의 원인).',
  },
  {
    name: '[urshorts-flight] 받아 둔 목록으로 첫 렌더를 안 그린다(자리표시 → 목록 깜빡임)',
    file: 'src/components/home/UrShortsRail.tsx',
    find: '  const [items, setItems] = useState<UrShortItem[]>(() => cached ?? [])',
    replace: '  const [items, setItems] = useState<UrShortItem[]>(() => [])',
    test: TEST,
    why: '다시 마운트된 레일이 이미 가진 목록을 두고 빈 패널부터 그린다.',
  },
  {
    name: '[urshorts-flight] 실패를 보관한다 — 세션 내내 레일이 안 뜬다',
    file: 'src/components/home/UrShortsRail.tsx',
    find: '      if (railList === entry) railList = null\n      return null',
    replace: '      return null',
    test: TEST,
    why: '한 번 네트워크가 끊기면 5분 동안 다시 시도하지 않는다.',
  },
]
