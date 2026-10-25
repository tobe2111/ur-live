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
import { Link, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { ChevronRight } from 'lucide-react'
import { HOME_SERVICE_CATEGORIES, type HomeServiceAudience } from '@/shared/home-service'
import { formatNumber } from '@/utils/format'
import { LIFE_TILES, LifeTileIcon } from './life-tiles'
import { LIFE_HUB_SEO } from '@/shared/seo/life-hub-seo'
import { LIFE_FAQ } from '@/shared/life-faq'
import { withSiteName } from '@/shared/seo/consumer-surfaces'
// 밑줄 탭은 교환권 카테고리 탭과 같은 클래스(선택 신호가 화면마다 갈리지 않게).
import { VOUCHER_CAT_TAB } from '@/shared/voucher-tile'

/**
 * 가게 → 숙소 → 집 (2026-10-25 대표 "우리는 사장님을 위한 생활 서비스" — 가게가 첫 탭).
 * 화면은 A안(아이콘 격자): 카테고리마다 붙던 설명 문장을 빼고 짧은 이름 + 그림만 둔다
 * (대표 "너무 글자가 많달까? 눈에 잘 안 들어오고"). 설명은 요청서 첫 질문 화면이 맡는다.
 */
const TABS: readonly { audience: HomeServiceAudience; title: string }[] = [
  { audience: 'store', title: '가게' },
  { audience: 'lodging', title: '숙소' },
  { audience: 'home', title: '집' },
]

interface VoucherItem { id: number; name: string; price?: number; restaurant_name?: string }

export default function LifePage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.audience === params.get('tab'))?.audience ?? 'store'
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [open, setOpen] = useState(true)
  // 카테고리별 받는 업체 수 — 하나라도 0 이면 격자 위에 한 줄로만 알린다(타일마다 붙이면 다시 글자가 많아진다).
  const [proCounts, setProCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    api.get('/api/group-buy/products?status=active&category=home_voucher')
      .then((r) => setVouchers(r.data?.success ? (r.data.data || []) : []))
      .catch(() => setVouchers([]))
    api.get('/api/home-service/config')
      .then((r) => { setOpen(r.data?.data?.open !== false); setProCounts(r.data?.data?.proCounts || null) })
      .catch(() => {})
  }, [])

  const defs = HOME_SERVICE_CATEGORIES.filter((d) => d.audience === tab)
  const recruiting = !!proCounts && defs.some((d) => !proCounts[d.key])
  const deals = vouchers.filter((v) => defs.some((d) => d.voucherKeywords.some((k) => String(v.name || '').includes(k)))).slice(0, 4)

  return (
    <div className="min-h-[100dvh] bg-surface text-ink pb-safe-nav">
      <SEO title={withSiteName(LIFE_HUB_SEO.title)} description={LIFE_HUB_SEO.description} url="/life" />

      <header className="ur-content-narrow px-5 pt-7">
        {/* 2026-10-25 대표 "일반 대중 전체가 아니라 사장님 대상이라는 걸 나타내 주면" — 숨고·미소와 갈리는 첫 줄. */}
        <h1 className="text-[24px] font-bold leading-snug tracking-tight">사장님, 가게 일은<br />여기서 맡기세요</h1>
        <p className="mt-2 text-[15px] text-gray-600 dark:text-gray-300">간판·방역·설비 수리까지 근처 업체 견적을 무료로 비교해요</p>
        {!open && <p className="mt-3 text-[13px] font-medium text-tone-bad">지금은 잠시 요청을 받지 않아요.</p>}
      </header>

      <nav className="ur-content-narrow mt-4 flex gap-5 border-b border-line px-5" aria-label="생활 서비스 분류">
        {TABS.map((t) => {
          const on = t.audience === tab
          return (
            <button key={t.audience} type="button" aria-pressed={on}
              onClick={() => setParams(t.audience === 'store' ? {} : { tab: t.audience }, { replace: true })}
              className={`${VOUCHER_CAT_TAB.tab} ${on ? VOUCHER_CAT_TAB.on : VOUCHER_CAT_TAB.off}`}>
              {t.title}
            </button>
          )
        })}
      </nav>

      <div className="ur-content-narrow px-3 pb-10">
        <ul className="grid grid-cols-4 gap-x-1 gap-y-6 pt-6">
          {defs.map((def) => (
            <li key={def.key}>
              <Link to={`/life/request/${def.key}`} className="flex flex-col items-center gap-2 active:opacity-70">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warm">
                  <LifeTileIcon category={def.key} />
                </span>
                <span className="whitespace-pre-line text-center text-[13px] font-medium leading-tight">{LIFE_TILES[def.key][0]}</span>
              </Link>
            </li>
          ))}
        </ul>

        {recruiting && (
          <p className="mx-2 mt-8 rounded-2xl bg-warm px-4 py-3 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
            아직 업체를 모으는 일도 요청은 받아요. 업체가 들어오는 대로 보내 드려요.
          </p>
        )}

        {deals.length > 0 && (
          <section className="mx-2 mt-8">
            <h2 className="text-[17px] font-bold">정해진 가격으로 바로 사기</h2>
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
        <section className="mx-2 mt-8" aria-labelledby="life-faq">
          <h2 id="life-faq" className="text-[17px] font-bold">자주 묻는 질문</h2>
          <div className="mt-2 divide-y divide-rule border-y border-rule">
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

        <Link to="/life/requests" className="mx-2 mt-8 flex h-12 items-center justify-between border-y border-rule px-1">
          <span className="text-[15px] font-medium">내 요청 보기</span>
          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </Link>
        <p className="mt-6 text-center text-[13px] text-gray-500 dark:text-gray-400">견적은 무료이고, 비교해서 고른 한 곳에만 연락처가 전달돼요.</p>
        <Link to="/life/pro" className="mt-3 block text-center text-[13px] text-gray-500 dark:text-gray-400">업체세요? 근처 요청을 알림톡으로 받기</Link>
      </div>
    </div>
  )
}
