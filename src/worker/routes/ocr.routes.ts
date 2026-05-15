/**
 * 🛡️ 2026-05-15: Workers AI 메뉴 OCR — 셀러가 메뉴판 사진만 올리면 메뉴/가격 자동 추출.
 *
 * - POST /api/ocr/menu  (multipart: image=File)
 * - 모델: @cf/llava-1.5-7b-hf (vision, 무료 10K req/day)
 * - AI binding 미설정 시 graceful: { success: false, fallback: 'manual', reason: 'ai_unavailable' }
 *
 * 클라이언트는 결과를 form 에 자동 입력 (수정 가능). 등록 마찰 3분 → 30초.
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAuth } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'

interface AIEnv {
  AI?: {
    run: (model: string, input: { image: number[]; prompt: string; max_tokens?: number }) => Promise<{ description?: string; response?: string }>
  }
}

const ocrRoutes = new Hono<{ Bindings: Env }>()

// 메뉴 추출 prompt — JSON 으로 강제하여 파싱 가능
const PROMPT = `Look at this Korean restaurant menu image. Extract menu items and prices.
Respond ONLY with valid JSON in this exact format:
{"name":"가게/대표 메뉴 이름","items":[{"menu":"메뉴명","price":12000}],"suggested_price":15000}

Rules:
- "name" should be the most prominent dish or restaurant name
- "items" max 10 entries, prices in KRW (number, no commas/currency)
- "suggested_price" is the median menu price for group-buy default
- If image is unclear or not a menu, return {"name":"","items":[],"suggested_price":0}`

ocrRoutes.post(
  '/menu',
  rateLimit({ action: 'ocr_menu', max: 10, windowSec: 300 }),
  requireAuth(),
  async (c) => {
    const ai = (c.env as Env & AIEnv).AI
    if (!ai) {
      return c.json({
        success: false,
        fallback: 'manual',
        reason: 'ai_unavailable',
        message: 'OCR 서비스가 일시 비활성화. 메뉴/가격을 직접 입력해주세요.',
      }, 200)  // 200 으로 graceful — 클라가 fallback UX 보여줌
    }

    let formData: FormData
    try {
      formData = await c.req.formData()
    } catch {
      return c.json({ success: false, error: '잘못된 요청 (multipart 필요)' }, 400)
    }

    const file = formData.get('image') as File | null
    if (!file || !(file instanceof File)) {
      return c.json({ success: false, error: 'image 파일 필요' }, 400)
    }
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ success: false, error: '5MB 이하 이미지만 가능' }, 400)
    }
    if (!/^image\//.test(file.type)) {
      return c.json({ success: false, error: '이미지 파일만 가능' }, 400)
    }

    try {
      const buf = await file.arrayBuffer()
      const bytes = Array.from(new Uint8Array(buf))

      const result = await ai.run('@cf/llava-1.5-7b-hf', {
        image: bytes,
        prompt: PROMPT,
        max_tokens: 512,
      })

      const text = (result.description || result.response || '').trim()
      // JSON 추출 (모델이 가끔 prose 함께 반환)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return c.json({
          success: false,
          fallback: 'manual',
          reason: 'parse_failed',
          message: 'OCR 결과 파싱 실패. 직접 입력해주세요.',
          raw: text.slice(0, 300),
        }, 200)
      }

      let parsed: { name?: string; items?: Array<{ menu?: string; price?: number }>; suggested_price?: number }
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        return c.json({
          success: false,
          fallback: 'manual',
          reason: 'invalid_json',
          message: 'OCR 결과 JSON 오류. 직접 입력해주세요.',
        }, 200)
      }

      // sanitize
      const items = (parsed.items || [])
        .filter(i => i.menu && typeof i.menu === 'string' && Number.isFinite(i.price) && (i.price ?? 0) > 0 && (i.price ?? 0) < 1_000_000)
        .slice(0, 10)
      const name = (parsed.name || '').toString().slice(0, 100)
      const suggestedPrice = Number(parsed.suggested_price)
      const validSuggested = Number.isFinite(suggestedPrice) && suggestedPrice > 0 && suggestedPrice < 1_000_000
        ? Math.round(suggestedPrice)
        : items.length > 0
          ? Math.round(items.map(i => i.price!).sort((a, b) => a - b)[Math.floor(items.length / 2)])
          : 0

      return c.json({
        success: true,
        data: {
          name,
          items,
          suggested_price: validSuggested,
        },
      })
    } catch (err) {
      console.error('[ocr/menu]', err)
      return c.json({
        success: false,
        fallback: 'manual',
        reason: 'inference_failed',
        message: 'OCR 처리 실패. 직접 입력해주세요.',
      }, 200)
    }
  }
)

export { ocrRoutes }
