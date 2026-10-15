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
    // 🔁 2026-10-15 재조준 — 허용목록이 페이싱 넷으로 자라 종전 앵커(`'min_interval',\n])`)가
    //    닫는 줄이 아니게 됐다. **불변식은 그대로**: `true` 를 넣으면 거짓 침묵이 돌아온다.
    find: "  'rescan_hour',  // :127 maintenance",
    replace: "  'true',\n  'rescan_hour',  // :127 maintenance",
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
  {
    name: '🧱 시각 페이싱 셋을 허용목록에서 뺀다 (첫 판 — 15→3 이 남는다)',
    file: U,
    find: "  'even_hour',    // :241 collect-company",
    replace: "  // 'even_hour',    // :241 collect-company",
    test: T,
    why:
      '라이브 경보 15건 중 **3건이 blocked 로 남는다**(off_hour · rescan_hour · even_hour). 셋 다 ' +
      '러너의 의도적 시각 페이싱이라 내일 저절로 돈다 — 사람이 할 일이 없는데 매일 04시 KST 에 ' +
      '거짓 경보가 올라오고, 그 소음이 다시 진짜 error 를 가린다(이 수리가 막으려던 그 사고).',
  },
  {
    name: '🧱 꺼짐(gate_off)을 건강하다고 분류한다 — 거짓 침묵 복귀',
    file: U,
    find: "  'gate_off',   // env 게이트가 'true' 가 아니다",
    replace: "  // 'gate_off',   // env 게이트가 'true' 가 아니다",
    test: T,
    why:
      '🔴 **반대 방향.** 게이트가 꺼진 레인은 **사람이 켜야** 도는 것이고, 2026-08-31 이 잡으려던 ' +
      '사고(바인딩 부재로 이미지 이관이 넉 달간 무음)가 정확히 이 모양이다. 두 집합의 경계는 ' +
      '"내일 저절로 도는가" 이고, 꺼짐을 페이싱으로 옮기면 그 사고가 다시 조용해진다.',
  },
  {
    name: '🧱 러너에 분류 안 된 새 페이싱 이유가 생긴다 (내일의 거짓 경보)',
    file: 'src/worker-ads/lane-alarm-runners.ts',
    find: "      if (new Date().getUTCHours() % 4 !== 1) return { skipped: 'off_hour' }",
    replace: "      if (new Date().getUTCHours() % 4 !== 1) return { skipped: 'quarter_hour' }",
    test: T,
    why:
      '이게 **내일 실제로 일어나는 일**이다 — 누가 레인에 새 페이싱 이유를 붙이면 그 이름은 두 ' +
      '집합 어디에도 없어 기본값 `blocked` 로 떨어지고, 매일 04시 KST 거짓 경보가 하나 늘어난다. ' +
      '빌드·시험·화면 전부 멀쩡해서 **재 본 사람만 안다**(이 수리가 바로 그래서 두 번 필요했다).',
  },
  {
    name: '🧱 분류 전수 검사가 리터럴을 0건 찾는다 (표기 변경 → 헛도는 가드)',
    file: T,
    find: "    const found = [...code.matchAll(/skipped:\\s*'([^']+)'/g)].map((m) => m[1])",
    replace: "    const found = [...code.matchAll(/skippedZZ:\\s*'([^']+)'/g)].map((m) => m[1])",
    test: T,
    why:
      '러너가 표기를 바꾸면(`skipped:` → 다른 모양) match 가 0건이 되고 `unclassified` 도 빈 ' +
      '배열이라 **분류를 아무리 빼먹어도 초록**이다. 하한 10 이 그 자리를 막는다 — 이 주입이 ' +
      '빨간불이어야 그 하한이 실제로 일하고 있다는 증거다.',
  },
]
