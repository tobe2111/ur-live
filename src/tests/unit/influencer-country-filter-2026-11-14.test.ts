/**
 * 🌏 인플루언서 국가 필터 (2026-11-14 대표 *"유튜브 같은 경우에는 외국인들도 있을텐데 … 필터링을 할 수 있게 해줘"*).
 *
 * 판정: 채널이 밝힌 국가(`country`) + 이름·소개글의 한국어 여부. 라이브 실측 근거는 `shared/ads/influencer-country.ts`.
 * 진짜 SQLite 에 판정 SQL 을 그대로 먹인다(GLOB 의 한글 범위가 실제로 동작하는지까지 본다).
 * ⚠️ 못 보는 것: 화면이 실제로 그 선택지를 그리는지(그려서 봐야 한다) · D1 과 node:sqlite 의 GLOB 차이(둘 다 SQLite 다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { influencerCountryWhere, COUNTRY_FILTER_OPTIONS } from '@/shared/ads/influencer-country'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (s: string) => { run: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[] } }
}

const db = new DatabaseSync(':memory:')
db.exec('CREATE TABLE ad_influencer_leads (id INTEGER PRIMARY KEY, name TEXT, description TEXT, country TEXT)')
const rows: Array<[number, string, string | null, string | null]> = [
  [1, '한량백수의 1박2일', '맛집 여행', 'KR'],          // 한국 표기
  [2, '전국맛집 이장', '노포 맛집', null],              // 미표기 + 한국어 → 한국
  [3, 'zacheats', 'I eat food on camera', null],        // 미표기 + 외국어 → 외국
  [4, 'Boram Tube Vlog [보람튜브 브이로그]', null, 'US'], // 해외 표기 + 한국어 → 해외 거주 한국어
  [5, 'Nails by Deborah LLC', 'nails', 'US'],            // 해외 표기 + 외국어 → 외국
  [6, 'KHO MUKBANG', null, 'JP'],                         // 해외 표기 + 외국어
  [7, 'Daily Seoul', '서울 일상', ''],                   // 빈 문자열 미표기 + 소개만 한국어 → 한국
]
for (const r of rows) db.prepare('INSERT INTO ad_influencer_leads VALUES (?, ?, ?, ?)').run(...r)
const pick = (v: string) => {
  const w = influencerCountryWhere(v)
  if (!w) return null
  return (db.prepare(`SELECT id FROM ad_influencer_leads WHERE ${w.sql} ORDER BY id`).all(...w.binds) as Array<{ id: number }>).map(r => r.id)
}

describe('판정', () => {
  it('한국 = KR 표기 + 미표기 한국어 채널', () => expect(pick('KR')).toEqual([1, 2, 7]))
  it('해외 거주 한국어 채널 = 해외 표기인데 한국어', () => expect(pick('ko_abroad')).toEqual([4]))
  it('외국 채널 = 한국어 아님(해외 표기 또는 미표기)', () => expect(pick('foreign')).toEqual([3, 5, 6]))
  it('국가 코드 = 그 표기만', () => { expect(pick('US')).toEqual([4, 5]); expect(pick('JP')).toEqual([6]) })
  it('세 묶음이 겹치지 않고 전체를 덮는다', () => {
    const all = [...pick('KR')!, ...pick('ko_abroad')!, ...pick('foreign')!].sort()
    expect(all).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('모르는 값은 필터 없음(조용히 0건이 되지 않는다) · 코드는 바인딩으로만', () => {
    expect(influencerCountryWhere('')).toBeNull()
    expect(influencerCountryWhere("KR' OR 1=1 --")).toBeNull()
    expect(influencerCountryWhere('us')).toBeNull()
    expect(influencerCountryWhere('US')).toEqual({ sql: 'country = ?', binds: ['US'] })
  })
  it('화면 선택지는 전부 서버가 받는 값이다', () => {
    for (const o of COUNTRY_FILTER_OPTIONS) expect(influencerCountryWhere(o.value), o.value).not.toBeNull()
  })
})

describe('배선 — 목록·엑셀·CSV 가 같은 판정을 쓴다', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
  it('목록 API 가 country 를 받는다', () => {
    expect(read('src/features/marketing/api/admin-ads-influencers.routes.ts')).toMatch(/influencerCountryWhere\(c\.req\.query\('country'\)\)/)
  })
  it('엑셀 내보내기가 country 를 받아 본문 조회와 남은 수 세기에 모두 건다', () => {
    const r = read('src/features/marketing/api/admin-ads-influencers.routes.ts')
    expect(r).toMatch(/country: c\.req\.query\('country'\) \|\| ''/)
    const e = read('src/features/marketing/api/influencer-pool-export.ts')
    expect((e.match(/\$\{newOnlyFilter\}\$\{countryFilter\}/g) || []).length).toBe(2)
    expect((e.match(/\.\.\.\(cw\?\.binds \|\| \[\]\)/g) || []).length).toBe(2)
  })
  it('화면이 국가 선택을 쿼리와 엑셀 버튼에 넘긴다(CSV 는 같은 쿼리를 쓴다)', () => {
    const page = read('src/pages/admin/AdminInfluencerPoolPage.tsx')
    expect(page).toMatch(/if \(country\) params\.set\('country', country\)/)
    expect(page).toMatch(/<ExcelExportButtons variant="contactable" country=\{country\} \/>/)
    expect(read('src/pages/admin/influencer-pool/ExcelExportButtons.tsx')).toMatch(/&country=\$\{encodeURIComponent\(country\)\}/)
    expect(read('src/pages/admin/influencer-pool/PoolFilters.tsx')).toMatch(/COUNTRY_FILTER_OPTIONS\.map/)
  })
})
