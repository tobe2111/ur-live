/**
 * 📱 **주문 목록 — 모바일 카드 뷰** 〔시안 `docs/design/operator-mall-pilot.md` 화면 C〕
 *
 * 의뢰서 §4 화면 C: *"사장님이 하는 일은 단순하다 — 오늘 픽업하러 올 사람이 누구고 뭘 가져가나를 훑는 것."*
 * 그런데 기존 화면은 **PC 표**다(8열 · 체크박스 · CSV · 페이지네이션). 의뢰서 §2 가 정한 사용 환경은
 * *"휴대폰, 한 손, 가게 카운터에서 서서"* 라, 표를 폰에서 가로 스크롤하는 것으로는 그 일이 안 된다.
 *
 * ## 왜 표를 안 고치고 뷰를 하나 더 두는가
 * 의뢰서 §5.3 은 *"사장님 대시보드는 PC 에서 넓게 씁니다"* 라고 못박았다 — PC 표는 그대로 필요하다.
 * 그리고 `SellerOrdersPage` 에는 **`handleRefund`(머니 경로)** 가 들어 있어, 표를 재작성하면
 * 돈 흐름 코드를 건드리게 된다. ⇒ **표는 한 줄도 안 건드리고**(`hidden md:block`) 모바일에만
 * 이 카드 뷰를 얹는다(`md:hidden`). 롤백 = 이 컴포넌트 렌더 1줄 제거.
 *
 * ## 🔴 시안과 다른 점 하나 — 날짜 그룹 기준
 * 시안은 **픽업일**로 묶고 `오늘 픽업 7건` 을 센다. 그런데 `GET /api/seller/orders` 의 `Order` 에는
 * **픽업일이 없다**(`created_at` 뿐 — `types.ts` 참조). 픽업일은 `product_supply_meta.pickup_date` 에
 * 있고 주문 응답에 조인돼 있지 않다.
 *
 * ⇒ 없는 값을 있는 척하지 않는다. **주문일로 묶고 라벨도 "주문"이라고 쓴다.**
 *   픽업일 기준으로 바꾸려면 API 가 주문 라인에 `pickup_date` 를 실어야 한다(핸드오프에 기재).
 *   그 전까지 이 화면은 "언제 주문이 들어왔나"를 훑는 화면이고, 시안이 노린 "오늘 누가 오나"는 아니다.
 *
 * ⚠️ 날짜는 전부 `@/utils/date` SSOT 경유 — D1 타임스탬프는 `Z` 없는 UTC 문자열이라
 *   `new Date()` 로 읽으면 9시간 어긋난다(이 레포 반복 사고 클래스, `check-utc-date-parse`).
 * ⚠️ `text-gray-*` 대신 hex — `tailwind.config.js` 가 `gray-*` 를 INK(딥네이비)로 리맵한다.
 */
import { useMemo, useState } from 'react'
import { parseUTCDate } from '@/utils/date'
import { formatWon } from '@/utils/format'
import type { Order } from './types'

const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 픽업 대기 = 결제는 끝났고 아직 손님이 안 가져간 것. 픽업 주문은 배송 상태를 안 거친다. */
const WAITING = new Set(['PAID', 'DONE', 'PAY_COMPLETE', 'PREPARING', 'SHIPPING'])
const HANDED = new Set(['DELIVERED'])

type Tab = 'waiting' | 'handed' | 'all'

/** KST 달력 조각. `Date` 의 로컬 타임존에 기대지 않는다(워커·브라우저 TZ 가 다르다). */
function kstOf(iso: string) {
  const d = parseUTCDate(iso)
  if (Number.isNaN(d.getTime())) return null
  const k = new Date(d.getTime() + 9 * 3600_000)
  return {
    key: k.toISOString().slice(0, 10),
    label: `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 (${DOW[k.getUTCDay()]})`,
  }
}

