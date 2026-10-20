/**
 * 🎛️ **처리량 노브 등기부** — 요금제가 닿아야 할 것과 닿으면 **안 될** 것 (2026-08-02).
 *
 * ## 왜 등기부인가
 * 같은 날 **같은 결함을 세 번** 만났다: 플랫폼 천장 → 보강 벽시계 → DO 알람·레인 예산.
 * 전부 *"이 상수가 요금제를 모른다"* 였고 전부 **사람이 발견**해서 고쳤다.
 * 발견에 의존하면 다음 노브도 놓치고, 놓치면 **유료로 바꿔도 그 축은 안 오른다**(에러가 없다).
 * ⇒ 등기부 + 가드로 *"기억했는가"* 를 *"잊을 수 없다"* 로 바꾼다.
 *
 * ## 🔴 전부 올리면 안 된다 — 이게 이 등기부의 핵심
 * `external`(YouTube 유닛·카카오/네이버 일 쿼터)을 요금제에 묶으면 **유료 전환이 곧 장애**가 된다:
 * Workers 예산은 늘었는데 그쪽이 403 을 주고 그 레인은 그날 내내 죽는다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 분류가 *틀린* 경우(외부 쿼터를 `cf` 로 적음). 문자열로 판정 불가다
 *   — 등기부의 `why` 를 사람이 읽고 판단해야 한다. 여기서는 *빠뜨림*과 *배선 누락*만 막는다.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { PLAN_KNOBS, knobClass, cfKnobs } from '../../worker-ads/plan-knobs'

describe('노브 등기부 — 형태', () => {
  it('모든 항목이 분류와 이유를 갖는다', () => {
    expect(PLAN_KNOBS.length).toBeGreaterThan(15)   // 측정 대상이 비면 통과가 아니라 실패
    for (const k of PLAN_KNOBS) {
      expect(k.env, `${k.env} 는 ADS_ 접두어여야 한다`).toMatch(/^ADS_[A-Z0-9_]+$/)
      expect(['cf', 'external', 'shape']).toContain(k.cls)
      expect(k.why.length, `${k.env}: 이유 없는 등재 금지 — 다음 세션이 판단을 못 이어받는다`).toBeGreaterThan(10)
    }
  })

  it('중복 등재가 없다 — 분류가 둘이면 어느 쪽이 참인지 알 수 없다', () => {
    const names = PLAN_KNOBS.map(k => k.env)
    expect(new Set(names).size).toBe(names.length)
  })

  /**
   * 🔴 오분류의 대가가 가장 큰 축들을 못박는다. `external` 을 `cf` 로 바꾸면 유료 전환이 곧 장애다
   *   — Workers 예산은 늘었는데 YouTube/카카오가 403 을 주기 시작한다.
   */
  it('외부 API 쿼터 노브는 external 이다 (유료로 올리면 그날 쿼터를 태운다)', () => {
    for (const n of ['ADS_YT_SEARCH_BUDGET', 'ADS_YT_PERF_UNITS', 'ADS_YT_PAGES',
      'ADS_STORE_KAKAO_BUDGET', 'ADS_KAKAO_SWEEP_CHAIN', 'ADS_NAVER_EXTRA']) {
      expect(knobClass(n), `${n} 은 외부 쿼터다`).toBe('external')
    }
  })

  it('Cloudflare 자원 노브는 cf 다 (요금제와 함께 올라야 한다)', () => {
    for (const n of ['ADS_LANES_PER_TICK', 'ADS_SUBREQ_PLATFORM_CAP', 'ADS_ENRICH_DEADLINE_MS',
      'ADS_ENRICH_BUDGET', 'ADS_INFLUENCER_ENRICH_BUDGET', 'ADS_MAINT_OPS_BUDGET',
      'ADS_SUBREQUEST_BUDGET', 'ADS_LANE_ALARM_INTERVAL_MS', 'ADS_LANE_ALARM_RUNS_PER_HOUR']) {
      expect(knobClass(n), `${n} 은 Cloudflare 자원이다`).toBe('cf')
    }
    expect(cfKnobs().length).toBeGreaterThanOrEqual(9)
  })

  it('모르는 이름은 null — 조용히 아무 분류로 떨어지지 않는다', () => {
    expect(knobClass('ADS_그런거없음')).toBeNull()
  })
})

