/**
 * 🧾 정산 역발행(매입세금계산서) 게이트웨이 — provider-agnostic SSOT (2026-07-01)
 *
 * 배경: 유어딜(플랫폼)이 사업자 유저 셀러(공급자)에게 정산금을 지급하면, 세법상 셀러가 유어딜 앞으로
 *   매출세금계산서를 발행해야 한다(공급자→공급받는자). 셀러 수백 명이 각자 수기 발행하면 누락/오류/독촉
 *   지옥 → 플랫폼 표준은 **역발행**: 유어딜(공급받는자)이 매입세금계산서 *초안*을 자동 작성해 셀러에게
 *   보내고, 셀러는 **승인 클릭 1번**으로 발행. 카카오 애드핏 = 유니포스트 역발행이 정확히 이 모델.
 *
 * 이 파일은 그 발행 채널을 **한 곳**으로 모은 게이트웨이다(Toss confirm 헬퍼와 같은 "직접 fetch 5벌 금지"
 *   철학). 소비자 정산 코드는 이 함수만 호출하고, 실제 provider(유니포스트/바로빌) 연동은 여기서만 바뀐다.
 *
 * ⚠️ 안전 규칙:
 *   - env 미설정(REVERSE_INVOICE_PROVIDER 미지정) → provider='none' → 항상 skipped. 실 발행 0(cost-0).
 *   - 'stub' → 스테이징 검증용 가짜 성공(외부 호출 없음).
 *   - 'unipost' → 실 API 호출(자격증명 필수). 스펙은 유니포스트 계약 문서 기준으로 아래 adapter 에서 매핑.
 *   - 모든 함수 fail-soft: 발행 실패가 정산(돈) 흐름을 막지 않는다. 호출측이 draft 로 남기고 재시도.
 *   - 금액은 **서버 재계산값만** 사용(클라이언트 신뢰 금지). 호출측이 공급가액/세액을 확정해 전달.
 */

export interface ReverseInvoiceEnv {
  REVERSE_INVOICE_PROVIDER?: string
  UNIPOST_API_URL?: string
  UNIPOST_API_KEY?: string
  UNIPOST_CORP_NUM?: string
  TAX_INVOICE_SENDER_BIZ_NO?: string
}

export type ReverseInvoiceProvider = 'unipost' | 'stub' | 'none'

export interface ReverseInvoiceRequest {
  /** 문서관리번호(멱등키) — settlement id 기반. provider 재요청 시 중복 방지. */
  mgtKey: string
  /** 공급자 = 셀러(사업자 유저). */
  supplierBizNo: string
  supplierName: string
  supplierCeo?: string | null
  supplierAddress?: string | null
  supplierBizType?: string | null
  supplierBizCategory?: string | null
  supplierEmail?: string | null
  /** 금액(서버 확정) — 공급대가 = supply + vat. */
  supplyAmount: number
  vatAmount: number
  totalAmount: number
  /** 작성일자 YYYY-MM-DD. */
  writeDate: string
  /** 품목명 e.g. '유어딜 정산 (2026-06)'. */
  itemName: string
  remark?: string | null
}

export interface ReverseInvoiceResult {
  ok: boolean
  provider: ReverseInvoiceProvider
  /** provider 측 발행/요청 식별자(있으면). */
  providerRef: string | null
  /**
   * requested = 역발행 요청 전송(셀러 승인 대기) / issued = 즉시 발행완료 /
   * skipped = provider 미설정(draft 유지) / failed = 발행 거부/오류.
   */
  status: 'requested' | 'issued' | 'skipped' | 'failed'
  /** 국세청 승인번호(발행완료 시). */
  ntsConfirmNum?: string | null
  error?: string
  skipped?: boolean
}

/** 현재 설정된 provider 판별. 미설정/기타값 → 'none'. */
export function reverseInvoiceProvider(env: ReverseInvoiceEnv | undefined): ReverseInvoiceProvider {
  const p = String(env?.REVERSE_INVOICE_PROVIDER || '').trim().toLowerCase()
  if (p === 'unipost') return 'unipost'
  if (p === 'stub') return 'stub'
  return 'none'
}

