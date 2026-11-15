/**
 * 🌏 **외국 유튜버 수집** (2026-11-15 대표 결정 — 질문 셋에 대한 답 그대로)
 *   - 대상: *"나라별 일반 인플루언서"* (한국을 다루는 채널에 한정하지 않는다)
 *   - 배분: 하루 유튜브 검색 90번 중 *"10번 (약 11%)"* — 한국 채널은 90 → 80번
 *   - 언어: *"영어, 중국어, 기타 동남아 언어, 일본어"*
 *
 * ## 왜 따로 도는가
 * 한국 수집은 `regionCode=KR&relevanceLanguage=ko` 에 **한국어 키워드**로 돈다. 외국 채널은 그 그물에 안 걸린다
 * (2026-11-14 실측: 유튜브 24,672명 중 외국어 채널은 약 1,300명 — 우연히 섞인 것뿐). 외국 채널을 모으려면
 * 그 나라 지역·언어로, **그 나라 말 키워드**로 물어야 한다. 그래서 한국 키워드 회전과 섞지 않고 여기서 따로 돈다.
 *
 * ## 쿼터 — 한국 몫을 먼저 깎아 둔다
 * 유튜브 검색 쿼터는 하루 한 덩어리다(`YT_SEARCH_BUDGET_DEFAULT` 90). 한국 수집이 앞에서 다 써 버리면 외국 몫이
 * 영영 안 남으므로, **오늘 아직 못 쓴 외국 몫만큼 한국 상한에서 미리 뺀다**(`foreignYtReserve`). 외국 검색을 다
 * 쓰면 예약은 0 이 되고 한국은 남은 걸 쓴다 — 총합은 언제나 90 을 넘지 않는다.
 *
 * ## 무엇을 저장하나
 * 그대로 `ad_influencer_leads`(같은 풀). 국가는 유튜브가 주는 `snippet.country`, 카테고리는 키워드의 카테고리.
 * 국가 필터(`shared/ads/influencer-country.ts`)가 '외국 채널'·국가 코드로 이들을 골라낸다.
 *
 * ⚠️ 못 하는 것: 외국 채널의 연락처는 한국 채널보다 덜 나온다(이메일을 소개란에 안 적는 경우가 많다) ·
 *   중국 본토는 유튜브가 막혀 있어 중국어는 대만(번체)으로 묻는다.
 */
import { discoverYouTubeInfluencers, type FetchBudget, type InfluencerLead } from './influencer-discovery'
import { pickYtAngle } from './influencer-yt-quota'

/** 하루 외국 검색 기본 횟수(대표 결정). env `ADS_YT_FOREIGN_SEARCH_BUDGET` 로 0~30 조정(0 = 끔). */
export const YT_FOREIGN_SEARCH_DEFAULT = 10
export const YT_FOREIGN_SEARCH_MAX = 30
/** 진행값 `"<태평양 날짜>:<오늘 쓴 횟수>:<누적>"` — 누적이 키워드 회전의 순번이다. */
export const YT_FOREIGN_KEY = 'ads_yt_foreign_used'

export interface ForeignLocale { region: string; lang: string; keywords: ReadonlyArray<{ kw: string; category: string }> }

/**
 * 나라·언어별 검색어. 카테고리는 풀의 카테고리(`POOL_CATEGORIES`) 값만 쓴다(화면 필터와 같은 칸).
 * ⚠️ 중국어는 `TW`·`zh-Hant` — 본토는 유튜브 접속이 막혀 있어 본토 크리에이터가 거의 없다.
 */
export const FOREIGN_LOCALES: ReadonlyArray<ForeignLocale> = [
  { region: 'US', lang: 'en', keywords: [
    { kw: 'food review', category: '맛집' }, { kw: 'makeup tutorial', category: '뷰티' }, { kw: 'travel vlog', category: '여행' },
    { kw: 'cafe vlog', category: '카페' }, { kw: 'skincare routine', category: '뷰티' }, { kw: 'nail art', category: '네일' },
    { kw: 'restaurant review', category: '맛집' }, { kw: 'hotel review', category: '숙소' } ] },
  { region: 'TW', lang: 'zh-Hant', keywords: [
    { kw: '美食', category: '맛집' }, { kw: '美妝', category: '뷰티' }, { kw: '旅遊vlog', category: '여행' },
    { kw: '咖啡廳', category: '카페' }, { kw: '餐廳推薦', category: '맛집' }, { kw: '保養', category: '뷰티' } ] },
  { region: 'JP', lang: 'ja', keywords: [
    { kw: 'グルメ', category: '맛집' }, { kw: 'メイク', category: '뷰티' }, { kw: '旅行vlog', category: '여행' },
    { kw: 'カフェ巡り', category: '카페' }, { kw: '食べ歩き', category: '맛집' }, { kw: 'スキンケア', category: '뷰티' } ] },
  { region: 'VN', lang: 'vi', keywords: [
    { kw: 'review đồ ăn', category: '맛집' }, { kw: 'trang điểm', category: '뷰티' }, { kw: 'du lịch vlog', category: '여행' },
    { kw: 'quán cà phê', category: '카페' } ] },
  { region: 'TH', lang: 'th', keywords: [
    { kw: 'รีวิวอาหาร', category: '맛집' }, { kw: 'แต่งหน้า', category: '뷰티' }, { kw: 'เที่ยว', category: '여행' },
    { kw: 'คาเฟ่', category: '카페' } ] },
  { region: 'ID', lang: 'id', keywords: [
    { kw: 'review makanan', category: '맛집' }, { kw: 'kuliner', category: '맛집' }, { kw: 'tutorial makeup', category: '뷰티' },
    { kw: 'travel vlog indonesia', category: '여행' } ] },
]

