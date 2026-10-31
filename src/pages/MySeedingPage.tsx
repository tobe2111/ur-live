/**
 * 🎁 내 체험 신청 (`/my-seeding`) — 2026-10-31
 *
 * 인플루언서가 무상 체험을 진행하는 한 곳: SNS 연동 · 신청권(노쇼 방지 보증금) · 신청 목록과 다음 행동.
 *   승인됨 → 희망 일정 1~3개 + 신청권 1장  ·  방문 확정 → 게시물 링크 제출  ·  진행 중 → 취소
 * 알림톡 버튼이 모두 이 화면으로 온다(`lib/alimtalk-buttons.ts` SEEDING_MINE_URL).
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { resolveTossFlow } from '@/lib/toss-key-type'
import { formatNumber } from '@/utils/format'
import { formatKSTShort } from '@/utils/date'
import BrandLoader from '@/components/brand/BrandLoader'
import SnsLinkList, { type SnsLinkView } from '@/components/seeding/SnsLinkList'
import { MAX_VISIT_SLOTS, PLATFORM_LABEL, STATUS_LABEL, type ApplicationStatus, type PassPackage, type SeedingPlatform } from '@/shared/seeding'

interface App {
  id: number; product_id: number; platform: SeedingPlatform; status: ApplicationStatus; visit_slots: string | null
  visit_at: string | null; post_deadline: string | null; post_url: string | null; product_name: string | null; store_name: string | null
  created_at: string
}
interface Me {
  links: SnsLinkView[]; available: Record<SeedingPlatform, boolean>
  passes: { free_left: number; paid_left: number; total: number }
  penalty: { strikes: number; blocked_until: string | null }
  applications: App[]; packages: PassPackage[]; charge_enabled: boolean
}

const card = 'rounded-2xl bg-surface p-5 shadow-lift'
const errMsg = (e: unknown, d: string) => (e as { response?: { data?: { error?: string } } }).response?.data?.error || d

export default function MySeedingPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    api.get('/api/seeding/me').then((r) => { if (r.data?.success) setMe(r.data.data) }).catch(() => toast.error('불러오지 못했어요')).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const q = new URLSearchParams(window.location.search)
    const paymentKey = q.get('paymentKey'), orderId = q.get('orderId'), amount = q.get('amount')
    if (q.get('charge') === 'success' && paymentKey && orderId && amount) {
      window.history.replaceState({}, '', '/my-seeding')
      api.post('/api/seeding/passes/confirm', { paymentKey, orderId, amount: Number(amount) })
        .then((r) => { r.data?.success ? toast.success(r.data.message || '신청권을 받았어요') : toast.error(r.data?.error || '처리하지 못했어요'); load() })
        .catch((e) => toast.error(errMsg(e, '처리하지 못했어요')))
    } else if (q.get('charge') === 'fail') {
      window.history.replaceState({}, '', '/my-seeding'); toast.error('결제를 취소했어요')
    } else if (q.get('sns')) {
      const s = q.get('sns')
      if (s === 'connected') toast.success('연동했어요')
      else if (s === 'connected_nocount') toast.info('연동했지만 팔로워 수를 읽지 못했어요')
      else if (s !== 'cancelled') toast.error(q.get('reason') || '연동하지 못했어요')
      window.history.replaceState({}, '', '/my-seeding')
    }
  }, [load])

  if (loading) return <BrandLoader fullScreen />

  return (
    <div className="min-h-[100dvh] bg-warm pb-24">
      <SEO title="내 체험 신청 - 유어딜" description="무상 체험 신청과 SNS 연동, 신청권을 관리합니다" url="/my-seeding" />
      <div className="mx-auto max-w-xl space-y-4 px-4 pt-5">
        <h1 className="text-[24px] font-bold text-gray-900 dark:text-white">내 체험 신청</h1>
        {!me ? <p className="text-[13px] text-gray-500 dark:text-gray-400">정보를 불러오지 못했어요.</p> : (
          <>
            {me.penalty.blocked_until && (
              <p className="rounded-2xl bg-surface p-4 text-[13px] text-gray-700 dark:text-gray-200">
                경고 {me.penalty.strikes}회 — {formatKSTShort(me.penalty.blocked_until)}까지 새 체험 신청이 제한돼요.
              </p>
            )}
            <section className={card}>
              <p className="text-[17px] font-bold text-gray-900 dark:text-white">SNS 연동</p>
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">연동한 계정의 팔로워로 신청 조건이 자동 확인돼요.</p>
              <div className="mt-2"><SnsLinkList links={me.links} available={me.available} returnTo="/my-seeding" onChanged={load} /></div>
            </section>
            <PassSection me={me} />
            <section className={card}>
              <p className="text-[17px] font-bold text-gray-900 dark:text-white">신청 내역</p>
              {me.applications.length === 0 ? (
                <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
                  아직 신청이 없어요. 이용권 상세의 <span className="font-medium">이 이용권 팔아보기</span>에서 무료 체험을 신청할 수 있어요.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-rule">
                  {me.applications.map((a) => <AppRow key={a.id} a={a} onDone={load} />)}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function PassSection({ me }: { me: Me }) {
  const [busy, setBusy] = useState('')
  async function buy(key: string) {
    setBusy(key)
    try {
      const r = await api.post('/api/seeding/passes/charge', { package_key: key })
      if (!r.data?.success) { toast.error(r.data?.error || '구매를 시작하지 못했어요'); return }
      const { orderId, amount, orderName, clientKey, flow } = r.data.data
      if (resolveTossFlow(flow, clientKey) === 'invalid') { toast.error('결제 설정을 확인할 수 없어요'); return }
      const params = new URLSearchParams({
        orderId, amount: String(amount), orderName, clientKey,
        successUrl: `/my-seeding?charge=success&orderId=${orderId}`, failUrl: '/my-seeding?charge=fail',
      })
      window.location.href = `/pay/widget?${params.toString()}`
    } catch (e) { toast.error(errMsg(e, '구매를 시작하지 못했어요')) } finally { setBusy('') }
  }
  return (
    <section className={card}>
      <p className="text-[13px] text-gray-500 dark:text-gray-400">남은 신청권</p>
      <p className="mt-1 text-[28px] font-extrabold text-gray-900 dark:text-white">{formatNumber(me.passes.total)}<span className="ml-1 text-[15px] font-bold">장</span></p>
      <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
        무료 {formatNumber(me.passes.free_left)}장 · 구매 {formatNumber(me.passes.paid_left)}장. 사장님이 승인한 체험의 일정을 낼 때 노쇼 방지 보증금으로 1장 써요.
        일정이 확정되기 전에 취소하거나 매장 사정으로 취소되면 돌려드려요.
      </p>
      {me.charge_enabled ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {me.packages.map((p) => (
            <button key={p.key} type="button" disabled={!!busy} onClick={() => buy(p.key)}
              className="rounded-xl bg-warm px-2 py-3 text-center disabled:opacity-60">
              <span className="block text-[15px] font-bold text-gray-900 dark:text-white">{p.label}</span>
              <span className="block text-[12px] text-gray-500 dark:text-gray-400">{formatNumber(p.price)}원</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-gray-600 dark:text-gray-300">신청권 구매는 곧 열려요. 가입 혜택 무료 신청권으로 먼저 체험해 보세요.</p>
      )}
    </section>
  )
}

function AppRow({ a, onDone }: { a: App; onDone: () => void }) {
  const [slots, setSlots] = useState<string[]>([''])
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (path: string, body: unknown, ok: string) => {
    setBusy(true)
    try {
      const r = await api.post(`/api/seeding/applications/${a.id}/${path}`, body)
      r.data?.success ? toast.success(r.data.message || ok) : toast.error(r.data?.error || '처리하지 못했어요')
      onDone()
    } catch (e) { toast.error(errMsg(e, '처리하지 못했어요')) } finally { setBusy(false) }
  }
  const cancellable = ['pending', 'sent', 'approved', 'scheduling', 'scheduled'].includes(a.status)
  const input = 'w-full rounded-xl border border-rule bg-surface px-3 py-2 text-[15px] text-gray-900 dark:text-white'
  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/pass/${a.product_id}`} className="block truncate text-[15px] font-medium text-gray-900 dark:text-white">{a.store_name} · {a.product_name}</Link>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">{PLATFORM_LABEL[a.platform]} · {STATUS_LABEL[a.status] || a.status}</p>
          {a.visit_at && <p className="text-[13px] text-gray-600 dark:text-gray-300">방문 {a.visit_at} · 게시 기한 {a.post_deadline}까지</p>}
        </div>
      </div>

      {a.status === 'approved' && (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] text-gray-600 dark:text-gray-300">방문 희망 일정을 최대 {MAX_VISIT_SLOTS}개 골라 주세요(내일부터).</p>
          {slots.map((s, i) => (
            <input key={i} type="datetime-local" className={input} value={s}
              onChange={(e) => setSlots((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          {slots.length < MAX_VISIT_SLOTS && (
            <button type="button" onClick={() => setSlots((xs) => [...xs, ''])} className="text-[13px] text-brand-text">+ 일정 추가</button>
          )}
          <button type="button" disabled={busy || !slots.some(Boolean)} onClick={() => run('schedule', { slots: slots.filter(Boolean) }, '희망 일정을 보냈어요')}
            className="ur-btn ur-btn-primary w-full disabled:opacity-50">신청권 1장 쓰고 일정 보내기</button>
        </div>
      )}

      {a.status === 'scheduled' && (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] text-gray-600 dark:text-gray-300">방문 후 게시물 주소를 붙여 넣어 주세요.</p>
          <input className={input} placeholder="https://www.instagram.com/p/..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" disabled={busy || !url} onClick={() => run('post', { url }, '게시물을 등록했어요')}
            className="ur-btn ur-btn-primary w-full disabled:opacity-50">게시물 등록</button>
          <Link to="/my-vouchers" className="block text-center text-[13px] text-brand-text">체험 이용권 보기</Link>
        </div>
      )}

      {a.post_url && <a href={a.post_url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-[13px] text-brand-text">{a.post_url}</a>}

      {cancellable && (
        <button type="button" disabled={busy} onClick={() => { if (window.confirm(a.status === 'scheduled' ? '방문이 확정된 뒤 취소하면 보증금은 돌려드리지 않아요. 취소할까요?' : '신청을 취소할까요?')) run('cancel', {}, '취소했어요') }}
          className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">신청 취소</button>
      )}
    </li>
  )
}
