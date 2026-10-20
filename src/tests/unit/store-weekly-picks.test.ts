/**
 * 🗓️ 결재 store-acquisition-pipeline(2026-09-08 승인) — 이번 주 영입 N곳 · 제안 문구 · 배선 계약.
 *   못 막는 것: D1 실제 선정 SQL 결과(통합). 그건 배포 후 어드민 패널에 20곳이 뜨는지로 판정(E4).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { weekKeyKST, trackerOf, clampWeeklyConfig, WEEKLY_N_DEFAULT } from '@/features/marketing/api/store-weekly-picks'
import { proposalDraft, voucherExampleFor, REGISTER_URL } from '@/features/marketing/api/store-proposal'
import { stripComments as codeOnly } from '../helpers/source-text'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('weekKeyKST — 주 키는 KST 월요일', () => {
  it('KST 월요일 00:00 직후와 일요일 23:59 는 다른 주, 같은 주 화~일은 같은 월요일', () => {
    // 2026-09-08(화) 04:18 UTC = 13:18 KST → 그 주 월요일 2026-09-07
    expect(weekKeyKST(new Date('2026-09-08T04:18:00Z'))).toBe('2026-09-07')
    // 2026-09-13(일) 14:59 UTC = 23:59 KST 일요일 → 아직 09-07 주
    expect(weekKeyKST(new Date('2026-09-13T14:59:00Z'))).toBe('2026-09-07')
    // 2026-09-13(일) 15:00 UTC = 09-14(월) 00:00 KST → 새 주
    expect(weekKeyKST(new Date('2026-09-13T15:00:00Z'))).toBe('2026-09-14')
    // UTC 로는 아직 일요일인데 KST 는 월요일인 경계 — UTC 기준으로 계산하면 틀린다
    expect(weekKeyKST(new Date('2026-09-06T16:00:00Z'))).toBe('2026-09-07')
  })
})

describe('trackerOf — 추적표 집계', () => {
  it('new 만 미접촉, 관심/입점/거절은 응답, 보류는 접촉이지만 응답 아님', () => {
    const t = trackerOf([{ status: 'new' }, { status: 'contacted' }, { status: 'interested' }, { status: 'onboarded' }, { status: 'rejected' }, { status: 'hold' }])
    expect(t).toEqual({ total: 6, contacted: 5, responded: 3, interested: 1, onboarded: 1, rejected: 1, hold: 1 })
  })
})

describe('clampWeeklyConfig — 기본 N=20(결재 기본안), 1~100 클램프', () => {
  it('기본값과 클램프', () => {
    expect(WEEKLY_N_DEFAULT).toBe(20)
    expect(clampWeeklyConfig(null).n).toBe(20)
    expect(clampWeeklyConfig({ n: 0 }).n).toBe(20)
    expect(clampWeeklyConfig({ n: 999 }).n).toBe(100)
    expect(clampWeeklyConfig({ n: '7', categories: ['일반음식점', 3, ' 미용업 '], regions: 'x' })).toEqual({ n: 7, categories: ['일반음식점', '미용업'], regions: [] })
  })
})

describe('proposalDraft — 결재 요구: 이용권 예시 · 수수료 채널 안내 · 등록 링크 · 허위 0', () => {
  const store = { id: 42, biz_name: '행복분식', category: '일반음식점', region: '수원시 팔달구', apv_perm_ymd: '20260901', is_new_open: 1 }
  const d = proposalDraft(store, { platformPctDirect: 10, platformPct: 5 })
  it('매장 이름·지역·이용권 예시·두 채널 요율·등록 링크가 본문에 있다', () => {
    expect(d.subject).toContain('행복분식')
    expect(d.body).toContain('행복분식')
    expect(d.body).toContain('수원시 팔달구')
    expect(d.body).toContain(voucherExampleFor('일반음식점'))
    expect(d.body).toMatch(/직접 등록.*10%/)
    expect(d.body).toMatch(/대신하면 5%/)
    expect(d.body).toContain(`${REGISTER_URL}?ref=store-42`)
    expect(d.register_url).toBe(`${REGISTER_URL}?ref=store-42`)
    expect(d.body).toContain('2026.09.01 개업')
  })
  it('요율은 인자를 따른다(하드코딩 아님) — 어드민에서 바꾸면 문구도 바뀐다', () => {
    const d2 = proposalDraft(store, { platformPctDirect: 12, platformPct: 6 })
    expect(d2.body).toMatch(/12%/)
    expect(d2.body).toMatch(/6%/)
    expect(d2.sms).toContain('6~12%')
  })
  it('개업 정보가 없으면 개업 문장을 넣지 않는다(허위 0)', () => {
    const d3 = proposalDraft({ id: 1, biz_name: '무명', category: null, region: null }, { platformPctDirect: 10, platformPct: 5 })
    expect(d3.body).not.toContain('개업')
    expect(d3.body).toContain(voucherExampleFor(null))
  })
  it('문자는 한 줄이고 등록 링크를 담는다', () => {
    expect(d.sms).not.toContain('\n')
    expect(d.sms).toContain(REGISTER_URL)
  })
})

describe('배선 계약', () => {
  it("라우트: GET /weekly · PATCH /weekly/config · GET /:id/proposal 이 있고, GET '/:id'(한 세그먼트) 가 없어 'weekly' 가 id 로 잡히지 않는다", () => {
    const src = codeOnly(read('src/features/marketing/api/store-prospects.routes.ts'))
    expect(src).toContain("app.get('/weekly'")
    expect(src).toContain("app.patch('/weekly/config'")
    expect(src).toContain("app.get('/:id/proposal'")
    // 한 세그먼트 GET '/:id' 가 생기면 그보다 앞에 '/weekly' 를 두어야 한다 — 지금은 존재 자체가 없다.
    expect(src).not.toMatch(/app\.get\(\s*'\/:id'\s*,/)
    // 요율은 리드 파일 밖(store-proposal.ts)에서 메인 DB 를 읽는다 — 이 파일에 bare env.DB 가 있으면 ads-leads-db R1 이 빨갛다
    expect(src).toContain('loadProposalRates(c.env)')
    expect(src.replace(/adsLeadsDb\(c\.env\)/g, '')).not.toMatch(/(?<![.\w])(?:c\.)?env\.DB\b/)
  })
  it('어드민 매장 후보 페이지가 WeeklyPicksPanel 을 그린다 · 패널은 자동 발송 코드가 없다', () => {
    const page = codeOnly(read('src/pages/admin/AdminStoreProspectsPage.tsx'))
    expect(page).toMatch(/<WeeklyPicksPanel\b/)
    const panel = codeOnly(read('src/pages/admin/store-prospects/WeeklyPicksPanel.tsx'))
    expect(panel).not.toMatch(/outreach-send|api\.post\([^)]*send/)
    const mod = codeOnly(read('src/features/marketing/api/store-weekly-picks.ts'))
    expect(mod).not.toMatch(/fetch\(|sendEmail|sendSms|outreach-send/)
  })
})