function todayKstKey(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

export default function MobileOrderList({
  orders,
  onSelect,
}: {
  orders: Order[]
  onSelect: (order: Order) => void
}) {
  const [tab, setTab] = useState<Tab>('waiting')

  const waitingCount = orders.filter((o) => WAITING.has(o.status)).length
  const handedCount = orders.filter((o) => HANDED.has(o.status)).length

  /** 탭 필터 → 주문일(KST)별 묶음. 최신 날짜가 위. */
  const groups = useMemo(() => {
    const filtered = orders.filter((o) =>
      tab === 'waiting' ? WAITING.has(o.status) : tab === 'handed' ? HANDED.has(o.status) : true,
    )
    const map = new Map<string, { label: string; rows: Order[] }>()
    for (const o of filtered) {
      const k = kstOf(o.created_at)
      if (!k) continue
      if (!map.has(k.key)) map.set(k.key, { label: k.label, rows: [] })
      map.get(k.key)!.rows.push(o)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [orders, tab])

  const today = todayKstKey()

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'waiting', label: '픽업 대기' },
    { id: 'handed', label: '전달 완료' },
    { id: 'all', label: '전체' },
  ]

  return (
    <div className="md:hidden">
      {/* 요약 — 로즈는 "지금 처리해야 하는 것"에만 쓴다〔시안 §3.1〕 */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-[#FBEDF0] px-[13px] py-3">
          <p className="text-[11.5px] font-bold text-[#B0576A] tracking-[-0.02em]">픽업 대기</p>
          <p className="mt-[3px] text-[21px] font-extrabold text-[#C43D55] tracking-[-0.04em]">{waitingCount}건</p>
        </div>
        <div className="flex-1 rounded-xl bg-[#F5F2F3] px-[13px] py-3">
          <p className="text-[11.5px] font-bold text-[#776F74] tracking-[-0.02em]">전달 완료</p>
          <p className="mt-[3px] text-[21px] font-extrabold text-[#3F383C] tracking-[-0.04em]">{handedCount}건</p>
        </div>
      </div>

      {/* 세그먼트 — 안 고른 것도 면이다(테두리 박스로 그리지 않는다)〔시안 §3.2〕 */}
      <div className="mt-4 flex rounded-[13px] bg-[#F1EDEF] p-1">
        {TABS.map((tb) => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)} aria-pressed={tab === tb.id}
            className={`flex-1 h-11 rounded-[10px] text-sm tracking-[-0.03em] transition-colors ${
              tab === tb.id
                ? 'bg-white shadow-[0_1px_3px_rgba(26,23,25,.12)] font-extrabold text-[#1A1719]'
                : 'font-semibold text-[#8A8288]'
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="py-16 text-center text-[14.5px] font-bold text-[#3F383C] tracking-[-0.03em]">
          해당하는 주문이 없어요
        </p>
      )}

      {groups.map(([key, g]) => (
        <section key={key}>
          <div className="flex items-center justify-between px-1 pt-[22px] pb-2.5">
            <h3 className="text-[13px] font-extrabold text-[#1A1719] tracking-[-0.03em]">
              {g.label} 주문{key === today && ' · 오늘'}
            </h3>
            <span className="text-[12px] font-bold text-[#9A9298]">{g.rows.length}건</span>
          </div>

          <ul className="flex flex-col gap-2.5">
            {g.rows.map((o) => {
              const handed = HANDED.has(o.status)
              return (
                <li key={o.order_number}>
                  <button type="button" onClick={() => onSelect(o)}
                    className={`w-full text-left bg-white border border-[#EAE5E7] rounded-2xl px-[15px] py-3.5 ${handed ? 'opacity-[.62]' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-extrabold text-[#1A1719] tracking-[-0.03em] truncate">
                        {o.shipping_name || o.user_name || '-'}
                      </span>
                      <span className={`shrink-0 text-[10.5px] font-extrabold px-[7px] py-1 rounded-md tracking-[-0.02em] ${
                        handed ? 'text-[#6B6469] bg-[#F1EDEF]' : 'text-[#B0576A] bg-[#FBEDF0]'
                      }`}>
                        {handed ? '전달 완료' : '픽업 대기'}
                      </span>
                    </div>

                    {/* 무엇을 가져가나 — 이 화면의 본론이라 이름 바로 아래 둔다 */}
                    {o.items && o.items.length > 0 && (
                      <p className="mt-2.5 text-[13px] leading-[1.5] text-[#4A4448] tracking-[-0.025em]">
                        {o.items.map((it) => (
                          <span key={it.id} className="block">
                            {it.product_name} <span className="font-extrabold">× {it.quantity}</span>
                          </span>
                        ))}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-[#F1EDEF] flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-[#9A9298] tracking-[-0.01em] truncate">{o.order_number}</span>
                      <span className="shrink-0 text-[15px] font-extrabold text-[#1A1719] tracking-[-0.03em]">
                        {formatWon(o.total_amount)}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
