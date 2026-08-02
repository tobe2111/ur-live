/**
 * ⏰ `wrangler.toml` 의 cron 배열 — **문법**과 **필수 항목 존재**를 고정한다.
 *
 * ## 왜 (2026-08-02 실측)
 * 주간 D1 백업이 `0 20 * * 0` 로 선언돼 있었다. 표준 crontab 에선 0=일요일이라 맞아 보이지만
 * **Cloudflare 는 day-of-week 를 1-7 또는 MON-SUN 으로만 받는다 — 0 은 범위 밖**(code 10100).
 *
 * 그리고 스케줄 등록은 **원자적 전체 교체**다. 하나가 거부되면 나머지도 반영되지 않는다.
 * ⇒ 이 한 줄이 배열 전체를 무효화했고, **백업 cron 은 등록조차 된 적이 없다**:
 *    하트비트 0건 · R2 백업 객체 0개 · D1 Time Travel(30일) 초과 보존 0 = **재해복구 수단 없음**.
 * 에러는 배포 로그 깊숙한 곳에만 있었고 워크플로가 그걸 삼켜 "성공"으로 보고했다.
 *
 * ⚠️ 이 테스트가 **못 하는 것**: 표현식이 문법적으로 맞아도 **CF 에 실제 등록됐는지**는 모른다.
 *    유일한 답은 배포 후 `worker-deploy` 로그의 `schedule:` 목록이다. 그리고 배열에서 항목을
 *    **빼는** 실수(= 그 cron 삭제)도 못 막는다 — 사람이 그 로그와 대조해야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const TOML = readFileSync('wrangler.toml', 'utf8')
const CRON_LINE = TOML.split('\n').find((l) => /^\s*crons\s*=/.test(l)) || ''
const EXPRS = [...CRON_LINE.matchAll(/"([^"]+)"/g)].map((m) => m[1])

describe('wrangler.toml cron 배열', () => {
  it('배열을 찾았고 비어 있지 않다 (측정 0 이면 통과가 아니라 실패)', () => {
    // 빈 배열로 배포하면 **등록된 스케줄이 전부 삭제**된다 — 가장 조용한 사고다.
    expect(CRON_LINE, 'crons 배열을 못 찾았다 — 파일 구조가 바뀌었다').not.toBe('')
    expect(EXPRS.length, 'crons 가 비었다').toBeGreaterThan(0)
  })

  it('모든 표현식이 5필드다', () => {
    for (const e of EXPRS) {
      expect(e.trim().split(/\s+/).length, `"${e}" 필드 수`).toBe(5)
    }
  })

  it('day-of-week 에 0 이 없다 (CF 는 1-7 또는 MON-SUN)', () => {
    // 🔑 이게 실제 사고 지점이다. 숫자 0 은 CF 가 거부하고, 거부되면 배열 전체가 날아간다.
    const bad = EXPRS.filter((e) => {
      const dow = e.trim().split(/\s+/)[4]
      return String(dow).split(/[,/-]/).some((v) => /^\d+$/.test(v) && (Number(v) < 1 || Number(v) > 7))
    })
    expect(bad, `CF 가 거부할 day-of-week: ${bad.join(', ')} — 일요일은 'SUN' 으로 쓸 것`).toEqual([])
  })

  it('나머지 필드도 범위 안이다', () => {
    const spec: Array<[string, number, number]> = [
      ['minute', 0, 59], ['hour', 0, 23], ['day-of-month', 1, 31], ['month', 1, 12],
    ]
    const bad: string[] = []
    for (const e of EXPRS) {
      const f = e.trim().split(/\s+/)
      spec.forEach(([name, min, max], i) => {
        for (const v of String(f[i]).split(/[,/-]/)) {
          if (!/^\d+$/.test(v)) continue
          const n = Number(v)
          // `*/5` 의 5 는 스텝이라 범위 밖일 수 있다 — 스텝은 건너뛴다.
          if (String(f[i]).includes('/') && String(f[i]).split('/')[1] === v) continue
          if (n < min || n > max) bad.push(`"${e}" ${name}=${n}`)
        }
      })
    }
    expect(bad, `범위 밖: ${bad.join(', ')}`).toEqual([])
  })

  it('중복 표현식이 없다', () => {
    const dup = EXPRS.filter((e, i) => EXPRS.indexOf(e) !== i)
    expect([...new Set(dup)], '같은 표현식이 두 번 — 한 번은 무의미').toEqual([])
  })

  it('주간 D1 백업 트리거가 살아 있다', () => {
    // 백업이 배열에서 사라지면 재해복구가 다시 0 이 된다. 몇 달간 그 상태였다.
    const hasWeekly = EXPRS.some((e) => {
      const f = e.trim().split(/\s+/)
      return f[4] !== '*' // day-of-week 가 지정된 = 주간 스케줄
    })
    expect(hasWeekly, '주간(day-of-week 지정) 트리거가 없다 — D1 백업 cron 이 빠졌다').toBe(true)
  })

  it('cron 이 코드에 실제로 배선돼 있다 (트리거만 있고 호출부가 없으면 무의미)', () => {
    const scheduled = readFileSync('src/worker/scheduled.ts', 'utf8')
    expect(scheduled, '백업 cron 호출부가 없다').toContain('handleD1Backup')
    // safeCron 경유여야 하트비트가 남는다(CLAUDE.md cron 무음정지 룰).
    expect(scheduled).toMatch(/safeCron\(\s*['"]d1-backup['"]/)
  })
})
