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
import { readFileSync, readdirSync } from 'node:fs'

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

  it('계정 전체 트리거 합이 무료 한도(5) 이하다', () => {
    // 🔴 2026-08-02: 이게 문법보다 **뒤에 나온 두 번째 벽**이다. `0`→`SUN` 으로 고쳐 실제 배포하자
    //   "Workers Free limit of 5 cron triggers per **account**" (code 10072) 가 나왔다.
    //   한 파일만 보면 절대 못 잡는다 — 한도는 **계정** 단위다. (당시 ur-live 3 + cleanup-cron 1 + ads 1 = 5)
    //   6번째를 넣으면 PUT 이 통째로 거부되고 **이후 모든 worker-deploy 가 실패**해 cron 배포가 멈춘다.
    const files = readdirSync('.').filter((f) => /^wrangler.*\.toml$/.test(f))
    expect(files.length, 'wrangler*.toml 을 못 찾았다 — 검사가 헛돈다').toBeGreaterThan(0)
    let total = 0
    const detail: string[] = []
    for (const f of files) {
      const l = readFileSync(f, 'utf8').split('\n').find((x) => /^\s*crons\s*=/.test(x))
      if (!l) continue
      const n = [...l.matchAll(/"([^"]+)"/g)].length
      total += n
      detail.push(`${f}:${n}`)
    }
    expect(total, `계정 합계 ${total} (${detail.join(' + ')}) — 무료 한도 5 초과`).toBeLessThanOrEqual(5)
  })

  /** 주석은 배선이 아니다 — 실행 코드만 판정한다(이 레포가 반복해 걸린 함정). */
  const scheduledCode = readFileSync('src/worker/scheduled.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
  /** 백업을 발화시키는 `if (...)` 조건 한 줄. */
  const backupBranch = scheduledCode.split('\n').find((l) => /^\s*if \(cron === .*\*\/15/.test(l)) ?? ''

  it('D1 백업 트리거가 배열에 있다 (등록된 식 중 하나가 백업 분기에 걸린다)', () => {
    // 2026-08-02 점화. 여기서 빠지면 재해복구가 다시 0 이 된다 — 몇 달간 그 상태였다.
    // 🗄️ 2026-08-25 정정: 예전엔 *주간*(day-of-week 지정)인지로 판정했는데, 백업이 `*/15` 전용
    //   트리거로 옮겨가면서 그 판정은 **백업과 무관한 다른 주간 트리거로도 통과**한다(대리 지표).
    //   ⇒ **등록된 식이 실제로 백업 분기에 매칭되는가**를 본다 — 이게 원래 물어보려던 것이다.
    expect(backupBranch, '백업 분기를 못 찾았다 — 구조가 바뀌었나?(통과 아님)').toBeTruthy()
    expect(EXPRS.some((e) => backupBranch.includes(`'${e}'`)),
      `백업 분기가 등록된 식(${EXPRS.join(' , ')})을 하나도 안 받는다 — 백업이 영원히 안 돈다`).toBe(true)
  })

  it('백업 cron 은 코드가 세 표기를 모두 받는다 (등록 표기가 무엇이든)', () => {
    //   `0`/`SUN`/`7` 중 무엇으로 등록하든 분기가 매칭돼야 한다.
    //   CF 는 **등록된 문자열 그대로** event.cron 에 넣으므로 표기 하나만 받으면 조용히 안 돈다.
    const scheduled = readFileSync('src/worker/scheduled.ts', 'utf8')
    for (const form of ["'0 20 * * 0'", "'0 20 * * SUN'", "'0 20 * * 7'"]) {
      expect(scheduled, `백업 분기가 ${form} 표기를 안 받는다`).toContain(form)
    }
  })

  it('cron 이 코드에 실제로 배선돼 있다 (트리거만 있고 호출부가 없으면 무의미)', () => {
    const scheduled = readFileSync('src/worker/scheduled.ts', 'utf8')
    // 🗄️ 2026-08-25: 옛 `handleD1Backup`(전체 덤프)은 DB 가 커져 08-02 이후 OOM 으로 죽은 코드다.
    //   이 자리는 **분할 백업**이 이어받았다 — 옛 이름을 기대하면 죽은 호출부를 되살리게 된다.
    expect(scheduled, '백업 cron 호출부가 없다').toContain('handleChunkedBackup')
    // ⚠️ 주석 제거본으로 판정한다 — 위 주석이 옛 이름을 *설명*하므로 원문으로 보면 늘 빨강이다.
    expect(scheduledCode, '죽은 전체덤프 백업이 되살아났다').not.toContain('handleD1Backup')
    // slotCron/safeCron 경유여야 하트비트가 남는다(CLAUDE.md cron 무음정지 룰).
    expect(scheduled).toMatch(/Cron\([^)]*\)?\(?\s*['"]d1-backup-chunked['"]/)
  })

  /**
   * 🗄️ 2026-08-25 — **백업 전용 트리거**. 조용히 되돌아가는 길 셋을 각각 앵커로 박는다.
   *   되돌아가면 에러 없이 백업만 다시 굶는다(이 레포의 "실패가 아니라 조용한 부재" 클래스).
   */
  describe('백업 전용 트리거(*/15)', () => {
    const scheduled = readFileSync('src/worker/scheduled.ts', 'utf8')
    const toml = readFileSync('wrangler.toml', 'utf8')
    const liveCrons = (/crons\s*=\s*\[([^\]]*)\]/.exec(
      toml.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n'),
    )?.[1] ?? '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean)

    it('🔴 `*/15` 가 실제로 등록돼 있다 — 코드 분기만 있으면 한 번도 안 돈다', () => {
      expect(liveCrons, `등록된 crons=${liveCrons.join(' , ')}`).toContain('*/15 * * * *')
    })

    it('🔴 계정 한도(5, ur-ads 1개 포함)를 넘지 않는다 — 넘으면 PUT 이 거부돼 배열 전체가 사라진다', () => {
      expect(liveCrons.length, `ur-live crons=${liveCrons.length} (ur-ads 1개 별도)`).toBeLessThanOrEqual(4)
    })

    it('🔴 `*/15`(:00/:15/:30/:45) 와 `*/5` 백업 슬롯(:05/:20/:35/:50)이 안 겹친다', () => {
      // 겹치면 두 인보케이션이 같은 커서를 동시에 밀어 백업 파일이 깨진다.
      const slots = /\[([\d,\s]+)\]\.some\(\(m\) => slotDue/.exec(scheduled)?.[1] ?? ''
      const mins = slots.split(',').map((x) => Number(x.trim())).filter(Number.isFinite)
      expect(mins.length, '`*/5` 백업 슬롯 목록을 못 찾았다(구조가 바뀌었나?)').toBeGreaterThan(0)
      for (const m of mins) expect(m % 15, `분 ${m} 이 */15 격자와 겹친다`).not.toBe(0)
    })

    it('🔴 분기가 `*/15` 를 받는다 — 안 받으면 발화해도 cron-unmatched 로 버려진다', () => {
      expect(scheduled).toContain("cron === '*/15 * * * *'")
    })
  })
})
