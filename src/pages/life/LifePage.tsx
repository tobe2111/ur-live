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
import { LifeTileIcon } from './life-tiles'
import { LIFE_GROUPS, LIFE_BIG_SUB, LIFE_ICON_ROW_MAX, LIFE_TILE_LABEL, LIFE_COPY, LIFE_CLS as C } from '@/shared/life-page'
import { LIFE_HUB_SEO } from '@/shared/seo/life-hub-seo'
import { LIFE_FAQ } from '@/shared/life-faq'
import { withSiteName } from '@/shared/seo/consumer-surfaces'
import LifeHero from './LifeHero'
import { takeBootFirstScreen } from '@/lib/boot-first-screen'
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
// 🧱 2026-11-08 묶음·부제·칸 수·클래스는 서버 첫 화면과 같은 SSOT(`shared/life-page.ts`) — 두 벌이면 마운트 때 튄다.
const GROUPS = LIFE_GROUPS
const BIG_SUB = LIFE_BIG_SUB
const ICON_ROW_MAX = LIFE_ICON_ROW_MAX

interface VoucherItem { id: number; name: string; price?: number; restaurant_name?: string }

const CARD = C.card // 📏 2026-11-04 대표 *"양쪽 공백 왜 이렇게"* — 판이 평면이라 가장자리는 바깥 하나(20)만.

function IconRow({ keys, calm }: { keys: readonly HomeServiceCategory[]; calm: boolean }) {
  const [more, setMore] = useState(false)
  const folded = keys.length > ICON_ROW_MAX && !more
  const shown = folded ? keys.slice(0, ICON_ROW_MAX - 1) : keys
  const tile = C.tile
  return (
    <ul className={C.iconGrid}>
      {shown.map((k, ti) => (
        <li key={k} className={calm ? undefined : C.tileLi} style={{ '--i': Math.min(ti, 10) } as React.CSSProperties}>
          <Link to={`/life/request/${k}`} className={tile}>
            <span className={C.tileIc}><LifeTileIcon category={k} size={40} /></span>
            <span className={C.tileLabel}>{LIFE_TILE_LABEL[k]}</span>
          </Link>
        </li>
      ))}
      {folded && (
        <li>
          <button type="button" onClick={() => setMore(true)} className={`${tile} w-full`}>
            <span className={C.moreIc}><ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400" /></span>
            <span className={C.moreLabel}>{LIFE_COPY.more}</span>
          </button>
        </li>
      )}
    </ul>
  )
}

export default function LifePage() {
  // 🏠 2026-11-08 서버가 첫 화면을 그렸으면 타일이 이미 보인다 — 마운트 때 다시 떠오르게(투명 → 보임) 하면 깜빡인다.
  const [calm] = useState(() => takeBootFirstScreen('/life') !== null)
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
    <div className={C.page}>
      <SEO title={withSiteName(LIFE_HUB_SEO.title)} description={LIFE_HUB_SEO.description} url="/life" />

      {/* 🖥️ 2026-10-26 PC: 액자를 벗고(pc-fullbleed) 두 칸 — 왼쪽 업종, 오른쪽 바로 사기·질문·업체 안내. */}
      <div className={C.wrap}>
        {/* 🏠 2026-11-03 대표 확정 안 5 — 평면 머리 + 주 버튼(업종 고르기 창) + 실시간 한 줄(C). 상세 `LifeHero.tsx`. */}
        <LifeHero groups={GROUPS} open={open} live={live} />

        <div className={C.cols}>
        <div className={C.left}>
        {GROUPS.map((g) => (
          <section key={g.title} className={CARD}>
            <h2 className={C.cardTitle}>{g.title}</h2>
            {g.big ? (
              <ul className={C.bigList}>
                {g.keys.map((k) => {
                  const def = categoryDef(k)
                  return (
                    <li key={k}>
                      <Link to={`/life/request/${k}`} className={C.bigLink}>
                        <LifeTileIcon category={k} size={44} />
                        <span className={C.bigText}>
                          <span className={C.bigLabel}>{def?.label} 업체 찾기</span>
                          <span className={C.bigSub}>{BIG_SUB[k]}</span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : <IconRow keys={g.keys} calm={calm} />}
          </section>
        ))}

        {recruiting && (
          <p className="rounded-2xl py-3 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
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
