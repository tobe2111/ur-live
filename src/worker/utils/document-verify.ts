/**
 * 🧾 서류 ↔ 등록 매장 대조 — OCR 결과를 사람이 1초에 볼 수 있는 형태로 만든다.
 *
 * 2026-09-16 (결재 `docs/decisions/2026-09-16-ocr-license-automation.md`).
 *
 * ## 무엇과 무엇을 맞추나 — 결재 문서의 계획을 실측으로 고쳤다
 *
 * 문서는 *"영업신고증 OCR ↔ 공개 원장 269,708건"* 을 주력으로 적었다. 라이브를 재 보니
 * 그 숫자의 대부분이 원장이 아니었다(학원 139,477 · **카카오 플레이스 스크랩 96,832** ·
 * 병원 26,809). **진짜 인허가 원장은 6,590건**이고 하루 300건씩 신규 인허가만 들어온다 —
 * 전국 음식점 대비 1% 미만이다.
 *
 * ⇒ 원장 대조는 **걸리면 강한 양성, 안 걸리면 무신호**다. 주력이 될 수 없다.
 *
 * **주력은 이것이다**: 서류에 박힌 소재지 ↔ **사장님이 카카오맵에서 고른 매장 주소**.
 * 매장 주소는 우리가 이미 갖고 있고 커버리지가 100%다. 결재가 지목한 구멍
 * (*"자기 진짜 등록증 + 남의 가게 이름"*)은 서류 소재지가 등록한 가게와 다른 순간 드러난다.
 *
 * ## 🚧 이 파일은 승인하지 않는다
 * `verdict` 는 사람이 읽는 **요약**이지 명령이 아니다. 승인·반려 버튼은 어드민이 누른다.
 * 자동 승인은 `isOcrAutoVerifyEnabled`(기본 OFF) 뒤에서만, 그것도 호출부가 결정한다.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { compareAddress, compareBizName, type AddressComparison, type NameComparison } from '../../shared/korean-address'
import { DOC_LABEL, type DocKind, type OcrDocResult } from './ocr-license'
import { loadLatestProductCopy, mergeStoreProfile } from './store-profile'
import { getSellerMeta, setSellerMeta } from './seller-meta'

/** 원장에서 찾은 한 건(영업신고증 대조용). */
export interface LedgerHit {
  mgtNo: string
  bizName: string
  address: string | null
  tradeState: string | null
  permitDate: string | null
}

export type DocVerdict = 'match' | 'review' | 'mismatch' | 'unreadable'

export interface DocVerifyResult {
  kind: DocKind
  label: string
  ocr: OcrDocResult
  /** 등록한 매장의 이름·주소(비교 기준) */
  store: { name: string | null; address: string | null }
  name: NameComparison
  address: AddressComparison
  /** 인허가 원장에서 찾았으면 그 건. **못 찾은 것은 음성 신호가 아니다**(커버리지 1% 미만) */
  ledger: LedgerHit | null
  ledgerNote: string
  verdict: DocVerdict
  /** 어드민 화면 한 줄 */
  summary: string
}

/**
 * 인허가 원장(localdata)에서 상호로 찾아본다.
 *
 * ⚠️ **카카오 플레이스 행은 제외한다.** `store_prospects` 의 96,832행이 `opn_svc_id='kakao_place'`
 * 인데 그건 스크랩이라 `mgt_no` 가 장소 ID 이고 인허가일도 없다. 그걸 "원장에서 확인됨" 으로
 * 보여 주면 **없는 근거를 만들어 내는 것**이다.
 *
 * ⚠️ 못 찾아도 `null` 일 뿐 의심 신호가 아니다 — 원장 커버리지가 1% 미만이다.
 */
export async function findInPermitLedger(
  DB: D1Database,
  bizName: string | null,
  mgtNo: string | null,
): Promise<LedgerHit | null> {
  const nm = (bizName || '').trim()
  const mg = (mgtNo || '').trim()
  if (!nm && !mg) return null

  try {
    // 관리번호가 읽혔으면 그게 가장 강한 키다 — 먼저 시도
    if (mg) {
      const byMgt = await DB.prepare(
        `SELECT mgt_no, biz_name, addr_road, trd_state_nm, apv_perm_ymd
           FROM store_prospects
          WHERE opn_svc_id IN ('general_restaurants','rest_cafes') AND mgt_no = ?
          LIMIT 1`,
      ).bind(mg).first<{ mgt_no: string; biz_name: string; addr_road: string | null; trd_state_nm: string | null; apv_perm_ymd: string | null }>()
      if (byMgt) {
        return { mgtNo: byMgt.mgt_no, bizName: byMgt.biz_name, address: byMgt.addr_road, tradeState: byMgt.trd_state_nm, permitDate: byMgt.apv_perm_ymd }
      }
    }
    if (nm) {
      const byName = await DB.prepare(
        `SELECT mgt_no, biz_name, addr_road, trd_state_nm, apv_perm_ymd
           FROM store_prospects
          WHERE opn_svc_id IN ('general_restaurants','rest_cafes') AND biz_name = ?
          LIMIT 1`,
      ).bind(nm).first<{ mgt_no: string; biz_name: string; addr_road: string | null; trd_state_nm: string | null; apv_perm_ymd: string | null }>()
      if (byName) {
        return { mgtNo: byName.mgt_no, bizName: byName.biz_name, address: byName.addr_road, tradeState: byName.trd_state_nm, permitDate: byName.apv_perm_ymd }
      }
    }
  } catch {
    // 원장 테이블이 이 DB 에 없을 수도 있다(ads 리드 DB 분리) — 없으면 그냥 없는 것
    return null
  }
  return null
}

