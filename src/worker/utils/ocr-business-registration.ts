/**
 * 🛡️ 2026-05-27 (사용자 결정 — 무료 marginal): 사업자등록증 OCR 자동 추출.
 *
 * Cloudflare Workers AI 무료 한도 (일 10,000 Neurons) 안에서 동작.
 * 모델: @cf/microsoft/resnet-50 또는 @cf/meta/llama-vision (베타) — 사용 가능 모델 따라.
 *
 * 사용:
 *   - 사장님이 사업자등록증 사진 업로드 시 자동 OCR
 *   - 추출된 사업자번호 vs DB 값 자동 비교 → 일치 시 business_registration_status='verified' 자동
 *   - 추출 실패 / 불일치 → admin 수동 검토
 *
 * graceful: env.AI binding 없으면 skip (기존 동작).
 *
 * 사용자 액션 필요:
 *   1. wrangler.toml 에 [[ai]] binding="AI" 추가
 *   2. Cloudflare Dashboard → Workers AI 활성화
 */

export interface OcrExtractResult {
  ok: boolean
  /** 추출된 사업자번호 (10자리 hyphen 제거) */
  businessNumber: string | null
  /** 추출된 대표자명 */
  representativeName: string | null
  /** 추출된 상호 */
  businessName: string | null
  /** 추출된 개업일 (YYYYMMDD) */
  startDate: string | null
  /** 일치도 (0-1) */
  confidence: number
  message: string
  raw?: unknown
}

interface Ai {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>
}

/**
 * 사업자등록증 이미지에서 텍스트 추출 + 핵심 필드 파싱.
 *
 * @param ai env.AI binding (Cloudflare Workers AI)
 * @param imageBytes 이미지 byte array (Uint8Array)
 */
export async function ocrBusinessRegistration(
  ai: Ai | undefined,
  imageBytes: Uint8Array,
): Promise<OcrExtractResult> {
  if (!ai) {
    return { ok: false, businessNumber: null, representativeName: null, businessName: null, startDate: null, confidence: 0, message: 'AI binding 미설정 — skip' }
  }

  try {
    // Cloudflare Workers AI Vision 모델 (LLaMA Vision 베타)
    // 프롬프트로 사업자등록증 핵심 필드 추출 요청
    const response = await ai.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      image: Array.from(imageBytes),
      prompt: `이 한국 사업자등록증 이미지에서 다음 정보를 추출해주세요. JSON 형식으로만 답변하세요.
{
  "business_number": "사업자번호 (XXX-XX-XXXXX 형식)",
  "representative_name": "대표자명",
  "business_name": "상호",
  "start_date": "개업연월일 (YYYY-MM-DD 형식)"
}
필드를 찾을 수 없으면 null 로 표시.`,
      max_tokens: 256,
    } as Record<string, unknown>) as { response?: string; description?: string } | string

    const text = typeof response === 'string' ? response : (response.response || response.description || '')
    if (!text) {
      return { ok: false, businessNumber: null, representativeName: null, businessName: null, startDate: null, confidence: 0, message: 'AI 응답 비어있음' }
    }

    // JSON 추출 — LLM 응답에서 { ... } 패턴 찾기
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) {
      return { ok: false, businessNumber: null, representativeName: null, businessName: null, startDate: null, confidence: 0, message: 'AI 응답 JSON 추출 실패', raw: text }
    }
    let parsed: Record<string, string | null>
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return { ok: false, businessNumber: null, representativeName: null, businessName: null, startDate: null, confidence: 0, message: 'AI JSON parse 실패', raw: text }
    }

    const bizNo = parsed.business_number ? String(parsed.business_number).replace(/-/g, '') : null
    const startDate = parsed.start_date ? String(parsed.start_date).replace(/-/g, '') : null

    // confidence — 핵심 4 필드 중 추출된 수 / 4
    const extracted = [bizNo, parsed.representative_name, parsed.business_name, startDate].filter(v => v && v !== 'null').length
    const confidence = extracted / 4

    return {
      ok: true,
      businessNumber: bizNo && /^\d{10}$/.test(bizNo) ? bizNo : null,
      representativeName: parsed.representative_name && parsed.representative_name !== 'null' ? parsed.representative_name : null,
      businessName: parsed.business_name && parsed.business_name !== 'null' ? parsed.business_name : null,
      startDate: startDate && /^\d{8}$/.test(startDate) ? startDate : null,
      confidence,
      message: confidence >= 0.75 ? '추출 성공' : '일부 필드 누락',
      raw: text,
    }
  } catch (err) {
    return {
      ok: false,
      businessNumber: null,
      representativeName: null,
      businessName: null,
      startDate: null,
      confidence: 0,
      message: `OCR 실패: ${(err as Error).message?.slice(0, 100)}`,
    }
  }
}

/**
 * 추출된 OCR 결과 + DB 값 자동 비교.
 * 모든 필드 일치 시 verified=true (admin 검수 불필요).
 */
export function compareOcrWithDb(
  ocr: OcrExtractResult,
  db: { businessNumber: string; representativeName: string | null; businessStartDate: string | null },
): { autoVerified: boolean; mismatch: string[] } {
  if (!ocr.ok) return { autoVerified: false, mismatch: ['OCR 실패'] }
  const mismatch: string[] = []

  const dbBizNo = db.businessNumber.replace(/-/g, '')
  if (ocr.businessNumber && ocr.businessNumber !== dbBizNo) mismatch.push(`사업자번호: OCR=${ocr.businessNumber} vs DB=${dbBizNo}`)

  if (db.representativeName && ocr.representativeName) {
    const dbName = db.representativeName.trim()
    if (ocr.representativeName.trim() !== dbName) mismatch.push(`대표자: OCR=${ocr.representativeName} vs DB=${dbName}`)
  }

  if (db.businessStartDate && ocr.startDate) {
    const dbDate = db.businessStartDate.replace(/-/g, '')
    if (ocr.startDate !== dbDate) mismatch.push(`개업일: OCR=${ocr.startDate} vs DB=${dbDate}`)
  }

  return {
    autoVerified: mismatch.length === 0 && ocr.confidence >= 0.75,
    mismatch,
  }
}
