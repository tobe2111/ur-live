/**
 * 🆕 2026-06-30 유어애즈 — 경쟁사 분석(쇼핑검색 상위에서 나보다 위에 있는 몰).
 *
 *   특정 키워드의 네이버 쇼핑검색 상위 300위를 훑어 몰(mallName)별로 집계 →
 *   "누가 나보다 위인가 + 그 몰의 최저가/노출 상품수"를 보여준다. 내 순위(myRank) 기준
 *   aboveMe 플래그. rank-tracker 와 같은 오픈API(/v1/search/shop.json) 재사용 · 읽기 · 돈 0.
 *   ⚠️ 이 환경 egress 차단 → 라이브(배포) 후 실호출.
 */
import type { Env } from '@/worker/types/env'

const OPENAPI = 'https://openapi.naver.com'
const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim()
const naverOpenId = (env: Env) => env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
const naverOpenSecret = (env: Env) => env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET

export interface ShopItem { rank: number; mall: string; title: string; price: number; link: string }
export interface Competitor { mall: string; bestRank: number; count: number; minPrice: number; sampleTitle: string; aboveMe: boolean }
export interface CompetitorAnalysis { keyword: string; myMall: string; myRank: number | null; total: number; competitors: Competitor[] }

/** 순수 — shop.json 아이템에서 경쟁 몰 집계(내 몰 제외). myRank=내 몰 첫 등장 순위. bestRank 오름차순. */
export function aggregateCompetitors(items: ShopItem[], myMall: string, limit = 12): { myRank: number | null; competitors: Competitor[] } {
  const m = myMall.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  let myRank: number | null = null
  const map = new Map<string, Competitor>()
  for (const it of items) {
    const mallLc = it.mall.toLowerCase()
    const linkLc = it.link.toLowerCase()
    if (m && (mallLc.includes(m) || linkLc.includes(m))) { if (myRank == null) myRank = it.rank; continue } // 내 몰
    if (!it.mall) continue
    const cur = map.get(it.mall)
    if (cur) {
      cur.count++
      if (it.rank < cur.bestRank) { cur.bestRank = it.rank; cur.sampleTitle = it.title }
      if (it.price > 0 && it.price < cur.minPrice) cur.minPrice = it.price
    } else {
      map.set(it.mall, { mall: it.mall, bestRank: it.rank, count: 1, minPrice: it.price > 0 ? it.price : Infinity, sampleTitle: it.title, aboveMe: false })
    }
  }
  const list = [...map.values()]
    .map(c => ({ ...c, minPrice: c.minPrice === Infinity ? 0 : c.minPrice, aboveMe: myRank != null && c.bestRank < myRank }))
    .sort((a, b) => a.bestRank - b.bestRank)
  return { myRank, competitors: list.slice(0, limit) }
}

/** shop.json 상위 pages×100 크롤(전 아이템 수집 — findShopRank 와 달리 조기 종료 안 함). */
async function crawlShopItems(clientId: string, clientSecret: string, keyword: string, pages = 3): Promise<{ ok: boolean; items?: ShopItem[]; total?: number; error?: string }> {
  const q = keyword.trim()
  if (!q) return { ok: false, error: '키워드를 입력해주세요' }
  const items: ShopItem[] = []
  let total = 0
  for (let page = 0; page < pages; page++) {
    const start = page * 100 + 1
    const res = await fetch(`${OPENAPI}/v1/search/shop.json?query=${encodeURIComponent(q)}&display=100&start=${start}&sort=sim`, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    }).catch(() => null)
    if (!res || !res.ok) { if (page === 0) return { ok: false, error: '쇼핑검색 호출 실패' }; break }
    const data = (await res.json().catch(() => null)) as { total?: number; items?: Array<{ title?: string; link?: string; mallName?: string; lprice?: string | number }> } | null
    total = Number(data?.total) || total
    const arr = data?.items || []
    arr.forEach((it, i) => items.push({ rank: start + i, mall: String(it.mallName || ''), title: stripTags(String(it.title || '')), price: Number(it.lprice) || 0, link: String(it.link || '') }))
    if (arr.length < 100) break
  }
  return { ok: true, items, total }
}

/** 키워드의 경쟁 몰 분석 — 내 순위 + 나보다 위/아래 경쟁 몰(최저가·노출상품수). */
export async function analyzeCompetitors(env: Env, keyword: string, myMall: string, limit = 12): Promise<{ ok: boolean; data?: CompetitorAnalysis; error?: string }> {
  const id = naverOpenId(env), secret = naverOpenSecret(env)
  if (!id || !secret) return { ok: false, error: 'NOT_CONFIGURED' }
  const c = await crawlShopItems(id, secret, keyword, 3)
  if (!c.ok || !c.items) return { ok: false, error: c.error }
  const { myRank, competitors } = aggregateCompetitors(c.items, myMall, limit)
  return { ok: true, data: { keyword: keyword.trim(), myMall: myMall.trim(), myRank, total: c.total || 0, competitors } }
}
