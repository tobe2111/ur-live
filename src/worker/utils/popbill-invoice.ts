/**
 * 🧾 팝빌(Popbill) 전자세금계산서 **정발행(즉시 발행)** 어댑터 — 매장 수수료 세금계산서 (2026-11-26 대표 *"팝빌로 할 것 같아"*)
 *
 * 초안은 `fee-tax-invoice.ts` 가 매월 1일 만든다. 이 파일은 그 초안 한 장을 팝빌에 보내는 문 하나다.
 *
 * ## 프로토콜 (출처: 팝빌 공식 SDK — npm `popbill`/`linkhub` 1.64.2·1.8.2, Maven `popbill-sdk` 1.71.4 의 클래스 필드)
 * 개발자센터(developers.popbill.com)는 이 작업 환경에서 열리지 않아 **공식 SDK 소스를 읽어** 옮겼다.
 * 1. 토큰: `POST https://auth.linkhub.co.kr/{POPBILL|POPBILL_TEST}/Token`
 *    본문 `{"access_id": 유어딜 사업자번호, "scope": ["member","110"]}` · 서명 = HMAC-SHA256(base64 비밀키,
 *    `"POST\n" + base64(sha256(본문)) + "\n" + x-lh-date + "\n" + "*\n" + "2.0\n" + 경로`) ·
 *    헤더 `x-lh-date`(`yyyy-MM-ddTHH:mm:ssZ` — 밀리초 없음) `x-lh-version: 2.0` `x-lh-forwarded: *` `Authorization: LINKHUB {LinkID} {서명}`.
 *    `*` = IP 제한 끔(SDK `IPRestrictOnOff=false`) — Cloudflare 워커는 나가는 IP 가 고정이 아니다.
 * 2. 발행: `POST https://{popbill|popbill-test}.linkhub.co.kr/Taxinvoice` · `Authorization: Bearer {session_token}` ·
 *    `X-HTTP-Method-Override: ISSUE` · 본문 = Taxinvoice(빈 값은 뺀다 — SDK `_stringify` 와 같다).
 *    응답 `{code: 1, message, ntsConfirmNum}` / 실패 `{code: 음수, message}`.
 * 2026-11-26 대표가 공유한 팝빌 인증 문서·팝빌 MCP(RegistIssue)로 대조: 시각 형식·Content-Type·serialNum(문자열)·scope 순서를 문서대로 맞췄다.
 * 3. 필드 이름은 Java SDK `Taxinvoice`·`TaxinvoiceDetail` 클래스에서 확인했다. 값(정과금·정발행·영수·과세·사업자)은 팝빌 표기.
 *
 * 문서번호(invoicerMgtKey) = `UD{yyyymm}-{매장id}` — 사업자별로 겹치면 팝빌이 거부한다 ⇒ 같은 달 두 번 발행되지 않는다(멱등).
 * 영수: 수수료는 정산금에서 이미 떼었다(받은 돈).
 * 자격: 환경변수 `POPBILL_LINK_ID`·`POPBILL_SECRET_KEY` 우선, 없으면 `platform_settings.popbill_link_id`·`popbill_secret_key`
 *   (어드민 설정 연동 자격 칸). `popbill_is_test`(기본 'true')가 'false' 일 때만 운영 서버로 보낸다.
 * 전제: 유어딜이 팝빌 회원이고 공동인증서를 팝빌에 등록해 두었을 것(대표 — 본인 확인이 필요하다).
 * 돈을 옮기지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { COMPANY } from '../../shared/company-info'
import type { FeeInvoiceRow } from './fee-tax-invoice'

export interface PopbillCreds { linkId: string; secretKey: string; isTest: boolean; userId?: string | null }

export async function resolvePopbillCreds(DB: D1Database, env: { POPBILL_LINK_ID?: string; POPBILL_SECRET_KEY?: string } | undefined): Promise<PopbillCreds | null> {
  const { results } = await DB.prepare(
    "SELECT key, value FROM platform_settings WHERE key IN ('popbill_link_id','popbill_secret_key','popbill_is_test','popbill_user_id')",
  ).all<{ key: string; value: string }>().catch(() => ({ results: [] as Array<{ key: string; value: string }> }))
  const m = new Map((results || []).map((r) => [r.key, String(r.value || '').trim()]))
  const linkId = String(env?.POPBILL_LINK_ID || '').trim() || m.get('popbill_link_id') || ''
  const secretKey = String(env?.POPBILL_SECRET_KEY || '').trim() || m.get('popbill_secret_key') || ''
  if (!linkId || !secretKey) return null
  return { linkId, secretKey, isTest: m.get('popbill_is_test') !== 'false', userId: m.get('popbill_user_id') || null }
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const b64decode = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))

/** 순수(시각 주입) — 링크허브 토큰 요청 헤더·본문. 시험이 서명 식을 고정한다. */
export async function linkhubTokenRequest(c: PopbillCreds, corpNum: string, xDate: string): Promise<{ url: string; body: string; headers: Record<string, string> }> {
  const service = c.isTest ? 'POPBILL_TEST' : 'POPBILL'
  const uri = `/${service}/Token`
  const body = JSON.stringify({ access_id: corpNum, scope: ['110', 'member'] })
  const digest = b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)))
  const target = `POST\n${digest}\n${xDate}\n*\n2.0\n${uri}`
  const key = await crypto.subtle.importKey('raw', b64decode(c.secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(target)))
  return {
    url: `https://auth.linkhub.co.kr${uri}`,
    body,
    headers: { 'x-lh-date': xDate, 'x-lh-version': '2.0', 'x-lh-forwarded': '*', Authorization: `LINKHUB ${c.linkId} ${sig}`, 'Content-Type': 'application/json' },
  }
}

