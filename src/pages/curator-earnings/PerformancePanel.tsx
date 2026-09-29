/**
 * 🎫 2026-09-29 (대표 확정 **B안**) 소개 콘솔의 **성과 한 판** — 탭 셋으로 합쳤다.
 *
 * ## 왜 합쳤나
 * 종전엔 `인기 핀` · `영입한 매장` · `최근 적립` 이 **각자 판**이었다. 셋 다 "무엇이 벌어주나"
 * 한 질문의 다른 얼굴인데 화면에선 서로 모르는 사이였다. 대표가 *"섹션이 너무 많다"* 를 고른 자리다.
 * ⇒ 판 하나 + 탭 셋. 세로 길이가 3분의 1이 되고, 비교가 같은 자리에서 일어난다.
 *
 * ## 🔴 목록 문법(`ListRow`)을 쓰지 않는다 — 대표가 *"목록 문법 자체가 안 맞는다"* 를 골랐다
 * 그 문법은 **마이의 메뉴**를 위해 만든 것이다(아이콘 원 + 제목 + 설명 + 화살표). 콘솔은 메뉴가
 * 아니라 **성적표**라 필요한 것이 다르다: 순번 · 이름 · **오른쪽에 정렬된 금액**. 화살표도 아이콘 원도
 * 자리만 먹는다. ⇒ 콘솔 전용 **순위표**를 쓴다(규칙 ③ 숫자가 주인공).
 *
 * ## 🔴 없는 숫자를 지어내지 않는다 (여기가 이 파일에서 제일 조심한 곳)
 * 시안에는 상품별 **매출액**이 있었는데 서버엔 그 값이 없다:
 *   · `top_pins` 는 **클릭 수**만 준다(`ORDER BY click_count`, LIMIT 3).
 *   · `recent_earnings` 는 **최근 30건**이다(전체 기간이 아니라 *최근 30건*, `LIMIT 30`).
 * ⇒ 상품 순위는 `recent_earnings` 를 상품별로 **합산한 적립액**으로 내고, 라벨에 *"최근 30건 기준"*
 *   이라고 **그대로 적는다**. 30일 전체 합계인 척하면 그건 거짓말이다.
 *   썸네일은 `top_pins` 에 같은 상품이 있으면 빌려 온다(없으면 안 그린다 — 자리만 비운다).
 *
 * ## ⚠️ 이 판이 못 하는 것
 *   · 클릭은 많은데 안 팔리는 핀은 여기서 안 보인다(그건 유어샵 관리 화면의 일이다).
 *     대신 `top_pins` 에 있는 상품이면 부제에 클릭 수를 함께 적는다.
 *   · 매장 탭은 별도 API(`getIntroducedStores`)라 실패하면 그 탭만 조용히 빈다(판은 남는다).
 *
 * ## 🔴 `공구 대행 등록` 버튼은 없다 (2026-09-29 대표 확정 — 물었더니 "아니")
 * 매장 **줄 전체가 그 동작**이다. 목록에 버튼을 심으면 줄마다 파란 알약이 붙어 순위표가
 * 다시 소음이 된다. 동작은 사라지지 않았다(누르면 대행 등록 모달이 열린다).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { curatorApi, type DashboardStats } from '@/features/curator/api/curator-api'
import { formatWon, formatNumber, safeNum } from '@/utils/format'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { parseUTCDate } from '@/utils/date'

type Tab = 'product' | 'store' | 'log'
type Store = { id: number; business_name: string | null; status: string | null; referral_bonus_until: string | null; total_orders: number; total_sales: number }

/** 최근 적립 내역을 상품별로 합산 — 이 목록이 가진 만큼만 말한다(최근 30건). */
export function byProduct(items: NonNullable<DashboardStats['recent_earnings']>) {
  const m = new Map<number, { id: number; name: string; total: number; count: number }>()
  for (const e of items) {
    if (e.status === 'refunded') continue
    let cur = m.get(e.product_id)
    if (!cur) { cur = { id: e.product_id, name: e.product_name || '상품', total: 0, count: 0 }; m.set(e.product_id, cur) }
    cur.total += safeNum(e.commission)
    cur.count += 1
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 5)
}

