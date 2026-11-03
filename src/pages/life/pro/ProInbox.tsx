/** 🏠 사장님 요청함 — 내 지역·카테고리의 새 요청 / 내가 보낸 견적. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { quotePriceText } from '@/shared/home-service'
import { categoryLabel, sellerHeaders } from '../life-shared'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 13차 ⑥ — 탭을 바꾸면 밑줄이 옆으로 미끄러지고(잰 자리 · 못 재면 종전 밑줄), 목록이 살짝 떠오르며 바뀐다.
injectMotionCss('ur-m-proinbox', `@keyframes ur-pi-in { from { opacity: 0; transform: translateY(8px); } }.ur-pi-row { animation: ur-pi-in .3s cubic-bezier(.2,.9,.3,1) backwards; animation-delay: calc(var(--i, 0) * 45ms); }@media (prefers-reduced-motion: reduce){.ur-pi-row{animation:none!important}}`)

interface Row {
  id: number; category: string; summary: string; desired_date: string; status: string
  quote_count: number; max_quotes: number; my_quote_id?: number | null; my_quote_status?: string | null; my_price?: number | null
}

const MINE_LABEL: Record<string, string> = { sent: '손님이 보는 중', chosen: '손님이 선택함', refunded: '참여권 돌려받음' }

export default function ProInbox({ refreshKey }: { refreshKey: number }) {
  const [tab, setTab] = useState<'open' | 'mine'>('open')
  const [data, setData] = useState<{ open: Row[]; mine: Row[] } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api.get('/api/home-service/pro/requests', sellerHeaders())
      .then((r) => setData(r.data?.data || { open: [], mine: [] }))
      .catch(() => setFailed(true))
  }, [refreshKey])

  const rows = data ? data[tab] : []
  const tabsRef = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const on = tabsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    const next = on ? { x: on.offsetLeft, w: on.offsetWidth } : null
    setBar((p) => (p?.x === next?.x && p?.w === next?.w ? p : next))
  })
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-lift">
      <div ref={tabsRef} className="relative flex gap-3 border-b border-rule">
        {(['open', 'mine'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`-mb-px border-b-2 pb-2 text-[15px] font-bold transition-colors ${tab === k ? `${bar ? 'border-transparent' : 'border-ink'} text-ink` : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
            {k === 'open' ? `새 요청 ${data?.open.length ?? ''}` : `보낸 견적 ${data?.mine.length ?? ''}`}
          </button>
        ))}
        {bar && <span aria-hidden="true" className="absolute -bottom-px left-0 h-[2px] bg-ink transition-[transform,width] duration-300 ease-[cubic-bezier(.2,.9,.3,1)] motion-reduce:transition-none" style={{ width: bar.w, transform: `translateX(${bar.x}px)` }} />}
      </div>
      {failed ? (
        <p className="py-8 text-center text-[13px] text-tone-bad">요청을 불러오지 못했어요.</p>
      ) : !data ? (
        <p className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">불러오는 중</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
          {tab === 'open' ? '지금 내 지역에 열린 요청이 없어요. 새 요청이 오면 알림톡으로 알려 드려요.' : '아직 보낸 견적이 없어요.'}
        </p>
      ) : (
        <ul className="divide-y divide-rule">
          {rows.map((r, ri) => (
            <li key={`${tab}-${r.id}`} className="ur-pi-row" style={{ '--i': Math.min(ri, 8) } as React.CSSProperties}>
              <Link to={`/life/pro/requests/${r.id}`} className="block py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-bold">{categoryLabel(r.category)}</span>
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">
                    {tab === 'mine' ? (MINE_LABEL[r.my_quote_status || ''] || '') : `견적 ${r.quote_count}/${r.max_quotes}`}
                  </span>
                </div>
                <p className="mt-1 truncate text-[13px] text-gray-600 dark:text-gray-300">{r.summary}</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                  {r.desired_date}
                  {tab === 'mine' && <span className="ml-2">내 견적 {quotePriceText(r.my_price)}</span>}
                  {tab === 'open' && r.my_quote_id && <span className="ml-2 text-brand-text">견적 보냄</span>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
