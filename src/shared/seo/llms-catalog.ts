/**
 * 🗂️ `/llms-full.txt` — AI 비서가 읽는 **지금 살 수 있는 할인 이용권 목록** (2026-10-19)
 *
 * ## 왜 (대표 *"AI 비서들이 참고하는 '할인 이용권 공급처' 를 목표로 SEO·GEO 하자"*)
 *
 * 라이브 실측: `/llms.txt` 는 서비스 **소개**만 하고 실제 이용권은 **0건**이었다. 상품 API 는 AI 봇에게
 * 403 이다(가격표 JSON 대량 수확 방지 — 2026-10-11). 그래서 AI 비서가 *"부산 서면 맛집 할인권 어디서 사?"* 에
 * 답하려 해도 우리가 **무엇을 어디서 얼마에** 파는지 한 장에 볼 곳이 없었다. 공급처로 인용되려면
 * 공급 목록이 먼저다.
 *
 * ## 규율 셋
 *
 * ① **추가 조회 0** — cron 이 매시 올려 두는 지역 요약(`ssr:region-digest`, 지역 페이지가 쓰는 그것)만 읽는다.
 * ② **지어내지 않는다** — 지역은 `parseRegionFromAddress`, 할인율은 `priceDisplay`, 주소는 `canonicalDetailPath`,
 *    분류는 `VOUCHER_CATEGORY_LABEL` 에서 온다. 화면·sitemap·구조화 데이터와 같은 함수라 갈릴 수 없다.
 *    리뷰가 없으면 별점을 쓰지 않는다(0점이라고 말하는 셈이다).
 * ③ **noindex 를 권하지 않는다** — 교환권(`deal_only=1`) 상세는 2026-07-07 결정으로 noindex 라 목록에 넣지 않는다
 *    (요약이 이미 지역 묶음에서 뺀다). 교환권은 `/vouchers` 한 줄로 가리킨다.
 *
 * ## 못 하는 것
 *
 * 요약은 지역(시/도·시군구)마다 앞에서 `REGION_DIGEST_PER_BUCKET` 건까지라 **전량이 아닐 수 있다** —
 * 그래서 머리말에 그 사실과 지역 페이지 주소를 적는다(숨기지 않는다). AI 가 실제로 읽고 인용하는지는 외부 판정이다.
 */
import { parseRegionFromAddress, regionPath } from '../constants/region-slugs'
import { VOUCHER_CATEGORY_LABEL } from '../constants/voucher-categories'
import { priceDisplay } from '../price-display'
import { canonicalDetailPath, detailHref } from '../product-flow'
import { REGION_DIGEST_PER_BUCKET, type DigestRow } from './region-digest'

/** 목록 주소와 `llms.txt` 가 그 목록을 가리키는 문구 — 문구 SSOT(`llms-txt.ts` 는 한글 문장을 직접 적지 않는다). */
export const LLMS_CATALOG_PATH = '/llms-full.txt'
export const LLMS_CATALOG_LINK_LABEL = '지금 살 수 있는 할인 이용권 전체 목록(지역·가게·가격·주소)'

