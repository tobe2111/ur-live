/**
 * 🏠 생활 — 가게(간판·방역·후드·설비) + 숙소(청소·수영장) + 집(이사·청소·방역)
 *   (2026-10-24 대표 확정 · 결재 `docs/decisions/2026-10-24-home-service-quotes.md` · 2026-10-25 사장님 먼저)
 *
 * 카테고리마다 두 길을 함께 둔다:
 *  - **견적 받기**(숨고식): 요청서를 올리면 근처 사장님에게 알림이 가고, 견적이 오면 비교해 고른다.
 *  - **바로 사기**(정찰가 이용권): 그 일을 정해진 가격으로 파는 사장님의 이용권.
 * 음식점·숙소와 다르게 가는 이유: 이사처럼 집마다 가격이 다른 일은 정찰가로 팔 수 없다.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { ChevronRight } from 'lucide-react'
import { HOME_SERVICE_CATEGORIES, categoryDef, type HomeServiceCategory } from '@/shared/home-service'
import { formatNumber } from '@/utils/format'
import { LIFE_TILES, LifeTileIcon } from './life-tiles'
import { LIFE_HUB_SEO } from '@/shared/seo/life-hub-seo'
import { LIFE_FAQ } from '@/shared/life-faq'
import { withSiteName } from '@/shared/seo/consumer-surfaces'
import LifeHero from './LifeHero'
import type { LifeLive } from './life-live'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 13차 ④⑤ — 이용 순서 1·2·3 이 차례로 떠오르며 번호가 톡 튀고, 서비스 타일은 차례로 나타나며 누르면 눌렸다 돌아온다.
injectMotionCss('ur-m-life', `@keyframes ur-life-in { from { opacity: 0; transform: translateY(10px); } }@keyframes ur-life-n { 0% { transform: scale(.4); opacity: 0; } 70% { transform: scale(1.25); opacity: 1; } 100% { transform: none; } }.ur-life-step { animation: ur-life-in .38s cubic-bezier(.2,.9,.3,1) backwards; animation-delay: calc(var(--i, 0) * 160ms); }.ur-life-step .ur-life-n { display: inline-block; animation: ur-life-n .4s cubic-bezier(.3,1.4,.5,1) backwards; animation-delay: calc(var(--i, 0) * 160ms + 120ms); }.ur-life-tile { animation: ur-life-in .34s cubic-bezier(.2,.9,.3,1) backwards; animation-delay: calc(var(--i, 0) * 40ms); }.ur-life-tile .ur-life-ic { transition: transform .18s cubic-bezier(.3,1.4,.5,1); }.ur-life-tile a:active .ur-life-ic { transform: scale(.86); }@media (prefers-reduced-motion: reduce){.ur-life-step,.ur-life-step .ur-life-n,.ur-life-tile{animation:none!important}.ur-life-tile .ur-life-ic{transition:none}}`)

/**
 * 🏠 2026-10-25 대표 *"생활 페이지는 이런 형태여야 하지 않을까? 오늘의집인데"* — 탭 셋을 걷고
 * **상황별 흰 카드**를 세로로 쌓는다(오늘의집 인테리어/생활 탭과 같은 문법, 참고 `docs/design/assets/life-ohou-ref-2026-10-25.jpg`).
 * 탭은 고르기 전엔 다른 두 묶음이 안 보여 "가게만 하는 곳" 처럼 읽혔다. 카드는 한 번 내리면 전부 보인다.
 *  - 가게 문 열 때: 큰 줄 두 개(간판·인테리어 — 큰 공사라 따로 세운다)
 *  - 가게 운영 중 · 숙소 운영 중 · 이사·집: 아이콘 줄(넘치면 4개 + 자세히)
 * 카테고리 설명 문장은 여전히 안 쓴다(대표 "글자가 많달까") — 큰 줄의 한 줄 부제만 이 파일에 짧게 둔다.
 */
type Group = { title: string; keys: readonly HomeServiceCategory[]; big?: boolean }
const GROUPS: readonly Group[] = [
  { title: '가게 문 열 때', keys: ['signage', 'store_interior'], big: true },
  { title: '가게 운영 중이라면', keys: ['store_pest', 'kitchen_hood', 'store_repair', 'store_fridge', 'store_aircon', 'store_clean', 'store_drain'] },
  { title: '숙소 운영 중이라면', keys: ['lodging_clean', 'lodging_pool'] },
  { title: '이사·집 일이 생기면', keys: ['move', 'move_in_clean', 'aircon_clean', 'home_interior', 'home_grout', 'home_pest'] },
]
/** 큰 줄의 한 줄 부제(오늘의집 "오늘의집이 시공하자, A/S 보장" 자리). */
const BIG_SUB: Partial<Record<HomeServiceCategory, string>> = {
  signage: '새 간판·교체·LED 수리까지 견적 비교',
  store_interior: '오픈·리뉴얼 공사, 근처 업체 견적 비교',
}
const ICON_ROW_MAX = 5

interface VoucherItem { id: number; name: string; price?: number; restaurant_name?: string }

const CARD = 'rounded-2xl px-5 py-5'