/**
 * OCR 결과 + 등록 매장 → 사람이 읽는 판정.
 *
 * ## 등급의 뜻
 * - `unreadable` — 못 읽었다. **사장님 탓이 아니다.** 사진을 다시 받거나 사람이 눈으로 본다.
 * - `mismatch`   — 서류 소재지가 등록한 매장과 **다른 시·군·구**다. 반드시 사람이 본다.
 * - `review`     — 같은 동네인데 건물이 다르거나 상호가 어긋난다. 흔한 정상 케이스도 여기 온다.
 * - `match`      — 같은 건물 + 상호 일치/포함. **그래도 자동 승인이 아니다**(게이트가 따로 있다).
 */
export function judgeDocument(
  ocr: OcrDocResult,
  store: { name: string | null; address: string | null },
  ledger: LedgerHit | null,
): DocVerifyResult {
  const name = compareBizName(ocr.bizName, store.name)
  const address = compareAddress(ocr.address, store.address)

  let verdict: DocVerdict
  if (!ocr.ok || (!ocr.bizName && !ocr.address)) verdict = 'unreadable'
  else if (address.verdict === 'differ') verdict = 'mismatch'
  else if (address.verdict === 'same' && (name.verdict === 'same' || name.verdict === 'contains')) verdict = 'match'
  else verdict = 'review'

  const ledgerNote = ledger
    ? `인허가 원장에서 찾았습니다 — ${ledger.bizName} · ${ledger.tradeState || '상태 미상'}`
    : '인허가 원장에 없습니다 (원장이 전국의 1% 미만이라 **이상 신호가 아닙니다**)'

  const summary = verdict === 'unreadable'
    ? `${DOC_LABEL[ocr.kind]}을 읽지 못했습니다 — 사람이 확인해 주세요`
    : verdict === 'mismatch'
      ? `⚠️ ${DOC_LABEL[ocr.kind]} 소재지가 등록 매장과 다릅니다 — ${address.reason}`
      : verdict === 'match'
        ? `${DOC_LABEL[ocr.kind]}과 등록 매장이 일치합니다 — ${address.reason}`
        : `확인이 필요합니다 — ${address.reason} / ${name.reason}`

  return { kind: ocr.kind, label: DOC_LABEL[ocr.kind], ocr, store, name, address, ledger, ledgerNote, verdict, summary }
}

/**
 * 한 셀러의 서류 하나를 끝까지 처리: 읽고 → 맞춰 보고 → 어드민이 볼 수 있게 보관.
 *
 * ⚠️ 보관은 `seller_meta`(K-V 사이드테이블)에 한다 — `sellers` 는 **정확히 100컬럼 = D1 한도**라
 * 새 컬럼을 못 붙인다(CLAUDE.md 예산제).
 */
export async function verifyAndStoreDocument(
  DB: D1Database,
  sellerId: number,
  ocr: OcrDocResult,
): Promise<DocVerifyResult> {
  // 매장의 이름·주소는 세 곳에 흩어져 있다(상품 복사본 · seller_meta · sellers 본체) —
  // `mergeStoreProfile` 이 그 우선순위의 SSOT 다. 여기서 직접 조립하면 화면과 판정이 갈린다.
  const [lastProduct, metaMap, seller] = await Promise.all([
    loadLatestProductCopy(DB, sellerId).catch(() => null),
    getSellerMeta(DB, [sellerId]).catch(() => new Map()),
    DB.prepare('SELECT name, business_name, phone, address FROM sellers WHERE id = ? LIMIT 1')
      .bind(sellerId).first<{ name: string | null; business_name: string | null; phone: string | null; address: string | null }>()
      .catch(() => null),
  ])
  const merged = mergeStoreProfile({ product: lastProduct, meta: metaMap.get(sellerId) || {}, seller })
  const store = { name: merged.name || null, address: merged.address || null }

  const ledger = ocr.kind === 'business_license'
    ? await findInPermitLedger(DB, ocr.bizName, ocr.mgtNo)
    : null

  const result = judgeDocument(ocr, store, ledger)

  // 어드민이 "왜 이렇게 판정했나" 를 볼 수 있어야 한다 — 요약만이 아니라 추출 원본까지
  await setSellerMeta(DB, sellerId, {
    [`ocr_${ocr.kind}`]: JSON.stringify({
      at: new Date().toISOString(),
      verdict: result.verdict,
      summary: result.summary,
      extracted: {
        bizName: ocr.bizName, address: ocr.address, ownerName: ocr.ownerName,
        bizNumber: ocr.bizNumber, mgtNo: ocr.mgtNo, permitDate: ocr.permitDate, fill: ocr.fill,
      },
      store,
      ledger,
    }).slice(0, 4000),
  }).catch(() => null)

  return result
}
