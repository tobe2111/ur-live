/** 🧬 주입 — 부품 정적 서빙의 안전장치가 빠지면 빨간불인가. 가드: src/tests/unit/assets-static-2026-11-09.test.ts */
const T = 'src/tests/unit/assets-static-2026-11-09.test.ts'
export default [
  {
    name: '부품정적 — _headers 에서 no-store 떼기를 지운다',
    file: 'public/_headers',
    find: '/assets/*\n  ! Cache-Control\n',
    replace: '/assets/*\n',
    test: T,
    why: '맨 위 /* 의 no-store 와 합쳐져 부품 캐시가 통째로 꺼진다.',
  },
  {
    name: '부품정적 — 부트가드가 부품을 다시 안 받고 바로 이동한다',
    file: 'index.html',
    find: '          var pending = refreshAssets();',
    replace: '          var pending = null;',
    test: T,
    why: '브라우저에 잘못 저장된 부품이 1년간 남아 자가복구가 영영 못 낫는다.',
  },
]
