/**
 * 🤝 내 협업 — 코드 입력 · 매장별 링크 · 성과 · 제안 수락 (2026-09-19 대표 확정 플로우 7·8·10번)
 *
 * 종전 `MyStoresAndDeals` 는 딜을 이름·%·상태로만 나열했다. 링크도, 숫자도, 수락 버튼도 없었다 —
 * **매장이 제안한 딜은 '대기'에 영원히 멈춰 있었다**(수락 엔드포인트가 없었다). 이 부품이 그 넷을 채운다.
 *
 * 링크는 **매장 단위**(`/s/{id}?ref=`) — 매장 공개 페이지가 ref 를 7일 귀속으로 심어 어느 이용권을 사든
 * 이 사람에게 온다. 대표 이용권이 있으면 상품 상세 링크도 준다(카톡엔 상품이 보이는 쪽이 낫다).
 *
 * 백엔드: `/api/influencer-settlement/my-stores`(링크·성과 포함) · `/codes/redeem` · `/deals/:id/respond`.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { KeyRound, Copy, Share2, Check, X } from 'lucide-react'

interface Deal {
  id: number; seller_id: number; seller_name: string | null; commission_pct: number; status: string
  proposed_by: string; created_at: string; ends_at: string | null
  requires_content_proof?: number | null; proof_status?: string | null
  store_link: string; product_link: string | null
  orders_count: number; pending_krw: number; confirmed_krw: number
}
interface Referred { id: number; name: string; referral_bonus_until: string | null; total_commission: number }
interface BrokerRow { seller_id: number; seller_name: string | null; orders_count: number; pending_krw: number; confirmed_krw: number }

const won = (n: number) => `${Number(n || 0).toLocaleString()}원`

export default function DealsAndCodesSection({ ownerFunded }: { ownerFunded: boolean }) {
  const [referred, setReferred] = useState<Referred[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [broker, setBroker] = useState<BrokerRow[]>([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [responding, setResponding] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/influencer-settlement/my-stores')
      if (r.data?.success) {
        setReferred(r.data.data.referred || [])
        setDeals(r.data.data.deals || [])
        setBroker(r.data.data.broker || [])
      }
    } catch { /* silent */ }
  }, [])
  useEffect(() => { void load() }, [load])

  async function redeem() {
    const v = code.trim()
    if (!v) { toast.error('코드를 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/influencer-settlement/codes/redeem', { code: v })
      if (!r.data?.success) throw new Error(r.data?.error)
      const d = r.data.data
      toast.success(d.status === 'active' ? `${d.seller_name || '매장'}과 협업이 시작됐어요 (${d.commission_pct}%)` : `${d.seller_name || '매장'}에 신청했어요 — 매장이 승인하면 활성돼요`)
      setCode('')
      await load()
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string }
      toast.error(ax.response?.data?.error || ax.message || '코드를 넣지 못했어요')
    } finally { setBusy(false) }
  }

  async function respond(d: Deal, action: 'accept' | 'reject') {
    setResponding(d.id)
    try {
      const r = await api.post(`/api/influencer-settlement/deals/${d.id}/respond`, { action })
      if (!r.data?.success) throw new Error(r.data?.error)
      toast.success(action === 'accept' ? '수락했어요 — 지금부터 내 링크로 팔리면 적립돼요' : '거절했어요')
      await load()
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string }
      toast.error(ax.response?.data?.error || ax.message || '처리하지 못했어요')
    } finally { setResponding(null) }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success('링크를 복사했어요') } catch { toast.error('복사에 실패했어요') }
  }
  async function share(d: Deal) {
    const url = d.product_link || d.store_link
    const title = `${d.seller_name || '매장'} 이용권`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ title, url }); return }
    } catch { /* 사용자가 취소 — 복사로 폴백 */ }
    await copy(url)
  }

  const canRespond = (d: Deal) => d.status === 'proposed' && (d.proposed_by === 'seller' || d.proposed_by === 'code') && !d.requires_content_proof

  return (
    <>
      {/* 🔑 코드 입력 */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-brand-text" /> 협업 코드 입력</h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">매장이나 대행사에서 받은 코드를 넣으면 그 매장과 협업이 시작돼요. 내 링크로 팔리는 이용권마다 정해진 % 가 적립됩니다.</p>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="예: AB3K-9QXP" maxLength={12}
            onKeyDown={(e) => { if (e.key === 'Enter') void redeem() }}
            className="flex-1 px-3 py-2.5 border border-line rounded-lg text-sm tabular-nums tracking-wider text-gray-900 dark:text-white bg-surface placeholder:text-gray-400" />
          <button onClick={() => void redeem()} disabled={busy} className="px-4 rounded-lg bg-brand text-white text-sm font-bold disabled:opacity-50">{busy ? '…' : '입력'}</button>
        </div>
      </div>

      {/* 🤝 협업 매장 */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">🤝 협업 매장 ({deals.length})</h3>
        {ownerFunded && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mb-2">우대 커미션은 매장 promo(매장 몫) 재원에서 지급됩니다 — 유어딜 5%(인프라비)와 무관.</p>
        )}
        {deals.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">아직 협업 중인 매장이 없어요. 위에 코드를 넣거나, 매장의 제안을 기다려 보세요.</p>
        ) : (
          <ul className="space-y-3">
            {deals.map((d) => (
              <li key={d.id} className="border border-line rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{d.seller_name || `매장 ${d.seller_id}`}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      커미션 {d.commission_pct}% · {d.proposed_by === 'seller' ? '매장 제안' : d.proposed_by === 'code' ? '코드로 시작' : d.proposed_by === 'outreach' ? '제안 수락' : '내가 신청'}
                      {d.ends_at ? ` · ${new Date(d.ends_at).toLocaleDateString('ko-KR')} 까지` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] px-2 py-1 rounded font-bold ${
                    d.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    d.status === 'proposed' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-warm text-gray-500 dark:text-gray-400'}`}>
                    {d.status === 'active' ? '활성' : d.status === 'proposed' ? (canRespond(d) ? '수락 대기' : d.requires_content_proof ? '콘텐츠 인증 대기' : '매장 승인 대기') : d.status === 'rejected' ? '거절됨' : d.status}
                  </span>
                </div>

                {canRespond(d) && (
                  <div className="mt-2 flex gap-2">
                    <button disabled={responding === d.id} onClick={() => respond(d, 'accept')} className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-brand text-white text-xs font-bold disabled:opacity-50"><Check className="w-3.5 h-3.5" /> 수락</button>
                    <button disabled={responding === d.id} onClick={() => respond(d, 'reject')} className="px-3 py-2 rounded-lg border border-line text-xs font-bold text-gray-600 dark:text-gray-300 disabled:opacity-50"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}

                {d.status === 'active' && (
                  <>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-warm py-1.5"><p className="text-[10px] text-gray-500 dark:text-gray-400">판매</p><p className="text-sm font-bold text-gray-900 dark:text-white">{d.orders_count}건</p></div>
                      <div className="rounded-lg bg-warm py-1.5"><p className="text-[10px] text-gray-500 dark:text-gray-400">대기</p><p className="text-sm font-bold text-gray-900 dark:text-white">{won(d.pending_krw)}</p></div>
                      <div className="rounded-lg bg-warm py-1.5"><p className="text-[10px] text-gray-500 dark:text-gray-400">확정</p><p className="text-sm font-bold text-gray-900 dark:text-white">{won(d.confirmed_krw)}</p></div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="flex-1 min-w-0 truncate text-[11px] tabular-nums text-gray-600 dark:text-gray-300">{d.store_link.replace('https://', '')}</p>
                      <button onClick={() => copy(d.product_link || d.store_link)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-[11px] font-bold text-gray-700 dark:text-gray-200"><Copy className="w-3 h-3" /> 복사</button>
                      <button onClick={() => share(d)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand text-white text-[11px] font-bold"><Share2 className="w-3 h-3" /> 공유</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 💸 중개사 몫 — 행이 있을 때만(게이트 OFF 면 안 뜬다) */}
      {broker.length > 0 && (
        <div className="bg-surface border border-line rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">🏪 중개 매장 몫 ({broker.length})</h3>
          <ul className="space-y-2">
            {broker.map((b) => (
              <li key={b.seller_id} className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{b.seller_name || `매장 ${b.seller_id}`}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">판매 {b.orders_count}건 · 대기 {won(b.pending_krw)} · 확정 {won(b.confirmed_krw)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {referred.length > 0 && (
        <div className="bg-surface border border-line rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">🏪 내가 영입한 매장 ({referred.length}개)</h3>
          <ul className="space-y-2">
            {referred.map((s) => {
              const remaining = s.referral_bonus_until ? Math.max(0, Math.ceil((new Date(s.referral_bonus_until).getTime() - Date.now()) / (30 * 86400_000))) : 0
              return (
                <li key={s.id} className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">누적 commission {won(s.total_commission)}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded font-bold ${remaining > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-warm text-gray-500 dark:text-gray-400'}`}>
                    {remaining > 0 ? `보너스 ${remaining}개월 남음` : '보너스 종료'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
