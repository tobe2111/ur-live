/**
 * ✍️ 2026-10-27 (대표 "기왕 AI 연결했으면 데모 이용권들 상품 구성 및 설명도 더 자세히 적어줘야 하지 않을까?"):
 *   데모 이용권의 `상품 구성`(description)과 `가게 소개`(long_description)를 Claude Haiku 가 쓴다.
 *
 * 🔒 근거는 둘뿐이다 — ① 이용권 이름·짧은 설명(시드가 정한 것) ② AI 판정을 통과한 **그 매장의 사진**.
 *   카카오 메뉴 탭은 막혀 있다(2026-10-27 실측 406) — 그래서 메뉴판을 근거로 쓸 수 없다.
 *   데모 매장은 **실제 가게**라, 확인 못 한 사실(영업시간·주차·수상·다른 메뉴 가격)을 쓰면 남의 가게에 대해
 *   거짓말을 하게 된다. 프롬프트로 금지하고, 출력도 검사해서 걸리면 **버린다**(쓰지 않는 것이 틀린 것보다 낫다).
 *
 * 켜짐 조건: `ANTHROPIC_API_KEY` 가 있을 때만(사진 판정과 같은 스위치). 실패는 다음 회차에 다시.
 * 회차당 소수만 — 크론 서브리퀘스트 예산을 지킨다. 대상은 동네딜 데모(`demo-deal-`)만 — 숙소는 객실이 상품 구성이라 다르다.
 */
import type { Env } from '../types/env'
import { getSupplyMeta, setSupplyMeta } from '../utils/product-supply-meta'
import { demoPhotoJudgeOn, judgeImageUrl, DEMO_JUDGE_MODEL } from '../utils/demo-photo-judge'

export const DEMO_DESC_V = '1'
const PER_RUN = 2
const PRELAUNCH_NOTE = '※ 오픈 협의 중인 매장입니다.'

const CATEGORY_LABEL: Record<string, string> = {
  meal_voucher: '음식점·카페', beauty_voucher: '미용·뷰티', stay_voucher: '숙소', etc_voucher: '체험·여가', home_voucher: '방문 서비스',
}

export function descPrompt(o: { storeName: string; category: string | null; offerName: string; offerDesc: string; photos: number }): string {
  const kind = CATEGORY_LABEL[o.category || ''] || '매장'
  return `"${o.storeName}" (${kind}) 의 할인 이용권 판매 페이지 글을 쓴다.
이용권: ${o.offerName}
기본 설명: ${o.offerDesc}
${o.photos > 0 ? `위 사진 ${o.photos}장은 이 매장이 직접 올린 사진이다.` : ''}

규칙(어기면 글 전체를 버린다):
- 이용권 이름과 기본 설명에 있는 것만 상품 구성으로 쓴다. 새 메뉴·새 서비스·새 수량을 지어내지 마라.
- 영업시간, 주차, 예약 방법, 전화, 수상·방송·순위, 다른 메뉴 가격, 할인율, 금액을 쓰지 마라.
- 가게 소개는 사진에 실제로 보이는 것(공간 분위기, 보이는 음식·시설)만 2~3문장으로. 맛·품질 단정 금지.
- 존댓말(~해요체), 과장·이모지 금지.

JSON 으로만 답하라. 다른 글자는 쓰지 마라.
{"items":["상품 구성 한 줄", "..."], "intro":"가게 소개 2~3문장"}
items 는 2~5개, 한 줄 40자 이내.`
}

const BANNED = /영업\s*시간|주차|예약\s*(필수|방법)|전화|수상|미슐랭|방송|TV|1위|맛집\s*랭킹|[0-9][0-9,]*\s*원|%|할인율/

