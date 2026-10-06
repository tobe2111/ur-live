/**
 * 📉 대외 랜딩의 지어낸 실적 수치 — 주입 매니페스트 (2026-09-24 등록).
 * 가드: src/tests/unit/landing-no-fabricated-stats-2026-09-24.test.ts
 *
 * 이 결함은 **에러가 안 난다.** 빌드도 타입도 통과하고 화면은 오히려 그럴듯해진다 —
 * 그래서 몇 달을 살아남았다(`240만+ 누적 사용자` vs 실측 23명). 두 방향을 잠근다:
 * ① 실적 수치가 **되돌아오는 것** ② 남긴 약속의 **구현이 사라지는 것**(문구만 남으면 그것도 거짓말).
 */
export default [
  {
    name: '히어로에 누적 사용자 수치를 되살린다',
    file: 'src/pages/IntroducePage.tsx',
    find: '<span><b className="text-white">미사용 시 100%</b> 자동환불</span>',
    replace: '<span><b className="text-white">240만+</b> 누적 사용자</span>',
    test: 'src/tests/unit/landing-no-fabricated-stats-2026-09-24.test.ts',
    why:
      '2026-09-24 어드민 실측은 **유저 23명**이었다. 10만 배 과장이고, 이 페이지는 입점 제안·' +
      '투자 자리에 그대로 쓰인다 — 대외 랜딩의 거짓 실적은 표시광고법 문제다.',
  },
  {
    name: 'STATS 띠에 4대 실적 수치를 되살린다',
    file: 'src/pages/IntroducePage.tsx',
    find: "{ n: '100%', l: '미사용 시 자동환불' },",
    replace: "{ n: '240만+', l: '누적 사용자' },\n            { n: '4,200+', l: '입점 셀러' },",
    test: 'src/tests/unit/landing-no-fabricated-stats-2026-09-24.test.ts',
    why:
      '실측 셀러는 **11곳(활성 9)**. 그리고 "더 정확한 숫자로 바꾸면 되지 않나" 도 함정이다 — ' +
      '공개 피드 total 358 중 **표본 100건에서 94건이 데모**라 그 숫자도 거짓이 된다. ' +
      '이 자리에 쓸 수 있는 건 서버가 센 값이거나 코드가 보증하는 약속뿐이다.',
  },
  {
    name: '만료 이용권 자동환불 cron 호출을 뺀다(문구만 남는다)',
    file: 'src/worker/cron/daily-lane.ts',
    find: "run('expired-voucher-refund', () => handleExpiredVoucherRefunds(env))",
    replace: "Promise.resolve()",
    test: 'src/tests/unit/landing-no-fabricated-stats-2026-09-24.test.ts',
    why:
      '랜딩에서 실적 수치를 걷어내고 남긴 것이 **"미사용 시 100% 자동환불"** 이다. 그 약속은 ' +
      '이 cron 이 실제로 돌려서 참인 것이지 문구라서 참인 게 아니다. 구현이 사라지면 ' +
      '랜딩 문구도 같이 거짓이 되므로, 둘을 한 시험에 묶어 둔다.',
  },
]
