/**
 * 🧾 수수료 부가세 별도 — 워커 쪽 판단(설정 읽기). 규칙 자체는 `src/shared/fee-vat.ts`.
 *
 * 결재 `docs/decisions/2026-11-25-fee-vat-exclusive.md`. 대표 2026-11-25 *"1번 부가세 별도로 하자"*.
 *
 * 설정을 못 읽으면 **기본 시작일(2027-01-01)** 을 쓴다 — 대표가 정한 규칙이 기본이고, 끄려면
 * `platform_settings.fee_vat_exclusive_from = 'off'` 를 명시해야 한다(조회 실패가 조용히 끄지 않게).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { FEE_VAT_FROM_KEY, feeVatAmount, feeVatApplies, resolveFeeVatFrom } from '../../shared/fee-vat'

async function readFrom(DB: D1Database): Promise<string | null> {
  let raw: string | undefined
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
      .bind(FEE_VAT_FROM_KEY).first<{ value: string }>()
    raw = row?.value
  } catch { raw = undefined } // 조회 실패 → 기본 시작일(위 머리말)
  return resolveFeeVatFrom(raw)
}

/** 지금(또는 주어진 시각) 수수료에 부가세를 붙이는가. */
export async function feeVatOn(DB: D1Database, nowMs: number = Date.now()): Promise<boolean> {
  return feeVatApplies(nowMs, await readFrom(DB))
}

/** 매장 화면용 — 시작일(null=끔)과 지금 적용 중인지. */
export async function feeVatContext(DB: D1Database, nowMs: number = Date.now()): Promise<{ fee_vat_from: string | null; fee_vat_on: boolean }> {
  const from = await readFrom(DB)
  return { fee_vat_from: from, fee_vat_on: feeVatApplies(nowMs, from) }
}

/** 수수료(공급가액) → 이 시각에 매장에서 함께 뗄 부가세. 꺼져 있으면 0. */
export async function feeVatFor(DB: D1Database, fee: number, nowMs: number = Date.now()): Promise<number> {
  return (await feeVatOn(DB, nowMs)) ? feeVatAmount(fee) : 0
}
