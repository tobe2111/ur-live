/**
 * 🧱 **유어애즈↔유어딜 경계 가드가 실제로 작동하는지** (2026-08-27 대표 지시
 *   *"유어애즈 때문에 유어딜이 부정적인 영향을 받는 일이 없도록 해"*).
 *
 * ## 왜 가드의 가드가 필요한가
 * 이 레포의 반복 사고는 "검사가 실패한다"가 아니라 **"검사가 실패할 수 없다"** 였다. 그래서
 * 여기서는 ① 규칙의 알맹이가 소스에 남아 있는지(문자열) ② **일부러 깨뜨렸을 때 실제로 빨간불이
 * 뜨는지**(실행) 둘 다 본다. ②가 없으면 규칙이 주석으로만 남아도 초록불이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'

const GUARD = 'scripts/check-ads-urdeal-isolation.mjs'
const BASELINE = 'scripts/ads-urdeal-shared-tables.json'
const src = readFileSync(GUARD, 'utf8')

const runGuard = (): { code: number; out: string } => {
  try {
    const out = execFileSync('node', [GUARD, '-s'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: `${err.stdout || ''}${err.stderr || ''}` }
  }
}

describe('R1 · 유어애즈는 유어딜 업무 테이블에 쓰지 않는다', () => {
  it('보호 대상 목록에 돈·회원·상품 축이 살아 있다 — 여기서 빠지면 데이터 사고가 초록불이 된다', () => {
    for (const t of ['orders', 'order_items', 'products', 'sellers', 'users', 'payments', 'ledger_entries'])
      expect(src, `${t} 가 URDEAL_TABLES 에서 빠졌다`).toMatch(new RegExp(`'${t}'`))
  })
  it('쓰기(INSERT/UPDATE/DELETE)만 본다 — 읽기 교차는 정당하다(광고슬롯↔sellers)', () => {
    expect(src).toMatch(/INSERT\\\\s\+.*UPDATE|UPDATE\|DELETE/)
    expect(src).toContain('읽기는 막지 않는다')
  })
})

describe('R2 · 유어딜 DB 에 유어애즈 테이블을 새로 만들지 않는다 (래칫)', () => {
  it('조기 통과 조건이 baseline/이사목록 검사로 남아 있다', () => {
    // 조건을 통째로 `continue` 로 바꾸면(=주입) 이 검사가 걸린다
    expect(src).toMatch(/allowed\.has\(m\[1\]\)[\s\S]{0,60}continue/)
  })
})

describe('R3 · 유어애즈 작업을 유어딜 워커 cron 에 새로 얹지 않는다 (래칫)', () => {
  it('동결 목록 대조가 남아 있다', () => {
    expect(src).toMatch(/knownLanes\.has\(lane\)[\s\S]{0,40}continue/)
  })
  it('cron 이름은 safeCron 구간으로 귀속한다 — 고정 창이면 한 줄에 둘일 때 앞 이름을 붙인다', () => {
    expect(src).toContain('CRON_SPANS')
    expect(src, '다음 safeCron 시작점까지를 몸통으로 잘라야 한다').toMatch(/ms\[i \+ 1\]\?\.index/)
  })
})

describe('가드가 실제로 실패할 수 있다 (실행 검증)', () => {
  it('현재 레포는 통과한다', () => {
    expect(runGuard().code, '기준선이 깨져 있다면 먼저 그것부터 확인할 것').toBe(0)
  })

  it('🩸 동결 목록에서 한 줄만 빼도 빨간불이 뜬다', () => {
    const orig = readFileSync(BASELINE, 'utf8')
    const bak = join(mkdtempSync(join(tmpdir(), 'adsiso-')), 'b.json')
    copyFileSync(BASELINE, bak)
    try {
      const j = JSON.parse(orig) as { tables: string[]; lanes: string[] }
      j.tables = j.tables.filter((t) => t !== 'gov_notices') // 유어딜 DB 에 있는 실제 유어애즈 테이블
      writeFileSync(BASELINE, JSON.stringify(j, null, 2))
      const r = runGuard()
      expect(r.code, '동결에서 뺐는데도 통과했다 = R2 래칫이 헛돈다').not.toBe(0)
      expect(r.out).toContain('gov_notices')
    } finally {
      copyFileSync(bak, BASELINE)
    }
  })

  it('🩸 유어딜 cron 동결 목록을 비우면 빨간불이 뜬다', () => {
    const orig = readFileSync(BASELINE, 'utf8')
    const bak = join(mkdtempSync(join(tmpdir(), 'adsiso-')), 'b.json')
    copyFileSync(BASELINE, bak)
    try {
      const j = JSON.parse(orig) as { tables: string[]; lanes: string[] }
      j.lanes = []
      writeFileSync(BASELINE, JSON.stringify(j, null, 2))
      const r = runGuard()
      expect(r.code, 'cron 동결이 비었는데도 통과했다 = R3 이 헛돈다').not.toBe(0)
      expect(r.out).toContain('outreach-email-drain') // 이름 귀속이 맞는지도 함께 본다
    } finally {
      copyFileSync(bak, BASELINE)
    }
  })
})
