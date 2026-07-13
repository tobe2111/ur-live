import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { downloadCsv } from '@/utils/csv-download'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import PanelError from './PanelError'

/**
 * 🆕 2026-07-13 유어애즈 — 인플루언서 발굴/연락처 수집 패널.
 *   YouTube Data API 키워드 발굴 + 공개 설명에서 이메일·인스타·틱톡 링크 추출 → 리드 DB.
 *   인스타/틱톡 직접 발굴은 데이터 제공사 연동 시 활성(sources 로 표시).
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

interface Lead {
  id: number; platform: string; name: string; handle: string | null; url: string
  subscriber_count: number; view_count: number; video_count: number; country: string | null; thumbnail: string | null
  email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  status: string; memo: string | null; collected_at: string
}
interface Sources { youtube: boolean; instagram: boolean; tiktok: boolean }

const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
const input = 'h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'
const STATUS_KO: Record<string, string> = { new: '신규', contacted: '컨택함', rejected: '제외' }
const PLATFORMS = [{ id: 'youtube', label: '유튜브' }, { id: 'instagram', label: '인스타그램' }, { id: 'tiktok', label: '틱톡' }] as const

const igUrl = (h: string) => `https://instagram.com/${h}`
const ttUrl = (h: string) => `https://tiktok.com/@${h}`

export default function InfluencerDiscoveryPanel() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [sources, setSources] = useState<Sources>({ youtube: false, instagram: false, tiktok: false })
  const [platform, setPlatform] = useState<'youtube' | 'instagram' | 'tiktok'>('youtube')
  const [keyword, setKeyword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const [onlyContact, setOnlyContact] = useState(false)

  const load = useCallback(async () => {
    setErr(false)
    try {
      const r = await api.get('/api/ads/influencers', { headers: authHeader() })
      if (r.data?.success) { setLeads(r.data.leads || []); if (r.data.sources) setSources(r.data.sources) }
    } catch { setErr(true) }
  }, [])
  useEffect(() => { load() }, [load])

  async function discover() {
    if (keyword.trim().length < 2) { toast.error('키워드를 2자 이상 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/ads/influencers/discover', { keyword: keyword.trim(), platform, max: 20 }, { headers: authHeader() })
      if (r.data?.success) {
        setLeads(r.data.leads || [])
        toast.success(`${r.data.found}명 발굴 · ${r.data.saved}명 신규 저장`)
      } else toast.error(r.data?.error || '발굴 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '발굴 실패')
    } finally { setBusy(false) }
  }

  async function setStatus(l: Lead, status: string) {
    try {
      const r = await api.patch(`/api/ads/influencers/${l.id}`, { status }, { headers: authHeader() })
      if (r.data?.success) setLeads(prev => prev.map(x => x.id === l.id ? { ...x, status } : x))
    } catch { toast.error('변경 실패') }
  }

  async function remove(l: Lead) {
    const ok = await confirmDialog({ title: '리드 삭제', message: `${l.name} 을(를) 목록에서 삭제할까요?`, confirmText: '삭제', danger: true })
    if (!ok) return
    try {
      const r = await api.delete(`/api/ads/influencers/${l.id}`, { headers: authHeader() })
      if (r.data?.success) setLeads(prev => prev.filter(x => x.id !== l.id))
    } catch { toast.error('삭제 실패') }
  }

  function exportCsv() {
    const rows = shown.map(l => [
      l.name, l.platform, l.handle || '', String(l.subscriber_count), l.url,
      l.email || '', l.instagram ? igUrl(l.instagram) : '', l.tiktok ? ttUrl(l.tiktok) : '', l.links || '',
      l.country || '', STATUS_KO[l.status] || l.status, l.memo || '',
    ])
    downloadCsv(`influencers-${new Date().toISOString().slice(0, 10)}.csv`,
      ['이름', '플랫폼', '핸들', '구독자', 'URL', '이메일', '인스타', '틱톡', '링크', '국가', '상태', '메모'], rows)
  }

  const shown = onlyContact ? leads.filter(l => l.email || l.instagram || l.tiktok || l.links) : leads
  const contactCount = leads.filter(l => l.email || l.instagram || l.tiktok || l.links).length
  const providerReady = sources.instagram || sources.tiktok

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">인플루언서 발굴 · 연락처 수집</h3>
          <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">키워드로 유튜브 채널을 찾아 구독자·<b>공개 비즈니스 이메일·인스타/틱톡 링크</b>를 자동 수집합니다.</p>
        </div>
        {leads.length > 0 && <button onClick={exportCsv} className="h-9 px-3 rounded-lg border border-gray-300 dark:border-[#2A2A2A] text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">CSV 내보내기</button>}
      </div>

      {/* 플랫폼 선택 */}
      <div className="mt-3 flex gap-1.5">
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => setPlatform(p.id)} className={`h-8 px-3 rounded-lg text-[12.5px] font-semibold ${platform === p.id ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0A0A0A]' : 'border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300'}`}>{p.label}</button>
        ))}
      </div>

      {/* 인스타/틱톡: 제공사 미연동 안내 */}
      {(platform === 'instagram' || platform === 'tiktok') && !providerReady && (
        <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-2.5 text-[11.5px] text-amber-800 dark:text-amber-300">
          {platform === 'instagram' ? '인스타그램' : '틱톡'} <b>직접 발굴</b>은 데이터 제공사 API 연동이 필요합니다(자체 스크래핑은 불가·ToS/법 리스크). <b>지금은 유튜브 발굴 결과에서 인스타/틱톡 링크가 함께 수집</b>됩니다 — 유튜버가 설명란에 교차게시하는 경우.
        </div>
      )}

      {/* 발굴 폼 */}
      <div className="mt-2 flex gap-2">
        <input className={`flex-1 ${input}`} placeholder={platform === 'youtube' ? '예: 뷰티 리뷰, 캠핑, 홈트, 맛집' : '제공사 연동 후 사용 가능'} value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') discover() }} disabled={platform !== 'youtube' && !providerReady} />
        <button onClick={discover} disabled={busy || (platform !== 'youtube' && !providerReady)} className="h-10 px-4 rounded-lg bg-gray-900 dark:bg-white text-[13px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{busy ? '수집 중…' : '발굴하기'}</button>
      </div>

      {/* 준법 안내 */}
      <p className="mt-2 text-[10.5px] text-gray-400 dark:text-gray-500 leading-relaxed">
        ⚖️ 수집한 이메일·연락처로 광고성 정보를 보내려면 <b>사전 수신동의</b>가 필요합니다(정보통신망법). 컨택 전 동의 확보 또는 opt-in 채널을 이용하세요.
      </p>

      {err && <PanelError onRetry={load} />}

      {/* 리드 목록 */}
      {leads.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="text-gray-500 dark:text-gray-400">총 {formatNumber(leads.length)}명 · 연락처 확보 {formatNumber(contactCount)}명</span>
          <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={onlyContact} onChange={e => setOnlyContact(e.target.checked)} /> 연락처 있는 것만
          </label>
        </div>
      )}

      <div className="mt-2 space-y-2">
        {leads.length === 0 && !err && <p className="py-6 text-center text-[12.5px] text-gray-400 dark:text-gray-500">키워드로 인플루언서를 발굴해보세요.</p>}
        {shown.map(l => (
          <div key={l.id} className={`rounded-xl border p-3 ${l.status === 'rejected' ? 'border-gray-100 dark:border-[#1A1A1A] opacity-60' : 'border-gray-100 dark:border-[#1F2637]'}`}>
            <div className="flex items-start gap-3">
              {l.thumbnail && <img src={l.thumbnail} alt="" className="w-10 h-10 rounded-full shrink-0" loading="lazy" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-[13.5px] font-bold text-gray-900 dark:text-white hover:underline">{l.name}</a>
                  <span className="text-[11.5px] text-gray-500 dark:text-gray-400">구독 {formatNumber(l.subscriber_count)}</span>
                  {l.country && <span className="text-[10.5px] text-gray-400">{l.country}</span>}
                </div>
                {/* 연락처 chips */}
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  {l.email && <a href={`mailto:${l.email}`} className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">✉ {l.email}</a>}
                  {l.instagram && <a href={igUrl(l.instagram)} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 font-semibold">IG @{l.instagram}</a>}
                  {l.tiktok && <a href={ttUrl(l.tiktok)} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1A2030] text-gray-700 dark:text-gray-200 font-semibold">TikTok @{l.tiktok}</a>}
                  {l.links && l.links.split(' ').filter(Boolean).map((u, i) => <a key={i} href={u.startsWith('http') ? u : `https://${u}`} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1A2030] text-gray-600 dark:text-gray-300">🔗 링크</a>)}
                  {!l.email && !l.instagram && !l.tiktok && !l.links && <span className="text-gray-400 dark:text-gray-500">연락처 미공개</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 text-[11.5px]">
                <select value={l.status} onChange={e => setStatus(l, e.target.value)} className="rounded border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-1.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                  {Object.entries(STATUS_KO).map(([v, k]) => <option key={v} value={v}>{k}</option>)}
                </select>
                <button onClick={() => remove(l)} className="font-semibold text-red-500 hover:underline">삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
