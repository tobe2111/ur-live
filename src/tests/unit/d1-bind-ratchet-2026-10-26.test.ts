/**
 * 🧮 D1 바인딩 한도 래칫 — `check-d1-bind-limit.mjs` 가 실제로 일하는지
 *
 * 왜 있나: 2026-10-26 에 같은 병이 **두 번** 드러났다.
 *   ① 내보냄 도장 — 청크당 `id 100 + 도장 1 = 101` 바인딩. `.catch(() => null)` 이 삼켜 **0건**.
 *   ② `/api/fcfs/active` — `fcfs_enabled='1'` 상품 **395개**를 한 `IN (…)` 에 넣어 두 쿼리가 모두
 *      터지고 `.catch` 가 빈 배열로 삼켜 **`success:true, data:[]`**(라이브 실측). HTTP 200.
 *
 * 🩸 그때 기존 가드가 통과한 이유: *진짜 SQLite*(`node:sqlite`)로 동작 판정을 하는데 **그쪽 한도는
 *   32,766** 이다. 진짜 DB 로 쟀다는 것이 D1 과 같은 제약이라는 뜻이 아니다.
 *
 * ⚠️ 이 시험이 **못 보는 것**: 어떤 자리의 배열이 실제로 100을 넘는지(정적으로 알 수 없다 — 요청
 *   본문·페이지 크기·DB 행 수에 달렸다). 그래서 래칫은 **표면 개수**만 동결하고, 그 자리가 위험한지는
 *   사람이 읽어 판정한다. 동결분 171자리의 감사는 범위 밖이다(인계 §6).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { countBindSites, totalOf, diffAgainst, PH_RE } from '../../../scripts/d1-bind-scan.mjs'
import { readCode } from '../helpers/source-text'

const read = (f: string) => readFileSync(f, 'utf8')
const BASE = JSON.parse(read('scripts/d1-bind-baseline.json')) as {
  _total: number; counts: Record<string, number>
}

describe('① 스캐너가 손으로 만든 IN-목록을 센다 (합성 소스로 동작 판정)', () => {
  const synth = (src: string) => countBindSites(['x.ts'], () => src)

  it('손으로 조립한 자리를 센다', () => {
    expect(synth(`const ph = ids.map(() => '?').join(',')`)).toEqual({ 'x.ts': 1 })
    expect(synth(`const ph = ids.map(()=>'?').join(',')`)).toEqual({ 'x.ts': 1 })
    expect(synth(`const ph = Array(n).fill('?').join(',')`)).toEqual({ 'x.ts': 1 })
  })

  it('한 파일에 여러 자리면 그만큼 센다', () => {
    expect(synth(`a.map(() => '?')\nb.map(() => '?')\nc.map(() => '?')`)).toEqual({ 'x.ts': 3 })
  })

  it('`chunkForBinds` 를 같은 자리에서 쓰면 세지 않는다 — SSOT 로 옮기면 카운트가 줄어든다', () => {
    expect(synth(`for (const ch of chunkForBinds(ids, 1)) {\n  const ph = ch.map(() => '?').join(',')\n}`)).toEqual({})
  })

  it('SSOT 가 멀리 있으면(앞 25줄 밖) 센다 — 다른 함수의 chunkForBinds 에 가려지지 않는다', () => {
    const far = `chunkForBinds(a)\n` + '// 채움\n'.repeat(40) + `const ph = ids.map(() => '?').join(',')`
    expect(synth(far)).toEqual({ 'x.ts': 1 })
  })

  it('`d1-bind-ok` 주석이 그 줄에 있으면 세지 않는다', () => {
    expect(synth(`const ph = ids.map(() => '?').join(',') // d1-bind-ok: ids 는 최대 3개`)).toEqual({})
  })

  it('플레이스홀더가 없는 파일은 결과에 안 들어간다(0건 키 금지)', () => {
    expect(synth(`const q = 'SELECT 1'`)).toEqual({})
  })

  it('읽기가 실패하는 파일은 조용히 건너뛴다(스캔 전체가 죽지 않는다)', () => {
    const counts = countBindSites(['bad.ts', 'ok.ts'], (f: string) => {
      if (f === 'bad.ts') throw new Error('ENOENT')
      return `ids.map(() => '?')`
    })
    expect(counts).toEqual({ 'ok.ts': 1 })
  })
})

describe('② 래칫 셈 — 늘면 잡고 줄면 알린다', () => {
  it('늘어난 파일을 집어낸다', () => {
    const { grew, shrank } = diffAgainst({ 'a.ts': 2 }, { 'a.ts': 1 })
    expect(grew).toEqual([{ file: 'a.ts', from: 1, to: 2 }])
    expect(shrank).toEqual([])
  })
  it('새 파일(동결에 없음)도 늘어난 것으로 센다', () => {
    expect(diffAgainst({ 'new.ts': 1 }, {}).grew).toEqual([{ file: 'new.ts', from: 0, to: 1 }])
  })
  it('줄어든 파일은 통과시키되 알린다', () => {
    const { grew, shrank } = diffAgainst({}, { 'a.ts': 3 })
    expect(grew).toEqual([])
    expect(shrank).toEqual([{ file: 'a.ts', from: 3, to: 0 }])
  })
  it('totalOf 는 파일별 개수의 합이다', () => {
    expect(totalOf({ 'a.ts': 2, 'b.ts': 3 })).toBe(5)
  })
})

describe('③ 동결값이 실제 소스와 맞는다', () => {
  it('베이스라인 총합이 파일별 개수의 합이다', () => {
    expect(BASE._total).toBe(totalOf(BASE.counts))
  })
  it('베이스라인이 비어 있지 않다 — 비면 래칫이 아무것도 안 지킨다', () => {
    expect(BASE._total).toBeGreaterThan(50)
    expect(Object.keys(BASE.counts).length).toBeGreaterThan(20)
  })
})

describe('④ 2026-10-26 에 고친 세 자리가 되돌아오지 않는다', () => {
  it('도장(pool-export-batch)은 chunkForBinds 를 거친다 — 청크 크기를 손으로 적지 않는다', () => {
    const s = read('src/features/marketing/api/pool-export-batch.ts')
    expect(s).toMatch(/chunkForBinds\(clean,\s*1\)/)
    expect(s).not.toMatch(/i \+= 100/)
  })
  it('선착순 두 자리는 표면이 0 이다(승계 판정 · 당첨자 전화 조회)', () => {
    expect(BASE.counts['src/features/group-buy/api/fcfs.routes.ts']).toBeUndefined()
  })
  it('`/api/fcfs/active` 는 활성 필터를 **SQL JOIN** 으로 건다 — 쪼개서 JS 로 다시 정렬하지 않는다', () => {
    const s = read('src/features/group-buy/api/fcfs.routes.ts')
    expect(s).toMatch(/JOIN product_supply_meta mf ON mf\.product_id = p\.id AND mf\.key = 'fcfs_enabled'/)
    expect(s).not.toMatch(/WHERE p\.id IN \(\$\{ph\}\)/)
    // 정렬은 한 글자도 안 바뀐다 — 두 벌로 베끼면 갈린다.
    expect(s).toMatch(/ORDER BY is_demo, p\.created_at DESC/)
  })
  it('승계 판정이 NOT IN 목록을 쓰지 않는다 — 바인딩 1개', () => {
    // 🩸 판정은 **주석 제거본**으로 한다 — 제거를 기록한 내 주석이 `user_id NOT IN` 을 인용하므로
    //   원문을 검사하면 거짓 빨간불이 난다(CLAUDE.md 가 두 번 적어 둔 그 함정). 이 시험의 첫 판이 실제로 그랬다.
    const code = readCode('src/features/group-buy/api/fcfs.routes.ts')
    expect(code).not.toMatch(/user_id NOT IN/)
    expect(code).toMatch(/const winnerSet = new Set\(winnerIds\.map\(String\)\)/)
  })
  it('은퇴한 백업(d1-backup)도 쪼갠다 — 다시 cron 에 꽂혀도 54개 테이블이 안 빈다', () => {
    const s = read('src/worker/cron/d1-backup.ts')
    expect(s).toMatch(/for \(const idChunk of chunkForBinds\(ids\)\)/)
    expect(BASE.counts['src/worker/cron/d1-backup.ts']).toBeUndefined()
  })
})

describe('⑤ 가드 자신이 헛돌 수 없다', () => {
  const guard = read('scripts/check-d1-bind-limit.mjs')
  it('검사 대상 파일이 비면 통과가 아니라 실패다', () => {
    expect(guard).toMatch(/files\.length < 500/)
    expect(guard).toMatch(/조용히 비었다/)
  })
  it('플레이스홀더 0건이면 통과가 아니라 실패다', () => {
    expect(guard).toMatch(/total === 0/)
    expect(guard).toMatch(/헛도는 가드 차단/)
  })
  it('판정 로직은 순수 모듈이고 가드가 그것을 import 한다 — 시험이 스크립트를 실행하지 않는다', () => {
    expect(guard).toMatch(/from '\.\/d1-bind-scan\.mjs'/)
    // 같은 이유로 주석 제거본 — 머리말이 `process.exit` 를 인용한다(그게 분리한 이유라서).
    const scan = readCode('scripts/d1-bind-scan.mjs')
    expect(scan).not.toMatch(/process\.exit|writeFileSync|execSync/)
  })
  it('패턴이 이 레포의 실제 모양을 잡는다(정규식이 낡으면 전부 0건이 된다)', () => {
    expect(PH_RE.test(`ids.map(() => '?').join(',')`)).toBe(true)
  })
})

describe('⑥ 가드가 실제로 돈다 (등록)', () => {
  it('verify.yml 에 등록돼 있다', () => {
    expect(read('.github/workflows/verify.yml')).toMatch(/check-d1-bind-limit\.mjs/)
  })
  it('audit-gate 에 등록돼 있다', () => {
    expect(read('scripts/audit-gate.sh')).toMatch(/check-d1-bind-limit\.mjs/)
  })
})

describe('⑦ 한도 SSOT', () => {
  it('D1_MAX_BINDS 는 100 이고 그 값은 한 곳에만 있다', () => {
    const s = read('src/shared/db/d1-binds.ts')
    expect(s).toMatch(/export const D1_MAX_BINDS = 100/)
    expect(s).toMatch(/99 OK|101/)   // 실측 근거가 머리말에 남아 있다
  })
})
