/** 🧬 주입 — 유어샵 SNS 이름표 팔로워 수(2026-11-03). 가드: src/tests/unit/ushop-sns-followers-2026-11-03.test.tsx */
const TEST = 'src/tests/unit/ushop-sns-followers-2026-11-03.test.tsx'
export default [
  {
    name: '📈 SNS 팔로워 — 계정 이름을 앞부분만 맞춰 본다(남의 팔로워가 붙는다)',
    file: 'src/shared/ushop-sns-followers.ts',
    find: "return s.split(/[/?#@\\s]+/).some((part) => part === u)",
    replace: 'return s.includes(u)',
    test: TEST,
    why: '`jiwon` 이 `jiwon_food` 주소에 걸리면 다른 사람의 팔로워 수가 내 이름표에 붙는다.',
  },
  {
    name: '📈 SNS 팔로워 — 만 단위를 반올림해 부풀린다',
    file: 'src/shared/ushop-sns-followers.ts',
    find: '(Math.floor(n / 1000) / 10).toFixed(1)',
    replace: '(n / 10000).toFixed(1)',
    test: TEST,
    why: '12,999 를 1.3만이라 부른다 — 실제보다 큰 숫자다.',
  },
  {
    name: '📈 SNS 팔로워 — 서버 첫 화면은 숫자를 빼고 이름만 그린다(마운트 때 이름표 폭이 바뀐다)',
    file: 'src/worker/utils/curator-ssr-body.ts',
    find: 'return n == null ? name : snsFollowerLabel(n) }',
    replace: 'return n == null ? name : name }',
    test: TEST,
    why: '화면과 서버가 다른 글자를 그리면 첫 화면이 교체될 때 줄이 튄다.',
  },
  {
    name: '📈 SNS 팔로워 — 조회를 첫 물결 밖으로 뺀다(왕복 +1)',
    file: 'src/worker/routes/curator.routes.ts',
    find: '      loadUShopSnsFollowers(DB, user), // 📈',
    replace: '      Promise.resolve({}), // 📈',
    test: TEST,
    why: '주인 보기는 캐시 없이 원본을 읽어 왕복이 곧 체감이다(2026-11-02 물결 정리).',
  },
]