describe('노브 등기부 — 가드가 실제로 강제한다', () => {
  /**
   * 🚦 등기부가 옳아도 **가드가 안 돌면** 다음 노브는 그냥 빠진다.
   *   그래서 스크립트를 직접 실행해 초록을 확인한다(주입 검증은 `check-guard-mutations` 가 담당).
   */
  it('현재 소스에서 통과한다 — 누락·배선 0', () => {
    const out = execFileSync('node', ['scripts/check-plan-knob-coverage.mjs'], { encoding: 'utf8' })
    expect(out).toMatch(/전부 분류됨/)
    expect(out).toMatch(/cf 배선 누락 0/)
  })

  /**
   * ⚠️ **첫 판의 가드는 R1 이 헛돌았다** — raw `parseInt` 만 봐서, 노브를 리졸버로 배선하는 순간
   *   스캐너 눈에서 사라졌다. 그래서 등기부에서 그 줄을 지워도 통과했다(주입에서 exit=0 으로 드러남).
   *   ⇒ 리졸버 경유 형태도 함께 스캔한다. 그 사실을 여기서 고정한다.
   */
  it('가드가 리졸버 경유 형태도 노브로 센다 (배선하면 사라지지 않는다)', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('scripts/check-plan-knob-coverage.mjs', 'utf8')
    expect(src, 'RESOLVED 패턴이 없으면 배선된 노브가 등기부 검사에서 빠진다').toMatch(/envLaneBudget\|resolveInterval/)
    expect(src).toMatch(/const RAW =/)
  })

  /**
   * 🔴 **주입 하네스가 이 검사를 만들게 했다.** 첫 판은 가드를 *깨끗한 소스에서만* 돌려서,
   *   강제 라인(`if (bad) process.exit(…)`)을 통째로 지워도 테스트가 초록이었다 —
   *   `bad` 가 false 인 소스에선 그 줄이 있든 없든 결과가 같기 때문이다.
   *   ⇒ **강제 경로 자체**를 겨눈다. 위반이 발견됐을 때 실제로 실패로 끝나는가.
   *
   * ⚠️ 이 검사가 못 보는 것: 판정 로직이 틀려 `bad` 가 영영 false 인 경우.
   *   그건 실제 위반을 주입해 봐야 알고, 그 검증은 **손으로 두 규칙 다 exit=1 을 확인**했다
   *   (등기부 한 줄 삭제 / cf 노브를 raw parseInt 로 되돌리기).
   */
  /**
   * 🕳️ **등기부의 사각지대 — env 가 아닌 요금제 쌍** (2026-08-03 신설).
   *
   * R1·R2 는 `ADS_*` env 노브만 본다. 그런데 이 파이프라인의 요금제 축 **절반은 파일 안 상수 쌍**이다
   * (`RUN_DEADLINE_MS` / `…_PAID`, `ALARM_INTERVAL_MS_DEFAULT` / `…_PAID`, `SUBREQ_PLATFORM_CAP_*`).
   * 그것들은 등기부에 뜨지도, R2 에 걸리지도 않는다.
   *
   * 08-03 전수 확인에서 다행히 전부 배선돼 있었지만 그건 **강제가 아니라 성실함**이었다.
   * `_PAID` 를 만들어 놓고 선택부를 안 붙이면 **유료로 바꿔도 그 축은 안 오른다**(에러 없음).
   *
   * ⚠️ 이 규칙이 못 잡는 것: `_PAID` 짝이 **아예 없는** CF-bound 상수. 이름만으론 CPU 에 묶인 건지
   *   데이터 모양인지 알 수 없다 — 사람이 판단해야 한다(등기부의 `why` 와 같은 이유).
   */
  it('R3: 아무도 고르지 않는 `_PAID` 상수를 잡는다 (env 밖 요금제 쌍)', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('scripts/check-plan-knob-coverage.mjs', 'utf8')
    expect(src, '_PAID 상수 스캔이 없으면 env 밖 요금제 축이 통째로 사각지대다')
      .toMatch(/const\\s\+\(\[A-Z\]\[A-Z0-9_\]\*_PAID\)/)
    expect(src, '요금제 판정 함수를 확인하지 않으면 "정의만 하고 안 고르는" 경우를 못 잡는다')
      .toMatch(/envPlanValue\|paidPlan\|resolvePlan\|isPaid/)
    // 🔴 **조건문 자체를 겨눈다.** 처음엔 `orphanPaid.size` 문자열만 봤는데, 그 이름이 **에러 메시지
    //   안에도** 있어서 `if (orphanPaid.size)` 를 `if (false)` 로 바꿔도 초록이었다(주입에서 드러남).
    //   같은 함정을 이 파일에서 이미 한 번 겪었다 — 이름이 아니라 **강제 경로**를 고정해야 한다.
    expect(src, '조건이 죽으면 R3 는 아무것도 안 막는다').toMatch(/if \(orphanPaid\.size\) \{\s*\n\s*bad = true/)
  })

  /**
   * ⚠️ **선언 순서 함정** — R3 블록이 `let bad = false` 보다 **앞**에 있으면, 위반이 실제로 났을 때
   *   `bad = true` 가 TDZ ReferenceError 로 죽는다. 통과할 땐 멀쩡하고 **실패할 때만 깨지는**
   *   가장 나쁜 모양이다(첫 판이 실제로 그 상태였고, 순서 검사를 넣고서야 알았다).
   */
  it('R3 가 `let bad` 뒤에 온다 — 앞이면 위반 시 TDZ 로 죽는다', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('scripts/check-plan-knob-coverage.mjs', 'utf8')
    const declAt = src.indexOf('let bad = false')
    const r3At = src.indexOf('const orphanPaid = new Map()')
    const exitAt = src.indexOf('if (bad) process.exit')
    expect(declAt).toBeGreaterThan(-1)
    expect(r3At, 'R3 블록을 못 찾았다 — 코드가 옮겨갔다').toBeGreaterThan(-1)
    expect(r3At, 'R3 가 bad 선언보다 앞이면 위반 시 ReferenceError').toBeGreaterThan(declAt)
    expect(r3At, 'R3 가 최종 exit 뒤면 판정이 반영되지 않는다').toBeLessThan(exitAt)
  })

  it('위반을 찾으면 실제로 실패로 끝난다 (강제 경로 존재)', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('scripts/check-plan-knob-coverage.mjs', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
    expect(src, 'strict 에서 종료하지 않으면 CI 가 위반을 통과시킨다').toMatch(/if \(bad\) process\.exit\(STRICT \? 1 : 0\)/)
    // 그리고 두 규칙이 실제로 `bad` 를 세운다.
    expect(src).toMatch(/if \(missing\.size\) \{\s*\n?\s*bad = true/)
    expect(src).toMatch(/if \(unwired\.size\) \{\s*\n?\s*bad = true/)
  })
})
