/**
 * 🌏 2026-11-04 대표 *"사람들이 대부분 처음 진입하는걸텐데 캐시 데이터베이스가 의미가 있어? … 데이터가 느릴 때 많이 느리던데"*
 *
 * 실측: 한국 손님은 홍콩·도쿄·LA 데이터센터로 붙고(서울 0건 — 1주 RUM), DB 원본은 미국 동부다. 캐시가 빈 요청은
 *   **차례로 묻는 횟수 × 약 0.2초**가 그대로 체감이다. 그래서 첫 진입 화면의 "차례 묻기"를 줄였다:
 *   ① 내 이용권 — 선물 표 확인(DDL 2문장)이 사본 세션 때문에 **매 요청 미국 원본**으로 갔다 → 원본 기준 메모(`dbKey`) · 선물 두 조회 나란히
 *   ② 찜 — 목록과 개수 나란히 ③ 유어샵 대시보드 — 가게 없는 손님의 이메일 매칭 두 번을 첫 물결에
 *   ④ 실사용 표본 — 한국 손님의 DB 답 지역(원본/사본)을 `D1` 표본으로(사본이 정말 가까이서 답하는지 판정용)
 * ⚠️ 못 보는 것: 실제 한국 왕복 시간(배포 뒤 어드민 vitals `D1` 표본으로 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ensureVoucherGiftTable } from '@/worker/utils/voucher-gift'
import { publicReadDb } from '@/worker/utils/d1-read-replica'
import { d1ServedSample } from '@/lib/web-vitals-report'
import { D1_SAMPLE_PAGE } from '@/worker/routes/analytics.routes'
import { stripComments } from '../helpers/source-text'

const code = (f: string) => stripComments(readFileSync(f, 'utf8'))

describe('① 내 이용권 — 사본 세션이 와도 선물 표 확인은 isolate 당 한 번', () => {
  it('요청마다 새 세션 객체여도 DDL 은 처음 한 번만 원본으로', async () => {
    let ddl = 0
    const stmt = { run: async () => { ddl++; return {} } }
    const primary = { prepare: () => stmt, withSession: () => ({ prepare: () => stmt }) } as unknown as D1Database
    await ensureVoucherGiftTable(publicReadDb(primary))
    await ensureVoucherGiftTable(publicReadDb(primary)) // 다른 세션 객체
    await ensureVoucherGiftTable(primary)
    expect(ddl, '세션마다 DDL 이 다시 나가면 매 요청 미국 원본 왕복 +2').toBe(2) // CREATE TABLE + CREATE INDEX 한 번씩
  })
  it('선물 두 조회는 나란히', () => {
    expect(code('src/worker/utils/voucher-gift.ts')).toContain('const [{ results: pend }, { results: sent }] = await Promise.all([pendP, sentP])')
  })
})

describe('② 찜 · ③ 유어샵 대시보드 — 무관한 조회는 같은 물결에', () => {
  it('찜 개수는 목록과 나란히 출발한다', () => {
    const s = code('src/features/wishlists/api/wishlists.routes.ts')
    expect(s.indexOf('const countP = DB.prepare(')).toBeGreaterThan(0)
    expect(s.indexOf('const countP = DB.prepare(')).toBeLessThan(s.indexOf('results = (await DB.prepare(listSql('))
    expect(s).toContain('const countResult = await countP;')
  })
  it('가게 없는 손님의 이메일 매칭은 첫 Promise.all 안에서 묻는다(차례 두 번 → 0)', () => {
    const s = code('src/worker/routes/curator.routes.ts')
    expect(s).toMatch(/recentR, emailSeller0\] = await Promise\.all\(/)
    expect(s).toContain('linkedSeller = emailSeller0')
    expect(s).not.toContain("const u = await DB.prepare('SELECT email FROM users WHERE id = ?')")
  })
})

describe('④ 한국 손님의 DB 답 지역 표본', () => {
  it('Server-Timing d1 이 붙은 /api 응답 하나만 · 모양이 서버 허용식과 같다', () => {
    const s = d1ServedSample([
      { name: 'https://urdeal.kr/assets/a.js', requestStart: 0, responseEnd: 5 },
      { name: 'https://urdeal.kr/api/sections', requestStart: 10, responseEnd: 230, serverTiming: [{ name: 'd1', description: 'replica:APAC' }] },
    ], 'HKG')
    expect(s).toEqual({ value: 220, page: 'd1:replica:APAC@HKG' })
    expect(D1_SAMPLE_PAGE.test(s!.page)).toBe(true)
    expect(d1ServedSample([{ name: '/api/x', requestStart: 0, responseEnd: 1, serverTiming: [{ name: 'd1', description: '<script>' }] }], 'HKG')).toBeNull()
    expect(D1_SAMPLE_PAGE.test('d1:replica:APAC@hkg')).toBe(false)
  })
  it('홈 섹션이 Server-Timing 으로 내보낸다', () => {
    expect(code('src/features/sections/api/sections.routes.ts')).toContain("if (d1Served) c.header('Server-Timing', `d1;desc=\"${d1Served}\"`, { append: true });")
  })
})
