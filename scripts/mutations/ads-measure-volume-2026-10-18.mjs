// 📏 유어애즈 경보 재정렬 — 결재 `2026-10-15-ads-alarm-stall-alert` 안 2 (2026-10-18)
const TEST = 'src/tests/unit/ads-measure-volume-2026-10-18.test.ts'

export default [
  {
    name: '📏 유어애즈 측정량 경보: 못 센 것을 성공으로 넘긴다',
    file: 'src/worker-ads/measure-volume-watch.ts',
    find: "    if (verdict !== 'ok') {",
    replace: "    if (verdict === 'low') {",
    test: TEST,
    why: '리드 DB 조회가 깨지면 경보가 영원히 초록이 되고 측정이 멎어도 아무도 모른다.',
  },
  {
    name: '📏 유어애즈 측정량 경보: 하한 판정을 뒤집는다',
    file: 'src/worker-ads/measure-volume-watch.ts',
    find: "  return count < floor ? 'low' : 'ok'",
    replace: "  return count < 0 ? 'low' : 'ok'",
    test: TEST,
    why: '하루 측정이 20배 줄어도(실측 3,600) 경보가 안 울린다 — 이 결재가 막으려던 바로 그 손실.',
  },
  {
    name: '📏 유어애즈 측정량 경보: 스케줄러 배선을 뺀다',
    file: 'src/worker-ads/index.ts',
    find: "; runMeasureVolumeWatch(env, hourUTC, adsBeat, (p) => ctx.waitUntil(p), staleGapMinutes(24 * 60))",
    replace: "",
    test: TEST,
    why: '모듈은 멀쩡한데 아무도 부르지 않는다 — 경보가 0건이라 이상 없음처럼 보인다.',
  },
  {
    name: '📏 유어애즈 알람 임계: 상한을 무한정 올린다',
    file: 'src/worker-ads/lane-cadence.ts',
    find: 'export const ALARM_SWEEP_GAP_MIN = 62',
    replace: 'export const ALARM_SWEEP_GAP_MIN = 600',
    test: TEST,
    why: '62분을 넘는 침묵은 배달 지연으로 설명되지 않는다 — 진짜 멈춤이 10시간 동안 조용하다.',
  },
  {
    name: '📏 유어애즈 알람 임계: 알람 레인이 다시 32분 공식을 쓴다',
    file: 'src/worker-ads/lane-alarm.ts',
    find: 'alarmLaneGapMinutes(Math.max(1, Math.round(60 / Math.max(1, cap)))), this.meter)',
    replace: 'Math.max(1, 2 * Math.round(60 / Math.max(1, cap)) + 30), this.meter)',
    test: TEST,
    why: '정상 배달 지연(31~60분)에도 시간대마다 경보가 울려 진짜 경보를 가린다.',
  },
]
