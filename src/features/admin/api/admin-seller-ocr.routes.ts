/**
 * 🔍 어드민 — 제출된 사업자등록증을 읽어 **등록 매장과 나란히** 보여 준다.
 *
 * 2026-09-16 (결재 `docs/decisions/2026-09-16-ocr-license-automation.md` §안전 레일 ①
 * *"1단계는 추출값을 어드민 화면에 입력값과 나란히 띄우기만 한다"*).
 *
 * ## 왜 셀러가 아니라 어드민이 부르나
 * 셀러 쪽 `POST /api/seller/business-registration/ocr-verify` 는 **사장님이 직접 타이핑한 값**과
 * 사진을 맞춘다 — "사진이 본인이 적은 것과 같다" 만 증명한다. 남의 가게 이름으로 낸 위조는
 * 그대로 통과한다. 이 라우트는 **사진 소재지 ↔ 카카오맵에서 고른 매장 주소**를 맞춘다.
 *
 * ## 이 라우트가 하지 않는 것
 * - **승인/반려하지 않는다.** 판정 요약만 돌려준다. 버튼은 사람이 누른다.
 * - 셀러 상태를 바꾸지 않는다(`sellers` UPDATE 0). 보관은 `seller_meta` 뿐이다.
 *
 * 인증: `worker/index.ts` 의 `adminApp` 체인(CORS + IP 화이트리스트 + requireAdmin + audit)을 탄다.
 */

import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'

export const adminSellerOcrRoutes = new Hono<{ Bindings: Env }>()

/** 업로드 원본이 커도 모델에 넣기 전에 막는다 — 큰 파일은 비용만 태우고 잘 읽히지도 않는다. */
const MAX_BYTES = 6 * 1024 * 1024

/**
 * `POST /sellers/:id/business-registration/ocr`
 *
 * 이미 제출된 등록증 이미지를 내려받아 읽고, 등록 매장과 대조한 결과를 돌려준다.
 * 어드민이 버튼을 눌러야만 돈다(자동 실행 없음 — 추론 비용을 사람이 쥔다).
 */
adminSellerOcrRoutes.post('/sellers/:id/business-registration/ocr', async (c) => {
  const idRaw = c.req.param('id')
  if (!idRaw || !/^\d+$/.test(String(idRaw))) {
    return c.json({ success: false, error: 'Invalid ID' }, 400)
  }
  const sellerId = Number(idRaw)

  if (!c.env.AI) {
    // ⚠️ 실패가 아니라 **부재**다. 화면이 "실패했다" 고 하면 운영자가 사진을 다시 받으려 든다.
    return c.json({
      success: false,
      code: 'AI_UNAVAILABLE',
      error: 'AI 바인딩이 없어 자동 읽기를 건너뜁니다 — 사진을 직접 확인해 주세요',
    }, 200)
  }

  const row = await c.env.DB.prepare(
    'SELECT business_registration_image_url FROM sellers WHERE id = ? LIMIT 1',
  ).bind(sellerId).first<{ business_registration_image_url: string | null }>().catch(() => null)

  if (!row) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404)
  const url = (row.business_registration_image_url || '').trim()
  if (!url) return c.json({ success: false, error: '제출된 사업자등록증 이미지가 없습니다' }, 400)

  // 이미지 가져오기 — 우리 R2(`/api/media/*`) 또는 절대 URL
  let bytes: Uint8Array
  try {
    const abs = /^https?:\/\//i.test(url) ? url : new URL(url, c.req.url).toString()
    const res = await fetch(abs)
    if (!res.ok) return c.json({ success: false, error: `이미지를 불러오지 못했습니다 (${res.status})` }, 502)
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) {
      return c.json({ success: false, error: '이미지가 너무 큽니다 (6MB 초과)' }, 413)
    }
    bytes = new Uint8Array(buf)
  } catch {
    return c.json({ success: false, error: '이미지를 불러오지 못했습니다' }, 502)
  }

  const { ocrDocument } = await import('../../../worker/utils/ocr-license')
  const { verifyAndStoreDocument } = await import('../../../worker/utils/document-verify')

  const ocr = await ocrDocument(c.env.AI, bytes, 'business_registration')
  const result = await verifyAndStoreDocument(c.env.DB, sellerId, ocr)

  return c.json({
    success: true,
    verdict: result.verdict,
    summary: result.summary,
    // 나란히 보기 — 화면은 이 두 줄만 그리면 된다
    extracted: {
      bizName: ocr.bizName, address: ocr.address, ownerName: ocr.ownerName,
      bizNumber: ocr.bizNumber, permitDate: ocr.permitDate, fill: ocr.fill,
    },
    store: result.store,
    nameCheck: { verdict: result.name.verdict, reason: result.name.reason },
    addressCheck: { verdict: result.address.verdict, reason: result.address.reason },
    ledger: result.ledger,
    ledgerNote: result.ledgerNote,
    // 🚧 판정은 참고일 뿐 — 승인 버튼은 사람이 누른다(결재 §안전 레일 ②)
    note: '자동 승인·반려는 하지 않습니다. 확인 후 직접 눌러 주세요.',
  })
})

export default adminSellerOcrRoutes
