/**
 * 🔍 서류 OCR — 사업자등록증 · 영업신고증 두 축.
 *
 * 2026-09-16 (결재 `docs/decisions/2026-09-16-ocr-license-automation.md`,
 * 대표가 Pages `ur-live` production 에 Workers AI 바인딩을 켜며 착수).
 *
 * ## 이 파일이 하는 일은 딱 하나 — **읽기**
 * 사진에서 글자를 뽑아 구조화한다. **판정도 승인도 하지 않는다.**
 * 대조는 `shared/korean-address.ts`(순수 함수), 승인 버튼은 사람이 누른다.
 *
 * ## 🚧 결재가 못 박은 안전 레일 둘 — 이 파일도 그 아래 있다
 * 1. **자동 승인은 게이트 뒤**(`ocr_auto_verify_enabled`, 기본 OFF). 이 파일은 추출만 하고
 *    누가 그 값을 쓸지 결정하지 않는다.
 * 2. **자동 반려는 하지 않는다.** 그래서 이 파일의 실패는 전부 `ok:false` 이고,
 *    호출부는 그것을 "의심스럽다" 가 아니라 **"못 읽었다"** 로 다뤄야 한다.
 *
 * ## ⚠️ AI 바인딩은 optional 이다
 * Pages 는 production / preview 바인딩이 따로인데 **preview 엔 안 붙어 있다**
 * (2026-09-16 API 실측). 없으면 조용히 `ok:false` 로 돌아간다 = 사람이 눈으로 보는 현행 동작.
 * 이건 결함이 아니라 이득이다 — 프리뷰 배포가 추론 비용을 안 태운다.
 *
 * ## 🩸 앞선 코드가 어긴 것 (2026-05-27 작성 → 한 번도 안 돎)
 * `ocr-business-registration.ts` 는 추출값이 맞으면 **게이트 없이**
 * `UPDATE sellers SET business_registration_status='verified'` 를 때렸다.
 * 게다가 비교 대상이 *사장님이 직접 타이핑한 값* 이라 "사진이 본인이 적은 것과 같다" 만 증명한다 —
 * 남의 가게 이름으로 낸 위조는 그대로 통과한다. 그래서 이 파일은 **등록한 매장 주소**와 맞춘다.
 */

import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../types/env'
import { aiText } from './ai-text'

/** 어느 서류인가. 프롬프트와 추출 필드가 갈린다. */
export type DocKind = 'business_registration' | 'business_license'

export const DOC_LABEL: Record<DocKind, string> = {
  business_registration: '사업자등록증',
  business_license: '영업신고증',
}

export interface OcrDocResult {
  ok: boolean
  kind: DocKind
  /** 상호 / 업소명 */
  bizName: string | null
  /** 사업장 / 영업소 소재지 */
  address: string | null
  /** 대표자 · 성명 (등록증 위주) */
  ownerName: string | null
  /** 사업자등록번호 10자리(하이픈 제거) — 등록증만 */
  bizNumber: string | null
  /** 관리번호 `3000000-101-2026-00229` 형태 — 영업신고증만 */
  mgtNo: string | null
  /** 개업연월일 / 신고일 YYYYMMDD */
  permitDate: string | null
  /** 핵심 필드 중 읽힌 비율 0~1 — **정확도가 아니라 충실도다** */
  fill: number
  message: string
  /** 모델 원문 — 어드민이 "왜 이렇게 읽었나" 를 볼 수 있어야 한다 */
  raw?: string
}

/** Workers AI 비전 모델. 바꿀 때는 `fill` 실측을 다시 낼 것. */
export const OCR_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'
/** 빈 응답에 한해 몇 번 더 물어보나 — 2026-09-21 실측(5회 중 2회 빈 응답)으로 1. 예외에는 적용하지 않는다. */
export const OCR_EMPTY_RETRIES = 1

const PROMPTS: Record<DocKind, string> = {
  business_registration: `이 이미지는 대한민국 사업자등록증입니다. 아래 JSON 만 출력하세요. 설명 금지.
{"biz_name":"상호(법인명)","address":"사업장 소재지 전체 주소","owner_name":"대표자 성명","biz_number":"등록번호 XXX-XX-XXXXX","permit_date":"개업연월일 YYYY-MM-DD"}
읽을 수 없는 항목은 null 로 두세요. 추측하지 마세요.`,
  business_license: `이 이미지는 대한민국 영업신고증(또는 영업허가증)입니다. 아래 JSON 만 출력하세요. 설명 금지.
{"biz_name":"업소명(상호)","address":"영업소 소재지 전체 주소","owner_name":"성명(대표자)","mgt_no":"관리번호","permit_date":"신고일(허가일) YYYY-MM-DD"}
읽을 수 없는 항목은 null 로 두세요. 추측하지 마세요.`,
}

function emptyResult(kind: DocKind, message: string, raw?: string): OcrDocResult {
  return {
    ok: false, kind, bizName: null, address: null, ownerName: null,
    bizNumber: null, mgtNo: null, permitDate: null, fill: 0, message, raw,
  }
}

/** `null` 문자열·빈 문자열·`-` 같은 빈 표기를 전부 null 로. */
function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s === 'null' || s === '-' || s === 'N/A' || s === '없음') return null
  return s
}

