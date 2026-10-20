/**
 * 🕑 빈 시간대 리포트(2026-10-19 대표 "남은 3가지도 다 해줘" ①) — 주입 매니페스트.
 * 가드: src/tests/unit/idle-hours-2026-10-19.test.ts
 */
const TEST = 'src/tests/unit/idle-hours-2026-10-19.test.ts'

export default [
  {
    name: '🕑 쉬는 날(사용 0)을 가장 한가한 시간으로 고른다',
    file: 'src/shared/idle-hours.ts',
    find: '    if (typeTotal[dayType] === 0) continue\n',
    replace: '',
    test: TEST,
    why: '평일만 여는 가게에 "주말이 가장 한가해요" 라고 말하게 된다.',
  },
  {
    name: '🕑 평일/주말을 합계로 비교한다',
    file: 'src/shared/idle-hours.ts',
    find: 'perDay: Math.round((sum / DAYS_IN[dayType]) * 10) / 10,',
    replace: 'perDay: sum,',
    test: TEST,
    why: '평일은 5일이라 합계로 비교하면 늘 평일이 바빠 보인다.',
  },
  {
    name: '🕑 얇은 표본으로도 판정한다',
    file: 'src/shared/idle-hours.ts',
    find: '  if (total < IDLE_MIN_SAMPLES) return empty\n',
    replace: '',
    test: TEST,
    why: '사용 몇 건으로 "이 시간이 한가하다" 고 말하면 거짓이 된다.',
  },
  {
    name: '🕑 사용 시각을 UTC 그대로 모은다',
    file: 'src/features/seller/api/seller-analytics.routes.ts',
    find: "CAST(strftime('%H', v.used_at, '+9 hours') AS INTEGER) AS hour,",
    replace: "CAST(strftime('%H', v.used_at) AS INTEGER) AS hour,",
    test: TEST,
    why: 'D1 시각은 UTC 라 그대로 모으면 한가한 시간이 9시간 어긋난다.',
  },
  {
    name: '🕑 남의 가게 이용권까지 센다',
    file: 'src/features/seller/api/seller-analytics.routes.ts',
    find: "      WHERE p.seller_id = ? AND v.status = 'used' AND v.used_at IS NOT NULL\n",
    replace: "      WHERE ? IS NOT NULL AND v.status = 'used' AND v.used_at IS NOT NULL\n",
    test: TEST,
    why: '다른 매장의 사용 기록이 섞이면 리포트가 남의 가게 이야기가 된다.',
  },
]
