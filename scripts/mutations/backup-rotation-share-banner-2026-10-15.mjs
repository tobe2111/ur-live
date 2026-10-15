export default [
  {
    name: '💾 백업 회전이 목록 순서로 돌아가 업체 DB 가 다시 굶는다',
    file: 'src/worker/cron/d1-backup-chunked.ts',
    find: '  pending.sort((a, b) => (a.last < b.last ? -1 : a.last > b.last ? 1 : a.i - b.i))\n',
    replace: '\n',
    test: 'src/tests/unit/d1-backup-chunked.test.ts',
    why: '2026-10-15 실측: 업체 DB 마지막 백업 08-31(45일). ads·main 이 번갈아 "오늘 안 끝남" 이라 company 차례가 안 왔다.',
  },
  {
    name: '🎁 소개 보상 배너가 로그아웃 상태에서도 딜을 조회해 401 을 낸다',
    file: 'src/pages/group-buy/ShareRewardBanner.tsx',
    find: '    if (!getUserIdSync()) return\n',
    replace: '\n',
    test: 'src/tests/unit/share-reward-banner-anon-2026-10-15.test.tsx',
    why: '2026-10-15 라이브: 로그아웃 이용권 상세마다 deal-for-seller 401.',
  },
]