/**
 * 서류 사진에서 필드를 뽑는다.
 *
 * @param ai `env.AI` — **없으면 조용히 `ok:false`**(현행 동작 유지)
 * @param imageBytes 이미지 바이트
 * @param kind 어느 서류인가
 */
export async function ocrDocument(
  ai: Env['AI'],
  imageBytes: Uint8Array,
  kind: DocKind,
): Promise<OcrDocResult> {
  if (!ai) return emptyResult(kind, 'AI 바인딩이 없어 건너뜁니다 (사람이 확인)')
  if (!imageBytes || imageBytes.length === 0) return emptyResult(kind, '이미지가 비어 있습니다')

  let text = ''
  // 🔁 2026-09-21 (S-OCR 라이브 실측): 같은 이미지에 대한 5회 호출 중 **2회가 빈 응답**이었다(예외도 아니고 산문도 아닌
  //   완전한 빈 문자열). 한 번에 못 읽었다고 `unreadable` 로 끝내면 어드민이 같은 버튼을 다시 눌러야 하고, 게이트가
  //   켜진 뒤엔 정상 서류가 자동 승인 후보에서 조용히 빠진다. **빈 응답에만 1회 재시도** — 예외(쿼터·5016)는
  //   재시도하지 않는다(같은 답이 돌아오고 비용만 든다).
  for (let attempt = 0; attempt < OCR_EMPTY_RETRIES + 1 && !text; attempt += 1) {
    try {
      const res = await ai.run(OCR_MODEL, {
        image: Array.from(imageBytes),
        prompt: PROMPTS[kind],
        max_tokens: 384,
      })
      text = aiText(res)
    } catch (err) {
      // ⚠️ 원문 메시지를 소비자에게 돌려주지 않는다(CLAUDE.md safeError 룰) — 여기선 길이만 자른다
      return emptyResult(kind, `읽기 실패: ${String((err as Error)?.message || '').slice(0, 80)}`)
    }
  }

  if (!text) return emptyResult(kind, `모델이 빈 응답을 돌려줬습니다 (${OCR_EMPTY_RETRIES + 1}회 시도)`)

  const m = text.match(/\{[\s\S]*?\}/)
  if (!m) return emptyResult(kind, '응답에서 JSON 을 찾지 못했습니다', text)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(m[0]) as Record<string, unknown>
  } catch {
    // 🧵 2026-09-21 (S-OCR 실측 8회 중 1회): 모델이 JSON 을 **문자열로 한 번 더 감싸** 돌려줬다 —
    //   `"{\n \"biz_name\": ...}"` 처럼 따옴표가 역슬래시로 이스케이프돼 있어 그대로는 해석이 안 된다.
    //   다 읽어 놓고 `unreadable` 로 버리는 것이 아까우니 이스케이프를 한 겹 벗겨 한 번 더 시도한다.
    try {
      parsed = JSON.parse(m[0].replace(/\\"/g, '"').replace(/\\n/g, '\n')) as Record<string, unknown>
    } catch {
      return emptyResult(kind, 'JSON 을 해석하지 못했습니다', text)
    }
  }

  const bizNumberRaw = clean(parsed.biz_number)
  const bizNumber = bizNumberRaw ? bizNumberRaw.replace(/\D/g, '') : null
  const dateRaw = clean(parsed.permit_date)
  const permitDate = dateRaw ? dateRaw.replace(/\D/g, '') : null

  const result: OcrDocResult = {
    ok: true,
    kind,
    bizName: clean(parsed.biz_name),
    address: clean(parsed.address),
    ownerName: clean(parsed.owner_name),
    bizNumber: bizNumber && /^\d{10}$/.test(bizNumber) ? bizNumber : null,
    mgtNo: clean(parsed.mgt_no),
    permitDate: permitDate && /^\d{8}$/.test(permitDate) ? permitDate : null,
    fill: 0,
    message: '',
    raw: text.slice(0, 1200),
  }

  // 충실도 — 그 서류에서 **기대되는** 필드만 센다(등록증에 관리번호를 기대하면 늘 낮게 나온다)
  const expected: Array<string | null> = kind === 'business_registration'
    ? [result.bizName, result.address, result.ownerName, result.bizNumber]
    : [result.bizName, result.address, result.mgtNo, result.permitDate]
  const got = expected.filter(Boolean).length
  result.fill = got / expected.length
  result.message = got === 0
    ? '항목을 하나도 읽지 못했습니다'
    : result.fill >= 0.75 ? '읽었습니다' : '일부만 읽었습니다'
  if (got === 0) result.ok = false

  return result
}

/**
 * 자동 승인 게이트 — **기본 OFF**.
 *
 * 결재 §안전 레일 ①: 1단계는 추출값을 어드민 화면에 나란히 띄우기만 한다.
 * 이 함수가 `true` 를 돌려주기 전에는 어떤 코드도 `business_registration_status` 를
 * 스스로 `verified` 로 바꾸면 안 된다.
 *
 * ⚠️ 조회 실패는 `false`(= 꺼짐). 게이트는 **못 읽으면 닫히는 쪽**이 안전하다.
 */
export async function isOcrAutoVerifyEnabled(DB: D1Database): Promise<boolean> {
  try {
    const row = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'ocr_auto_verify_enabled' LIMIT 1",
    ).first<{ value: string }>()
    return String(row?.value || '').toLowerCase() === 'true'
  } catch {
    return false
  }
}
