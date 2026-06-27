import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

/**
 * 🆕 2026-06-27 유어애즈 — 부정클릭 방지 Phase 1 (탐지·리포트, 차단 0).
 *   광고주 사이트 등록 → 픽셀 스니펫 → 방문 수집 → 의심 IP 리포트.
 *   프라이버시: 국가 수준만, 90일 보관, 광고주별 격리. 차단(노출제한 IP)은 Phase 2.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

interface Site { advertiser_key: string; domain: string; created_at: string }
interface SuspiciousIp { ip: string; country: string; clicks: number; adClicks: number; lastSeen: string; suspicious: boolean }
interface ClickReport { days: number; totalClicks: number; uniqueIps: number; adClicks: number; suspects: SuspiciousIp[] }

const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
const input = 'w-full h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

export default function ClickGuardPanel() {
  const [sites, setSites] = useState<Site[]>([])
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<ClickReport | null>(null)
  const [days, setDays] = useState<7 | 30>(7)
  const [blocklist, setBlocklist] = useState<Array<{ ip: string; reason: string | null; created_at: string }>>([])
  const [blocking, setBlocking] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://live.ur-team.com'

  const loadSites = useCallback(async () => {
    try {
      const r = await api.get('/api/ads/clickguard/sites', { headers: authHeader() })
      if (r.data?.success) setSites(r.data.sites || [])
    } catch { /* graceful */ }
  }, [])

  const loadReport = useCallback(async (d: 7 | 30) => {
    try {
      const r = await api.get(`/api/ads/clickguard/report?days=${d}`, { headers: authHeader() })
      if (r.data?.success) setReport(r.data.report || null)
    } catch { /* graceful */ }
  }, [])

  const loadBlocklist = useCallback(async () => {
    try {
      const r = await api.get('/api/ads/clickguard/blocklist', { headers: authHeader() })
      if (r.data?.success) setBlocklist(r.data.blocklist || [])
    } catch { /* graceful */ }
  }, [])

  useEffect(() => { loadSites() }, [loadSites])
  useEffect(() => { if (sites.length) { loadReport(days); loadBlocklist() } }, [sites.length, days, loadReport, loadBlocklist])

  async function blockIp(ip: string) {
    if (!ip) return
    setBlocking(ip)
    try {
      const r = await api.post('/api/ads/clickguard/block', { ip, reason: '부정클릭 의심' }, { headers: authHeader() })
      if (r.data?.success) { toast.success(`${ip} 차단 목록에 추가`); setBlocklist(r.data.blocklist || []) }
      else toast.error(r.data?.error || '추가 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '추가 실패')
    } finally { setBlocking(null) }
  }

  async function unblockIp(ip: string) {
    await api.delete(`/api/ads/clickguard/block?ip=${encodeURIComponent(ip)}`, { headers: authHeader() }).catch(() => {})
    await loadBlocklist()
  }

  async function addSite() {
    const d = domain.trim()
    if (!d) { toast.error('도메인을 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/ads/clickguard/site', { domain: d }, { headers: authHeader() })
      if (r.data?.success) { toast.success('사이트 등록 완료 — 아래 스니펫을 붙여넣으세요'); setDomain(''); await loadSites() }
      else toast.error(r.data?.error || '등록 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '등록 실패')
    } finally { setBusy(false) }
  }

  async function removeSite(key: string) {
    if (!(await confirmDialog('이 사이트와 수집된 클릭 기록을 모두 삭제할까요?'))) return
    await api.delete(`/api/ads/clickguard/site?key=${encodeURIComponent(key)}`, { headers: authHeader() }).catch(() => {})
    await loadSites(); setReport(null)
  }

  function snippet(key: string) {
    return `<script src="${origin}/api/ads/clickguard/pixel.js?k=${key}" async></script>`
  }
  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success('복사됨')).catch(() => toast.error('복사 실패'))
  }
  const blockedSet = new Set(blocklist.map(b => b.ip))

  const POLICY = '부정클릭 방지를 위해 광고 유입 방문자의 접속기록(IP·접속국가·유입경로)을 수집하며, 이를 (주)유어팀(유어애즈)에 위탁 처리합니다. 수집 정보는 부정클릭 탐지·차단 목적으로만 사용되고 90일 후 파기됩니다.'

  return (
    <div className={`mt-3 ${card}`}>
      <div className="text-[14px] font-bold text-gray-900 dark:text-white">🛡️ 부정클릭 방지 <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium">Phase 1 · 탐지/리포트</span></div>
      <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">내 사이트에 픽셀을 넣으면 광고 유입 방문을 수집해 <b>의심 IP</b>를 찾아줍니다. (현재는 탐지·리포트만 — 자동 차단은 준비 중)</p>

      {/* 사이트 등록 */}
      <div className="mt-2 flex gap-2">
        <input className={input} placeholder="내 사이트 도메인 (예: example.com)" value={domain} onChange={e => setDomain(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSite() }} />
        <button onClick={addSite} disabled={busy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">등록</button>
      </div>

      {/* 등록된 사이트 + 픽셀 스니펫 */}
      {sites.length > 0 && (
        <div className="mt-3 space-y-2">
          {sites.map(s => (
            <div key={s.advertiser_key} className="rounded-lg border border-gray-100 dark:border-[#1A1A1A] p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-gray-900 dark:text-white">{s.domain}</span>
                <button onClick={() => removeSite(s.advertiser_key)} className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-red-500">삭제</button>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <code className="flex-1 truncate rounded bg-gray-50 dark:bg-[#0A0A0A] px-2 py-1 text-[10.5px] text-gray-600 dark:text-gray-300">{snippet(s.advertiser_key)}</code>
                <button onClick={() => copy(snippet(s.advertiser_key))} className="shrink-0 rounded border border-gray-200 dark:border-[#2A2A2A] px-2 py-1 text-[10.5px] font-bold text-gray-700 dark:text-gray-200">복사</button>
              </div>
              <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">위 스니펫을 사이트 모든 페이지 &lt;/body&gt; 앞에 붙여넣으세요.</p>
            </div>
          ))}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">개인정보처리방침 안내문 (사이트에 고지 필요)</span>
              <button onClick={() => copy(POLICY)} className="shrink-0 rounded border border-amber-300 dark:border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">복사</button>
            </div>
            <p className="mt-1 text-[10.5px] text-amber-700 dark:text-amber-200/80 leading-relaxed">{POLICY}</p>
          </div>
        </div>
      )}

      {/* 리포트 */}
      {sites.length > 0 && report && (
        <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">📋 의심 IP 리포트</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
              {([7, 30] as const).map(d => (
                <button key={d} onClick={() => setDays(d)} className={`px-2.5 py-0.5 text-[11px] font-semibold ${days === d ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0A0A0A]' : 'text-gray-500 dark:text-gray-400'}`}>{d}일</button>
              ))}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[{ l: '총 클릭', v: formatNumber(report.totalClicks) }, { l: '고유 IP', v: formatNumber(report.uniqueIps) }, { l: '광고 유입', v: formatNumber(report.adClicks) }].map(m => (
              <div key={m.l} className="rounded-lg bg-gray-50 dark:bg-[#0A0A0A] p-2 text-center">
                <div className="text-[10px] text-gray-400 dark:text-gray-500">{m.l}</div>
                <div className="text-[12.5px] font-bold text-gray-900 dark:text-white tabular-nums">{m.v}</div>
              </div>
            ))}
          </div>
          {report.suspects.length === 0 ? (
            <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">아직 수집된 데이터가 없습니다. 픽셀 설치 후 방문이 쌓이면 표시됩니다.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
                  <th className="py-1 pr-2">IP</th><th className="py-1 pr-2">국가</th><th className="py-1 pr-2 text-right">클릭</th><th className="py-1 pr-2 text-right">광고</th><th className="py-1 pr-2">판정</th><th className="py-1 text-right">차단</th>
                </tr></thead>
                <tbody>
                  {report.suspects.slice(0, 30).map((s, i) => {
                    const blocked = blockedSet.has(s.ip)
                    return (
                    <tr key={i} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
                      <td className="py-1 pr-2 font-mono text-[10.5px]">{s.ip || '-'}</td>
                      <td className="py-1 pr-2">{s.country || '-'}</td>
                      <td className="py-1 pr-2 text-right tabular-nums font-bold">{formatNumber(s.clicks)}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(s.adClicks)}</td>
                      <td className="py-1 pr-2">
                        {s.suspicious
                          ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">의심</span>
                          : <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400">정상</span>}
                      </td>
                      <td className="py-1 text-right">
                        {blocked
                          ? <span className="text-[10px] text-gray-400 dark:text-gray-500">차단됨</span>
                          : <button onClick={() => blockIp(s.ip)} disabled={blocking === s.ip || !s.ip} className="rounded border border-red-200 dark:border-red-500/30 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 disabled:opacity-40">{blocking === s.ip ? '…' : '차단'}</button>}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 차단 목록 (검색광고센터 노출제한 IP 복붙용) */}
      {sites.length > 0 && blocklist.length > 0 && (
        <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">🚫 차단 목록 <span className="text-gray-400 dark:text-gray-500 font-medium">({blocklist.length}/600)</span></span>
            <button onClick={() => copy(blocklist.map(b => b.ip).join('\n'))} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1 text-[11px] font-bold text-white dark:text-[#0A0A0A]">전체 복사</button>
          </div>
          <p className="mt-1 text-[10.5px] text-gray-400 dark:text-gray-500 leading-relaxed">
            '전체 복사' 후 <b>네이버 검색광고센터 &gt; 도구 &gt; 노출제한 IP 관리</b>에 붙여넣으면 해당 IP 에 광고가 노출되지 않습니다.
            (네이버가 공식 API 를 열면 자동 등록으로 전환됩니다.)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {blocklist.map(b => (
              <span key={b.ip} className="inline-flex items-center gap-1 rounded bg-gray-50 dark:bg-[#0A0A0A] px-1.5 py-0.5 text-[10.5px] font-mono text-gray-600 dark:text-gray-300">
                {b.ip}
                <button onClick={() => unblockIp(b.ip)} className="text-gray-400 dark:text-gray-500 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
