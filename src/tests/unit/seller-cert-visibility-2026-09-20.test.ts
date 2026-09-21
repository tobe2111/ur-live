/**
 * 🧾 등록증이 어드민·OCR 에 안 보이던 것 (2026-09-20 — E5 실사용에서 발견)
 *
 * 대시보드 매장 등록(`POST /api/seller/stores`, 직접·중개 모두)은 등록증을 `seller_meta.business_cert_url` 에만
 * 적었고, 어드민 승인 목록·상세·OCR 은 `sellers.business_registration_image_url` 컬럼만 읽었다.
 * 09-16 사기 방어("사진을 받아 사람이 심사")가 이 경로에서 통째로 비어 있었다 — 에러 0, 화면엔 "서류 없음".
 *
 * 세 자리를 잰다: ① 등록이 컬럼에도 적는가 ② OCR 이 폴백을 타는가 ③ 어드민 목록·상세가 폴백을 타는가.
 * 못 보는 것: 실제 D1 에서 UPDATE 가 통과하는지(라이브 판정 = 등록 후 어드민 상세에 URL 이 뜨는가).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stripComments } from '../helpers/source-text'
import { resolveSellerCertUrls } from '@/worker/utils/seller-cert-url'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const STORES = read('src/features/seller/api/seller-stores.routes.ts')
const OCR = read('src/features/admin/api/admin-seller-ocr.routes.ts')
const ADMIN = read('src/features/admin/api/admin-sellers.routes.ts')
const FALLBACK = read('src/features/admin/api/admin-sellers/cert-fallback.ts')
const SURFACE = read('src/features/auth/api/seller.routes.ts')
const SESSION = read('src/features/seller/api/seller-registration/session-routes.ts')

describe('① 매장 등록이 등록증 URL 을 컬럼에도 적는다', () => {
  it('POST /stores 가 sellers.business_registration_image_url 을 certUrl 로 채운다 (비어 있을 때만 · best-effort)', () => {
    const at = STORES.indexOf("app.post('/stores'")
    const body = STORES.slice(at, STORES.indexOf("app.post('/stores/:id/close'", at))
    expect(body).toMatch(/UPDATE sellers SET business_registration_image_url = \? WHERE id = \? AND COALESCE\(business_registration_image_url, ''\) = ''/)
    expect(body).toMatch(/\.bind\(certUrl, newSellerId\)\.run\(\)\.catch\(/)
    expect(body).toMatch(/business_cert_url: certUrl/) // meta 는 그대로 진실
  })
})

describe('② SSOT 폴백 — 컬럼 → seller_meta', () => {
  // getSellerMeta 는 ensureSellerMetaTable(run) → SELECT … IN (?) (bind → all) 순서로 부른다
  const fakeDb = (meta: Record<number, Record<string, string>>) => {
    const stmt = (ids: unknown[] = []) => ({
      bind: (...a: unknown[]) => stmt(a),
      run: async () => ({ success: true }),
      first: async () => null,
      all: async () => ({ results: ids.flatMap((id) => Object.entries(meta[Number(id)] || {}).map(([key, value]) => ({ seller_id: Number(id), key, value }))) }),
    })
    return { prepare: () => stmt(), batch: async () => [] } as unknown as import('@cloudflare/workers-types').D1Database
  }
  it('컬럼이 있으면 그대로, 없으면 meta.business_cert_url, 둘 다 없으면 null', async () => {
    const m = await resolveSellerCertUrls(fakeDb({ 2: { business_cert_url: '/api/media/uploads/biz-cert/x.png' } }), [
      { id: 1, business_registration_image_url: '/api/media/col.png' }, { id: 2, business_registration_image_url: null }, { id: 3, business_registration_image_url: '' },
    ])
    expect(m.get(1)).toBe('/api/media/col.png'); expect(m.get(2)).toBe('/api/media/uploads/biz-cert/x.png'); expect(m.get(3)).toBeNull()
  })
})

describe('③ 읽는 쪽 셋이 폴백을 탄다', () => {
  it('OCR 라우트가 컬럼 직접 읽기 대신 resolveSellerCertUrl 을 쓴다', () => {
    expect(OCR).toMatch(/resolveSellerCertUrl\(c\.env\.DB, sellerId, row\.business_registration_image_url\)/)
    expect(OCR).not.toMatch(/url = \(row\.business_registration_image_url \|\| ''\)\.trim\(\)/)
  })
  it('어드민 목록·상세가 cert-fallback 을 부른다', () => {
    expect(ADMIN).toMatch(/m => m\.attachCertUrls\(DB, sellers\)/)
    expect(ADMIN).toMatch(/m => m\.attachCertUrl\(DB, sellerId, seller as Record<string, unknown>\)/)
    expect(FALLBACK).toMatch(/resolveSellerCertUrls\(DB, rows\)/)
    expect(FALLBACK).toMatch(/resolveSellerCertUrl\(DB, Number\(sellerId\)/)
  })
  it('셀러 배너 근거(has_business_cert) 두 곳도 폴백을 탄다 — 아니면 등록증을 냈는데 "사본이 아직 없어요" 가 뜬다', () => {
    expect(SURFACE).toMatch(/has_business_cert: !!\(await import\('\.\.\/\.\.\/\.\.\/worker\/utils\/seller-cert-url'\)/)
    expect(SURFACE).not.toMatch(/has_business_cert: !!row\?\.business_registration_image_url/)
    expect(SESSION).toMatch(/has_business_cert: !!\(await import\('\.\.\/\.\.\/\.\.\/\.\.\/worker\/utils\/seller-cert-url'\)/)
    expect(SESSION).not.toMatch(/has_business_cert: !!seller\.business_registration_image_url/)
  })
  it('OCR 라우트가 모델의 message·raw 를 어드민에게 돌려준다 (S-OCR 실측에서 fill 0 의 이유를 볼 수 없었다)', () => {
    expect(OCR).toMatch(/ocr: \{ ok: ocr\.ok, message: ocr\.message, raw: ocr\.raw \?\? null \}/)
  })
  it('OCR 모델 라이선스 동의 엔드포인트 — 모델은 OCR_MODEL 로 고정, 프롬프트는 agree (5016 실측)', () => {
    expect(OCR).toMatch(/adminSellerOcrRoutes\.post\('\/ai\/agree-ocr-model'/)
    expect(OCR).toMatch(/c\.env\.AI\.run\(OCR_MODEL, \{ prompt: 'agree' \}\)/)
    expect(OCR).not.toMatch(/agree-ocr-model[\s\S]*c\.req\.(json|query)\(/) // 요청 본문으로 모델을 못 고른다
  })
})
