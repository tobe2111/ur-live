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
import { HOME_SERVICE_CATEGORIES, type HomeServiceAudience } from '@/shared/home-service'
import { formatNumber } from '@/utils/format'

/** 가게 → 숙소 → 집(2026-10-25 대표 "식당, 숙소 등을 타겟으로" · "일단 다 하자"). */
const GROUPS: readonly { audience: HomeServiceAudience; title: string; sub: string }[] = [
  { audience: 'store', title: '가게', sub: '식당·카페 사장님, 필요한 일을 적으면 근처 업체가 견적을 보내요' },
  { audience: 'lodging', title: '숙소', sub: '펜션·풀빌라·게스트하우스 관리' },
  { audience: 'home', title: '집', sub: '이사·청소처럼 집마다 가격이 다른 일' },
]

interface VoucherItem { id: number; name: string; price?: number; restaurant_name?: string }

export default function LifePage() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [open, setOpen] = useState(true)
  // 카테고리별 받는 업체 수. 0 이면 "업체 모집 중"(링크는 그대로 — 요청은 보관됐다가 업체가 생기면 간다).
  const [proCounts, setProCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    api.get('/api/group-buy/products?status=active&category=home_voucher')
      .then((r) => setVouchers(r.data?.success ? (r.data.data || []) : []))
      .catch(() => setVouchers([]))
    api.get('/api/home-service/config')
      .then((r) => { setOpen(r.data?.data?.open !== false); setProCounts(r.data?.data?.proCounts || null) })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title="생활 서비스 - 간판·방역·후드 청소·설비 수리·이사 견적 - 유어딜" description="요청서 한 번이면 근처 업체가 견적을 보내 드려요. 간판·방역·냉장 설비 같은 가게 관리부터 숙소 관리, 이사·청소까지 비교하고 마음에 드는 곳만 고르세요." url="/life" />

      <header className="ur-content-narrow px-4 pt-7 pb-5">
        <h1 className="text-[24px] font-extrabold tracking-tight">생활 서비스</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
          요청서를 올리면 근처 업체가 견적을 보내요. 비교하고 고른 한 곳에만 연락처가 전달돼요.
        </p>
        {!open && <p className="mt-3 text-[13px] font-bold text-tone-bad">지금은 잠시 요청을 받지 않아요.</p>}
      </header>

      <div className="ur-content-narrow space-y-8 px-4 pb-10">
        {GROUPS.map((g) => (
          <section key={g.audience}>
            <h2 className="text-[17px] font-bold">{g.title}</h2>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{g.sub}</p>
            <ul className="mt-3 divide-y divide-rule rounded-2xl bg-surface px-5 shadow-lift">
              {HOME_SERVICE_CATEGORIES.filter((d) => d.audience === g.audience).map((def) => {
                const items = vouchers.filter((v) => def.voucherKeywords.some((k) => String(v.name || '').includes(k))).slice(0, 3)
                return (
                  <li key={def.key} className="py-4">
                    <Link to={`/life/request/${def.key}`} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold">{def.label}</span>
                        <span className="mt-1 block text-[13px] text-gray-600 dark:text-gray-300">{def.blurb}</span>
                      </span>
                      {proCounts && !proCounts[def.key]
                        ? <span className="shrink-0 text-[13px] text-gray-500 dark:text-gray-400">업체 모집 중</span>
                        : <span className="shrink-0 text-[13px] font-bold text-brand-text">무료 견적</span>}
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    </Link>
                    {items.length > 0 && (
                      <ul className="mt-3 divide-y divide-rule border-t border-rule">
                        {items.map((v) => (
                          <li key={v.id}>
                            <Link to={`/pass/${v.id}`} className="flex items-center justify-between gap-3 py-3">
                              <span className="min-w-0 truncate text-[13px]">{v.restaurant_name ? `${v.restaurant_name} · ` : ''}{v.name}</span>
                              <span className="shrink-0 text-[13px] font-bold">{formatNumber(v.price)}원</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <div className="flex flex-col gap-2 pt-2 text-center text-[13px]">
          <Link to="/life/requests" className="font-bold text-brand-text">내 요청 보기</Link>
          <Link to="/life/pro" className="text-gray-500 dark:text-gray-400">간판·방역·청소·수리·이사 업체세요? 근처 요청을 알림톡으로 받기 →</Link>
        </div>
      </div>
    </div>
  )
}