const ymd8 = (s: string) => s.replace(/-/g, '').slice(0, 8)

/** 순수 — 초안 한 장 → 팝빌 Taxinvoice(정발행 · 영수 · 과세). 빈 값은 뺀다. */
export function popbillTaxinvoice(r: FeeInvoiceRow): Record<string, unknown> {
  const [y, m] = r.period.split('-').map(Number)
  const t: Record<string, unknown> = {
    writeDate: ymd8(r.write_date),
    chargeDirection: '정과금',
    issueType: '정발행',
    purposeType: '영수',
    taxType: '과세',
    invoicerCorpNum: COMPANY.bizRegNoDigits,
    invoicerMgtKey: `UD${r.period.replace('-', '')}-${r.seller_id}`,
    invoicerCorpName: COMPANY.legalName,
    invoicerCEOName: COMPANY.ceo,
    invoicerAddr: COMPANY.address,
    invoicerEmail: COMPANY.email,
    invoiceeType: '사업자',
    invoiceeCorpNum: r.buyer_biz_no,
    invoiceeCorpName: r.buyer_name,
    invoiceeCEOName: r.buyer_ceo,
    invoiceeAddr: r.buyer_address,
    invoiceeEmail1: r.buyer_email,
    supplyCostTotal: String(r.supply_amount),
    taxTotal: String(r.vat_amount),
    totalAmount: String(r.total_amount),
    detailList: [{ serialNum: '1', purchaseDT: ymd8(r.write_date), itemName: `유어딜 중개수수료 (${y}년 ${m}월)`, supplyCost: String(r.supply_amount), tax: String(r.vat_amount) }],
  }
  for (const k of Object.keys(t)) if (t[k] === null || t[k] === undefined || t[k] === '') delete t[k]
  return t
}

export interface PopbillIssueResult { ok: boolean; ntsConfirmNum?: string | null; test?: boolean; error?: string; duplicate?: boolean }

/** 한 장 즉시 발행. 실패해도 던지지 않는다(호출부가 초안으로 남긴다). 토큰은 호출마다 새로 받는다(월 1회 · 몇 장뿐). */
/** 팝빌 요청 시각 형식 `yyyy-MM-ddTHH:mm:ssZ`(UTC, 밀리초 없음 — 인증 문서 X-LH-Date). */
export const linkhubDate = (d: Date = new Date()) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

/** 링크허브 토큰. 실패해도 던지지 않는다. */
async function getPopbillToken(c: PopbillCreds, fetchImpl: typeof fetch, nowIso: string): Promise<{ token?: string; error?: string }> {
  const tr = await linkhubTokenRequest(c, COMPANY.bizRegNoDigits, nowIso)
  const tres = await fetchImpl(tr.url, { method: 'POST', headers: tr.headers, body: tr.body })
  const tj = await tres.json().catch(() => ({})) as { session_token?: string; message?: string; code?: number }
  if (!tres.ok || !tj.session_token) return { error: `팝빌 인증 실패: ${tj.message || `HTTP ${tres.status}`}${tj.code ? ` (${tj.code})` : ''}` }
  return { token: tj.session_token }
}

const popbillHost = (c: PopbillCreds) => (c.isTest ? 'popbill-test.linkhub.co.kr' : 'popbill.linkhub.co.kr')

async function postIssue(c: PopbillCreds, token: string, body: Record<string, unknown>, fetchImpl: typeof fetch): Promise<PopbillIssueResult> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'X-HTTP-Method-Override': 'ISSUE', 'Content-Type': 'application/json;charset=utf-8' }
  if (c.userId) headers['x-pb-userid'] = c.userId
  const res = await fetchImpl(`https://${popbillHost(c)}/Taxinvoice`, { method: 'POST', headers, body: JSON.stringify(body) })
  const j = await res.json().catch(() => ({})) as { code?: number; message?: string; ntsConfirmNum?: string }
  if (res.ok && j.code === 1) return { ok: true, ntsConfirmNum: j.ntsConfirmNum ?? null, test: c.isTest }
  const msg = `${j.message || `HTTP ${res.status}`}${j.code ? ` (${j.code})` : ''}`
  return { ok: false, error: msg, duplicate: /이미.*(사용|등록|발행)|중복/.test(msg) }
}