function IconRow({ keys }: { keys: readonly HomeServiceCategory[] }) {
  const [more, setMore] = useState(false)
  const folded = keys.length > ICON_ROW_MAX && !more
  const shown = folded ? keys.slice(0, ICON_ROW_MAX - 1) : keys
  const tile = 'flex flex-col items-center gap-2 active:opacity-70'
  return (
    <ul className="mt-4 grid grid-cols-5 gap-x-1 gap-y-5">
      {shown.map((k, ti) => (
        <li key={k} className="ur-life-tile" style={{ '--i': Math.min(ti, 10) } as React.CSSProperties}>
          <Link to={`/life/request/${k}`} className={tile}>
            <span className="ur-life-ic flex h-12 w-12 items-center justify-center"><LifeTileIcon category={k} size={40} /></span>
            <span className="whitespace-pre-line text-center text-[13px] leading-tight">{LIFE_TILES[k][0]}</span>
          </Link>
        </li>
      ))}
      {folded && (
        <li>
          <button type="button" onClick={() => setMore(true)} className={`${tile} w-full`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warm"><ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400" /></span>
            <span className="text-center text-[13px] leading-tight">자세히</span>
          </button>
        </li>
      )}
    </ul>
  )
}

export default function LifePage() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [open, setOpen] = useState(true)
  // 카테고리별 받는 업체 수 — 하나라도 0 이면 한 줄로만 알린다(타일마다 붙이면 다시 글자가 많아진다).
  const [proCounts, setProCounts] = useState<Record<string, number> | null>(null)
  const [live, setLive] = useState<LifeLive | null>(null)

  useEffect(() => {
    api.get('/api/group-buy/products?status=active&category=home_voucher')
      .then((r) => setVouchers(r.data?.success ? (r.data.data || []) : []))
      .catch(() => setVouchers([]))
    api.get('/api/home-service/config')
      .then((r) => { setOpen(r.data?.data?.open !== false); setProCounts(r.data?.data?.proCounts || null); setLive(r.data?.data?.live || null) })
      .catch(() => {})
  }, [])

  const recruiting = !!proCounts && HOME_SERVICE_CATEGORIES.some((d) => !proCounts[d.key])
  const deals = vouchers.slice(0, 4)

  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title={withSiteName(LIFE_HUB_SEO.title)} description={LIFE_HUB_SEO.description} url="/life" />

      {/* 🖥️ 2026-10-26 PC: 액자를 벗고(pc-fullbleed) 두 칸 — 왼쪽 업종, 오른쪽 바로 사기·질문·업체 안내. */}
      <div className="mx-auto w-full max-w-[720px] space-y-3 px-4 pb-10 pt-5 lg:max-w-[1120px] lg:px-8 lg:pt-8">
        {/* 🏠 2026-11-03 대표 확정 안 5 — 평면 머리 + 주 버튼(업종 고르기 창) + 실시간 한 줄(C). 상세 `LifeHero.tsx`. */}
        <LifeHero groups={GROUPS} open={open} live={live} />

        <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-5 lg:space-y-0">
        <div className="space-y-3">
        {GROUPS.map((g) => (
          <section key={g.title} className={CARD}>
            <h2 className="text-[16px] font-semibold">{g.title}</h2>
            {g.big ? (
              <ul className="mt-2 divide-y divide-rule">
                {g.keys.map((k) => {
                  const def = categoryDef(k)
                  return (
                    <li key={k}>
                      <Link to={`/life/request/${k}`} className="flex items-center gap-4 py-3 active:opacity-70">
                        <LifeTileIcon category={k} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold">{def?.label} 업체 찾기</span>
                          <span className="mt-1 block truncate text-[13px] text-gray-500 dark:text-gray-400">{BIG_SUB[k]}</span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : <IconRow keys={g.keys} />}
          </section>
        ))}

        {recruiting && (
          <p className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
            아직 업체를 모으는 일도 요청은 받아요. 업체가 들어오는 대로 보내 드려요.
          </p>
        )}

        </div>
        <aside className="space-y-3 lg:sticky lg:top-24">
        {deals.length > 0 && (
          <section className={CARD}>
            <h2 className="text-[16px] font-semibold">정해진 가격으로 바로 사기</h2>
            <ul className="mt-2 divide-y divide-rule">
              {deals.map((v) => (
                <li key={v.id}>
                  <Link to={`/pass/${v.id}`} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 truncate text-[15px]">{v.restaurant_name ? `${v.restaurant_name} · ` : ''}{v.name}</span>
                    <span className="shrink-0 text-[15px] font-bold">{formatNumber(v.price)}원</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 자주 묻는 질문 — 크롤러 본문·FAQPage JSON-LD 와 같은 배열(`shared/life-faq.ts`). */}
        <section className={CARD} aria-labelledby="life-faq">
          <h2 id="life-faq" className="text-[16px] font-semibold">자주 묻는 질문</h2>
          <div className="mt-2 divide-y divide-rule">
            {LIFE_FAQ.map((f) => (
              <details key={f.question} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium">
                  {f.question}
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90 dark:text-gray-500" />
                </summary>
                <p className="pt-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <Link to="/life/pro" className={`${CARD} flex items-center justify-between gap-3`}>
          <span>
            <span className="block text-[15px] font-medium">업체세요? 근처 요청을 알림톡으로 받기</span>
            <span className="mt-1 block text-[13px] text-gray-500 dark:text-gray-400">카카오 로그인 후 한 화면이면 가입 끝</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
        </Link>
        <p className="pt-3 text-center text-[13px] text-gray-500 dark:text-gray-400">견적은 무료이고, 비교해서 고른 한 곳에만 연락처가 전달돼요.</p>
        </aside>
        </div>
      </div>
    </div>
  )
}
