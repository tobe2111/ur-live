/**
 * 📊 파트너 풀 · 매장후보 풀 구글시트 미러 (2026-11-04 대표 "모두 다 연동하고픈데").
 *
 * 지키는 것:
 * 1. 붙여넣은 주소 → 시트 ID 파싱(주소 전체·ID 만 둘 다), 엉뚱한 값은 거부(매시간 "접근 실패" 만 쌓이지 않게).
 * 2. 헤더와 행 매핑의 **열 수가 같다** — 어긋나면 시트의 열 이름과 값이 한 칸씩 밀린다(에러 없이).
 * 3. 화면에 보이는 행만 — 파트너 풀은 보류(active=0)·병합 패자 제외, 매장후보는 폐업(active=0) 제외.
 * 4. OFFSET 이 아니라 id 커서로 읽는다(풀 40만 행에서 회차마다 앞을 다시 읽지 않게).
 * 5. 값은 RAW 로 쓴다(시트가 `=…` 를 수식으로 실행하지 않게).
 * 6. 알람 레인 등록 + 게이트를 러너가 스스로 본다.
 *
 * 못 막는 것: 실제 구글 API 응답(라이브 동기화 스탬프 `ads_sheets_last_sync_{pool}` 로 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseSheetId, colLetter, parsePoolCursor, cursorForCols, POOL_DEFS, SHEET_POOLS, rowsPerRun } from '@/features/marketing/api/pool-sheets-sync'
import { idsWithMark, normalizeEmailList, markSql, sentDayKST, MARK_DDL } from '@/features/marketing/api/pool-sheets-marks'

const SRC = readFileSync('src/features/marketing/api/pool-sheets-sync.ts', 'utf8')

describe('파트너·매장후보 풀 구글시트 미러', () => {
  it('시트 주소/ID 파싱', () => {
    const id = '13WBekphqiuYmShxfXRm0BPZxkBLsqTlVZyPMWTHfnLE'
    expect(parseSheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id)
    expect(parseSheetId(`  ${id} `)).toBe(id)
    expect(parseSheetId('https://naver.com')).toBeNull()
    expect(parseSheetId('abc')).toBeNull()
    expect(parseSheetId('')).toBeNull()
    expect(parseSheetId(`${id}"; DROP`)).toBeNull()
  })

  it('열 문자', () => {
    expect(colLetter(1)).toBe('A'); expect(colLetter(18)).toBe('R'); expect(colLetter(26)).toBe('Z'); expect(colLetter(27)).toBe('AA')
  })

  it('헤더와 행 매핑의 열 수가 같다', () => {
    for (const p of SHEET_POOLS) {
      const d = POOL_DEFS[p]
      const row = d.toRow({ id: 1 })
      expect(row.length, p).toBe(d.header.length)
      // SELECT 하는 열 수도 매핑이 읽는 것과 같은 세계 — 열 이름이 SELECT 에 다 있어야 한다.
      expect(d.cols.split(',').length, `${p} SELECT 열 수`).toBe(d.header.length)
    }
  })

  it('화면에 보이는 행만 — 보류·병합패자·폐업 제외', () => {
    expect(POOL_DEFS.company.where).toContain('active = 1')
    expect(POOL_DEFS.company.where).toContain('merged_into IS NULL')
    expect(POOL_DEFS.store.where).toContain('active = 1')
  })

  it('id 커서로 읽는다(OFFSET 금지) · RAW 로 쓴다', () => {
    expect(SRC).toMatch(/AND id > \? ORDER BY id ASC LIMIT \?/)
    expect(SRC).not.toMatch(/OFFSET \?/)
    expect(SRC).not.toMatch(/valueInputOption=USER_ENTERED/)
    expect(SRC).toMatch(/valueInputOption=RAW/)
  })

  it('커서 — off 0 이면 lastId 도 0(새 사이클), 깨진 값은 처음부터', () => {
    expect(parsePoolCursor('{"off":0,"total":5,"lastId":99}')).toEqual({ off: 0, total: 5, lastId: 0, cols: 0 })
    expect(parsePoolCursor('{"off":10,"total":50,"lastId":99,"cols":19}')).toEqual({ off: 10, total: 50, lastId: 99, cols: 19 })
    expect(parsePoolCursor('garbage')).toEqual({ off: 0, total: 0, lastId: 0, cols: 0 })
  })

  it('회차당 무게 = 인플루언서 미러(12,000행 × 30열)와 같은 셀 수', () => {
    for (const p of SHEET_POOLS) expect(rowsPerRun(p) * POOL_DEFS[p].header.length).toBeLessThanOrEqual(360_000)
  })

  it('알람 레인 등록 + 게이트를 러너가 본다', async () => {
    const runners = readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8')
    expect(runners).toMatch(/'sheets-sync-pools': \{\s*\n\s*runsPerHour: 1,/)
    const { ALARM_LANES } = await import('@/worker-ads/lane-alarm-runners')
    const r = await ALARM_LANES['sheets-sync-pools']!.run({} as never)
    expect((r as { skipped?: string }).skipped).toBe('gate_off')
  })
  it('차단기 응답(skipped)을 성공으로 옮기지 않는다 · 상태 조회는 차단기 면제', async () => {
    const routes = readFileSync('src/features/marketing/api/admin-pool-sheets.routes.ts', 'utf8')
    expect(routes).toMatch(/j\.skipped === 'budget'/)
    expect(routes).toMatch(/if \(j\.ok && j\.skipped\) return c\.json\(\{ success: false/)
    const { pauseExempt } = await import('@/worker-ads/lane-pause')
    expect(pauseExempt('/__ads/pool-sheets-status')).toBe(true)
    expect(pauseExempt('/__ads/pool-sheets-sync'), '실행은 예산을 따라야 한다').toBe(false)
  })

  describe('✉️ 이메일 보냄 표시 (방법 2)', () => {
    it('마지막 열이 이메일 보냄이고 DB email_sent_at 에서 그린다', () => {
      for (const p of SHEET_POOLS) {
        const d = POOL_DEFS[p]
        expect(d.header[d.header.length - 1]).toBe('이메일 보냄')
        expect(d.cols.trim().endsWith('email_sent_at')).toBe(true)
        expect(d.toRow({ id: 1, email_sent_at: '2026-11-04 16:00:00' }).at(-1)).toBe('2026-11-05') // UTC 16시 = KST 다음날 01시
      }
    })
    it('표시는 줄의 ID 로 찾는다 — 빈 표시·숫자 아닌 ID 는 버린다', () => {
      expect(idsWithMark([[11], [12], ['ID'], [14]], [['o'], [''], ['o'], [' 보냄 ']])).toEqual([11, 14])
      expect(idsWithMark([[1], [2]], undefined)).toEqual([])
      expect(idsWithMark([[5]], [[]])).toEqual([])
    })
    it('붙여넣은 이메일 목록 정규화 — mailto·꺾쇠·여러 개 한 칸·중복', () => {
      const l = normalizeEmailList([['Mailto:A@B.com'], ['<c@d.kr>, e@f.io'], ['not-email'], ['a@b.com']])
      expect(l).toEqual(expect.arrayContaining(['A@B.com', 'a@b.com', 'c@d.kr', 'e@f.io']))
      expect(l).not.toContain('not-email')
      expect(new Set(l).size).toBe(l.length)
    })
    it('저장은 한 방향 · 처음 표시만 · 새 리드는 연락함으로', () => {
      for (const t of ['ad_company_leads', 'store_prospects']) {
        for (const m of ['id', 'email'] as const) {
          const sql = markSql(t, m)
          expect(sql).toMatch(/AND email_sent_at IS NULL/)
          expect(sql).toMatch(/CASE WHEN status = 'new' THEN 'contacted' ELSE status END/)
          expect(sql).toMatch(/json_each\(\?\)/)
          expect(sql).not.toMatch(/email_sent_at = NULL/)
        }
      }
      expect(markSql('ad_company_leads', 'id')).toMatch(/contacted_at = COALESCE/)
      expect(markSql('store_prospects', 'id')).not.toMatch(/contacted_at/) // 매장후보엔 그 컬럼이 없다
    })
    it('이메일 매칭은 부분 인덱스로(전수 스캔 금지)', () => {
      expect(MARK_DDL.join('\n')).toMatch(/ON ad_company_leads\(email\) WHERE email IS NOT NULL/)
      expect(MARK_DDL.join('\n')).toMatch(/ON store_prospects\(email\) WHERE email IS NOT NULL/)
    })
    it('열 수가 바뀌면 사이클을 처음부터(그리드 밖 쓰기 방지)', () => {
      expect(cursorForCols({ off: 20000, total: 84000, lastId: 900, cols: 18 }, 19)).toEqual({ off: 0, total: 0, lastId: 0 })
      expect(cursorForCols({ off: 20000, total: 84000, lastId: 900, cols: 0 }, 19)).toEqual({ off: 0, total: 0, lastId: 0 })
      expect(cursorForCols({ off: 20000, total: 84000, lastId: 900, cols: 19 }, 19)).toEqual({ off: 20000, total: 84000, lastId: 900 })
    })
    it('덮어쓰기 전에 표시를 거둔다 — harvest 가 쓰기 PUT 보다 앞', () => {
      const src = SRC.slice(SRC.indexOf('while (wrote < budget)'))
      expect(src.indexOf('harvestMarks(')).toBeGreaterThan(0)
      expect(src.indexOf('harvestMarks(')).toBeLessThan(src.indexOf("method: 'PUT'"))
      // 꼬리 지우기 전에도 거둔다
      const tail = SRC.slice(SRC.indexOf('if (done) {'))
      expect(tail.indexOf('harvestMarks(')).toBeLessThan(tail.indexOf(':clear'))
    })
    it('KST 날짜 변환', () => {
      expect(sentDayKST('')).toBe('')
      expect(sentDayKST('2026-11-04 03:00:00')).toBe('2026-11-04')
    })
  })
})