export interface PopbillCheckResult { test: boolean; auth: { ok: boolean; error?: string }; cert?: { ok: boolean; message: string }; point?: { remain: string | null; error?: string }; sample?: PopbillIssueResult }

/**
 * 🔌 연결 확인 — 실제 초안은 건드리지 않는다(2026-11-26 대표 *"다 넣었어"* 뒤 첫 시험).
 *   ① 토큰(LinkID·SecretKey·회원 가입) ② 공동인증서(CertCheck) ③ 잔여 포인트
 *   ④ `sample` 이고 **테스트 서버일 때만** 가짜 공급받는자(8888888888)로 1장 발행 — 운영 서버에선 하지 않는다.
 */
export async function checkPopbill(c: PopbillCreds, opts: { sample?: boolean } = {}, fetchImpl: typeof fetch = fetch, nowIso: string = linkhubDate()): Promise<PopbillCheckResult> {
  const out: PopbillCheckResult = { test: c.isTest, auth: { ok: false } }
  try {
    const t = await getPopbillToken(c, fetchImpl, nowIso)
    if (!t.token) { out.auth = { ok: false, error: t.error }; return out }
    out.auth = { ok: true }
    const h: Record<string, string> = { Authorization: `Bearer ${t.token}` }
    if (c.userId) h['x-pb-userid'] = c.userId
    const cr = await fetchImpl(`https://${popbillHost(c)}/Taxinvoice/CertCheck`, { method: 'GET', headers: h })
    const cj = await cr.json().catch(() => ({})) as { code?: number; message?: string }
    out.cert = { ok: cr.ok && cj.code === 1, message: `${cj.message || `HTTP ${cr.status}`}${cj.code && cj.code !== 1 ? ` (${cj.code})` : ''}` }
    const pr = await fetchImpl(`https://auth.linkhub.co.kr/${c.isTest ? 'POPBILL_TEST' : 'POPBILL'}/Point`, { method: 'GET', headers: h })
    const pj = await pr.json().catch(() => ({})) as { remainPoint?: string; message?: string }
    out.point = pr.ok ? { remain: pj.remainPoint ?? null } : { remain: null, error: pj.message || `HTTP ${pr.status}` }
    if (opts.sample && c.isTest) {
      const stamp = nowIso.replace(/\D/g, '').slice(0, 14)
      const ymd = stamp.slice(0, 8)
      const body: Record<string, unknown> = {
        writeDate: ymd, chargeDirection: '정과금', issueType: '정발행', purposeType: '영수', taxType: '과세',
        invoicerCorpNum: COMPANY.bizRegNoDigits, invoicerMgtKey: `UDTEST-${stamp}`, invoicerCorpName: COMPANY.legalName, invoicerCEOName: COMPANY.ceo,
        invoicerAddr: COMPANY.address, invoicerEmail: COMPANY.email,
        invoiceeType: '사업자', invoiceeCorpNum: '8888888888', invoiceeCorpName: '테스트 공급받는자', invoiceeCEOName: '테스트',
        supplyCostTotal: '1000', taxTotal: '100', totalAmount: '1100',
        detailList: [{ serialNum: '1', purchaseDT: ymd, itemName: '유어딜 연동 시험', supplyCost: '1000', tax: '100' }],
      }
      for (const k of Object.keys(body)) if (body[k] === null || body[k] === undefined || body[k] === '') delete body[k]
      out.sample = await postIssue(c, t.token, body, fetchImpl)
    }
  } catch (e) {
    if (!out.auth.ok) out.auth = { ok: false, error: `팝빌 연결 실패: ${(e as Error).message}` }
  }
  return out
}

export async function issueFeeInvoiceViaPopbill(c: PopbillCreds, r: FeeInvoiceRow, fetchImpl: typeof fetch = fetch, nowIso: string = linkhubDate()): Promise<PopbillIssueResult> {
  if (!r.buyer_biz_no) return { ok: false, error: '매장 사업자번호가 없습니다' }
  // 팝빌 필수(공급받는자 상호·대표자 성명) — 비면 팝빌이 거부하니 보내기 전에 사유를 남긴다.
  if (!r.buyer_name || !r.buyer_ceo) return { ok: false, error: '매장 상호·대표자 성명이 없습니다(사업자 정보 확인)' }
  try {
    const t = await getPopbillToken(c, fetchImpl, nowIso)
    if (!t.token) return { ok: false, error: t.error }
    return await postIssue(c, t.token, popbillTaxinvoice(r), fetchImpl)
  } catch (e) {
    return { ok: false, error: `팝빌 연결 실패: ${(e as Error).message}` }
  }
}
