export default [
  {
    name: '🚫 후기 보너스 꺼졌는데 사장님 카드가 다시 뜬다',
    file: 'src/components/seller/ReviewBonusCard.tsx',
    find: '  if (!KAKAO_REVIEW_BONUS_ENABLED) return null\n',
    replace: '',
    test: 'src/tests/unit/review-bonus-off-copy-2026-10-15.test.ts',
    why: '사장님이 없는 보너스 금액을 설정하게 된다.',
  },
  {
    name: '🚫 입점 사실 파일이 없는 후기 보너스 1,000딜을 다시 약속한다',
    file: 'src/shared/partners-facts.ts',
    find: "reviewBonus: '지금은 운영하지 않음',",
    replace: "reviewBonus: '1,000딜',",
    test: 'src/tests/unit/review-bonus-off-copy-2026-10-15.test.ts',
    why: '덱·랜딩이 없는 혜택을 약속한다.',
  },
]
