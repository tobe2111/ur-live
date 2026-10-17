export default [
  {
    name: '[urshorts-layout] 레일 화살표 측정이 다시 마운트 effect 로 돌아간다',
    file: 'src/components/home/UrShortsRail.tsx',
    find: '  // 🧮 2026-10-14: 마운트·목록 도착 때 재지 않는다.',
    replace: '  useEffect(() => { sync() }, [sync, items.length])\n  // 🧮 2026-10-14: 마운트·목록 도착 때 재지 않는다.',
    test: 'src/tests/unit/urshorts-rail-no-boot-layout-2026-10-14.test.ts',
    why: '홈 부팅 중 강제 동기 레이아웃(CPU×4 76ms)이 돌아온다.',
  },
  {
    name: '[urshorts-layout] 호버 측정을 빼서 PC 화살표가 영영 안 뜬다',
    file: 'src/components/home/UrShortsRail.tsx',
    find: '<div className="group relative" onPointerEnter={sync}>',
    replace: '<div className="group relative">',
    test: 'src/tests/unit/urshorts-rail-no-boot-layout-2026-10-14.test.ts',
    why: '측정이 없으면 edge 가 늘 false 라 PC 화살표가 안 뜬다(2026-09-08 group 누락과 같은 조용한 부재).',
  },
  {
    name: '[urshorts-layout] 목록 대기 중 자리를 안 잡는다(레일이 끼어들며 피드를 민다)',
    file: 'src/components/home/UrShortsRail.tsx',
    find: 'const waiting = items.length === 0 && reserve && !settled',
    replace: 'const waiting = false && items.length === 0 && reserve && !settled',
    test: 'src/tests/unit/urshorts-rail-no-boot-layout-2026-10-14.test.ts',
    why: '목록 도착 순간 ~296px 레일이 인기 이용권 아래 끼어들어 피드를 민다(홈 CLS 0.576).',
  },
  {
    name: '[urshorts-layout] 요청이 실패하면 빈 패널이 영원히 남는다',
    file: 'src/components/home/UrShortsRail.tsx',
    find: '.catch(() => { if (alive) setSettled(true)',
    replace: '.catch(() => { if (alive) void 0',
    test: 'src/tests/unit/urshorts-rail-no-boot-layout-2026-10-14.test.ts',
    why: '네트워크 실패 시 카드 없는 검정 패널이 홈에 박제된다.',
  },
]
