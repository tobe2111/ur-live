/**
 * 🏠 참여권 잔액 · 묶음 충전 (2026-10-24 대표 확정 — 5장 5,000원 / 10장 9,000원 / 30장 24,000원, 어드민 조정).
 * 결제는 다른 충전과 같은 토스 위젯 화면(`/pay/widget`)을 지나고, 돌아오면 서버가 승인·지급한다.
 * 충전이 닫혀 있으면(staging 실결제 확인 전) 버튼 대신 안내만 — 무료 참여권은 그대로 쓸 수 있다.
 */
import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { formatKSTShort } from '@/utils/date'
import { sellerHeaders } from '../life-shared'
import type { ProMe } from './ProSetupForm'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 10차 ⑦ — 충전으로 참여권이 늘면 숫자가 굴러 올라가고 '+N장' 이 잠깐 떴다 사라진다.
injectMotionCss('ur-m-credit', `@keyframes ur-cr-gain { 0% { opacity: 0; transform: translateY(6px); } 20% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }.ur-cr-gain { display: inline-block; animation: ur-cr-gain 1.4s ease both; }@media (prefers-reduced-motion: reduce){.ur-cr-gain{animation:none!important}}`)

export default function ProCredits({ me, onChanged }: { me: ProMe; onChanged: () => void }) {
  const [busy, setBusy] = useState('')
  // 늘어난 만큼 '+N장' — 처음 그릴 때(이전 값 없음)나 줄어들 때(견적 보내기)는 안 띄운다.
  // 📦 숫자 굴림은 여기서 직접 센다 — 공용 숫자 굴림 부품을 불러오면 이용권 상세 묶음과 엮여 이 화면이 +4KB 를 받는다(2026-11-02 실측).
  const prevBal = useRef(me.balance)
  const [gain, setGain] = useState<{ n: number; k: number } | null>(null)
  const [shown, setShown] = useState(me.balance)
  useEffect(() => {
    const from = prevBal.current, d = me.balance - from
    prevBal.current = me.balance
    if (d <= 0) { setShown(me.balance); return }
    setGain({ n: d, k: Date.now() })
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => { const p = Math.min(1, (t - t0) / 600); setShown(Math.round(from + d * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step) }
    try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setShown(me.balance); else raf = requestAnimationFrame(step) } catch { setShown(me.balance) }
    const t = window.setTimeout(() => setGain(null), 1500)
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf) }
  }, [me.balance])

  // 결제창에서 돌아온 경우 — 한 번만 승인을 부른다(서버가 같은 결제를 두 번 지급하지 않는다).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const paymentKey = p.get('paymentKey'), orderId = p.get('orderId'), amount = p.get('amount')
    if (p.get('charge') === 'success' && paymentKey && orderId && amount) {
      window.history.replaceState({}, '', '/life/pro')
      api.post('/api/home-service/pro/credits/confirm', { paymentKey, orderId, amount: Number(amount) }, sellerHeaders())
        .then((r) => { if (r.data?.success) toast.success(r.data.message || '충전했어요'); else toast.error(r.data?.error || '충전하지 못했어요'); onChanged() })
        .catch((e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error || '충전하지 못했어요'))
    } else if (p.get('charge') === 'fail') {
      window.history.replaceState({}, '', '/life/pro')
      toast.error('결제를 취소했어요')
    }
  }, [onChanged])

  async function charge(key: string) {
    setBusy(key)
    try {
      const r = await api.post('/api/home-service/pro/credits/charge', { package_key: key }, sellerHeaders())
      if (!r.data?.success) { toast.error(r.data?.error || '충전을 시작하지 못했어요'); return }
      const { orderId, amount, orderName, clientKey, flow } = r.data.data
      // 🐢 2026-10-26: 정적 import 하면 그 파일이 든 이용권 상세 묶음(66KB)을 이 화면이 통째로 받는다 — 누를 때만 받는다.
      const { resolveTossFlow } = await import('@/lib/toss-key-type')
      if (resolveTossFlow(flow, clientKey) === 'invalid') { toast.error('결제 설정을 확인할 수 없어요'); return }
      const params = new URLSearchParams({
        orderId, amount: String(amount), orderName, clientKey,
        successUrl: `/life/pro?charge=success&orderId=${orderId}`,
        failUrl: '/life/pro?charge=fail',
      })
      window.location.href = `/pay/widget?${params.toString()}`
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || '충전을 시작하지 못했어요')
    } finally { setBusy('') }
  }

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-lift">
      <p className="text-[13px] text-gray-500 dark:text-gray-400">남은 참여권</p>
      <p className="mt-1 flex items-baseline gap-2 text-[28px] font-extrabold">
        <span className="inline-flex items-baseline tabular-nums">{formatNumber(shown)}<span className="ml-1 text-[15px] font-bold">장</span></span>
        {gain && <span key={gain.k} className="ur-cr-gain text-[13px] font-medium text-brand-text">+{formatNumber(gain.n)}장</span>}
      </p>
      <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
        견적을 보낼 때 업종에 맞는 장수가 빠져요. 손님이 요청을 취소하거나 48시간 동안 견적을 안 열어 보면 돌려드려요.
      </p>
      {me.chargeEnabled ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {me.packages.map((p) => (
            <button key={p.key} type="button" disabled={!!busy} onClick={() => charge(p.key)}
              className="rounded-xl bg-warm px-2 py-3 text-center disabled:opacity-60">
              <span className="block text-[15px] font-bold text-ink">{p.label}</span>
              <span className="block text-[12px] text-gray-500 dark:text-gray-400">{formatNumber(p.price)}원</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-warm px-4 py-3 text-[13px] text-ink">참여권 충전은 곧 열려요. 지금은 무료 참여권으로 견적을 보낼 수 있어요.</p>
      )}
      <CreditHistory rows={me.history ?? []} />
    </section>
  )
}

/** 🧾 참여권 내역 (2026-10-26 대표 *"갯수라던지 차감 히스토리라던지 확인할 수 있는건가?"*) — 원장 최근 20줄. */
const KIND_LABEL: Record<string, string> = { grant: '무료 지급', charge: '충전', spend: '견적 보냄', refund: '돌려받음' }

function CreditHistory({ rows }: { rows: NonNullable<ProMe['history']> }) {
  if (!rows.length) return null
  return (
    <div className="mt-5">
      <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">참여권 내역</p>
      <ul className="mt-2 divide-y divide-rule">
        {rows.map((r, i) => {
          const n = Number(r.amount) || 0
          return (
            <li key={i} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ink">{KIND_LABEL[r.kind] ?? r.kind}</p>
                <p className="flex gap-2 truncate text-[12px] text-gray-500 dark:text-gray-400">
                  <span>{formatKSTShort(r.created_at)}</span>
                  {r.price_paid > 0 && <span>{formatNumber(r.price_paid)}원</span>}
                  {r.note && r.kind !== 'charge' && <span className="truncate">{r.note}</span>}
                </p>
              </div>
              <span className={`shrink-0 text-[15px] font-bold tabular-nums ${n < 0 ? 'text-ink' : 'text-brand-text'}`}>
                {n > 0 ? '+' : ''}{formatNumber(n)}장
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
