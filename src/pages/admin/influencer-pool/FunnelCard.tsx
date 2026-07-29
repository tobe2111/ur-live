import { formatNumber } from '@/utils/format'

/**
 * 📊 아웃리치 전환 퍼널 — 컨택함 → 관심(회신) → 계약 전환율 + 컨택 채널 분해.
 *   "모은 게 실제 성과로 이어지나" 측정. 컨택 이력(reached>0) 있을 때만 렌더.
 */
export interface FunnelStats {
  reached?: number; replied?: number; st_contracted?: number; st_rejected?: number; st_hold?: number; contacted7?: number
  ch_email?: number; ch_dm?: number; ch_note?: number; ch_kakao?: number; ch_call?: number; ch_other?: number
  opened?: number; bounced?: number; consented?: number // 📬 이메일 개봉/반송(Resend 웹훅) · 📥 사전동의(자동발송 가능 모수)
}
/** 카테고리별 전환 — "어떤 카테고리가 실제로 회신·계약으로 이어지나"(타겟/문구 조정 근거). */
export interface CategoryFunnelRow { category: string; total: number; reached: number; replied: number; contracted: number; consented: number }

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

function Step({ label, n, rate, cls }: { label: string; n: number; rate?: string; cls: string }) {
  return (
    <div className={`flex-1 min-w-[92px] rounded-lg px-3 py-2 ${cls}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-xl font-bold leading-tight">{formatNumber(n)}</div>
      {rate && <div className="text-[11px] opacity-70">{rate}</div>}
    </div>
  )
}

export default function FunnelCard({ stats, categories }: { stats: FunnelStats; categories?: CategoryFunnelRow[] }) {
  const reached = stats.reached || 0
  if (reached <= 0) return null
  const replied = stats.replied || 0, contracted = stats.st_contracted || 0
  const opened = stats.opened || 0, consented = stats.consented || 0
  const cats = (categories || []).filter(c => c.reached > 0)
  const chans = [
    { k: '이메일', n: stats.ch_email || 0 }, { k: '인스타DM', n: stats.ch_dm || 0 }, { k: '네이버쪽지', n: stats.ch_note || 0 },
    { k: '카톡', n: stats.ch_kakao || 0 }, { k: '전화', n: stats.ch_call || 0 }, { k: '기타', n: stats.ch_other || 0 },
  ].filter(c => c.n > 0)
  return (
    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/40 px-4 py-3">
      <div className="text-sm font-medium text-indigo-900 mb-2">📊 아웃리치 전환 퍼널 <span className="text-xs font-normal text-gray-400">— 최근 7일 컨택 {formatNumber(stats.contacted7 || 0)}</span></div>
      <div className="flex items-center gap-2 flex-wrap">
        <Step label="컨택함" n={reached} cls="bg-blue-100 text-blue-800" />
        {opened > 0 && <><span className="text-gray-300">→</span>
          <Step label="📬 개봉" n={opened} rate={`개봉률 ${pct(opened, reached)}%`} cls="bg-sky-100 text-sky-800" /></>}
        <span className="text-gray-300">→</span>
        <Step label="관심(회신)" n={replied} rate={`전환 ${pct(replied, reached)}%`} cls="bg-amber-100 text-amber-800" />
        <span className="text-gray-300">→</span>
        <Step label="계약" n={contracted} rate={`전환 ${pct(contracted, replied)}%`} cls="bg-emerald-100 text-emerald-800" />
        <span className="text-gray-300 mx-1">·</span>
        <Step label="거절" n={stats.st_rejected || 0} cls="bg-gray-100 text-gray-500" />
        <Step label="보류" n={stats.st_hold || 0} cls="bg-gray-100 text-gray-500" />
        {consented > 0 && <Step label="📥 사전동의" n={consented} cls="bg-violet-100 text-violet-800" />}
      </div>
      {chans.length > 0 && (
        <div className="mt-2 text-[11px] text-gray-500">컨택 채널: {chans.map(c => `${c.k} ${c.n}`).join(' · ')}
          {stats.bounced ? <span className="text-red-500"> · 반송/신고 {formatNumber(stats.bounced)}</span> : null}</div>
      )}
      {/* 📊 카테고리별 전환 — 어떤 카테고리가 실제 성과로 이어지는지(발송 타겟·문구 조정 근거). */}
      {cats.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="text-[11px] text-gray-600">
            <thead className="text-gray-400"><tr>
              <th className="text-left pr-3 font-medium">카테고리</th><th className="text-right px-2 font-medium">컨택</th>
              <th className="text-right px-2 font-medium">회신</th><th className="text-right px-2 font-medium">회신율</th>
              <th className="text-right px-2 font-medium">계약</th><th className="text-right pl-2 font-medium">동의</th>
            </tr></thead>
            <tbody>
              {cats.map(cf => (
                <tr key={cf.category} className="border-t border-indigo-100">
                  <td className="pr-3 py-0.5">{cf.category}</td>
                  <td className="text-right px-2">{formatNumber(cf.reached)}</td>
                  <td className="text-right px-2">{formatNumber(cf.replied)}</td>
                  <td className={`text-right px-2 font-medium ${pct(cf.replied, cf.reached) >= 20 ? 'text-emerald-600' : ''}`}>{pct(cf.replied, cf.reached)}%</td>
                  <td className="text-right px-2">{formatNumber(cf.contracted)}</td>
                  <td className="text-right pl-2">{formatNumber(cf.consented)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
