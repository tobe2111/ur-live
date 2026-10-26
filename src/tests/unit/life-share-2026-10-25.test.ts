/**
 * 🔗 생활 요청 공유 페이지 `/life/q/:token` (2026-10-25 대표 — 커뮤니티에 요청을 올려 업체를 데려온다).
 *
 * 지키는 것: ① 이름·연락처·상세 주소·메모·사진이 공개 값에 **값으로** 안 나간다(마스킹만) ② 토큰은 추측 불가
 * ③ 공개 API 가 그 SSOT 를 지나고 SQL 에서부터 원본을 안 꺼낸다 ④ 마감은 noindex · 사이트맵은 모집 중만
 * ⑤ 공유로 들어온 업체는 그 카테고리를 하면 지역이 달라도 본다.
 * ⚠️ 못 보는 것: 화면 생김새 · 실제 카톡 카드(카카오가 그린다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isShareToken, newShareToken, publicShareView, shareDescription } from '@/shared/home-service-share'
import { buildLifeShareMeta, buildLifeShareNoscript } from '@/worker/utils/life-share-ssr'
import { shouldNoindexMissingEntity } from '@/worker/utils/surface-ssr-meta'

const read = (p: string) => readFileSync(p, 'utf8')

const ROW = {
  category: 'signage',
  details: {
    address: '서울 마포구 망원동', biz: '카페', work: '교체', kind: '돌출 간판', size: '2m 이하', spot: '1층 정면',
    design: '시안부터 필요해요', permit: '대신 해 주세요', budget: '100~300만 원', date: '2026-11-12',
    photos: '/api/media/uploads/user/3/a.webp,/api/media/uploads/user/3/b.webp', memo: '가게이름 망원커피로스터스 010-1234-5678',
  },
  status: 'open', quote_count: 2, max_quotes: 5, created_at: '2026-10-24 03:00:00', name_initial: '김',
}

describe('공개 값 — 마스킹', () => {
  const v = publicShareView(ROW)!
  const all = JSON.stringify(v)
  it('메모·사진 주소는 값으로 안 나간다(장수·유무만)', () => {
    expect(all).not.toContain('망원커피')
    expect(all).not.toContain('1234-5678')
    expect(all).not.toContain('a.webp')
    expect(v.photoCount).toBe(2)
    expect(v.hasMemo).toBe(true)
  })
  it('이름은 첫 글자 + ** · 연락처·주소는 가린 모양', () => {
    expect(v.masked).toEqual({ name: '김**', phone: '010-****-****', address: '망원동 *** ***' })
    // 이름 전체가 넘어와도(SQL 이 바뀌어도) 첫 글자만
    expect(publicShareView({ ...ROW, name_initial: '김철수' })!.masked.name).toBe('김**')
  })
  it('제목은 동·업종·카테고리 — 시안 그대로', () => {
    expect(v.title).toBe('망원동 카페 간판 제작·교체 견적 요청')
    expect(v.seatsLeft).toBe(3)
    expect(v.open).toBe(true)
    expect(v.rows.map((r) => r.label)).toContain('간판 종류')
  })
  it('지역에 번지가 섞여 와도 동까지만', () => {
    const w = publicShareView({ ...ROW, details: { ...ROW.details, address: '서울 마포구 망원동 123-4 2층' } })!
    expect(JSON.stringify(w)).not.toContain('123-4')
  })
  it('자리가 차거나 마감이면 open=false', () => {
    expect(publicShareView({ ...ROW, quote_count: 5 })!.open).toBe(false)
    expect(publicShareView({ ...ROW, status: 'chosen' })!.open).toBe(false)
  })
  it('없는 카테고리는 null(추측해서 그리지 않는다)', () => {
    expect(publicShareView({ ...ROW, category: 'nope' })).toBeNull()
  })
})

describe('토큰', () => {
  it('12자 영숫자 · 번호가 아니다', () => {
    const t = newShareToken()
    expect(isShareToken(t)).toBe(true)
    expect(isShareToken('123')).toBe(false)
    expect(isShareToken('abc/../../x1')).toBe(false)
    expect(new Set(Array.from({ length: 200 }, () => newShareToken())).size).toBe(200)
  })
})

describe('서버 — SQL 에서부터 원본을 안 꺼낸다', () => {
  const routes = read('src/features/home-service/api/home-service.routes.ts')
  const block = routes.slice(routes.indexOf("homeServiceRoutes.get('/share/:token'"), routes.indexOf("homeServiceRoutes.post('/requests'"))
  it('공개 API 가 연락처·상세 주소·이름 전체를 SELECT 하지 않는다', () => {
    expect(block).toContain('publicShareView(')
    expect(block).not.toMatch(/contact_phone|private_details|\bid,|r\.id/)
    expect(block).toContain('SUBSTR(contact_name, 1, 1)')
    expect(block).not.toMatch(/SELECT[^`]*\bcontact_name\b(?!,\s*1)/)
  })
  it('공유로 들어온 업체는 그 카테고리면 본다(proCanSee 에 공유 기록)', () => {
    const pro = read('src/features/home-service/api/home-service-pro.routes.ts')
    expect(pro).toMatch(/home_service_share_access sa WHERE sa\.request_id = r\.id AND sa\.seller_id = \?/)
    expect(pro).toContain('INSERT OR IGNORE INTO home_service_share_access')
  })
})

describe('검색 — 메타·본문·사이트맵', () => {
  const payload = { success: true, data: publicShareView(ROW) }
  it('모집 중은 색인, 마감은 noindex', () => {
    expect(buildLifeShareMeta(payload, 'https://urdeal.kr', '/life/q/AbCdEf123456')!.noindex).toBe(false)
    const closed = { success: true, data: publicShareView({ ...ROW, status: 'chosen' }) }
    expect(buildLifeShareMeta(closed, 'https://urdeal.kr', '/life/q/AbCdEf123456')!.noindex).toBe(true)
  })
  it('설명·본문에도 마스킹이 유지된다', () => {
    const ns = buildLifeShareNoscript(payload)
    expect(ns).toContain('망원동 카페 간판 제작·교체 견적 요청')
    expect(ns + shareDescription(payload.data!)).not.toMatch(/망원커피|1234-5678|a\.webp/)
    expect(ns).toContain('href="/life/request/signage"')
  })
  it('본문이 HTML 을 탈출한다', () => {
    const p = { success: true, data: { ...publicShareView(ROW)!, title: '<script>x</script>' } }
    expect(buildLifeShareNoscript(p)).not.toContain('<script>x')
  })
  it('없는 토큰은 404 + noindex(LIFESHARE 가 엔티티 슬롯)', () => {
    expect(shouldNoindexMissingEntity('LIFESHARE', 'self-fetch-404')).toBe(true)
  })
  it('사이트맵은 모집 중(자리 남음)만', () => {
    const sm = read('src/worker/routes/sitemap.routes.ts')
    expect(sm).toMatch(/WHERE status = 'open' AND quote_count < max_quotes AND share_token IS NOT NULL/)
  })
  it('워커 배선 — 슬롯·메타·본문', () => {
    const w = read('src/worker/index.ts')
    expect(w).toContain("slot: 'LIFESHARE'")
    expect(w).toContain('buildLifeShareMeta(ssrPayload, origin2, url.pathname)')
    expect(w).toContain("ssrSlot === 'LIFESHARE' ? buildLifeShareNoscript(ssrPayload)")
  })
})
