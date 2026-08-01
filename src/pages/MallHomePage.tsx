/**
 * 🏬 운영자 몰 홈 — `urdeal.kr/{슬러그}` (세션 ③-a, O2·C2·C3 진입)
 *
 * 대표 UX 기준(2026-07-29):
 *   ① **1순위 검증 환경 = 카카오톡 인앱 브라우저** ⇒ 비로그인·저사양·좁은 폭에서 먼저 성립해야 한다.
 *   ③ **신뢰 + 마감·잔여 수량 강조** ⇒ 카드에서 제일 먼저 읽히는 건 남은 시간과 남은 수량이다.
 *   ⑤ **본진 입구 금지** ⇒ 이 화면에서 유어딜 홈·탭·추천으로 가는 링크를 만들지 않는다.
 *   ⑥ **디자인 개선 금지** ⇒ 기존 토큰/패턴만 쓴다. 새 비주얼 언어를 만들지 않는다.
 *
 * 🔴 몰을 못 찾으면(없음·`consumer_path=0`) **404 를 그대로 보여준다.** 조용히 본진을 보여주지 않는다 —
 *   그러면 A몰 링크를 받은 사람이 유어딜 홈을 보게 되고, 그건 "몰이 열렸다"보다 나쁜 결과다.
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import NotFoundPage from '@/pages/NotFoundPage'
import { POWERED_BY, PAYMENT_TRUST_NOTE } from '@/shared/mall/branding'
import { cfImage } from '@/utils/cf-image'
import { parseUTCDate } from '@/utils/date'
import { formatWon } from '@/utils/format'
import { STORAGE_LABEL, STORAGE_NOTICE, type StorageKind } from '@/shared/pickup'

interface MallInfo {
  id: number; slug: string; name: string; initial: string
  logoUrl: string | null; colorLight: string; colorDark: string; intro: string; contactUrl: string | null
}
interface MallItem {
  product_id: number; name: string; image_url: string | null
  list_price: number; gb_price: number; discount_pct: number
  deadline: string | null; stock: number | null
  /** 📦 픽업 — 없으면 `null`(빈 껍데기를 그리지 않는다). */
  pickup: { date: string | null; place: string | null; storage: StorageKind | null } | null
}

/** 남은 시간 — "2일 3시간" / "5시간 12분" / "곧 마감". 분 단위 미만은 굳이 안 센다(재렌더 비용). */
function remainLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = parseUTCDate(iso)
  if (!d || Number.isNaN(d.getTime())) return null
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return null
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}분 남음`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 ${min % 60}분 남음`
  return `${Math.floor(hr / 24)}일 ${hr % 24}시간 남음`
}

