/**
 * 🦦 유달이(마스코트) 화면 배치 규칙 (2026-10-07)
 * 가드: src/tests/unit/udal-mascot-2026-10-07.test.ts
 */
const TEST = 'src/tests/unit/udal-mascot-2026-10-07.test.ts'

export default [
  {
    name: '🦦 화면이 부품을 우회해 마스코트 이미지를 직접 쓴다',
    file: 'src/components/ui/list-load-error.tsx',
    find: "import Udal from '@/components/mascot/Udal'\n",
    replace: "import Udal from '@/components/mascot/Udal'\nimport sorryFace from '@/assets/mascot/udal-sorry.webp'\nvoid sorryFace\n",
    test: TEST,
    why: '부품을 건너뛰면 같은 상황(오류)이 화면마다 다른 얼굴이 된다 — 아이콘·버튼 색이 그렇게 갈렸었다.',
  },
  {
    name: '🦦 상황표에서 얼굴 하나가 빠진다 (그 화면만 깨진 이미지)',
    file: 'src/components/mascot/Udal.tsx',
    find: '  empty: sleepy,\n',
    replace: '',
    test: TEST,
    why: '빠진 상황을 고른 화면은 src 가 undefined 인 이미지를 그린다 — 에러 없이 깨진 아이콘만 남는다.',
  },
  {
    name: '🦦 움직임 줄이기 사용자에게도 계속 흔들린다',
    file: 'src/index.css',
    find: '  .ur-udal-bob { animation: none; }',
    replace: '  .ur-udal-bob { animation-duration: 3.2s; }',
    test: TEST,
    why: '움직임 줄이기는 접근성 설정이다 — 장식 움직임은 그 사용자에게 멈춰야 한다.',
  },
  {
    name: '🦦 404 가 유달이 대신 원래 화면으로 되돌아간다',
    file: 'src/pages/NotFoundPage.tsx',
    find: '<Udal mood="lost"',
    replace: '<Udal mood="hello"',
    test: TEST,
    why: '상황표는 404 를 "길 잃음" 으로 정했다 — 화면이 다른 얼굴을 고르면 표가 무의미해진다.',
  },
  {
    name: '🦦 손님 화면이 아닌 곳(셀러 대시보드)에 유달이가 들어간다',
    file: 'src/components/SellerLayout.tsx',
    find: "import { useState",
    replace: "import Udal from '@/components/mascot/Udal'\nvoid Udal\nimport { useState",
    test: TEST,
    why: '문서가 대시보드·어드민·도매몰을 "안 쓰는 자리" 로 못 박았다(정산 알림만 결정 대기).',
  },
  {
    name: '🦦 로더 preload 경로가 실제 로더 그림과 갈린다',
    file: 'index.html',
    find: '<link rel="preload" as="image" href="/assets/mascot/udal-loader-v1.webp" />',
    replace: '<link rel="preload" as="image" href="/assets/mascot/udal-loader-v0.webp" />',
    test: TEST,
    why: '경로가 한 글자만 달라도 미리 받은 그림을 안 쓴다 — 유달이가 로고보다 늦게 튀어나온다.',
  },
  {
    name: '🦦 대시보드 로더에도 유달이가 뜬다',
    file: 'src/components/brand/BrandLoader.tsx',
    find: 'const showUdal = !forceLight',
    replace: 'const showUdal = true',
    test: TEST,
    why: '대시보드는 마스코트를 안 쓰는 자리다(문서).',
  },
]
