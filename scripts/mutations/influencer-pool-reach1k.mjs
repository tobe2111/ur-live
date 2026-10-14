/**
 * 🧬 주입 — 인플루언서 풀 '이웃·구독 1천+' 필터 (2026-10-14 대표 *"이웃 1000명 이상 블로거만"*).
 */
const TEST = 'src/tests/unit/influencer-pool-reach1k-2026-10-14.test.ts'

export default [
  {
    name: '📏 reach1k 가 1,000명을 빼 버린다 (경계 오프바이원)',
    file: 'src/features/marketing/api/admin-ads-influencers.routes.ts',
    find: "where.push('subscriber_count >= 1000')",
    replace: "where.push('subscriber_count > 1000')",
    test: TEST,
    why: '"1000명 이상" 이 대표 표현이다. > 로 바뀌어도 화면은 멀쩡하고 이웃 정확히 1,000명이 조용히 빠진다.',
  },
  {
    name: '📏 화면에 1천+ 선택지가 사라진다',
    file: 'src/pages/admin/influencer-pool/PoolFilters.tsx',
    find: '        <option value="reach1k">이웃·구독 1천+</option>\n',
    replace: '',
    test: TEST,
    why: '서버가 지원해도 고를 수 없으면 없는 기능이다.',
  },
  {
    name: '📏 서버가 reach1k 를 모른다 (선택해도 무시됨)',
    file: 'src/features/marketing/api/admin-ads-influencers.routes.ts',
    find: "if (tier === 'reach1k') where.push('subscriber_count >= 1000'); else if (tier === 'nano')",
    replace: "if (tier === 'nano')",
    test: TEST,
    why: '알 수 없는 tier 는 조건 없이 통과한다 — 화면은 1천+ 라고 말하는데 전체가 나온다. 에러는 0.',
  },
]
