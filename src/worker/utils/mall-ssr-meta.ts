/**
 * 🏬 운영자 몰 OG 메타 (순수) — 세션 ③-a 〔대표 UX 기준 ② 2026-07-29〕
 *
 * 대표: *"**OG 메타가 곧 매대다.** 카톡방에 링크가 붙을 때 뜨는 미리보기(몰 이름·상품 사진·공구가·마감일)를
 * 제공할 것. **sitemap 과 동일하게 몰 스코프 확인 필수** — A몰 링크에 본진이나 B몰 정보가 뜨면 안 된다."*
 *
 * ## 왜 sitemap 과 같은 클래스인가
 * 잘못 나간 미리보기는 **카톡방에 박제된다.** 카카오는 스크랩 캐시를 오래 들고 있고, 우리가 고쳐도
 * 이미 뿌려진 대화방의 카드는 그대로다 — **회수 시점의 통제권이 우리에게 없다.**
 * 그래서 세션 ② 에서 sitemap 을 화면보다 먼저 고친 논리가 여기에도 그대로 적용된다.
 *
 * ## 🔴 이 모듈의 중심 불변식 — **fail-closed**
 * 상품의 `mall_id` 와 URL 이 가리키는 몰이 **일치할 때만** 몰 메타를 만든다.
 * 불일치·불명이면 **`null`** 을 반환해 호출부가 **기본 메타로 폴백**하게 한다.
 *
 * > 잘못된 몰 정보를 뿌리는 것보다 **밋밋한 기본 카드**가 낫다. 전자는 회수가 안 되고 후자는 그냥 심심할 뿐이다.
 */
import { getGbSessions } from './gb-session-store'
import { resolveGbPricing } from '../../shared/gb-session'

export interface MallMetaInput {
  /** URL 이 가리키는 몰(경로/호스트로 이미 해석된 것). */
  mall: { id: number; name: string } | null | undefined
  /** 카드에 실을 상품. `mall_id` 는 **반드시** 채워져 있어야 한다(없으면 fail-closed). */
  product: {
    id?: number | string
    name?: string
    image_url?: string
    /** 공구 특가(있으면 이것을 보여준다 — 소비자가 실제로 낼 금액). */
    gb_price?: number | null
    /** 상시가. 특가와 함께 보여 할인 폭을 드러낸다. */
    price?: number | null
    /** 공구 마감(ISO). 있으면 "N월 N일 마감". */
    deadline?: string | null
    mall_id?: number | null
  } | null | undefined
  origin: string
  pathname: string
}

export interface MallMeta {
  title: string
  description: string
  canonical: string
  ogImage: string
  ogType: string
}

function won(n: number): string {
  return `${Math.floor(n).toLocaleString('ko-KR')}원`
}