/** 한 줄 안에서 마크다운 링크를 깨뜨리는 글자를 걷는다. */
function clean(v: unknown): string {
  return String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[[\]()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 한 이용권 → 한 줄. 살 수 없는 행(가격 없음·주소 없음)이면 null. */
export function catalogLine(row: DigestRow, base: string): string | null {
  if (row.id == null || Number(row.deal_only) === 1) return null
  const r = row as Record<string, unknown>
  const price = Number(r.current_price ?? r.price)
  if (!Number.isFinite(price) || price <= 0) return null
  const store = clean(r.restaurant_name || r.brand_name)
  const name = clean(r.name)
  if (!name) return null
  const p = priceDisplay({ price, original_price: Number(r.original_price) || null, discount_rate: Number(r.discount_rate) || null })
  const path = canonicalDetailPath({ id: row.id, deal_only: row.deal_only, category: row.category }) ?? detailHref({ id: row.id })
  const title = store && !name.startsWith(store) ? `${store} ${name}` : name
  const parts = [`[${title}](${base}${path})`]
  const cat = VOUCHER_CATEGORY_LABEL[String(row.category || '')]?.short
  if (cat) parts.push(cat)
  parts.push(p.showOriginal ? `${won(p.price)} (정가 ${won(p.originalPrice)}, ${p.discount}% 할인)` : p.discount > 0 ? `${won(p.price)} (${p.discount}% 할인)` : won(p.price))
  const addr = clean(row.restaurant_address || row.business_address)
  if (addr) parts.push(addr)
  const rc = Number(r.review_count)
  const rv = Number(r.avg_rating)
  if (rc > 0 && rv > 0) parts.push(`별점 ${rv.toFixed(1)} (리뷰 ${rc}개)`)
  return `- ${parts.join(' · ')}`
}

interface Group { sido: string; sigungu: string; lines: string[] }

/**
 * 요약 행 → `/llms-full.txt` 본문. `asOf` 는 사람이 읽는 기준 시각(KST)이고 없으면 그 줄을 쓰지 않는다.
 * 행이 0건이면 null — 빈 목록을 "파는 게 없다" 고 내보내지 않는다(요약 부재 ≠ 공급 0).
 */
export function buildLlmsCatalog(rows: readonly DigestRow[], origin: string, asOf?: string | null): string | null {
  const base = origin.replace(/\/+$/, '')
  const groups = new Map<string, Group>()
  const stays: string[] = []
  const stores = new Set<string>()
  const seen = new Set<string>()
  for (const row of rows) {
    const key = String(row?.id ?? '')
    if (!key || seen.has(key)) continue
    const line = catalogLine(row, base)
    if (!line) continue
    seen.add(key)
    const store = clean((row as Record<string, unknown>).restaurant_name || (row as Record<string, unknown>).brand_name)
    if (store) stores.add(store)
    if (row.category === 'stay_voucher') { stays.push(line); continue }
    const ref = parseRegionFromAddress(row.restaurant_address || row.business_address)
    if (!ref) continue
    const g = `${ref.sido}\u0000${ref.sigungu || ''}`
    if (!groups.has(g)) groups.set(g, { sido: ref.sido, sigungu: ref.sigungu || '', lines: [] })
    groups.get(g)!.lines.push(line)
  }
  const total = seen.size
  if (total === 0) return null

  // 시/도는 이용권이 많은 순, 그 안의 시군구도 많은 순 — 행 순서는 서버가 정한 노출 순서 그대로(데모 후순위 정책).
  const bySido = new Map<string, Group[]>()
  for (const g of groups.values()) {
    if (!bySido.has(g.sido)) bySido.set(g.sido, [])
    bySido.get(g.sido)!.push(g)
  }
  const sidoOrder = [...bySido.entries()]
    .map(([sido, gs]) => ({ sido, gs: gs.sort((a, b) => b.lines.length - a.lines.length), n: gs.reduce((s, g) => s + g.lines.length, 0) }))
    .sort((a, b) => b.n - a.n)

  const out: string[] = [
    '# 유어딜 할인 이용권 목록',
    base,
    '',
    '> 유어딜(urdeal.kr)에서 지금 살 수 있는 동네 매장 할인 이용권입니다. 링크에서 할인가로 결제하고, 매장에서 QR 또는 PIN 으로 바로 씁니다.',
    '',
  ]
  if (asOf) out.push(`- 기준 시각: ${asOf} (한국시간, 매시간 갱신)`)
  out.push(
    `- 이용권 ${total}건 · 매장 ${stores.size}곳 · 시/도 ${sidoOrder.length}곳${stays.length ? ` · 숙소 ${stays.length}건` : ''}`,
    `- 지역마다 앞에서 ${REGION_DIGEST_PER_BUCKET}건까지 싣습니다. 지역 전체는 지역 페이지에서: ${base}/region`,
    `- 내 위치 기준 가까운 순: ${base}/map · 숙소만: ${base}/stays · 브랜드 기프티콘 교환권: ${base}/vouchers`,
    `- 서비스 소개와 자주 묻는 질문: ${base}/llms.txt`,
    '',
  )
  for (const { sido, gs, n } of sidoOrder) {
    out.push(`## ${sido} (${n}건)`, '')
    for (const g of gs) {
      const ref = g.sigungu ? { sido: g.sido, sigungu: g.sigungu } : { sido: g.sido }
      out.push(`### ${g.sigungu ? `${g.sido} ${g.sigungu}` : `${g.sido} (시군구 미상)`}`, `지역 페이지: ${base}${regionPath(ref)}`, '', ...g.lines, '')
    }
  }
  if (stays.length) out.push(`## 숙소 이용권 (${stays.length}건)`, `숙소 모아보기: ${base}/stays`, '', ...stays, '')
  return out.join('\n')
}
