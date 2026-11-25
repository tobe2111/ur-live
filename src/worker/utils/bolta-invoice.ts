/**
 * 🧾 볼타(Bolta) 전자세금계산서 **정발행** 어댑터 — 매장 수수료 세금계산서 (2026-11-25 대표 *"일단 볼타 서비스를 쓸까 해"*)
 *
 * 초안은 `fee-tax-invoice.ts` 가 매월 1일 만든다. 이 파일은 그 초안 한 장을 볼타에 보내는 문 하나다.
 *
 * ## 볼타 API (docs.bolta.io — 이 작업 환경에선 프록시 차단으로 직접 못 열어 검색 요약으로 확인, 2026-11-25)
 * - `POST https://xapi.bolta.io/v1/taxInvoices/issue` · 인증 HTTP Basic(사용자명 = API 키, 비밀번호 없음)
 * - 중복 방지 헤더 `Bolta-Client-Reference-Id` — 같은 값을 다시 보내면 400 INVALID_REQUEST(= 이미 접수)
 * - 본문: date · purpose(RECEIPT 영수 / CLAIM 청구) · taxType(TAXABLE) · supplier · supplied(각 identificationNumber …) · items[{name, supplyCost, tax}]
 * - 응답 `issuanceKey`(접수 번호) — 국세청 결과는 웹훅·조회 API 로 온다(아직 안 붙였다 → 상태 'requested')
 * - 테스트 키(`test_` 로 시작)는 모든 발행을 **가상으로** 처리한다 → 대표가 테스트 키를 넣고 어드민에서 한 장 보내 보면
 *   필드 이름이 틀렸는지 볼타 오류 문구로 바로 드러난다(아래 `error` 에 원문을 싣는다).
 * - 정발행에는 공급자(유어딜) 공동인증서 등록이 필요 — 대표가 볼타 화면에서 한 번.
 *
 * ⚠️ 확인 못 한 것: supplier/supplied 안의 상호·대표자·담당자 이메일 필드 이름. 지금 이름은 추정이다(`organizationName`·
 *   `representativeName`·`manager.email`) — 테스트 키 시험에서 오류가 나면 여기 한 곳만 고친다.
 * 영수(RECEIPT): 수수료는 정산금에서 이미 떼었다(받은 돈) → 청구가 아니라 영수.
 * 키 위치: 환경변수 `BOLTA_API_KEY` 우선, 없으면 `platform_settings.bolta_api_key`(어드민 설정 화면 — Cloudflare 토큰과 같은 칸).
 * 돈을 옮기지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { COMPANY } from '../../shared/company-info'
import type { FeeInvoiceRow } from './fee-tax-invoice'

export const BOLTA_ISSUE_URL = 'https://xapi.bolta.io/v1/taxInvoices/issue'

export async function resolveBoltaKey(DB: D1Database, env: { BOLTA_API_KEY?: string } | undefined): Promise<string | null> {
  const fromEnv = String(env?.BOLTA_API_KEY || '').trim()
  if (fromEnv) return fromEnv
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'bolta_api_key' LIMIT 1").first<{ value: string }>().catch(() => null)
  const v = String(row?.value || '').trim()
  return v || null
}

/** 순수 — 초안 한 장 → 볼타 요청 본문. */
export function boltaIssueBody(r: FeeInvoiceRow): Record<string, unknown> {
  const [y, m] = r.period.split('-').map(Number)
  return {
    date: r.write_date,
    purpose: 'RECEIPT',
    taxType: 'TAXABLE',
    supplier: {
      identificationNumber: COMPANY.bizRegNoDigits,
      organizationName: COMPANY.legalName,
      representativeName: COMPANY.ceo,
      address: COMPANY.address,
      manager: { email: COMPANY.email },
    },
    supplied: {
      identificationNumber: r.buyer_biz_no,
      organizationName: r.buyer_name,
      representativeName: r.buyer_ceo,
      address: r.buyer_address,
      managers: r.buyer_email ? [{ email: r.buyer_email }] : [],
    },
    items: [{ date: r.write_date, name: `유어딜 중개수수료 (${y}년 ${m}월)`, supplyCost: r.supply_amount, tax: r.vat_amount }],
  }
}

/** 순수 — HTTP Basic(API 키 + ':'). */
export function boltaAuthHeader(key: string): string {
  return `Basic ${btoa(`${key}:`)}`
}

export interface BoltaIssueResult { ok: boolean; issuanceKey?: string; test?: boolean; error?: string; status?: number }

/** 한 장 발행 요청. 실패해도 던지지 않는다(호출부가 초안으로 남긴다). */
export async function issueFeeInvoiceViaBolta(key: string, r: FeeInvoiceRow, fetchImpl: typeof fetch = fetch): Promise<BoltaIssueResult> {
  if (!r.buyer_biz_no) return { ok: false, error: '매장 사업자번호가 없습니다' }
  try {
    const res = await fetchImpl(BOLTA_ISSUE_URL, {
      method: 'POST',
      headers: {
        Authorization: boltaAuthHeader(key),
        'Content-Type': 'application/json',
        'Bolta-Client-Reference-Id': `urdeal-fee-${r.seller_id}-${r.period}`,
      },
      body: JSON.stringify(boltaIssueBody(r)),
    })
    const text = await res.text()
    let j: Record<string, unknown> = {}
    try { j = JSON.parse(text) as Record<string, unknown> } catch { /* 본문이 JSON 이 아니면 원문을 오류로 */ }
    const issuanceKey = typeof j.issuanceKey === 'string' ? j.issuanceKey : undefined
    if (res.ok && issuanceKey) return { ok: true, issuanceKey, test: key.startsWith('test_'), status: res.status }
    return { ok: false, status: res.status, error: (typeof j.message === 'string' && j.message) || (typeof j.code === 'string' && j.code) || text.slice(0, 300) || `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: `볼타 연결 실패: ${(e as Error).message}` }
  }
}
