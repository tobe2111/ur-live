/**
 * 🛡️ 2026-05-18: 사용자 숙소 검색/목록 (PR 3/6).
 *
 * 필터: 지역 / 체크인-체크아웃 / 인원 / 가격대 / 숙소 타입 / 정렬
 * 🖥️ 2026-07-16 (대표 신고 "숙소 테마 안 맞음"): 다크 고정 → 라이트 기본 + dark: 대응(앱 테마 정합).
 *   + PC(lg+) 풀너비(pc-fullbleed) · 카드 그리드 확장(2→4열).
 */
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'
import { CalendarDays } from 'lucide-react'
import { TicketStubIcon } from '@/components/icons/urdeal-icons'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { Search, MapPin, Calendar, Users, SlidersHorizontal, X } from 'lucide-react'
import { useStaysSearch } from '@/hooks/queries/useStaysSearch'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hotel: '호텔', motel: '모텔', pension: '펜션', guesthouse: '게스트하우스',
  resort: '리조트', glamping: '글램핑', house: '주택',
}

function todayIso() { return new Date().toISOString().slice(0, 10) }
function tomorrowIso() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10) }

function buildQs(filters: Record<string, string | number>): string {
  const qs = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v !== 0) qs.set(k, String(v)) })
  return qs.toString()
}

