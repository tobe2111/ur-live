/** 🧬 주입 — 상세 상단 버튼 C안(2026-10-27). 가드: src/tests/unit/detail-header-c-2026-10-27.test.tsx */
const T = 'src/tests/unit/detail-header-c-2026-10-27.test.tsx'
export default [
  {
    name: 'detail-header-c — 사진 위에서도 흰 원으로 돌아간다',
    file: 'src/components/deal/DetailFloatingHeader.tsx',
    find: '  const onPhoto = overPhoto && !headerSolid\n',
    replace: '  const onPhoto = false && overPhoto && !headerSolid\n',
    test: T,
    why: '대표가 "붕 떠 있다" 고 한 원 버튼이 되살아난다.',
  },
]