/** 실 발행 가능한 provider 가 자격증명까지 갖췄는지. UI 안내/게이팅용. */
export function isReverseInvoiceConfigured(env: ReverseInvoiceEnv | undefined): boolean {
  const p = reverseInvoiceProvider(env)
  if (p === 'stub') return true
  if (p === 'unipost') return !!(env?.UNIPOST_API_URL && env?.UNIPOST_API_KEY)
  return false
}

/** 유어딜(공급받는자) 사업자번호. UNIPOST_CORP_NUM 우선, 없으면 기존 플랫폼 발행자번호 재사용. */
function platformCorpNum(env: ReverseInvoiceEnv | undefined): string {
  return String(env?.UNIPOST_CORP_NUM || env?.TAX_INVOICE_SENDER_BIZ_NO || '').trim()
}

const BIZNO_RE = /^\d{3}-\d{2}-\d{5}$/
/** 하이픈 없는 10자리도 표준 포맷으로 정규화. 형식 불충족이면 null. */
export function normalizeBizNo(raw: string | null | undefined): string | null {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (digits.length !== 10) return null
  const fmt = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  return BIZNO_RE.test(fmt) ? fmt : null
}

/**
 * 역발행 요청. provider 설정에 따라 실제 발행/요청을 수행.
 * ⚠️ 절대 throw 하지 않음(fail-soft) — 항상 ReverseInvoiceResult 반환.
 */
export async function requestReverseInvoice(
  env: ReverseInvoiceEnv | undefined,
  req: ReverseInvoiceRequest,
): Promise<ReverseInvoiceResult> {
  const provider = reverseInvoiceProvider(env)
  if (provider === 'none') {
    return { ok: false, provider, providerRef: null, status: 'skipped', skipped: true, error: 'REVERSE_INVOICE_PROVIDER 미설정' }
  }

  // 공통 검증 — 서버 확정 금액 + 사업자번호 형식.
  const supplierBizNo = normalizeBizNo(req.supplierBizNo)
  const buyerBizNo = normalizeBizNo(platformCorpNum(env))
  if (!supplierBizNo) return { ok: false, provider, providerRef: null, status: 'failed', error: '셀러 사업자등록번호 형식 오류' }
  if (!buyerBizNo) return { ok: false, provider, providerRef: null, status: 'failed', error: '플랫폼 사업자번호(UNIPOST_CORP_NUM) 미설정' }
  if (!(req.totalAmount > 0) || !(req.supplyAmount >= 0) || !(req.vatAmount >= 0)) {
    return { ok: false, provider, providerRef: null, status: 'failed', error: '금액 오류(총액 > 0 필요)' }
  }

  if (provider === 'stub') {
    // 스테이징 검증용 — 외부 호출 없이 '요청됨' 반환(셀러 승인 대기 흐름 테스트).
    return { ok: true, provider, providerRef: `STUB-${req.mgtKey}`, status: 'requested' }
  }

  // provider === 'unipost'
  try {
    return await unipostRequestReverse(env!, { ...req, supplierBizNo, buyerBizNo })
  } catch (e) {
    return { ok: false, provider, providerRef: null, status: 'failed', error: `유니포스트 요청 실패: ${String((e as Error)?.message || e).slice(0, 200)}` }
  }
}

/**
 * 유니포스트 전자세금계산서 역발행 adapter.
 *
 * ⚠️ 유니포스트 실 API 스펙(엔드포인트/필드명/응답 코드)은 계약 문서 기준으로 확정해야 한다.
 *   아래는 일반적인 e-tax ASP 역발행 요청 형태의 스켈레톤 — 스테이징 검증 후 필드 매핑을 고정한다.
 *   (REVERSE_INVOICE_PROVIDER='unipost' + 자격증명이 있을 때만 도달하므로 사고로 발사되지 않음.)
 */