/** ISO → "7월 29일" (UTC-naive/Z 양쪽 허용, KST 기준 표기). */
function deadlineLabel(iso: string): string | null {
  const s = String(iso).trim()
  if (!s) return null
  // D1 `CURRENT_TIMESTAMP` 는 'YYYY-MM-DD HH:MM:SS'(UTC, Z 없음) — 로컬로 오해석되지 않게 Z 를 붙인다.
  const norm = /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(s)
    ? s.replace(' ', 'T') + 'Z'
    : s
  const d = new Date(norm)
  if (Number.isNaN(d.getTime())) return null
  const kst = new Date(d.getTime() + 9 * 3600 * 1000)
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`
}

function absImage(raw: string | undefined, origin: string): string {
  const s = String(raw || '').trim()
  if (!s) return `${origin}/og-image.svg`
  if (s.startsWith('http')) return s
  if (s.startsWith('/')) return `${origin}${s}`
  return `${origin}/og-image.svg`
}

/**
 * 📣 2026-08-09 — **PRODUCT 슬롯용 배선 헬퍼** (사용자 "A-4 다 하자" — buildMallMeta 미배선 마감).
 *
 * 몰 상품 카드는 `/products/:id` 로 링크하므로 몰 링크 공유의 실제 표면은 PRODUCT 슬롯이다.
 * payload 의 `mall_id`(>본진 1)로만 발동하고, 몰 미실재·비공개(`consumer_path=0`)·조회 실패는
 * 전부 `null` — 호출부(worker)는 기존 `buildProductMeta` 로 폴백한다(fail-closed).
 * 가격은 mall-public 과 동일하게 `resolveGbPricing`(공구 live 면 공구가·마감일) — 화면과 카드 일치.
 * 본진 상품(`mall_id`≤1)은 DB 를 아예 안 본다(핫패스 불변).
 */
export async function buildMallProductMeta(
  DB: D1Database,
  ssrPayload: string,
  origin: string,
  pathname: string,
): Promise<MallMeta | null> {
  try {
    const pd = (JSON.parse(ssrPayload) as { data?: { id?: number; name?: string; image_url?: string; price?: number; original_price?: number | null; mall_id?: number | null } })?.data
    const pMallId = Number(pd?.mall_id)
    if (!pd || !Number.isFinite(pMallId) || pMallId <= 1) return null
    const mallRow = await DB.prepare(
      'SELECT id, name, brand_name FROM wholesale_malls WHERE id = ? AND COALESCE(consumer_path, 0) = 1',
    ).bind(pMallId).first<{ id: number; name: string; brand_name: string | null }>().catch(() => null)
    if (!mallRow) return null
    const sess = (await getGbSessions(DB, [Number(pd.id)]).catch(() => null))?.get(Number(pd.id))
    const pr = sess ? resolveGbPricing(sess, Number(pd.price), pd.original_price, Date.now()) : null
    return buildMallMeta({
      mall: { id: mallRow.id, name: String(mallRow.brand_name || mallRow.name || '') },
      product: {
        id: pd.id, name: pd.name, image_url: pd.image_url,
        gb_price: pr?.gbActive ? pr.effectivePrice : null,
        price: pr ? pr.listPrice : Number(pd.price),
        deadline: pr?.gbActive ? sess?.deadline : null,
        mall_id: pMallId,
      },
      origin, pathname,
    })
  } catch { return null }
}

/**
 * 몰 상품 링크의 카톡 미리보기 메타.
 * @returns 몰 스코프가 확인될 때만 메타. **불일치·불명이면 `null`**(호출부는 기본 메타 유지).
 */
export function buildMallMeta(i: MallMetaInput): MallMeta | null {
  const { mall, product, origin, pathname } = i
  if (!mall || !product) return null

  const mallId = Number(mall.id)
  const prodMall = product.mall_id == null ? NaN : Number(product.mall_id)

  // 🔴 몰 스코프 확인 — 여기가 이 모듈의 전부다.
  //   `mall_id` 가 없으면(컬럼 미적용·조회 누락) **모르는 것이므로 만들지 않는다.**
  //   "아마 맞겠지"로 카드를 뿌리면 A몰 링크에 B몰 정보가 박제된다.
  if (!Number.isFinite(mallId) || !Number.isFinite(prodMall) || mallId !== prodMall) return null

  const mallName = String(mall.name || '').trim()
  const name = String(product.name || '').trim()
  if (!mallName || !name) return null

  const gb = Number(product.gb_price)
  const list = Number(product.price)
  const hasGb = Number.isFinite(gb) && gb > 0 && (!Number.isFinite(list) || gb < list)

  const parts: string[] = []
  if (hasGb) {
    parts.push(Number.isFinite(list) && list > 0 ? `공구가 ${won(gb)} (정가 ${won(list)})` : `공구가 ${won(gb)}`)
  } else if (Number.isFinite(list) && list > 0) {
    parts.push(won(list))
  }
  const dl = product.deadline ? deadlineLabel(product.deadline) : null
  if (dl) parts.push(`${dl} 마감`)

  return {
    // 몰 이름이 앞에 온다 — 카톡 카드에서 **누구의 판인지**가 먼저 읽혀야 한다.
    title: `${mallName} · ${name}`,
    description: parts.length ? parts.join(' · ') : `${mallName}의 공동구매`,
    canonical: `${origin}${pathname}`,
    ogImage: absImage(product.image_url, origin),
    ogType: 'product',
  }
}
