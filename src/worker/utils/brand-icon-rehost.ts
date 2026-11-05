/**
 * 🏷️ 2026-11-05 — 교환권 **브랜드 로고**도 우리 R2 로 (교환권 탭 머리의 브랜드 칩 · 약 85종).
 *
 * 왜 따로 표를 두나: 로고 주소의 원천인 `gift_catalog.brand_icon_url` 은 카탈로그 동기화(`kt-alpha-catalog-sync.ts`)가
 *   **매번 덮어쓴다**(`brand_icon_url = excluded.brand_icon_url`). 거기에 우리 주소를 쓰면 다음 동기화에 원본으로 돌아간다.
 *   그래서 "원본 주소 → 우리 주소" 대응표를 두고, 화면에 내보낼 때만 바꿔 낀다(`/api/vouchers/categories`).
 * 왜 옮기나: giftishow 가 Cloudflare 를 막아 리사이저가 못 줄인다 → 32px 칩에 원본(실측 1장 176,870B)이 그대로 간다.
 *   우리 주소(`/api/media/uploads/voucher-brand/…`)면 리사이저가 다시 줄인다(종류 85개 × 한 폭 — 무료 변환 한도에 무해).
 */
import { schemaPresent } from './d1-read-replica'

export const BRAND_ICON_TABLE = 'brand_icon_rehost'
const _ready = new WeakSet<object>()

export async function ensureBrandIconRehostTable(DB: D1Database): Promise<void> {
  if (_ready.has(DB)) return
  _ready.add(DB)
  if (await schemaPresent(DB, { tables: [BRAND_ICON_TABLE] })) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS brand_icon_rehost (
    src TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run().catch(() => {})
}

/** 원본 → 우리 주소. 표가 없거나 실패하면 빈 대응표(= 원본 그대로 — 종전 동작). */
export async function loadBrandIconMap(DB: D1Database): Promise<Map<string, string>> {
  try {
    const { results } = await DB.prepare(`SELECT src, url FROM brand_icon_rehost`).all<{ src: string; url: string }>()
    return new Map((results || []).map((r) => [r.src, r.url]))
  } catch {
    return new Map()
  }
}
