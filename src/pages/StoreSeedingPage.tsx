/**
 * 🎁 사장님 — 무상 체험 요청함 (`/store/seeding`) — 2026-10-31
 *
 * 알림톡 [요청 확인하기] → `/store/go?s=<매장>&to=seeding` → 카카오 로그인(카톡 안에선 한 번 탭) → 그 매장 좌석 → 여기.
 * 대시보드 밖 한 화면(매장 계산대 `/store/scan` 과 같은 자리)이라 무거운 셀러 레이아웃을 거치지 않는다.
 *   위: 받은 신청(승인·거절 · 일정 고르기 · 노쇼 신고 · 취소)
 *   아래: 내 이용권별 무상 체험 제공 설정(이용권 등록 때 켠 것을 여기서 고친다)
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { getSellerToken } from '@/lib/seller-auth'
import { MY_PATH } from '@/lib/seller-return'
import SeedingOfferFields from '@/components/seeding/SeedingOfferFields'
import { FOLLOWER_WORD, PLATFORM_LABEL, STATUS_LABEL, normalizeOffer, type ApplicationStatus, type SeedingOffer, type SeedingPlatform } from '@/shared/seeding'

interface Req {
  id: number; product_name: string | null; platform: SeedingPlatform; sns_username: string | null; follower_count: number | null
  status: ApplicationStatus; visit_slots: string | null; visit_at: string | null; post_deadline: string | null; post_url: string | null
}
interface OfferRow { id: number; name: string; enabled: number | null }

const hdr = () => { const t = getSellerToken(); return t ? { headers: { Authorization: `Bearer ${t}` } } : {} }
const err = (e: unknown, d: string) => (e as { response?: { data?: { error?: string } } }).response?.data?.error || d
const card = 'rounded-2xl bg-surface p-5 shadow-lift'

export default function StoreSeedingPage() {
  const navigate = useNavigate()
  const allowed = typeof window !== 'undefined' && !!getSellerToken()
  const [reqs, setReqs] = useState<Req[] | null>(null)
  const [offers, setOffers] = useState<OfferRow[]>([])
  const load = useCallback(() => {
    api.get('/api/seller/seeding/requests', hdr()).then((r) => setReqs(r.data?.data ?? [])).catch(() => setReqs([]))
    api.get('/api/seller/seeding/offers', hdr()).then((r) => setOffers(r.data?.data ?? [])).catch(() => setOffers([]))
  }, [])
  useEffect(() => { if (!allowed) navigate(MY_PATH, { replace: true }); else load() }, [allowed, navigate, load])
  if (!allowed) return null

  return (
    <div className="min-h-[100dvh] bg-warm pb-16">
      <SEO title="무상 체험 요청함 - 유어딜" description="인플루언서 무상 체험 신청을 승인하고 일정을 정합니다" url="/store/seeding" />
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-rule bg-surface px-3 py-3">
        <button type="button" onClick={() => navigate(MY_PATH)} aria-label="뒤로" className="p-1 text-ink"><ChevronLeft className="h-6 w-6" /></button>
        <h1 className="text-[17px] font-bold text-ink">무상 체험 요청함</h1>
      </header>
      <div className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        <section className={card}>
          <p className="text-[17px] font-bold text-ink">받은 신청</p>
          {reqs === null ? <p className="mt-2 text-[13px] text-ink-soft">불러오는 중…</p>
            : reqs.length === 0 ? <p className="mt-2 text-[13px] text-ink-soft">아직 받은 신청이 없어요.</p>
            : <ul className="mt-2 divide-y divide-rule">{reqs.map((r) => <ReqRow key={r.id} r={r} onDone={load} />)}</ul>}
        </section>
        <section className={card}>
          <p className="text-[17px] font-bold text-ink">이용권별 제공 설정</p>
          <p className="mt-1 text-[13px] text-ink-soft">켜 둔 이용권에만 인플루언서가 무료 체험을 신청할 수 있어요.</p>
          <ul className="mt-2 divide-y divide-rule">{offers.map((o) => <OfferEdit key={o.id} o={o} />)}</ul>
          {offers.length === 0 && <p className="mt-2 text-[13px] text-ink-soft">판매 중인 이용권이 없어요.</p>}
        </section>
      </div>
    </div>
  )
}

function ReqRow({ r, onDone }: { r: Req; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const slots: string[] = (() => { try { return JSON.parse(r.visit_slots || '[]') } catch { return [] } })()
  const act = async (action: string, body: unknown = {}, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    try { const res = await api.post(`/api/seller/seeding/requests/${r.id}/${action}`, body, hdr()); res.data?.success ? toast.success('처리했어요') : toast.error(res.data?.error || '처리하지 못했어요'); onDone() }
    catch (e) { toast.error(err(e, '처리하지 못했어요')) } finally { setBusy(false) }
  }
  return (
    <li className="py-4">
      <p className="text-[15px] font-medium text-ink">{r.product_name}</p>
      <p className="text-[13px] text-ink-soft">
        {PLATFORM_LABEL[r.platform]} @{r.sns_username || '-'} ({FOLLOWER_WORD[r.platform]} {formatNumber(r.follower_count)}명)
      </p>
      <p className="text-[13px] text-ink-soft">
        {STATUS_LABEL[r.status] || r.status}
      </p>
      {r.visit_at && <p className="text-[13px] text-ink">방문 {r.visit_at} · 게시 기한 {r.post_deadline}</p>}
      {r.post_url && <a href={r.post_url} target="_blank" rel="noreferrer" className="block truncate text-[13px] text-brand-text">{r.post_url}</a>}

      {r.status === 'sent' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => act('respond', { decision: 'reject' })} className="rounded-xl bg-warm py-3 text-[15px] text-ink">거절</button>
          <button type="button" disabled={busy} onClick={() => act('respond', { decision: 'approve' })} className="ur-btn ur-btn-primary">승인</button>
        </div>
      )}
      {r.status === 'scheduling' && (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] text-ink-soft">가능한 방문 일정 하나를 골라 주세요. 고르면 체험 이용권이 발급돼요.</p>
          {slots.map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => act('pick', { slot: s })} className="ur-btn ur-btn-primary w-full">{s} 로 확정</button>
          ))}
        </div>
      )}
      {r.status === 'scheduled' && (
        <button type="button" disabled={busy} onClick={() => act('no-show', {}, '방문하지 않았나요? 노쇼로 신고하면 인플루언서에게 패널티가 붙어요.')}
          className="mt-2 text-[13px] text-ink-soft">노쇼 신고</button>
      )}
      {['approved', 'scheduling', 'scheduled'].includes(r.status) && (
        <button type="button" disabled={busy} onClick={() => act('cancel', {}, '매장 사정으로 취소할까요? 인플루언서의 보증금은 돌려드려요.')}
          className="mt-2 ml-4 text-[13px] text-ink-soft">매장 사정으로 취소</button>
      )}
    </li>
  )
}

function OfferEdit({ o }: { o: OfferRow }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState<SeedingOffer | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open || v) return
    api.get(`/api/seller/seeding/offers/${o.id}`, hdr()).then((r) => setV(normalizeOffer(r.data?.data))).catch(() => setV(normalizeOffer(null)))
  }, [open, v, o.id])
  const save = async () => {
    if (!v) return
    setSaving(true)
    try { const r = await api.put(`/api/seller/seeding/offers/${o.id}`, v, hdr()); toast.success(r.data?.message || '저장했어요'); setOpen(false) }
    catch (e) { toast.error(err(e, '저장하지 못했어요')) } finally { setSaving(false) }
  }
  return (
    <li className="py-3">
      <button type="button" onClick={() => setOpen((x) => !x)} className="flex w-full items-center justify-between text-left">
        <span className="truncate text-[15px] text-ink">{o.name}</span>
        <span className={`shrink-0 text-[13px] ${o.enabled ? 'text-brand-text' : 'text-ink-soft'}`}>{o.enabled ? '제공 중' : '제공 안 함'}</span>
      </button>
      {open && v && (
        <div className="mt-3 space-y-3">
          <SeedingOfferFields value={v} onChange={setV} />
          <button type="button" disabled={saving} onClick={save} className="ur-btn ur-btn-primary w-full">저장</button>
        </div>
      )}
    </li>
  )
}
