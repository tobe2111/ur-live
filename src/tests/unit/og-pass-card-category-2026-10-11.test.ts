/**
 * 🔗 이용권 공유 미리보기 — 카테고리로 거르지 않는다 (2026-10-11 라이브 실측)
 *
 * `/api/og/group-buy/:id` 가 옛 카테고리 7종만 받아, 그 밖의 이용권(2917 'lifestyle')은
 * 카톡 미리보기 사진이 404 로 비었다. 에러가 없어 공유해 본 사람만 안다.
 * ⚠️ 못 보는 것: 카카오가 그 그림을 실제로 그리는지(사진 원본으로 302 되는 경로는 JPEG 라 안전).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/worker/routes/og-image.routes.ts', 'utf8')
const block = src.slice(src.indexOf("ogRoutes.get('/group-buy/:id'"))

describe('이용권 공유 카드', () => {
  it('상품 조회가 카테고리 목록으로 거르지 않는다', () => {
    const sql = block.slice(block.indexOf('SELECT id, name'), block.indexOf('.bind(id)'))
    expect(sql).toContain('WHERE id = ?')
    expect(sql).not.toMatch(/category\s+IN/)
  })
  it('사진을 못 박으면 사진 원본으로 보낸다(카톡이 그릴 수 있는 형식)', () => {
    expect(block).toMatch(/if \(!photoUri && photoAbs\) return c\.redirect\(photoAbs, 302\)/)
  })
})

describe('발송 서버 IP 측정 엔드포인트', () => {
  const s = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
  const b = s.slice(s.indexOf("get('/alimtalk-egress-ip'"), s.indexOf('// ── 🚦 2026-07-05'))
  it('super_admin 만 — 읽기 전용 측정', () => {
    expect(b).toMatch(/admin\?\.role !== 'super_admin'\) return c\.json\(\{[^}]*\}, 403\)/)
    expect(b).not.toMatch(/INSERT|UPDATE|DELETE/)
  })
  it('Cloudflare 밖의 반향 서비스로 잰다(Cloudflare 안쪽 주소를 재면 의미가 없다)', () => {
    expect(b).toContain('checkip.amazonaws.com')
    expect(b).not.toContain('cdn-cgi/trace')
  })
})