/** 응답 → 저장할 두 글. 형식·금지어에 걸리면 null(버린다). 순수 함수, 시험 대상. */
export function parseDescReply(text: string): { description: string; longDescription: string } | null {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let o: { items?: unknown; intro?: unknown }
  try { o = JSON.parse(m[0]) } catch { return null }
  const items = Array.isArray(o.items) ? o.items.map((x) => String(x ?? '').trim()).filter(Boolean) : []
  const intro = String(o.intro ?? '').trim()
  if (items.length < 2 || items.length > 5 || items.some((x) => x.length > 60)) return null
  if (intro.length < 20 || intro.length > 300) return null
  if (BANNED.test(items.join('\n')) || BANNED.test(intro)) return null
  return { description: items.map((x) => `• ${x.replace(/^[•·\-*]\s*/, '')}`).join('\n'), longDescription: intro }
}

export async function writeDemoDescriptions(env: Env, perRun = PER_RUN): Promise<{ written: number; rejected: number }> {
  const out = { written: 0, rejected: 0 }
  const apiKey = (env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY
  if (!demoPhotoJudgeOn(env) || !apiKey) return out
  const DB = env.DB
  const { results } = await DB.prepare(
    `SELECT p.id, p.name, p.description, p.category, p.restaurant_name, p.image_url, p.images
       FROM products p
      WHERE p.slug LIKE 'demo-deal-%'
        AND COALESCE(p.is_active, 1) = 1 AND p.restaurant_name IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM product_supply_meta m WHERE m.product_id = p.id AND m.key = 'demo_desc_v' AND m.value = ?)
      ORDER BY p.id DESC LIMIT ?`,
  ).bind(DEMO_DESC_V, Math.max(1, perRun)).all<{ id: number; name: string; description: string | null; category: string | null; restaurant_name: string; image_url: string | null; images: string | null }>()
    .catch(() => ({ results: [] as never[] }))
  const rows = results || []
  if (!rows.length) return out
  const meta = await getSupplyMeta(DB, rows.map((r) => r.id)).catch(() => new Map<number, Record<string, string>>())
  for (const r of rows) {
    const tries = Number(meta.get(r.id)?.demo_desc_tries || 0)
    let photos: string[] = []
    try { const a = JSON.parse(r.images || '[]'); if (Array.isArray(a)) photos = a.filter((u): u is string => typeof u === 'string') } catch { /* 없음 */ }
    if (!photos.length && r.image_url) photos = [r.image_url]
    photos = photos.filter((u) => /^https:\/\//.test(u)).slice(0, 3)
    const raw = (r.description || '').trim()
    const prelaunch = raw.includes(PRELAUNCH_NOTE)
    const offerDesc = raw.split(PRELAUNCH_NOTE)[0].trim()
    const content: Array<Record<string, unknown>> = photos.map((u) => ({ type: 'image', source: { type: 'url', url: judgeImageUrl(u) } }))
    content.push({ type: 'text', text: descPrompt({ storeName: r.restaurant_name, category: r.category, offerName: r.name, offerDesc, photos: photos.length }) })
    let parsed: ReturnType<typeof parseDescReply> = null
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({ model: DEMO_JUDGE_MODEL, max_tokens: 500, messages: [{ role: 'user', content }] }),
      })
      if (res.ok) {
        const data = (await res.json()) as { content?: Array<{ text?: string }> }
        parsed = parseDescReply(data?.content?.[0]?.text || '')
      }
    } catch { /* 다음 회차 */ }
    if (!parsed) {
      out.rejected++
      // 세 번 버려지면 이 버전에선 그만 — 종전 짧은 설명 그대로 둔다(틀린 글보다 짧은 글).
      await setSupplyMeta(DB, r.id, tries + 1 >= 3 ? { demo_desc_v: DEMO_DESC_V, demo_desc_tries: '0' } : { demo_desc_tries: String(tries + 1) }).catch(() => {})
      continue
    }
    const description = prelaunch ? `${parsed.description}\n\n${raw.slice(raw.indexOf(PRELAUNCH_NOTE))}` : parsed.description
    await DB.prepare(`UPDATE products SET description = ?, long_description = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(description, parsed.longDescription, r.id).run().catch(() => {})
    await setSupplyMeta(DB, r.id, { demo_desc_v: DEMO_DESC_V, demo_desc_tries: '0' }).catch(() => {})
    out.written++
  }
  return out
}
