/**
 * 🔬 알람 예약 되읽기 — 되돌려-검증 주입 (2026-10-14).
 * 가드: src/tests/unit/alarm-arm-readback-2026-10-14.test.ts
 */
export default [
  {
    name: '🔬 setAlarm 실패를 다시 삼킨다 (①② 구분 불가로 회귀)',
    why: '종전 코드다. 실패가 기록에 안 남으면 "예약했다고 적었는데 예약은 없다"와 "예약은 걸렸는데 안 깨운다"가 같은 기록이 된다.',
    file: 'src/worker-ads/lane-alarm.ts',
    find: 'await this.ctx.storage.setAlarm(at).catch(() => { setOk = false })',
    replace: 'await this.ctx.storage.setAlarm(at).catch(() => undefined)',
    test: 'src/tests/unit/alarm-arm-readback-2026-10-14.test.ts',
    expect: 'red',
  },
  {
    name: '🔬 되읽기를 없앤다 (armed_at 이 영원히 null)',
    why: 'armed_at 이 없으면 ① 과 ② 를 가르는 값 자체가 사라진다. 그런데 스탬프는 그럴듯해 보인다.',
    file: 'src/worker-ads/lane-alarm.ts',
    find: 'const armed = await this.ctx.storage.getAlarm().catch(() => null)',
    replace: 'const armed = null',
    test: 'src/tests/unit/alarm-arm-readback-2026-10-14.test.ts',
    expect: 'red',
  },
  {
    name: '🔬 setOk 를 const true 로 굳힌다 (실패를 영원히 성공으로 보고)',
    why: '거짓 안심 — 예약이 매번 실패해도 스탬프는 set_ok: true 를 적는다.',
    file: 'src/worker-ads/lane-alarm.ts',
    find: '    let setOk = true',
    replace: '    const setOk = true',
    test: 'src/tests/unit/alarm-arm-readback-2026-10-14.test.ts',
    expect: 'red',
  },
  {
    name: '🔬 스탬프에서 set_ok 를 뺀다',
    why: '값을 계산하고 기록하지 않으면 밖에서 못 본다 — 계산과 사용은 다른 자리다.',
    file: 'src/worker-ads/lane-alarm.ts',
    find: '            set_ok: setOk,',
    replace: '',
    test: 'src/tests/unit/alarm-arm-readback-2026-10-14.test.ts',
    expect: 'red',
  },
  {
    name: '🔬 armed_at 을 밀리초 숫자로 적는다 (next_at 과 눈으로 비교 불가)',
    why: 'next_at 은 ISO 문자열이다. 한쪽만 숫자면 지연을 재려면 매번 변환해야 하고, 그 변환을 빼먹는 날 오판한다.',
    file: 'src/worker-ads/lane-alarm.ts',
    find: '            armed_at: armed != null ? new Date(Number(armed)).toISOString() : null,',
    replace: '            armed_at: armed != null ? Number(armed) : null,',
    test: 'src/tests/unit/alarm-arm-readback-2026-10-14.test.ts',
    expect: 'red',
  },
  {
    name: '🔬 (반대 방향) 관측을 넣으면서 예약을 빼 버린다',
    why: '관측은 멀쩡해 보이는데 레인이 통째로 멎는다. 이 방향이 더 조용하고 더 나쁘다.',
    file: 'src/worker-ads/lane-alarm.ts',
    find: '    await this.ctx.storage.setAlarm(at).catch(() => { setOk = false })',
    replace: '    void at',
    test: 'src/tests/unit/alarm-arm-readback-2026-10-14.test.ts',
    expect: 'red',
  },
]
