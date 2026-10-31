/**
 * 🎁 2026-10-31 (대표 "교환권 사진 안나오는거 많던데 영구적으로 문제 해결해줄래?" → 승인
 *   "원본 바로 보기 + 우리 저장소로 옮기기"): 교환권(기프티쇼) 사진을 우리 R2 로 옮긴다.
 *
 * 왜: 교환권 2,260장이 **전부** `bizimg.giftishow.com` 원본을 가리키는데, giftishow 가 Cloudflare 를
 *   다시 막는다(라이브 30장 실측 25장 실패 — 429 `err=9422` · 524 `err=9504`). 화면은 원본을 바로 쓰도록
 *   바꿨지만(`cf-image.ts` `isRawOnlyImageHost`) 그건 **손님 브라우저가 giftishow 에 닿는다** 는 전제다.
 *   옮겨 두면 사진이 우리 도메인(`/api/media`)이라 giftishow 가 누구를 막든 안 깨지고, 리사이저가
 *   다시 작게 줄여 준다(원본 20~86KB → 카드 크기).
 *
 * 설계:
 *   - **천천히**: 회차당 `PER_RUN` 장, 한 장씩 차례로(giftishow 는 몰아서 받으면 429 를 준다). 인보케이션
 *     서브리퀘스트 예산(무료 50)도 다른 작업과 나눠 쓴다 — 장당 ≈ fetch 1 + R2 2 + D1 1.
 *   - **많이 팔린 것부터**(`sold_count DESC`) — 사람들이 실제로 보는 사진이 먼저 옮겨진다.
 *   - **포기하지 않는다**: 실패하면 `voucher_img_retry_after` 로 뒤로 미루고(30분 × 2^시도, 최대 하루)
 *     다음에 다시 한다. 막힌 날이 지나가면 저절로 수렴한다. 사진을 지우지도 않는다(비파괴).
 *   - **CAS**: 그 사이 어드민 재가져오기가 주소를 바꿨으면 덮어쓰지 않는다(`AND image_url = ?`).
 *   - 바인딩(MEDIA_BUCKET)이 없으면 `skipped=NO_MEDIA_BUCKET` 로 남긴다 — 2026-08-31 에 데모 이관이
 *     같은 침묵으로 넉 달 멎었다(`demo-image-rehost.ts`). 못 한 것과 할 일이 없었던 것을 구분한다.
 */
import type { Env } from '../types/env'
import { rehostImageToR2 } from '../utils/rehost-image'
import { ensureSupplyMetaTable, getSupplyMeta, setSupplyMeta } from '../utils/product-supply-meta'

export const VOUCHER_REHOST_PER_RUN = 4
const RETRY_BASE_MS = 30 * 60 * 1000
const RETRY_MAX_MS = 24 * 60 * 60 * 1000

/** 다음 시도까지 기다릴 시간 — 30분, 1시간, 2시간 … 하루에서 멈춘다. */
export function voucherRehostBackoffMs(tries: number): number {
  const t = Math.max(0, Math.floor(Number(tries) || 0))
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(t, 10))
}

/**
 * 주소의 **호스트**가 giftishow 인가 — `LIKE '%giftishow.com/%'` 는 경로에 그 글자가 든 다른 호스트도 잡는다.
 * `https://` 다음부터 첫 `/` 앞까지를 떼서 본다(`cf-image.ts` `isRawOnlyImageHost` 와 같은 판정).
 */
const host = (col: string) => `substr(${col}, 9, instr(substr(${col}, 9) || '/', '/') - 1)`
export const giftishowHostSql = (col: string) =>
  `(${col} LIKE 'https://%' AND (${host(col)} = 'giftishow.com' OR ${host(col)} LIKE '%.giftishow.com'))`

/** 옮길 대상 — 활성 교환권 중 giftishow 원본을 가리키고, 지금 기다리는 중이 아닌 것. */
export const VOUCHER_REHOST_CANDIDATE_SQL = `SELECT p.id, p.image_url
     FROM products p
    WHERE p.deal_only = 1
      AND COALESCE(p.is_active, 1) = 1
      AND ${giftishowHostSql('p.image_url')}
      AND NOT EXISTS (
        SELECT 1 FROM product_supply_meta m
         WHERE m.product_id = p.id AND m.key = 'voucher_img_retry_after' AND m.value > ?
      )
    ORDER BY COALESCE(p.sold_count, 0) DESC, p.id
    LIMIT ?`

export async function handleVoucherImageRehost(env: Env, perRun = VOUCHER_REHOST_PER_RUN): Promise<string> {
  const DB = env.DB
  const bucketEnv = env as unknown as { MEDIA_BUCKET?: R2Bucket }
  if (!bucketEnv.MEDIA_BUCKET) return 'skipped=NO_MEDIA_BUCKET'
  await ensureSupplyMetaTable(DB)

  const nowIso = new Date().toISOString()
  const { results } = await DB.prepare(VOUCHER_REHOST_CANDIDATE_SQL)
    .bind(nowIso, perRun)
    .all<{ id: number; image_url: string }>()
  const rows = results || []
  if (rows.length === 0) return 'migrated=0 failed=0 remaining=0'

  const metaMap = await getSupplyMeta(DB, rows.map((r) => r.id)).catch(() => new Map<number, Record<string, string>>())
  let migrated = 0
  let failed = 0
  for (const row of rows) {
    // 한 장씩 차례로 — 병렬로 몰면 giftishow 가 429 를 준다(실측).
    const hosted = await rehostImageToR2(bucketEnv, row.image_url, 'voucher-image-rehost', 'uploads/voucher').catch(() => null)
    if (hosted) {
      await DB.prepare(`UPDATE products SET image_url = ?, updated_at = datetime('now') WHERE id = ? AND image_url = ?`)
        .bind(hosted, row.id, row.image_url).run()
      await setSupplyMeta(DB, row.id, { voucher_img_src: row.image_url, voucher_img_tries: '0' }).catch(() => {})
      migrated++
    } else {
      const tries = Number(metaMap.get(row.id)?.voucher_img_tries || 0)
      const retryAt = new Date(Date.now() + voucherRehostBackoffMs(tries)).toISOString()
      await setSupplyMeta(DB, row.id, { voucher_img_tries: String(tries + 1), voucher_img_retry_after: retryAt }).catch(() => {})
      failed++
    }
  }

  const left = await DB.prepare(
    `SELECT COUNT(*) AS n FROM products WHERE deal_only = 1 AND COALESCE(is_active, 1) = 1 AND ${giftishowHostSql('image_url')}`,
  ).first<{ n: number }>().catch(() => null)
  return `migrated=${migrated} failed=${failed} remaining=${left?.n ?? -1}`
}