async function unipostRequestReverse(
  env: ReverseInvoiceEnv,
  req: ReverseInvoiceRequest & { supplierBizNo: string; buyerBizNo: string },
): Promise<ReverseInvoiceResult> {
  const url = String(env.UNIPOST_API_URL || '').replace(/\/$/, '')
  const key = String(env.UNIPOST_API_KEY || '')
  if (!url || !key) {
    return { ok: false, provider: 'unipost', providerRef: null, status: 'skipped', skipped: true, error: '유니포스트 자격증명 미설정' }
  }

  // 역발행: 공급자=셀러 / 공급받는자=유어딜 / 발행요청 주체=유어딜(공급받는자).
  const payload = {
    mgtKey: req.mgtKey,                 // 문서관리번호(멱등)
    issueDirection: 'reverse',          // 역발행(공급받는자 작성 → 공급자 승인)
    writeDate: req.writeDate,
    supplier: {                          // 공급자(셀러)
      corpNum: req.supplierBizNo,
      corpName: req.supplierName,
      ceoName: req.supplierCeo || undefined,
      addr: req.supplierAddress || undefined,
      bizType: req.supplierBizType || undefined,
      bizClass: req.supplierBizCategory || undefined,
      email: req.supplierEmail || undefined,
    },
    buyer: {                             // 공급받는자(유어딜)
      corpNum: req.buyerBizNo,
    },
    amount: {
      supplyCostTotal: req.supplyAmount, // 공급가액
      taxTotal: req.vatAmount,           // 세액
      totalAmount: req.totalAmount,      // 합계
    },
    items: [
      { itemName: req.itemName, supplyCost: req.supplyAmount, tax: req.vatAmount },
    ],
    remark: req.remark || undefined,
  }

  const res = await fetch(`${url}/etax/reverse-issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    code?: number | string; success?: boolean; message?: string
    mgtKey?: string; invoiceKey?: string; ntsConfirmNum?: string; status?: string
  }

  const okFlag = res.ok && (data.success === true || data.code === 1 || String(data.code) === 'SUCCESS')
  if (!okFlag) {
    return { ok: false, provider: 'unipost', providerRef: data.invoiceKey || null, status: 'failed', error: (data.message || `HTTP ${res.status}`).slice(0, 200) }
  }
  // 역발행은 보통 '요청 전송(셀러 승인 대기)' 이 기본. 즉시 발행되는 계약이면 status='issued'.
  const issued = String(data.status || '').toUpperCase() === 'ISSUED' || !!data.ntsConfirmNum
  return {
    ok: true,
    provider: 'unipost',
    providerRef: data.invoiceKey || data.mgtKey || req.mgtKey,
    status: issued ? 'issued' : 'requested',
    ntsConfirmNum: data.ntsConfirmNum || null,
  }
}

/**
 * 역발행 상태 조회(발행완료 여부 폴링용). fail-soft.
 * provider 미설정/미지원이면 skipped.
 */
export async function getReverseInvoiceStatus(
  env: ReverseInvoiceEnv | undefined,
  providerRef: string,
): Promise<{ ok: boolean; status: 'requested' | 'issued' | 'failed' | 'unknown'; ntsConfirmNum?: string | null; skipped?: boolean }> {
  const provider = reverseInvoiceProvider(env)
  if (provider === 'none') return { ok: false, status: 'unknown', skipped: true }
  if (provider === 'stub') return { ok: true, status: 'issued', ntsConfirmNum: null }
  try {
    const url = String(env?.UNIPOST_API_URL || '').replace(/\/$/, '')
    const key = String(env?.UNIPOST_API_KEY || '')
    if (!url || !key) return { ok: false, status: 'unknown', skipped: true }
    const res = await fetch(`${url}/etax/status?ref=${encodeURIComponent(providerRef)}`, {
      headers: { 'Authorization': `Bearer ${key}` },
    })
    const data = (await res.json().catch(() => ({}))) as { status?: string; ntsConfirmNum?: string }
    const s = String(data.status || '').toUpperCase()
    if (s === 'ISSUED' || data.ntsConfirmNum) return { ok: true, status: 'issued', ntsConfirmNum: data.ntsConfirmNum || null }
    if (s === 'FAILED' || s === 'REJECTED') return { ok: true, status: 'failed' }
    return { ok: true, status: 'requested' }
  } catch {
    return { ok: false, status: 'unknown' }
  }
}
