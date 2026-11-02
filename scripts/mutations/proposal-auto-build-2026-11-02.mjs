/**
 * 🧬 주입 — 대외 소개서 자동 생성 (2026-11-02 대표 "제안서는 계속 자동 업데이트가 안돼" → "가장 이상적으로")
 *    가드: src/tests/unit/proposal-auto-build-2026-11-02.test.ts
 *
 * 막는 사고: 덱 숫자가 손으로 적은 그날 값에 멈추고, 완성본은 아무도 다시 안 뽑아 낡는다.
 */
const T = 'src/tests/unit/proposal-auto-build-2026-11-02.test.ts'
export default [
  {
    name: '소개서 자동 — 덱에 판매 중 이용권 수를 다시 손으로 적는다',
    file: 'docs/business/proposals/deck-common.mjs',
    find: "  feeDirect: '10%', feeBrokered: '5%',\n",
    replace: "  feeDirect: '10%', feeBrokered: '5%',\n  activeVouchers: '165',\n",
    test: T,
    why: '손으로 적은 숫자는 다시 아무도 안 고친다 — 11-02 에 이미 165 ↔ 라이브 160 이었다.',
  },
  {
    name: '소개서 자동 — 앵커 상품이 내려가도 알리지 않는다',
    file: 'src/shared/proposal-live-facts.ts',
    find: '    sampleMoved: !anchorOk,',
    replace: '    sampleMoved: false,',
    test: T,
    why: '10-06 에 앵커가 내려갔는데 덱이 "지금 팔리는 상품" 이라고 계속 말했다.',
  },
  {
    name: '소개서 자동 — 평균을 정가로 잰다',
    file: 'src/shared/proposal-live-facts.ts',
    find: 'ROUND(AVG(price)) AS avg',
    replace: 'ROUND(AVG(original_price)) AS avg',
    test: T,
    why: '평균의 정의는 판매가다(정가면 식사 40,757 — 10-12 세션이 한 번 헷갈렸다).',
  },
  {
    name: '소개서 자동 — 중개 몫 송금이 꺼져도 경고하지 않는다',
    file: 'docs/business/proposals/build-all.mjs',
    find: '    holds: (f) => f.flags?.brokerShareEnabled === true || f.flags?.agencySharePayoutEnabled === true,',
    replace: '    holds: () => true,',
    test: T,
    why: '덱이 대행사에게 "직접 보낸다" 고 약속하는데 스위치가 꺼져 있으면 아무도 모른다(11-02 실제 상태).',
  },
  {
    name: '소개서 자동 — 숫자가 비어도 덱을 만든다',
    file: 'docs/business/proposals/facts-live.mjs',
    find: "    if (v == null || Number.isNaN(v)) throw new Error(`소개서 라이브 숫자에 ${k} 가 없다 — 서버 응답을 확인할 것`);",
    replace: '    if (v == null || Number.isNaN(v)) return 0;',
    test: T,
    why: '빈 값으로 조용히 뽑으면 "판매 중 이용권 0건" 인 덱이 나간다.',
  },
  {
    name: '소개서 자동 — 어드민 파일 이름 검사를 푼다(경로 조작)',
    file: 'src/worker/routes/proposal-facts.routes.ts',
    find: 'export const PROPOSAL_ASSET_NAME = /^(?:urdeal-[a-z0-9-]+\\.(?:pdf|pptx)|manifest\\.json)$/',
    replace: 'export const PROPOSAL_ASSET_NAME = /\\.(?:pdf|pptx|json)$/',
    test: T,
    why: '../ 같은 이름이 Release 밖 주소로 새어 나간다.',
  },
  {
    name: '소개서 자동 — 워크플로가 Release 에 안 올린다',
    file: '.github/workflows/proposals.yml',
    find: '          gh release upload proposals-latest ./*.pdf ./*.pptx ./manifest.json --clobber\n',
    replace: '          echo skip\n',
    test: T,
    why: '만들기만 하고 안 올리면 어드민은 계속 옛 판을 본다.',
  },
  {
    name: '소개서 자동 — 어드민이 자동 생성본을 안 쓴다',
    file: 'src/pages/admin/AdminProposalsPage.tsx',
    find: '  const viewUrl = pdf.url ?? active.url',
    replace: '  const viewUrl = active.url',
    test: T,
    why: '자동 생성이 돌아도 화면은 저장소의 옛 PDF 를 보여 준다.',
  },
  {
    name: '소개서 자동 — 랜딩 정직 고지가 라이브 숫자를 안 읽는다',
    file: 'src/pages/partners/PartnerFaq.tsx',
    find: "      const res = await fetch('/api/public/proposal-facts')",
    replace: "      const res = await fetch('/api/public/none')",
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why: '랜딩이 손으로 적은 거울(165건)로 돌아가면 소개서와 다른 숫자를 말한다.',
  },
]
