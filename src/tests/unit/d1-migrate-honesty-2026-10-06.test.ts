import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { readRaw } from '../helpers/source-text'

/**
 * 🔇 **`d1-migrate` 워크플로가 몇 달간 "조용한 거짓" 이었다** (2026-10-06 대표 *"남은 것도 다 해줘"*)
 *
 * ## 실측 (추측 아님 — run 37465121609 의 잡 로그)
 *
 * ```
 *   x [ERROR] Couldn't find DB with name 'ur-live'
 *   ! migrations/0289_….sql 실패 (already applied?)
 *   ! ADMIN_REPAIR_TOKEN 미설정 — repair-schema 호출 skip
 *   -> job conclusion: success          ← 🔴 전부 실패했는데 초록
 * ```
 *
 * 원인이 **둘**이었다.
 *   (1) `D1_DATABASE_NAME` 시크릿 미설정 → 기본값 `ur-live` 를 찾았는데 **그런 DB 는 없다**
 *       (본진은 `wrangler.toml` 의 `DB` 바인딩 = `toss-live-commerce-db`).
 *   (2) 모든 실패를 `|| echo "실패 (already applied?)"` 가 삼켜 **잡이 초록**이었다.
 *
 * ⇒ 이 레포가 반복해 당한 클래스다: **실패가 아니라 "조용한 통과"**.
 *
 * ## 이번 수정의 원칙 — 정직하게 만들되 **프로덕션 쓰기는 켜지 않는다**(2단 스위치)
 *
 *   · DB 이름은 **`wrangler.toml` 에서 읽는다**(시크릿 불필요 ⇒ 이름이 다시 어긋날 수 없다).
 *   · 기본은 **보고 전용** — 무엇이 적용될지 출력만 하고 실행하지 않는다.
 *   · 실제 적용은 **명시 게이트** `vars.D1_MIGRATE_APPLY == 'true'` 일 때만(= 대표 판단).
 *   · "이미 적용됨" 으로 넘기는 것은 **중복 컬럼·테이블 존재** 뿐. 그 밖은 전부 실패시킨다.
 *
 * ## 🩸 `readCode`(주석 제거기)를 YAML 에 쓰지 말 것
 *
 * JS/TS 용 제거기는 `https://…` 의 `//` 를 줄 주석으로 읽어 **그 줄 뒤를 잘라낸다.** 같은 날
 * 다른 시험에서 실제로 그렇게 헛돌았다 ⇒ 워크플로는 `readRaw`.
 *
 * ## 이 시험이 **못 보는 것**
 *
 *   · 게이트를 켰을 때 마이그레이션이 실제로 깨끗히 적용되는지는 레포가 못 본다(프로덕션 D1).
 *   · 시크릿 설정 여부도 못 본다 — **라이브 로그만이 판정**이다(이 사고를 그래서 늦게 찾았다).
 */

const WF = '.github/workflows/d1-migrate.yml'
const wf = () => readRaw(WF)

/**
 * 🩸 주석을 떼고 본다 — 이 워크플로의 머리말은 **옛 안티패턴을 그대로 인용**한다
 *   (`|| echo "실패 (already applied?)"`). 전문을 그냥 검사하면 그 인용에 걸려
 *   "안티패턴이 되살아났다" 고 **거짓 빨간불**이 난다(처음에 실제로 그랬다).
 *   ⇒ `#` 로 시작하는 줄(YAML·셸 주석)만 떼고 **실행되는 줄**을 본다.
 */
const wfCode = () => wf().split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

