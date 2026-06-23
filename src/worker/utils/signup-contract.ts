/**
 * 🖋️ 가입 시 전자계약 자동발송 디스패처 (fire-and-forget, 가입 절대 안 막음).
 *
 *   판매사(distributor)·제조사(supplier) 가입 성공 직후 호출. 유캔싸인 카카오 서명요청 발송 +
 *   성공 시에만 contract_signatures 기록(→ 서명 전 거래 차단 enforcement 대상).
 *
 *   미설정(secret 없음)·휴대폰 없음 → no-op(행 미기록 = 차단 안 됨 → 기존/자격증명 전 계정 락아웃 방지).
 *   절대 throw 안 함 — 발송 실패가 가입을 깨지 않음.
 *
 *   customValue: webhook 수신 시 그대로 에코됨 → account 상관관계 + 공유시크릿(customValue5) 검증에 사용.
 */
import { sendContractFromTemplate, type UcansignEnv } from './ucansign-gateway'
import { recordContractRequest } from './contract-signatures'

/** 가입 핸들러 Context 의 최소 형태(넓은 Env·좁은 로컬 Bindings 모두 수용 — DB 만 요구). */
type ContractContext = {
  env: UcansignEnv & { DB: D1Database; UCANSIGN_WEBHOOK_SECRET?: string }
  executionCtx?: { waitUntil?: (p: Promise<unknown>) => void }
}

export interface SignupContractInput {
  accountType: 'distributor' | 'supplier'
  accountId: number
  signerName: string
  signerPhone: string
  businessName?: string
}

async function run(env: ContractContext['env'], input: SignupContractInput): Promise<void> {
  const templateId = env.UCANSIGN_TEMPLATE_ID
  if (!env.UCANSIGN_API_KEY || !templateId) return // 미설정 → no-op(행 없음 = 미차단)
  const phone = (input.signerPhone || '').replace(/[^0-9]/g, '')
  if (!phone) return // 카카오 서명은 휴대폰 필요 — 없으면 skip(차단 안 함)
  const isSupplier = input.accountType === 'supplier'
  const docType = isSupplier ? 'supplier_agreement' : 'distributor_agreement'
  const documentName = `유통스타트 ${isSupplier ? '제조사 공급계약서' : '판매사 거래계약서'} - ${(input.businessName || input.signerName || String(input.accountId)).slice(0, 60)}`
  const customValues: Record<string, string> = {
    customValue1: input.accountType,
    customValue2: String(input.accountId),
    customValue3: docType,
  }
  if (env.UCANSIGN_WEBHOOK_SECRET) customValues.customValue5 = env.UCANSIGN_WEBHOOK_SECRET

  const res = await sendContractFromTemplate(env, {
    templateId,
    documentName,
    participant: { name: (input.signerName || input.businessName || '담당자').slice(0, 100), value: phone, method: 'kakao' },
    customValues,
  })
  if (res.ok) {
    await recordContractRequest(env.DB, {
      account_type: input.accountType,
      account_id: input.accountId,
      template_id: templateId,
      document_id: res.documentId,
      signer_name: input.signerName || '',
      signer_value: phone,
      signing_method: 'kakao',
      title: documentName,
      status: 'requested',
    })
  }
}

/** 가입 핸들러에서 호출 — 응답 후 실행(waitUntil), ctx 없으면 백그라운드 promise. 항상 swallow. */
export function dispatchSignupContract(c: ContractContext, input: SignupContractInput): void {
  const p = run(c.env, input).catch(() => { /* fail-soft */ })
  try { if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(p) } catch { /* sync fallback (promise already running) */ }
}
