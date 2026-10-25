/**
 * 🧬 주입 — 원부 완주를 사망으로 읽던 것 + 커서가 끝에 주차하던 것 (2026-10-24 라이브 실측)
 *    가드: src/tests/unit/franchise-registry-wrap-2026-10-24.test.ts
 */
const T = 'src/tests/unit/franchise-registry-wrap-2026-10-24.test.ts'
const F = 'src/features/marketing/api/franchise-collect.ts'
const H = 'src/features/marketing/api/lane-yield-health.ts'
export default [
  {
    name: '원부완주 — 커서 되돌림을 제거한다(새 가맹본부가 영영 안 들어온다)',
    file: F,
    find: '      if (endOfRegistry) { completed = true; page = 1 }',
    replace: '      if (endOfRegistry) { completed = true }',
    test: T,
    why: '라이브 커서가 113(끝 112 초과)에 주차해 있었다 — 되돌리지 않으면 신규 등록분이 영구 미수집이다.',
  },
  {
    name: '원부완주 — 완주 판정에서 totalCount 조건을 뺀다',
    file: F,
    find: " && Number(total) > 0\n",
    replace: "\n",
    test: T,
    why: 'totalCount 가 없으면 "끝" 인지 "응답이 깨졌는지" 를 구분할 수 없다 — 깨진 응답에서 커서를 되돌리면 같은 1페이지를 영원히 돈다.',
  },
  {
    name: '원부완주 — 완주 회차도 오류로 올린다(가짜 적색 재발)',
    file: F,
    find: 'const error = found === 0 && lastMsg && !completed ?',
    replace: 'const error = found === 0 && lastMsg ?',
    test: T,
    why: '정상 응답을 diag.error 로 올리면 레인 건강이 사망으로 읽고, 그 가짜 적색이 진짜 죽은 레인을 가린다(화면에 하나만 뜬다).',
  },
  {
    name: '원부완주 — 신규/재확인 분리를 되돌린다',
    file: F,
    find: '    saved += c.inserted; upserted += c.upserted',
    replace: '    saved += c.inserted',
    test: T,
    why: '재확인 수가 없으면 "원부를 다 훑어 신규 0" 과 "한 번도 성공 못 함" 을 구분할 방법이 사라진다.',
  },
  {
    name: '원부완주 — 레인 건강의 완주 예외를 제거한다',
    file: H,
    find: '  if (runs >= DEAD_AFTER_RUNS && totalSaved === 0 && (Number(stat.total_upserted) > 0 || stat.completed)) return null',
    replace: '',
    test: T,
    why: '완주한 레인이 86회 연속 가짜 적색으로 떠서 진짜 사망 레인을 가린다(라이브에서 실제로 그랬다).',
  },
  {
    name: '원부완주 — 진짜 사망 판정까지 같이 없앤다',
    file: H,
    find: '  if (runs >= DEAD_AFTER_RUNS && totalSaved === 0) {',
    replace: '  if (false) {',
    test: T,
    why: '완주 예외를 넓히다 사망 판정 자체를 지우면 죽은 레인(nps 3,202건 조회 0 매칭)이 영영 안 보인다.',
  },
]
