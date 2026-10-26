/** 🧬 주입 — 에이전시 로그인 소개 판(2026-10-26). 가드: src/tests/unit/agency-login-intro-2026-10-26.test.ts */
const T = 'src/tests/unit/agency-login-intro-2026-10-26.test.ts'
export default [
  {
    name: '에이전시 소개 — 유어딜이 몫을 송금한다고 약속한다',
    file: 'src/pages/agency-console/AgencyIntro.tsx',
    find: "body: '에이전시가 유어딜에 내는 돈은 없어요.'",
    replace: "body: '에이전시 몫은 유어딜이 직접 송금해요.'",
    test: T,
    why: '지금은 매장이 직접 보낸다 — 없는 지급을 공개 화면이 약속한다.',
  },
  {
    name: '에이전시 소개 — 로그인 화면에서 소개 판을 뺀다',
    file: 'src/pages/agency-console/AgencyLoginPage.tsx',
    find: '      aside={<AgencyIntro />}',
    replace: '',
    test: T,
    why: '소개 판이 조용히 사라진다.',
  },
]