export default function StaysSearchPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState({
    region: params.get('region') || '',
    check_in: params.get('check_in') || todayIso(),
    check_out: params.get('check_out') || tomorrowIso(),
    guests: Number(params.get('guests')) || 2,
    property_type: params.get('property_type') || '',
    // 🛡️ 2026-05-18: 판매 모드 필터 — 'date' (날짜 지정) / 'voucher' (기간 무관) / '' (전체).
    sale_mode: params.get('sale_mode') || '',
    min_price: Number(params.get('min_price')) || 0,
    max_price: Number(params.get('max_price')) || 0,
    sort: params.get('sort') || 'recent',
  })

  // 🛡️ 2026-06-01 Tier2: 수동 load → React Query. queryQs 가 바뀔 때만 재요청.
  //   자동검색은 4개 필터(체크인/아웃/인원/정렬), 나머지는 '적용' 버튼에서 commit (기존 동작 유지).
  const [queryQs, setQueryQs] = useState(() => buildQs(filters))
  const { data: items = [], isLoading: loading, isError, refetch } = useStaysSearch(queryQs)

  useEffect(() => {
    setQueryQs(buildQs(filters))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.check_in, filters.check_out, filters.guests, filters.sort])

  function apply() {
    const next = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v !== 0) next.set(k, String(v)) })
    setParams(next)
    setShowFilters(false)
    setQueryQs(buildQs(filters))
  }

  const nights = Math.max(1, Math.round((new Date(filters.check_out).getTime() - new Date(filters.check_in).getTime()) / 86400000))

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#11141C] text-gray-900 dark:text-white pb-safe-nav">
      {/* 🏷️ 2026-07-20 (대표 — "숙소 공구 표현 맞나?"): '공구' 프레이밍 폐기(즉시판매 전환·명칭 SSOT) → '숙소'. */}
      <SEO title={CONSUMER_SURFACE_SEO['/stays'].title} description={CONSUMER_SURFACE_SEO['/stays'].description} url="/stays" />

      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="ur-content-wide px-4 lg:px-8 py-3 flex items-center gap-3">
          <Link to="/" className="text-sm font-bold">←</Link>
          <h1 className="text-base font-bold flex-1">🏨 숙소</h1>
          <button
            onClick={() => setShowFilters(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06]"
            aria-label="필터"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* 🧭 2026-07-20 v2 (대표 신고 "카테고리 클릭하면 가끔 저절로 동네딜로 넘어감" 전수조사): 1차 수리가
            칩을 /map?category= 로 보냈는데, 홈 칩과 똑같이 생긴 칩이 동네딜 **지도**로 점프해 "저절로 동네딜"
            체감의 원인이 됨 → 홈 카테고리 필터(`/?category=`) 복귀로 정정(PC PcHomePage·모바일 지도 홈 둘 다
            ?category 초기화 지원). 라벨은 홈 카테고리와 SSOT 정합. 지도는 명시적 '지도에서 보기' 링크만. */}
        <div className="ur-content-wide px-4 lg:px-8 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { key: 'all', to: '/', label: t('groupBuy.categoryAll', { defaultValue: '전체' }) },
            { key: 'meal_voucher', to: '/?category=meal_voucher', label: t('groupBuy.categoryMeal', { defaultValue: '🍽️ 식사' }) },
            { key: 'beauty_voucher', to: '/?category=beauty_voucher', label: t('groupBuy.categoryBeauty', { defaultValue: '💇 미용' }) },
            { key: 'stay_voucher', to: '/stays', label: t('groupBuy.categoryStay', { defaultValue: '🏨 숙소' }) },
            { key: 'etc_voucher', to: '/?category=etc_voucher', label: t('groupBuy.categoryEtc', { defaultValue: '🎯 기타' }) },
          ].map((cat) => {
            const active = cat.key === 'stay_voucher'
            return (
              <Link
                key={cat.key}
                to={cat.to}
                className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap border transition-colors ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2C2F35] hover:bg-gray-50 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </Link>
            )
          })}
        </div>

        {/* Quick filters bar */}
        <div className="ur-content-wide px-4 lg:px-8 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setShowFilters(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full text-xs whitespace-nowrap">
            <Calendar className="w-3 h-3" /> {filters.check_in.slice(5)} - {filters.check_out.slice(5)} ({nights}박)
          </button>
          <button onClick={() => setShowFilters(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full text-xs whitespace-nowrap">
            <Users className="w-3 h-3" /> 성인 {filters.guests}명
          </button>
          {filters.region && (
            <button onClick={() => setFilters({ ...filters, region: '' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 rounded-full text-xs whitespace-nowrap">
              <MapPin className="w-3 h-3" /> {filters.region} ×
            </button>
          )}
          {filters.property_type && (
            <button onClick={() => setFilters({ ...filters, property_type: '' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 rounded-full text-xs whitespace-nowrap">
              {PROPERTY_TYPE_LABELS[filters.property_type]} ×
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="ur-content-wide px-4 lg:px-8 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400 text-sm">검색 중...</div>
        ) : isError ? (
          // 🛡️ 2026-06-26 (소비자 감사 P0): fetch 실패를 '검색결과 없음'(재고 없음)으로 위장하지 않음 — 재시도.
          <div className="text-center py-20">
            <Search className="w-10 h-10 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">검색을 불러오지 못했어요</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">네트워크 상태를 확인해주세요.</p>
            <button onClick={() => refetch()} className="px-5 h-10 rounded-lg text-sm font-bold bg-gray-900 text-white dark:bg-white dark:text-gray-900">다시 시도</button>
          </div>
        ) : items.length === 0 ? (
          // 🧭 2026-07-20 (대표 — 빈 화면이 막다른 골목): 차가운 '검색 결과 없음' → 안내 + 다른 딜 CTA.
          <div className="text-center py-20">
            <Search className="w-10 h-10 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">조건에 맞는 숙소가 아직 없어요</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">날짜·인원을 바꿔 보거나, 주변 다른 딜을 둘러보세요.</p>
            <Link to="/map" className="inline-block px-5 py-2.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold">지도에서 동네딜 보기 →</Link>
          </div>
        ) : (
          // 🖥️ 2026-07-16 (풀너비): 모바일 1열 → PC 최대 4열(교환권 그리드와 정합).
          /* 🏨 2026-09-03 (대표 "여기 UI도 통일화 해야지"): 숙소 목록도 **홈과 같은 카드**로.
             이 화면은 네 번째 카드 세대였다 — 테두리 카드 + hover 그림자 + 사진 위 배지 2개
             (숙소타입·앰버 별) + 편의시설 pill + 구분선 가격. 같은 서비스가 화면마다 다른 카드를
             쓰면 반드시 갈린다(홈 섹션↔피드, 유어샵에 이어 네 번째).

             ⚠️ 옮기면서 **줄인 것**을 밝힌다:
               · 숙소타입·성급 → 사진 위 배지에서 **본문 맨 위 한 줄**로(사진을 가리지 않는다 —
                 2026-08-31 "할인율이 사진 안으로 들어가면 안돼" 와 같은 자리 규칙).
               · 편의시설 pill 3개 → **뺐다**. 카드에서 고르는 기준이 아니고(세 개가 다 '무료 주차·
                 와이파이·조식' 이라 변별력이 없다) 상세에 전부 있다.
             `/1박~` 표기는 카드가 `stay_voucher` 카테고리로 이미 처리한다(단위가 빠지면 뜻이 달라진다). */
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${DEAL_GRID_GAP}`}>
            {items.map((s) => {
              const typeLabel = s.property_type ? (PROPERTY_TYPE_LABELS[s.property_type] || s.property_type) : ''
              const starLabel = s.star_rating ? `${s.star_rating}성급` : ''
              return (
                <GroupBuyFeedCard
                  key={s.id}
                  p={{
                    id: s.id,
                    name: s.name,
                    price: s.price_from ?? 0,
                    image_url: s.image_url || '',
                    category: 'stay_voucher',
                    restaurant_address: [s.region_sido, s.region_sigungu].filter(Boolean).join(' '),
                    avg_rating: s.avg_rating ?? undefined,
                    review_count: s.review_count ?? undefined,
                  } as never}
                  aboveFold={false}
                  flags={
                    (typeLabel || starLabel) ? (
                      <p className="text-[11px] font-bold leading-none mb-1 text-gray-900 dark:text-gray-100">
                        {[typeLabel, starLabel].filter(Boolean).join(' · ')}
                      </p>
                    ) : null
                  }
                  /* 🔗 날짜·인원을 반드시 이어 보낸다 — 빠지면 상세가 오늘 날짜로 다시 잡아 요금이 달라진다. */
                  to={`/stays/${s.id}?check_in=${filters.check_in}&check_out=${filters.check_out}&guests=${filters.guests}`}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Filters Modal */}
      {showFilters && (
        <div
          className="fixed inset-0 z-[10600] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShowFilters(false)}
          role="presentation"
        >
          <div className="bg-white dark:bg-[#11141C] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-gray-100 dark:border-[#2C2F35] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-[#11141C] flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#2C2F35]">
              <h3 className="text-base font-bold">검색 필터</h3>
              <button onClick={() => setShowFilters(false)} aria-label="닫기" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">지역</label>
                <input
                  type="text"
                  value={filters.region}
                  onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                  placeholder="서울 / 제주 / 부산 등"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1D1F29] border border-gray-200 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">체크인</label>
                  <input type="date" value={filters.check_in} onChange={(e) => setFilters({ ...filters, check_in: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1D1F29] border border-gray-200 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">체크아웃</label>
                  <input type="date" value={filters.check_out} onChange={(e) => setFilters({ ...filters, check_out: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1D1F29] border border-gray-200 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">인원</label>
                <input type="number" min={1} max={20} value={filters.guests} onChange={(e) => setFilters({ ...filters, guests: Number(e.target.value) || 1 })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1D1F29] border border-gray-200 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">숙소 타입</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
                    <button key={v} onClick={() => setFilters({ ...filters, property_type: filters.property_type === v ? '' : v })}
                      className={`p-2 rounded-lg text-[11px] font-semibold ${filters.property_type === v ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-700 dark:text-gray-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">판매 방식</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {/* 🎨 2026-09-03: 이모지 → 선 아이콘 · 선택은 **브랜드 블루**(구 로즈 `bg-brand` 잔재).
                      아이콘 컨셉은 유어딜 아이콘 세트(선/면) — 유틸리티만 lucide. */}
                  {([
                    { v: '', l: '전체', Icon: null },
                    { v: 'date', l: '날짜 지정', Icon: CalendarDays },
                    { v: 'voucher', l: '숙소 이용권', Icon: TicketStubIcon },
                  ] as const).map((m) => (
                    <button key={m.v} type="button"
                      onClick={() => setFilters({ ...filters, sale_mode: m.v })}
                      className={`inline-flex items-center justify-center gap-1 p-2 rounded-lg text-[11px] font-semibold ${filters.sale_mode === m.v ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-[#1D1F29] text-gray-700 dark:text-gray-300'}`}>
                      {m.Icon && <m.Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">정렬</label>
                <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1D1F29] border border-gray-200 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white">
                  <option value="recent">최신 등록</option>
                  <option value="price_asc">가격 낮은순</option>
                  <option value="price_desc">가격 높은순</option>
                  <option value="rating">평점 높은순</option>
                </select>
              </div>
              <button onClick={apply} className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-900">검색</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
