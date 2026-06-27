import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

/**
 * 🆕 2026-06-27 유어애즈 — 네이버 검색광고 계정 연동 + 내 광고 구조 조회.
 *   멀티테넌트: 고객사가 자기 검색광고 키(고객ID/액세스라이선스/비밀키)를 연결 →
 *   캠페인→광고그룹→키워드(현재 입찰가) 드릴다운. 자동입찰/실적/키워드확장의 토대.
 *   읽기 전용(현재) — 입찰 변경(write)은 다음 단계.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

interface Campaign { id: string; name: string; type: string; status: string; dailyBudget: number }
interface AdGroup { id: string; name: string; status: string; bidAmt: number; campaignId: string }
interface AdKeyword { id: string; keyword: string; bidAmt: number; useGroupBid: boolean; status: string }
interface BidEstimate { position: number; bid: number }

const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
const input = 'w-full h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

export default function SearchAdPanel() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [form, setForm] = useState({ customer_id: '', access_license: '', secret_key: '' })
  const [busy, setBusy] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [openCampaign, setOpenCampaign] = useState<string | null>(null)
  const [adgroups, setAdgroups] = useState<Record<string, AdGroup[]>>({})
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<Record<string, AdKeyword[]>>({})
  // 목표순위 예상 입찰가 (읽기 — 연결 없이 플랫폼 키 폴백으로도 동작)
  const [estKw, setEstKw] = useState('')
  const [estDevice, setEstDevice] = useState<'PC' | 'MOBILE'>('PC')
  const [estBusy, setEstBusy] = useState(false)
  const [estimates, setEstimates] = useState<BidEstimate[] | null>(null)
  const [estOff, setEstOff] = useState(false)
  // 키워드 입찰가 수동 변경(write)
  const [bidEdit, setBidEdit] = useState<Record<string, string>>({})
  const [bidBusy, setBidBusy] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get('/api/ads/searchad/status', { headers: authHeader() })
      setConnected(!!r.data?.connected)
      setCustomerId(r.data?.customer_id || null)
    } catch { setConnected(false) }
  }, [])

  const loadCampaigns = useCallback(async () => {
    try {
      const r = await api.get('/api/ads/searchad/campaigns', { headers: authHeader() })
      if (r.data?.success) setCampaigns(r.data.campaigns || [])
    } catch { /* graceful */ }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => { if (connected) loadCampaigns() }, [connected, loadCampaigns])

  async function connect() {
    if (!form.customer_id.trim() || !form.access_license.trim() || !form.secret_key.trim()) { toast.error('세 값을 모두 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/ads/searchad/connect', form, { headers: authHeader() })
      if (r.data?.success) { toast.success(`검색광고 연결 완료 (캠페인 ${r.data.campaigns ?? 0}개)`); setForm({ customer_id: '', access_license: '', secret_key: '' }); await loadStatus() }
      else toast.error(r.data?.error || '연결 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '연결 실패')
    } finally { setBusy(false) }
  }

  async function disconnect() {
    await api.delete('/api/ads/searchad/connect', { headers: authHeader() }).catch(() => {})
    setCampaigns([]); setOpenCampaign(null); setOpenGroup(null); setAdgroups({}); setKeywords({})
    await loadStatus()
  }

  async function toggleCampaign(id: string) {
    if (openCampaign === id) { setOpenCampaign(null); return }
    setOpenCampaign(id); setOpenGroup(null)
    if (!adgroups[id]) {
      try {
        const r = await api.get(`/api/ads/searchad/adgroups?campaignId=${encodeURIComponent(id)}`, { headers: authHeader() })
        if (r.data?.success) setAdgroups(prev => ({ ...prev, [id]: r.data.adgroups || [] }))
      } catch { /* graceful */ }
    }
  }

  async function runEstimate() {
    const kw = estKw.trim()
    if (kw.length < 1) { toast.error('키워드를 입력해주세요'); return }
    setEstBusy(true); setEstimates(null); setEstOff(false)
    try {
      const r = await api.get(`/api/ads/searchad/estimate?keyword=${encodeURIComponent(kw)}&device=${estDevice}`, { headers: authHeader() })
      if (r.data?.success) setEstimates(r.data.estimates || [])
      else toast.error(r.data?.error || '추정 실패')
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { error?: string } } }
      if (ax.response?.status === 503) setEstOff(true)
      else toast.error(ax.response?.data?.error || '추정 실패')
    } finally { setEstBusy(false) }
  }

  async function applyBid(groupId: string, kw: AdKeyword) {
    const raw = bidEdit[kw.id]
    const bid = Math.round(Number(raw))
    if (!Number.isFinite(bid) || bid < 70 || bid > 100000) { toast.error('입찰가는 70~100,000원 범위로 입력해주세요'); return }
    if (!(await confirmDialog(`"${kw.keyword}" 입찰가를 ₩${formatNumber(bid)} 로 변경할까요? (실제 광고비에 영향)`))) return
    setBidBusy(kw.id)
    try {
      const r = await api.patch('/api/ads/searchad/keywords/bid', { keyword_id: kw.id, bid_amt: bid }, { headers: authHeader() })
      if (r.data?.success) {
        toast.success(`입찰가 ₩${formatNumber(bid)} 적용`)
        setKeywords(prev => ({ ...prev, [groupId]: (prev[groupId] || []).map(x => x.id === kw.id ? { ...x, bidAmt: bid, useGroupBid: false } : x) }))
        setBidEdit(prev => { const n = { ...prev }; delete n[kw.id]; return n })
      } else toast.error(r.data?.error || '입찰가 변경 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '입찰가 변경 실패')
    } finally { setBidBusy(null) }
  }

  async function toggleGroup(id: string) {
    if (openGroup === id) { setOpenGroup(null); return }
    setOpenGroup(id)
    if (!keywords[id]) {
      try {
        const r = await api.get(`/api/ads/searchad/keywords?adgroupId=${encodeURIComponent(id)}`, { headers: authHeader() })
        if (r.data?.success) setKeywords(prev => ({ ...prev, [id]: r.data.keywords || [] }))
      } catch { /* graceful */ }
    }
  }

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">📈 네이버 검색광고 계정 연동</div>
        {connected && <button onClick={disconnect} className="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">연결 해제</button>}
      </div>

      {/* 목표순위 예상 입찰가 (자동입찰 미리보기 — 읽기, 돈 변경 없음) */}
      <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-3">
        <div className="text-[12.5px] font-bold text-gray-900 dark:text-white">🎯 목표순위 예상 입찰가</div>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">"이 키워드를 N위에 노출하려면 입찰가 얼마?" — 자동입찰의 핵심. 실제 입찰 변경은 없습니다.</p>
        <div className="mt-2 flex gap-2">
          <input className={input} placeholder="키워드 (예: 무선이어폰)" value={estKw} onChange={e => setEstKw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runEstimate() }} />
          <div className="shrink-0 flex rounded-lg border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
            {(['PC', 'MOBILE'] as const).map(d => (
              <button key={d} onClick={() => setEstDevice(d)} className={`px-2.5 text-[11.5px] font-semibold ${estDevice === d ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0A0A0A]' : 'text-gray-500 dark:text-gray-400'}`}>{d === 'PC' ? 'PC' : '모바일'}</button>
            ))}
          </div>
          <button onClick={runEstimate} disabled={estBusy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-3 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{estBusy ? '…' : '추정'}</button>
        </div>
        {estOff && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-500">검색광고 키 설정 후 사용할 수 있습니다.</p>}
        {estimates && (estimates.length === 0 ? (
          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">추정 데이터가 없습니다(경쟁/노출 부족).</p>
        ) : (
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {estimates.map(e => (
              <div key={e.position} className="rounded-lg bg-gray-50 dark:bg-[#0A0A0A] p-2 text-center">
                <div className="text-[10px] text-gray-400 dark:text-gray-500">{e.position}위</div>
                <div className="text-[12px] font-bold text-gray-900 dark:text-white tabular-nums">₩{formatNumber(e.bid)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {connected === false && (
        <div className="mt-2 space-y-2">
          <p className="text-[11.5px] text-gray-400 dark:text-gray-500 leading-relaxed">
            검색광고센터 → 도구 → API 사용관리에서 발급한 <b>고객 ID · 액세스라이선스 · 비밀키</b>를 입력하세요.
            연결하면 자동입찰·실적·키워드 자동등록을 쓸 수 있습니다.
          </p>
          <input className={input} placeholder="고객 ID (숫자)" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} />
          <input className={input} placeholder="액세스라이선스" value={form.access_license} onChange={e => setForm(f => ({ ...f, access_license: e.target.value }))} />
          <input className={input} placeholder="비밀키" type="password" value={form.secret_key} onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))} />
          <button onClick={connect} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{busy ? '연결 중…' : '연결'}</button>
        </div>
      )}

      {connected && (
        <div className="mt-2">
          <p className="text-[12px] text-gray-600 dark:text-gray-300">연결됨 <span className="text-gray-400 dark:text-gray-500">(고객 ID {customerId})</span></p>
          {campaigns.length === 0 ? (
            <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">캠페인이 없습니다. 검색광고센터에서 캠페인을 만든 뒤 새로고침해주세요.</p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {campaigns.map(cp => (
                <div key={cp.id} className="rounded-lg border border-gray-100 dark:border-[#1A1A1A]">
                  <button onClick={() => toggleCampaign(cp.id)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left">
                    <span className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate">{openCampaign === cp.id ? '▾' : '▸'} {cp.name}</span>
                    <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{cp.type}{cp.dailyBudget > 0 ? ` · 일예산 ₩${formatNumber(cp.dailyBudget)}` : ''}</span>
                  </button>
                  {openCampaign === cp.id && (
                    <div className="px-3 pb-2 space-y-1">
                      {(adgroups[cp.id] || []).length === 0 ? (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 py-1">광고그룹 없음</p>
                      ) : (adgroups[cp.id] || []).map(g => (
                        <div key={g.id} className="rounded border border-gray-100 dark:border-[#1A1A1A]">
                          <button onClick={() => toggleGroup(g.id)} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left">
                            <span className="text-[12px] text-gray-700 dark:text-gray-300 truncate">{openGroup === g.id ? '▾' : '▸'} {g.name}</span>
                            <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">그룹입찰 ₩{formatNumber(g.bidAmt)}</span>
                          </button>
                          {openGroup === g.id && (
                            <div className="px-2.5 pb-2">
                              {(keywords[g.id] || []).length === 0 ? (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 py-1">키워드 없음</p>
                              ) : (
                                <table className="w-full text-[11.5px]">
                                  <thead><tr className="text-gray-400 dark:text-gray-500 text-left"><th className="py-1">키워드</th><th className="py-1 text-right">현재 입찰가</th><th className="py-1 text-right">입찰가 변경</th></tr></thead>
                                  <tbody>
                                    {(keywords[g.id] || []).map(k => (
                                      <tr key={k.id} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
                                        <td className="py-1 pr-2 truncate">{k.keyword}</td>
                                        <td className="py-1 text-right tabular-nums">{k.useGroupBid ? <span className="text-gray-400 dark:text-gray-500">그룹입찰</span> : `₩${formatNumber(k.bidAmt)}`}</td>
                                        <td className="py-1">
                                          <div className="flex items-center justify-end gap-1">
                                            <input type="number" min={70} max={100000} placeholder="70~"
                                              value={bidEdit[k.id] ?? ''} onChange={e => setBidEdit(prev => ({ ...prev, [k.id]: e.target.value }))}
                                              className="w-20 h-7 rounded border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-1.5 text-[11px] text-right text-gray-900 dark:text-white" />
                                            <button onClick={() => applyBid(g.id, k)} disabled={bidBusy === k.id || !bidEdit[k.id]}
                                              className="shrink-0 rounded bg-gray-900 dark:bg-white px-2 h-7 text-[10.5px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-40">{bidBusy === k.id ? '…' : '적용'}</button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">다음 단계: 키워드별 <b>목표순위 자동입찰</b>(입찰가 자동조정) · <b>통합실적</b>(StatReport).</p>
        </div>
      )}
    </div>
  )
}