/** 픽업일 라벨 — "8월 10일". UTC-naive 오해석을 피해 `parseUTCDate` 를 쓴다(이 레포 반복 사고 클래스). */
function pickupDayLabel(iso: string): string {
  const d = parseUTCDate(iso)
  if (Number.isNaN(d.getTime())) return ''
  const kst = new Date(d.getTime() + 9 * 3600 * 1000)
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`
}

export default function MallHomePage() {
  const { mallSlug = '' } = useParams()
  const [mall, setMall] = useState<MallInfo | null>(null)
  const [items, setItems] = useState<MallItem[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    // 몰 확정과 상품을 **병렬**로 — 카톡 인앱의 느린 회선에서 왕복 2회는 체감이 크다.
    //   상품 응답이 먼저 와도 몰이 404 면 버린다(아래 state 분기).
    type MallResp = { success?: boolean; mall?: MallInfo }
    type ListResp = { success?: boolean; data?: MallItem[] }
    const p1 = fetch(`/api/mall/${encodeURIComponent(mallSlug)}`)
      .then((r) => r.json() as Promise<MallResp>).catch(() => null)
    const p2 = fetch(`/api/mall/${encodeURIComponent(mallSlug)}/products`)
      .then((r) => r.json() as Promise<ListResp>).catch(() => null)
    Promise.all([p1, p2]).then(([m, list]) => {
      if (!alive) return
      if (!m?.success || !m?.mall) { setState('notfound'); return }
      setMall(m.mall)
      setItems(Array.isArray(list?.data) ? list.data : [])
      setState('ok')
    })
    return () => { alive = false }
  }, [mallSlug])

  if (state === 'loading') return <BrandLoader fullScreen />
  // 🔴 몰이 아니면 평소의 404. 본진으로 흘려보내지 않는다.
  if (state === 'notfound' || !mall) return <NotFoundPage />

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0F151D]">
      <SEO title={`${mall.name} - 공동구매`} description={mall.intro} url={`/${mall.slug}`} />

      {/* 헤더 — 로고(없으면 이니셜) · 이름 · 소개 1줄 */}
      <header className="px-4 pt-6 pb-4 ur-content-wide mx-auto">
        <div className="flex items-center gap-3">
          {mall.logoUrl ? (
            <img src={cfImage(mall.logoUrl, { width: 112 })} alt="" width={56} height={56}
              className="w-14 h-14 rounded-2xl object-cover border border-gray-100 dark:border-[#2A2A2A]" />
          ) : (
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold"
              style={{ backgroundColor: mall.colorLight }} aria-hidden>{mall.initial}</div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white truncate">{mall.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{mall.intro}</p>
          </div>
        </div>

        {/* 신뢰 — 대표 UX 기준 ③. 결제 주체를 밝히되 **환불 주체는 단정하지 않는다**(기획 확정 문구). */}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">🔒 {PAYMENT_TRUST_NOTE}</p>
      </header>

      <main className="px-4 pb-16 ur-content-wide mx-auto">
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            진행 중인 공동구매가 없습니다.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((it) => {
              const remain = remainLabel(it.deadline)
              return (
                <li key={it.product_id}>
                  <Link to={`/products/${it.product_id}`} className="block group">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]">
                      {it.image_url && (
                        <img src={cfImage(it.image_url, { width: 400 })} alt="" loading="lazy"
                          className="w-full h-full object-cover" />
                      )}
                      {/* 🔴 마감·잔여를 이미지 위에 — 카드에서 **제일 먼저 읽혀야 하는 정보**다(기준 ③). */}
                      {remain && (
                        <span className="absolute left-2 top-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[11px] font-semibold">
                          ⏰ {remain}
                        </span>
                      )}
                      {typeof it.stock === 'number' && it.stock > 0 && it.stock <= 10 && (
                        <span className="absolute right-2 top-2 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold">
                          {it.stock}개 남음
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-900 dark:text-gray-100 line-clamp-2">{it.name}</p>
                    <p className="mt-0.5 flex items-baseline gap-1.5">
                      {it.discount_pct > 0 && (
                        <span className="text-sm font-extrabold text-rose-600">{it.discount_pct}%</span>
                      )}
                      <span className="text-sm font-extrabold text-gray-900 dark:text-white">{formatWon(it.gb_price)}</span>
                      {it.list_price > it.gb_price && (
                        <span className="text-xs text-gray-400 line-through">{formatWon(it.list_price)}</span>
                      )}
                    </p>
                    {/* 📦 픽업 — **언제 받는지**가 카드에서 보여야 "배송인가?" 문의가 안 쏟아진다.
                        보관구분은 배지로 짧게(고지 전문은 상세에서). */}
                    {it.pickup && (it.pickup.date || it.pickup.storage) && (
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
                        {it.pickup.date && <span>📦 {pickupDayLabel(it.pickup.date)} 픽업</span>}
                        {it.pickup.storage && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
                            {STORAGE_LABEL[it.pickup.storage]}
                          </span>
                        )}
                      </p>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {/* 📦 보관 고지 — **카드마다 반복하지 않고** 목록에 한 번. 카드가 시끄러워지면 마감·가격이 묻힌다.
          ⚠️ 문구는 법무 확인 대기(체크리스트 X4c) 임시 표기다. */}
      {(() => {
        const kinds = Array.from(new Set(items.map((i) => i.pickup?.storage).filter(Boolean))) as StorageKind[]
        if (kinds.length === 0) return null
        return (
          <aside className="px-4 pb-6 ur-content-wide mx-auto space-y-1">
            {kinds.map((k) => (
              <p key={k} className="text-[11px] text-gray-500 dark:text-gray-400">· {STORAGE_NOTICE[k]}</p>
            ))}
          </aside>
        )
      })()}

      {/* ⑤ 본진 입구 금지 — 링크가 아니라 **문자열**이다(클릭 안 됨). */}
      <footer className="px-4 pb-10 text-center">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{POWERED_BY}</span>
      </footer>
    </div>
  )
}