export function foreignBudget(env: unknown): number {
  const raw = parseInt((env as { ADS_YT_FOREIGN_SEARCH_BUDGET?: string } | null)?.ADS_YT_FOREIGN_SEARCH_BUDGET || '', 10)
  return Math.max(0, Math.min(YT_FOREIGN_SEARCH_MAX, Number.isFinite(raw) ? raw : YT_FOREIGN_SEARCH_DEFAULT))
}

export function parseForeignState(raw: unknown, day: string): { usedToday: number; total: number } {
  const [d, u, t] = String(raw ?? '').split(':')
  const total = Math.max(0, parseInt(t || '0', 10) || 0)
  return { usedToday: d === day ? Math.max(0, parseInt(u || '0', 10) || 0) : 0, total }
}

/** 오늘 아직 안 쓴 외국 몫 — 한국 상한에서 미리 뺄 값(근거: 머리말 '쿼터'). */
export function foreignYtReserve(raw: unknown, day: string, env: unknown): number {
  return Math.max(0, foreignBudget(env) - parseForeignState(raw, day).usedToday)
}

/** 누적 순번 → 이번 검색(나라를 먼저 돌고, 한 바퀴마다 다음 키워드). 모든 나라가 고르게 돈다. */
export function pickForeignSearch(total: number): { region: string; lang: string; kw: string; category: string } {
  const n = Math.max(0, Math.floor(total))
  const loc = FOREIGN_LOCALES[n % FOREIGN_LOCALES.length]
  const k = loc.keywords[Math.floor(n / FOREIGN_LOCALES.length) % loc.keywords.length]
  return { region: loc.region, lang: loc.lang, kw: k.kw, category: k.category }
}

export interface ForeignRunResult { searched: boolean; found: number; saved: number; quota: boolean; error?: string; state: string; keyword?: string }

/**
 * 한 회차에 외국 검색 **최대 1번**(하루 몫을 하루에 고르게 펴기 위해). 한국 수집 루프가 끝난 뒤 부른다.
 * @param ytUsedTotal 오늘 한국+외국 합계 사용량 · @param ytTotalCap 하루 총 상한(외국 예약을 빼기 **전** 값)
 */
export async function runForeignYtSearch(env: { YOUTUBE_API_KEY?: string }, o: {
  raw: unknown; day: string; hasYouTube: boolean; quotaHit: boolean; ytUsedTotal: number; ytTotalCap: number
  budget: FetchBudget; alreadyContacted?: NonNullable<Parameters<typeof discoverYouTubeInfluencers>[2]>['alreadyContacted']
  save: (leads: InfluencerLead[], category: string, keyword: string) => Promise<number>
}): Promise<ForeignRunResult> {
  const st = parseForeignState(o.raw, o.day)
  const keep = `${o.day}:${st.usedToday}:${st.total}`
  if (!o.hasYouTube || o.quotaHit || st.usedToday >= foreignBudget(env) || o.ytUsedTotal + 1 > o.ytTotalCap || o.budget.left <= 2) {
    return { searched: false, found: 0, saved: 0, quota: false, state: keep }
  }
  const pick = pickForeignSearch(st.total)
  const angle = pickYtAngle(st.total)
  const state = `${o.day}:${st.usedToday + 1}:${st.total + 1}` // 시도 기준 차감 — 실패 호출도 구글이 센다
  const r = await discoverYouTubeInfluencers(env, pick.kw, {
    maxResults: 50, pages: 1, enrichMax: 10, budget: o.budget, searchType: angle.searchType, order: angle.order,
    alreadyContacted: o.alreadyContacted, regionCode: pick.region, relevanceLanguage: pick.lang,
  }).catch((e: unknown) => ({ ok: false as const, error: 'FAILED' as const, message: String((e as Error)?.message || e) }))
  const keyword = `${pick.region}:${pick.kw}`
  if (!r.ok) return { searched: true, found: 0, saved: 0, quota: r.error === 'QUOTA', error: `${r.error}${r.message ? `: ${r.message}` : ''}`, state, keyword }
  const leads = r.leads || []
  const saved = leads.length ? await o.save(leads, pick.category, keyword).catch(() => 0) : 0
  return { searched: true, found: leads.length, saved, quota: false, state, keyword }
}
