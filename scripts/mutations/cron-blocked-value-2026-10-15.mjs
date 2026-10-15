/**
 * 🧱 2026-10-15 — 하트비트 `skipped` 를 값까지 읽는 판정의 주입.
 *
 * 가드: `src/tests/unit/cron-blocked-value-2026-10-15.test.ts`
 * 근거·표: `src/worker/utils/cron-beat-blocked.ts` 머리말.
 *
 * 🔴 **절반이 반대 방향이다** — 이 처방은 "더 조용해지는" 쪽으로 틀리면 피해가 크다.
 *    모르는 값의 기본값이 `blocked` 인 것이 2026-08-31 사고(바인딩 부재로 넉 달 무음)를
 *    지키는 유일한 장치다. 허용목록을 넓히거나 기본값을 뒤집으면 **거짓 침묵**이 돌아온다.
 */
const U = 'src/worker/utils/cron-beat-blocked.ts'
const W = 'src/worker/cron/cron-stale-watch.ts'
const R = 'src/features/admin/api/admin-system-monitoring.routes.ts'
const P = 'src/pages/AdminSystemMonitoringPage.tsx'
const T = 'src/tests/unit/cron-blocked-value-2026-10-15.test.ts'

export default [
  {
    name: '🧱 skipped 판정 — 키만 보던 종전 정규식으로 돌아간다',
    file: W,
    find: '  const blocked = beats.filter(b => b.name !== SELF && isBlockedBeat(b.result))',
    replace: "  const blocked = beats.filter(b => b.name !== SELF && /(^|[\\s,{])skipped[=:]/.test(b.result || ''))",
    test: T,
    why:
      '이게 라이브 상태였다 — 하트비트 12개 중 **11개가 멀쩡한 레인**인데 12시간마다 거짓 ' +
      '`blocked:*` 를 쏘아 미해결 1,331건을 쌓고 어드민 최신 100건의 81%를 덮었다. ' +
      '그 창에 **error 는 0건**이라 진짜 error 621건이 화면에 도달하지 못했다.',
  },
  {
    name: '🧱 skipped 판정 — 카운터를 막힘으로 읽는다',
    file: U,
    find: "  if (/^-?\\d[\\d_,]*$/.test(raw)) return { raw, verdict: 'healthy' }",
    replace: '',
    test: T,
    why:
      '`demo-name-heal` 의 `skipped=309` 는 "309건은 손댈 게 없었다" 다. `__catchup` 의 주석이 ' +
      '*"started=0 skipped=27 이면 돌았고 밀린 게 없었다가 화면에서 읽힌다"* 고 적어 뒀는데 ' +
      '감시가 그 뜻을 정반대로 읽고 있었다.',
  },
  {
    name: '🧱 skipped 판정 — 명시적 false 를 막힘으로 읽는다',
    file: U,
    find: "  if (FALSY_SKIP_VALUES.has(low)) return { raw, verdict: 'healthy' }",
    replace: '',
    test: T,
    why:
      '`group-buy-feed-cache` 가 `skipped=false` 로 **안 건너뛰었다고 명시**하는데 그것을 ' +
      '막힘으로 읽었다 — 가장 또렷한 자기신고를 정반대로 해석한 경우다.',
  },
  {
    name: '🧱 skipped 판정 — 레인 페이싱(min_interval)을 막힘으로 읽는다',
    file: U,
    find: "  if (HEALTHY_SKIP_REASONS.has(low)) return { raw, verdict: 'healthy' }",
    replace: '',
    test: T,
    why:
      '`ads:*` 9개 레인이 `skipped=min_interval` 로 **최근에 돌아서 쉬는 중**이라고 말한다 ' +
      '(`worker-ads/lane-alarm.ts:188`). 거짓 경보 11건 중 9건이 이 한 줄에서 나왔다.',
  },
  {
    name: '🧱 skipped 판정 — 반대 방향: 모르는 값을 healthy 로 (거짓 침묵이 돌아온다)',
    file: U,
    find: "  return { raw, verdict: 'blocked' }\n}",
    replace: "  return { raw, verdict: 'healthy' }\n}",
    test: T,
    why:
      '🔴 **이 방향이 조용히 비싸다.** 2026-08-31 이 잡으려던 사고는 바인딩이 없어 이미지 이관이 ' +
      '넉 달간 `migrated=0` 을 성실히 반환한 것이고, 그 모양은 **이유 문자열**(`skipped=no_binding`)로 ' +
      '나타난다. 기본값을 뒤집으면 그 사고가 다시 **에러 없이** 조용해진다 — 소음을 줄이려다 ' +
      '감시 자체를 끈다.',
  },
  {
    name: '🧱 skipped 판정 — 반대 방향: 허용목록에 true 를 넣는다',
    file: U,
    find: "  'min_interval',\n])",
    replace: "  'min_interval',\n  'true',\n])",
    test: T,
    why:
      '`skipped: true` 는 이 레포에서 **"내 일을 못 했다"** 로 10곳 넘게 쓰인다(테이블 없음 · ' +
      '바인딩 없음 · 전제 불충족). 허용목록에 넣으면 그 전부가 조용해진다 — 넓히기는 ' +
      '**정확히 하나씩, 근거와 함께** 해야 한다.',
  },
  {
    name: '🧱 skipped 판정 — 빈 값을 healthy 로 넘긴다',
    file: U,
    find: "  if (!raw || /[=:]/.test(raw)) return { raw: raw || null, verdict: 'blocked' }",
    replace: "  if (!raw || /[=:]/.test(raw)) return { raw: raw || null, verdict: 'healthy' }",
    test: T,
    why:
      '`skipped=` 뒤가 비면 "무언가 건너뛴다면서 무엇인지 안 말한 것" 이다. 넘기면 그 emit 이 ' +
      '영원히 안 고쳐지고, 그 자리에 진짜 막힘이 생기는 날 조용해진다.',
  },
  {
    name: '🧱 skipped 판정 — 키 경계를 버린다 (unskipped 에 걸린다)',
    file: U,
    find: "  const m = /(?:^|[\\s,{])skipped[=:]\\s*([^\\s,}]*)/.exec(s)",
    replace: "  const m = /skipped[=:]\\s*([^\\s,}]*)/.exec(s)",
    test: T,
    why:
      '`unskipped=5`·`total_skipped=5` 같은 이름이 생기면 엉뚱한 값을 읽는다. 종전 정규식도 ' +
      '이 경계는 지키고 있었다 — 값 판정을 더하면서 그것까지 잃지 않는다.',
  },
  {
    name: '🧱 어드민 cron 실패 — severity 를 화이트리스트 없이 받는다',
    file: R,
    find: "  const severity = ['critical', 'error', 'warning'].includes(sevRaw) ? sevRaw : null",
    replace: '  const severity = sevRaw || null',
    test: T,
    why:
      '오타(`criticl`)·주입 시도가 그대로 바인딩에 들어가 **빈 목록**이 나오고, 어드민은 그걸 ' +
      '"이상 없음" 으로 읽는다 — 이 레포가 반복해 당한 *조용한 부재*를 새로 만드는 셈이다.',
  },
  {
    name: '🧱 어드민 cron 실패 — 반대 방향: 정렬을 severity 우선으로',
    file: R,
    // 🧭 `ORDER BY created_at DESC LIMIT 100` 은 이 파일에 4곳 있다 — WHERE 절까지 포함해 가른다.
    find: "      WHERE resolved = ?${severity ? ' AND severity = ?' : ''}\n      ORDER BY created_at DESC LIMIT 100",
    replace: "      WHERE resolved = ?${severity ? ' AND severity = ?' : ''}\n      ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 ELSE 2 END, created_at DESC LIMIT 100",
    test: T,
    why:
      '🔴 그럴듯해 보이지만 **가리는 쪽만 바뀐다** — 미해결 critical 11 + error 621 이면 100칸이 ' +
      '그 둘로 차고 **최근 warning 이 영영 안 보인다**. 필터는 사람이 고르게 하고 목록은 최신순으로 둔다.',
  },
  {
    name: '🧱 어드민 cron 실패 — 칩을 눌러도 아무 일이 없다 (쿼리 키에서 필터 누락)',
    file: P,
    find: "    ['admin', 'cron-failures', showResolved, cronSeverity], '/api/admin/cron-failures',",
    replace: "    ['admin', 'cron-failures', showResolved], '/api/admin/cron-failures',",
    test: T,
    why:
      'React Query 키에 필터가 없으면 칩을 눌러도 **캐시된 옛 목록**이 그대로 나온다 — 화면은 ' +
      '선택 상태를 보여 주는데 목록은 안 바뀌어서, 사람이 "error 가 없다" 고 오판한다.',
  },
]