/** 순위 한 줄 — 순번 · 이름/부제 · 오른쪽 값. 아이콘 원도 화살표도 없다. */
function Row({ n, to, onClick, thumb, name, sub, value, muted }: {
  n: number; to?: string; onClick?: () => void; thumb?: string | null; name: string; sub: string; value: string; muted?: boolean
}) {
  const inner = (
    <>
      <span className={`w-3.5 shrink-0 text-[12px] font-extrabold tabular-nums ${n === 1 ? 'text-brand-text' : 'text-gray-400 dark:text-gray-500'}`}>{n}</span>
      {thumb && (
        <img
          src={cfImage(thumb, { width: 96, format: 'auto' }) || thumb}
          alt=""
          width={36}
          height={36}
          loading="lazy"
          decoding="async"
          className="w-9 h-9 rounded-lg object-cover shrink-0"
          onError={(e) => cfImageOnError(e.currentTarget, thumb)}
        />
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-bold tracking-[-0.01em] truncate text-gray-900 dark:text-white">{name}</span>
        <span className="block text-[11.5px] text-gray-400 dark:text-gray-500 mt-px truncate">{sub}</span>
      </span>
      <span className={`shrink-0 text-[13.5px] font-extrabold tabular-nums ${muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{value}</span>
    </>
  )
  const cls = 'w-full text-left flex items-center gap-2.5 py-2.5 border-t border-rule first:border-t-0'
  if (to) return <Link to={to} className={`${cls} active:opacity-70`}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} active:opacity-70`}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

export default function PerformancePanel({ stats, onProxy }: {
  stats: DashboardStats
  onProxy: (s: { id: number; name: string }) => void
}) {
  const [tab, setTab] = useState<Tab>('product')
  const [stores, setStores] = useState<{ total_commission: number; stores: Store[] } | null>(null)

  useEffect(() => {
    curatorApi.getIntroducedStores().then((r: any) => { if (r?.success) setStores(r) }).catch(() => {})
  }, [])

  const earnings = stats.recent_earnings || []
  const products = useMemo(() => byProduct(earnings), [earnings])
  const clicksById = useMemo(
    () => new Map((stats.top_pins || []).map((p) => [p.product_id, p])),
    [stats.top_pins],
  )

  const hasStores = !!stores?.stores.length
  const tabs: Array<[Tab, string]> = [['product', '상품'], ...(hasStores ? [['store', '매장'] as [Tab, string]] : []), ['log', '내역']]
  // 매장 탭이 늦게 생겨도 선택이 어긋나지 않게 — 없는 탭이면 첫 탭으로 읽는다.
  const active = tabs.some(([k]) => k === tab) ? tab : 'product'

  if (!products.length && !hasStores && !earnings.length) return null

  return (
    <section className="bg-surface shadow-lift rounded-2xl px-4 pt-3 pb-1.5 mb-3">
      <div className="flex items-center gap-1.5 mb-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-2.5 py-1 rounded-full text-[12.5px] font-extrabold ${
              active === k ? 'bg-brand text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">
          {active === 'store' ? `누적 ${formatWon(stores?.total_commission ?? 0)}` : '최근 30건 기준'}
        </span>
      </div>

      {active === 'product' && products.map((p, i) => {
        const pin = clicksById.get(p.id)
        return (
          <Row
            key={p.id}
            n={i + 1}
            to={`/products/${p.id}`}
            thumb={pin?.thumbnail || pin?.image_url || null}
            name={p.name}
            sub={pin ? `${p.count}건 · ${formatNumber(pin.click_count)} 클릭` : `${p.count}건`}
            value={formatWon(p.total)}
          />
        )
      })}

      {active === 'store' && (stores?.stores ?? []).map((s, i) => {
        const expired = !!(s.referral_bonus_until && parseUTCDate(s.referral_bonus_until) < new Date())
        return (
          <Row
            key={s.id}
            n={i + 1}
            onClick={() => onProxy({ id: s.id, name: s.business_name || `매장 #${s.id}` })}
            name={s.business_name || `매장 #${s.id}`}
            sub={`${formatWon(s.total_sales)} · ${expired ? '커미션 만료' : (s.referral_bonus_until ? `~${s.referral_bonus_until.slice(0, 10)}` : '무기한')}`}
            value={`${formatNumber(s.total_orders)}건`}
          />
        )
      })}

      {active === 'log' && earnings.slice(0, 12).map((e, i) => (
        <Row
          key={e.id}
          n={i + 1}
          to={`/products/${e.product_id}`}
          name={e.product_name || '상품'}
          sub={`${e.status === 'holding' ? '적립예정 ' : ''}${parseUTCDate(e.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })}${e.order_amount ? ` · 주문 ${formatWon(e.order_amount)}` : ''}`}
          value={`+${formatWon(e.commission)}`}
          muted={e.status === 'holding'}
        />
      ))}
    </section>
  )
}
