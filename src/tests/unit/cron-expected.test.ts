/**
 * 🔴 "한 번도 안 뛴 cron" 탐지 불변식 〔2026-07-29 — 실사고 후 신설〕
 *
 * **사고**: `scheduled.ts` 는 10개 cron 식으로 분기하는데 라이브 Worker 엔 **3개만 등록**돼 있었다.
 * `payouts-generate`(주간 정산 지급)·`d1-backup`(주간 백업)·`toss-refund-retry` 가 **한 번도 안 돌았고**,
 * 몇 달간 아무도 몰랐다 — **에러가 안 나기 때문**이다.
 *
 * **왜 기존 감시가 못 잡았나**: `getCronHealth` 는 하트비트 *기록이 있는* 작업만 순회한다.
 * 한 번도 안 뛴 작업은 목록에 **아예 없어** 판정 대상에 들어가지도 않았다(실측: `missing: []`).
 * ⇒ **부재는 침묵과 다르게 생겼다.** 정적 기대 목록과 대조해야만 보인다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 대시보드의 실제 트리거 목록(레포가 못 읽는다). 판정은 "코드가 기대하는데 기록이 0" 까지다.
 *   - 등록은 됐는데 **키가 없어 일을 못 하는** 경우 — 같은 사고에서 캐리어 Worker 바인딩이
 *     5개뿐이라 `toss-refund-retry` 가 `TOSS_SECRET_KEY` 없이 돌고 있었다. 그건 **바인딩 축**이고
 *     여기서 안 잡힌다(하트비트는 `ok:true` 로 남는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  EXPECTED_CRON_EXPRESSIONS,
  RETIRED_CRON_EXPRESSIONS,
  KNOWN_CRON_EXPRESSIONS,
  findNeverFired,
  canonicalCron,
} from '@/worker/utils/cron-expected'
import { expectedMaxAgeMinutes } from '@/worker/utils/cron-heartbeat'

const MIN = 60
const DAY = 24 * 60

describe('기대 목록 ↔ scheduled.ts 동기 (드리프트 차단)', () => {
  // 주석을 먼저 걷어낸다 — 설명문이 `cron === '...'` 패턴을 **인용만 해도** 유령 식이 잡혀
  // 가드가 빨강이 된다(실제로 그렇게 깨졌다). 가드는 자기가 설명되는 것에 부서지면 안 된다.
  const src = readFileSync(resolve(process.cwd(), 'src/worker/scheduled.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  // 별칭(`0 20 * * SUN` 등)은 카노니컬로 되돌려 비교한다 — 같은 일정의 다른 표기일 뿐이고,
  // 기대 목록은 *일정 하나당 한 줄*이어야 never-fired 판정이 오염되지 않는다.
  const branched = new Set(
    Array.from(src.matchAll(/cron === '([^']+)'/g), (m) => canonicalCron(m[1]!)),
  )

  it('scheduled.ts 가 분기하는 cron 식을 실제로 찾는다 (빈 스캔 방지)', () => {
    // 정규식이 깨지거나 파일이 옮겨지면 0개가 잡히고, 그러면 아래 동일성 검사가 **무의미하게 통과**한다.
    // 2026-08-11: 죽은 식 4개를 `*/5` 분 게이트로 옮겨 10 → 5 가 됐다. 하한도 같이 내린다
    //   (하한의 목적은 "0개가 잡혀 동일성 검사가 무의미하게 통과"하는 것을 막는 것뿐이다).
    expect(branched.size).toBeGreaterThanOrEqual(4)
  })

  it('아는 목록(기대+은퇴)과 분기 목록이 정확히 같다', () => {
    // 어긋나면 둘 중 하나다: ① scheduled.ts 에 분기를 추가/삭제하고 목록을 안 고쳤다
    //                        ② 목록에만 있고 코드엔 없는 유령 식이다. 둘 다 고쳐야 한다.
    // 🪦 2026-09-07: 비교 대상이 EXPECTED → KNOWN 이 됐다. 은퇴한 식도 **분기는 남아야** 하기
    //    때문이다(잔존 트리거가 `cron-unmatched` 로 버려지지 않게). 기대 목록에서만 뺀다.
    expect([...branched].sort()).toEqual([...KNOWN_CRON_EXPRESSIONS].sort())
  })

  it('🪦 은퇴한 식은 기대 목록에 없다 — 있으면 헬스체크가 영구 빨강이 된다', () => {
    // 2026-09-07 실사고: `0 20 * * 0` 이 08-25 에 트리거에서 빠졌는데 기대 목록에 남아
    //   `findNeverFired` 가 매번 잡아냈고 `/api/_healthcheck/cron` 이 13일간 503 이었다.
    //   영원한 빨간불 하나가 **경보 채널 전체를 침묵시킨다** — 진짜 장애와 구분이 안 된다.
    const overlap = RETIRED_CRON_EXPRESSIONS.filter((c) => EXPECTED_CRON_EXPRESSIONS.includes(c))
    expect(overlap, `은퇴했는데 기대 목록에 남은 식: ${overlap.join(', ')}`).toEqual([])
    expect(RETIRED_CRON_EXPRESSIONS.length).toBeGreaterThan(0)   // 측정 대상 0은 통과가 아니다
  })

  it('🪦 은퇴한 식도 디스패처 분기는 남아 있다 — 잔존 트리거를 버리지 않는다', () => {
    // 지우면 대시보드에 남은 옛 트리거의 회차가 `cron-unmatched` 로 조용히 버려진다.
    // 은퇴는 "기대하지 않는다"이지 "받지 않는다"가 아니다.
    const dropped = RETIRED_CRON_EXPRESSIONS.filter((c) => !branched.has(c))
    expect(dropped, `은퇴 식인데 분기가 없다: ${dropped.join(', ')}`).toEqual([])
  })

  it('아는 목록의 모든 식이 주기 해석 가능하다', () => {
    // 해석 불가면 `findNeverFired` 가 그 식을 **조용히 건너뛴다** → 영구 사각지대가 생긴다.
    for (const c of KNOWN_CRON_EXPRESSIONS) {
      expect(expectedMaxAgeMinutes(c), `주기 해석 불가: ${c}`).not.toBeNull()
    }
  })
})

describe('findNeverFired — 부재 탐지', () => {
  const maxAge = (c: string) => expectedMaxAgeMinutes(c)

  // 🧪 2026-09-07: 아래 둘은 **주기별 거동**(일간 vs 주간)을 재는 테스트라, 프로덕션 상수가
  //   아니라 **명시 픽스처**를 주입한다. 종전엔 기본값을 그대로 썼고 주간 축의 대표로
  //   `0 20 * * 0` 을 골랐는데, 그 식이 은퇴하자(더는 기대 목록에 없다) 테스트가 함께 무너졌다.
  //   ⇒ 함수의 거동을 재는 테스트가 **그때그때의 운영 목록에 묶여 있으면 안 된다.**
  //   기대 목록 자체의 정합은 위 드리프트 describe 가 따로 본다.
  const WEEKLY = '0 0 * * 1'
  const DAILY = '0 18 * * *'
  const FIXTURE = ['*/5 * * * *', DAILY, WEEKLY]

  it('기록이 0이고 기회가 충분했으면 잡는다', () => {
    // 실사고 재현: `*/5` 만 돌고 나머지는 기록 0. 추적 30일이면 주간 작업까지 판정 가능.
    const crons = findNeverFired(['*/5 * * * *'], 30 * DAY, maxAge, FIXTURE).map((o) => o.cron)
    expect(crons).toContain(WEEKLY)
    expect(crons).toContain(DAILY)         // 일간 — 30일이면 기회가 충분했다
    expect(crons).not.toContain('*/5 * * * *')
  })

  it('🛡️ 기회가 없었으면 판정을 미룬다 — 배포 직후 전건 빨강 금지', () => {
    // 실제 조사 때 추적 창이 4.7시간뿐이라 일간·주간을 "판정 불가"로 남겨야 했다.
    //   그 절제가 오진을 막았다 — `0 18`·`0 19` 는 실제로 등록돼 있었다.
    const shortOut = findNeverFired(['*/5 * * * *'], 4.7 * MIN, maxAge, FIXTURE).map((o) => o.cron)
    expect(shortOut).not.toContain(WEEKLY)  // 주간 — 7일 안 지남
    expect(shortOut).not.toContain(DAILY)   // 일간 — 하루 안 지남
    // 창을 사흘로 넓히면 일간은 판정 대상이 되고(기대 최대간격 2,910분 ≈ 2.02일) 주간은 여전히
    // 미룬다(20,190분 ≈ 14일). 절제의 경계가 정확히 여기다.
    const out = findNeverFired(['*/5 * * * *'], 3 * DAY, maxAge, FIXTURE).map((o) => o.cron)
    expect(out).toContain(DAILY)
    expect(out).not.toContain(WEEKLY)
  })

  it('🪦 은퇴한 식은 판정 대상이 아니다 — 이게 13일 503 의 수리다', () => {
    // 기본 기대 목록(= 프로덕션)으로 돌렸을 때, 은퇴 식은 기록이 0이어도 never-fired 에 안 나온다.
    // 라이브에서 이 한 줄 때문에 `ok:false` 가 고정돼 있었다.
    const crons = findNeverFired([], 30 * DAY, maxAge).map((o) => o.cron)
    for (const retired of RETIRED_CRON_EXPRESSIONS) {
      expect(crons, `은퇴 식이 never-fired 로 잡힌다: ${retired}`).not.toContain(retired)
    }
  })

  it('한 번이라도 뛴 식은 잡지 않는다 (그건 stale 축이 본다)', () => {
    const all = [...EXPECTED_CRON_EXPRESSIONS]
    expect(findNeverFired(all, 30 * DAY, maxAge)).toEqual([])
  })

  it('주기 해석 불가는 조용히 건너뛴다 — 모르면 단정하지 않는다', () => {
    expect(findNeverFired([], 30 * DAY, () => null)).toEqual([])
  })

  it('null·빈 문자열 기록에 흔들리지 않는다', () => {
    const out = findNeverFired([null, '', undefined, '  0 18 * * *  '], 30 * DAY, maxAge).map((o) => o.cron)
    expect(out).not.toContain('0 18 * * *') // 공백 trim 후 매칭
  })
})
