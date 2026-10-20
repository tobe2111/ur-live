/**
 * 🤖 AI 비서 검색 창구 — 입력 정리 + 응답 한 줄 (2026-10-19 대표 "남은 3가지도 다 해줘" ②).
 *
 * ChatGPT·Claude 같은 AI 비서가 *"방배동에서 쓸 수 있는 할인 식사권 있어?"* 를 받았을 때
 * 우리 이용권을 찾아 **우리 상세 주소를 건네주는** 좁은 통로다.
 *
 * 🔒 범위(결재 `docs/decisions/2026-10-19-ai-agent-channel.md`):
 *   · **찾기만 한다.** 결제는 사람이 우리 상세 페이지에서 한다(`url`). 에이전트 대신 결제는 만들지 않았다 —
 *     결제 경로(등급 C)라 대표 승인 + staging 실결제 뒤에만 설계를 시작한다.
 *   · **좁게 연다.** 검색어나 지역이 있어야 답하고, 한 번에 최대 10건이다. 공개 상품 API 를
 *     AI 봇에게 막아 둔 결정(가격표 벌크 수확 차단 — `scrapeProtection`)을 뒤집지 않는다.
 *   · **데모는 안 준다.** 데모 이용권은 실제 가게 이름을 쓰지만 진짜 거래가 아니다 —
 *     AI 가 그걸 추천하면 손님이 없는 딜을 찾아간다.
 *   · 게이트 `agent_search_enabled` 기본 OFF.
 */
import { priceDisplay } from './price-display'
import { canonicalDetailPath } from './product-flow'
import { parseRegionFromAddress, regionLabel } from './constants/region-slugs'

export const AGENT_SEARCH_GATE = 'agent_search_enabled'
export const AGENT_SEARCH_MAX = 10
/** 창구 주소 — 라우트 마운트(`public-utility.routes.ts` `/api/agent` + `agent-search.routes.ts` `/search`)와 같은 값. */
export const AGENT_SEARCH_PATH = '/api/agent/search'

export const AGENT_CATEGORY: Record<string, { key: string; label: string }> = {
  meal: { key: 'meal_voucher', label: '식사' },
  beauty: { key: 'beauty_voucher', label: '뷰티' },
  stay: { key: 'stay_voucher', label: '숙소' },
  home: { key: 'home_voucher', label: '생활' },
  etc: { key: 'etc_voucher', label: '기타' },
}

export interface AgentQuery { q: string; region: string; category: string | null; limit: number }

/** LIKE 와일드카드·제어문자를 지우고 길이를 자른다. */
function clean(v: string | null | undefined, max: number): string {
  return String(v ?? '').replace(/[%_\\\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** 검색어도 지역도 없으면 `null` — 전체 목록을 내주지 않는다(벌크 수확 차단). */
export function parseAgentQuery(params: { q?: string | null; region?: string | null; category?: string | null; limit?: string | null }): AgentQuery | null {
  const q = clean(params.q, 40)
  const region = clean(params.region, 20)
  if (q.length < 1 && region.length < 2) return null
  const cat = params.category ? AGENT_CATEGORY[String(params.category).toLowerCase()] : undefined
  const n = Math.trunc(Number(params.limit))
  const limit = Number.isFinite(n) && n > 0 ? Math.min(n, AGENT_SEARCH_MAX) : AGENT_SEARCH_MAX
  return { q, region, category: cat?.key ?? null, limit }
}

export interface AgentRow {
  id: number
  name: string | null
  restaurant_name: string | null
  restaurant_address: string | null
  category: string | null
  price: number | null
  original_price: number | null
  discount_rate: number | null
  deal_only?: number | null
}

export interface AgentItem {
  /** 결제 링크(`/api/agent/checkout?id=`)에 넘기는 상품 번호. */
  id: number
  name: string
  store: string | null
  area: string | null
  category: string
  price: number
  original_price: number | null
  discount_percent: number
  currency: 'KRW'
  url: string
}

export function toAgentItem(row: AgentRow, origin: string): AgentItem | null {
  const path = canonicalDetailPath({ id: row.id, deal_only: row.deal_only, category: row.category })
  if (!path) return null
  const pd = priceDisplay(row)
  if (pd.price <= 0) return null
  const ref = parseRegionFromAddress(row.restaurant_address)
  const label = Object.values(AGENT_CATEGORY).find(c => c.key === row.category)?.label ?? '이용권'
  return {
    id: Number(row.id),
    name: String(row.name || '').trim(),
    store: row.restaurant_name ? String(row.restaurant_name).trim() : null,
    area: ref ? regionLabel(ref) : null,
    category: label,
    price: pd.price,
    original_price: pd.showOriginal ? pd.originalPrice : null,
    discount_percent: pd.discount,
    currency: 'KRW',
    url: `${origin.replace(/\/+$/, '')}${path}`,
  }
}

/** AI 비서가 손님에게 그대로 옮길 수 있는 사용법 한 줄 — 지어내지 않는다(실제 흐름). */
export const AGENT_HOW_TO_BUY = '상품 주소(url)에서 결제하면 이용권이 바로 발급되고, 매장에서 QR이나 확인코드로 사용합니다. 유효기간 안에 쓰지 않은 이용권은 자동으로 환불됩니다.'

/**
 * 🤖 `llms.txt` 에 싣는 창구 안내 (2026-10-20 대표 *"통로 열어줘"*).
 *
 * 창구를 켜도 AI 가 그 주소를 모르면 아무도 안 쓴다. `llms.txt` 는 AI 가 사이트를 읽을 때 처음 찾는 입구라
 * 거기에 싣는다. 문구가 이 파일에 있는 이유: 창구의 규칙(필수 입력·상한·결제 위치)이 여기 있어서다 —
 * 두 군데 적으면 상한을 바꿀 때 안내만 낡는다. **게이트가 켜져 있을 때만** 싣는 판단은 라우트가 한다.
 */
export function agentSearchLines(base: string): string[] {
  const cats = Object.keys(AGENT_CATEGORY).join(', ')
  return [
    '## AI 비서용 이용권 검색',
    '',
    `- 주소: GET ${base}${AGENT_SEARCH_PATH}?q=검색어&region=지역&category=분류`,
    '- 검색어(q)나 지역(region) 중 하나는 꼭 넣는다. 지역은 "서초구"처럼 동네 이름으로 쓴다.',
    `- 분류(category)는 선택이다: ${cats}`,
    `- 한 번에 최대 ${AGENT_SEARCH_MAX}건, 지금 살 수 있는 실제 매장 이용권만 돌려준다.`,
    '- 결제는 응답의 url(유어딜 상세 페이지)에서 사람이 직접 한다.',
    '',
  ]
}
