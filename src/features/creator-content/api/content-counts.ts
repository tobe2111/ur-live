/**
 * 🎬 목록 카드의 "다녀온 사람들 N" (2026-11-09 대표 *"모두 진행"* — 개선 5).
 *
 * 피드에 실리는 이용권마다 그 가게(`storeKeyFor` = 이름 + 구)의 **보이는 콘텐츠 수**를 `creator_count` 로 붙인다.
 * 쿼리 한 번(가게 키 IN …) · 실패하면 아무것도 안 붙이고 원래 목록 그대로(fail-soft — 피드를 깨지 않는다).
 * 교환권(`deal_only=1`)은 가게가 없어 붙이지 않는다.
 * ⚠️ 손님 응답은 자동 글을 한 번 더 거른다(가게 글·한 사람 2개) — 그래서 이 숫자는 상세 칸보다 조금 클 수 있다.
 *    카드에는 "있다는 신호"로만 쓰고 정확한 수가 중요한 곳(상세)은 상세 응답을 쓴다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { storeKeyFor } from './content-db'

/** D1 바인드 한도(100)보다 넉넉히 아래. 피드 한 장은 50개라 넘지 않는다. */
const MAX_KEYS = 90

type FeedRow = Record<string, unknown>

export async function loadCreatorCounts(DB: D1Database, keys: string[]): Promise<Map<string, number>> {
  const uniq = [...new Set(keys)].slice(0, MAX_KEYS)
  const out = new Map<string, number>()
  if (!uniq.length) return out
  const { results } = await DB.prepare(`SELECT store_key, COUNT(*) AS n FROM store_creator_content
      WHERE status = 'visible' AND platform NOT LIKE 'urdeal_%' AND store_key IN (${uniq.map(() => '?').join(',')}) GROUP BY store_key`)
    .bind(...uniq).all<{ store_key: string; n: number }>()
  for (const r of results ?? []) out.set(r.store_key, Number(r.n) || 0)
  return out
}

function keyOf(p: FeedRow): string | null {
  if (Number(p.deal_only) === 1) return null
  const name = typeof p.restaurant_name === 'string' ? p.restaurant_name.trim() : ''
  return name ? storeKeyFor(name, typeof p.restaurant_address === 'string' ? p.restaurant_address : null) : null
}

export async function attachCreatorCounts<T extends FeedRow>(DB: D1Database, rows: T[]): Promise<T[]> {
  try {
    const keys = rows.map(keyOf)
    const counts = await loadCreatorCounts(DB, keys.filter((k): k is string => !!k))
    if (!counts.size) return rows
    return rows.map((p, i) => {
      const n = keys[i] ? counts.get(keys[i] as string) ?? 0 : 0
      return n > 0 ? { ...p, creator_count: n } : p
    })
  } catch {
    return rows
  }
}