describe('① 적용은 명시 게이트 뒤에만 — 기본은 보고 전용', () => {
  it('Apply 스텝이 vars.D1_MIGRATE_APPLY 게이트를 갖는다', () => {
    const s = wf()
    const i = s.indexOf('- name: Apply migrations')
    expect(i, 'Apply 스텝을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
    const step = s.slice(i, i + 400)
    expect(step, '게이트가 사라졌다 — main 푸시마다 프로덕션 D1 에 실제로 쓰기 시작한다')
      .toMatch(/if:\s*\$\{\{\s*vars\.D1_MIGRATE_APPLY\s*==\s*'true'\s*\}\}/)
  })

  it('보고 전용 스텝이 있고, 게이트 OFF 를 사람이 읽을 수 있게 적는다', () => {
    const s = wf()
    expect(s, '보고 스텝이 사라졌다').toContain('- name: Report pending migrations')
    expect(s, '게이트 상태를 요약에 안 쓴다 — 아무도 OFF 인 줄 모른다').toContain('GITHUB_STEP_SUMMARY')
    expect(s, '게이트를 켜는 방법을 안 적는다').toContain('D1_MIGRATE_APPLY=true')
  })

  it('Apply 는 Preflight 뒤에 온다 — DB 확인 전에 쓰지 않는다', () => {
    const s = wf()
    expect(s.indexOf('- name: Apply migrations')).toBeGreaterThan(s.indexOf('- name: Preflight'))
  })
})

describe('② 실패를 삼키지 않는다 (이것이 몇 달 초록불의 원인이었다)', () => {
  it('"이미 적용됨" 으로 넘기는 것은 중복 컬럼·테이블 존재뿐', () => {
    const s = wf()
    expect(s, '판정 조건이 느슨해졌다 — 이름 오류·권한 오류까지 "이미 적용됨" 이 된다')
      .toContain('grep -qiE "duplicate column|already exists"')
  })

  it('그 밖의 실패는 ::error + 비-0 종료', () => {
    const s = wf()
    const i = s.indexOf('- name: Apply migrations')
    const step = s.slice(i, s.indexOf('- name: Discord'))
    expect(step, '실패를 세지 않는다').toContain('FAILED=$((FAILED+1))')
    expect(step, '실패해도 exit 하지 않는다 — 잡이 초록으로 끝난다').toMatch(/FAILED" -ne 0[\s\S]*exit 1/)
  })

  it('옛 삼킴 문구가 되살아나지 않았다', () => {
    expect(wfCode(), '`|| echo "… (already applied?)"` 가 돌아왔다 — 그게 거짓 초록의 본체다')
      .not.toMatch(/\|\|\s*echo[^\n]*already applied/)
    // 그리고 머리말이 그 사고를 **계속 기록**하고 있어야 한다(지우면 다음 세션이 이유를 모른다).
    expect(wf(), '사고 기록이 머리말에서 사라졌다').toContain('already applied?')
  })
})

describe('③ DB 이름은 wrangler.toml 이 진실 — 시크릿 드리프트 불가', () => {
  it('시크릿에서 읽지 않는다', () => {
    expect(wf(), 'D1_DATABASE_NAME 시크릿 의존이 되돌아왔다 — 미설정이면 같은 사고가 재발한다')
      .not.toContain('secrets.D1_DATABASE_NAME')
  })

  it('wrangler.toml 의 binding="DB" 블록에서 database_name 을 읽는다', () => {
    const s = wf()
    expect(s, 'wrangler.toml 을 읽지 않는다').toContain("open('wrangler.toml'")
    expect(s, 'DB 바인딩을 특정하지 않는다 — 다른 D1(ads 등)을 집을 수 있다')
      .toContain('binding\\s*=\\s*"DB"')
  })

  it('🔴 그 바인딩이 실제로 존재한다 — 이름이 틀렸던 사고의 본체', () => {
    const toml = readFileSync('wrangler.toml', 'utf8')
    const blk = toml
      .split(/\n(?=\[)/)
      .find((b) => b.trimStart().startsWith('[[d1_databases]]') && /binding\s*=\s*"DB"/.test(b))
    expect(blk, 'wrangler.toml 에 binding="DB" 인 [[d1_databases]] 가 없다 — 워크플로가 이름을 못 읽는다')
      .toBeTruthy()
    const name = blk!.match(/database_name\s*=\s*"([^"]+)"/)?.[1]
    expect(name, 'database_name 이 없다').toBeTruthy()
    // 사고 당시 기본값. 이 이름으로 되돌아가면 "Couldn't find DB" 가 다시 난다.
    expect(name, "본진 D1 이름이 'ur-live' 로 바뀌었다 — 그런 DB 는 없었다(그게 그 사고다)").not.toBe('ur-live')
  })

  it('죽은 헬퍼 참조가 없다 — 없는 파일을 먼저 부르면 의도가 흐려진다', () => {
    const s = wf()
    const m = s.match(/scripts\/ci\/[\w.-]+/g) || []
    for (const path of m) {
      expect(existsSync(path), `${path} 를 부르는데 그 파일이 없다`).toBe(true)
    }
  })
})

describe('④ 이름 오류를 조용히 넘기지 않는다 (preflight)', () => {
  it('DB 를 못 찾으면 ::error + exit 1', () => {
    const s = wf()
    const i = s.indexOf('- name: Preflight')
    expect(i, 'preflight 스텝이 사라졌다').toBeGreaterThan(-1)
    const step = s.slice(i, s.indexOf('- name: Report pending'))
    expect(step, 'wrangler d1 info 로 확인하지 않는다').toContain('wrangler d1 info')
    expect(step, "못 찾은 것을 '이미 적용됨' 과 구분하지 않는다").toContain('::error::')
    expect(step, '못 찾아도 계속 진행한다 — 바로 그 사고다').toContain('exit 1')
  })
})

describe('⑤ repair-schema 는 여기 없다 — main.yml 이 **실제로** 그 일을 한다', () => {
  it('이 워크플로는 repair-schema 를 부르지 않는다 (중복 + 거짓 확신의 출처였다)', () => {
    expect(wf(), 'repair-schema 호출이 되돌아왔다 — 토큰 미설정으로 한 번도 안 돌았고, 있다는 사실만으로 "자동으로 돈다" 는 오판을 만들었다')
      .not.toContain('/api/_internal/repair-schema')
  })

  it('그 일은 main.yml 이 배포 **직후** 한다 (2026-10-06 실측 — 주문 85 소급 기록을 그것이 돌렸다)', () => {
    const main = readRaw('.github/workflows/main.yml')
    expect(main, '배포 후 자동 복구가 사라졌다 — 그러면 이 제거가 기능 상실이 된다')
      .toContain('/api/_internal/repair-schema/auto')
    expect(main.indexOf('/api/_internal/repair-schema/auto'), '복구가 배포보다 앞선다(순서가 뒤집혔다)')
      .toBeGreaterThan(main.indexOf('pages deploy'))
  })
})

describe('🧮 보고가 헛돌지 않는다', () => {
  it('migrations/ 에 실제로 파일이 있다 — 0개면 "보고" 가 늘 빈 숫자다', () => {
    const n = readdirSync('migrations').filter((f) => f.endsWith('.sql')).length
    expect(n, 'migrations/*.sql 이 없다 — 이 워크플로의 전제가 사라졌다').toBeGreaterThan(100)
  })
})
