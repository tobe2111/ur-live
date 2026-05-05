/**
 * 어뷰징 탐지 관리 페이지 (2026-05-05)
 *
 * anomaly-detect.ts cron 이 매시간 적재하는 abuse_detections 를
 * 어드민이 조회하고 처리합니다.
 *
 * 패턴:
 *   donation_spike         — 후원 폭증 (z-score > 3)
 *   repeat_donor_24h       — 같은 buyer 24h ≥3건 후원
 *   new_account_donation_pattern — 신규 가입자 후원 ≥50%
 *   rapid_signups_same_ip  — 동일 IP 24h ≥5명 가입
 */

import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Shield, AlertTriangle, AlertOctagon, Info, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface AbuseDetection {
  id: number
  pattern: string
  user_id: string | null
  ref_type: string | null
  ref_id: string | null
  evidence: string
  severity: 'low' | 'medium' | 'high'
  reviewed: number
  created_at: string
}

const PATTERN_LABEL: Record<string, string> = {
  donation_spike: '후원 폭증',
  repeat_donor_24h: '반복 후원 (24h)',
  new_account_donation_pattern: '신규계정 후원 패턴',
  rapid_signups_same_ip: '동일 IP 대량 가입',
}

const SEVERITY_STYLE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  high:   { label: '높음',  cls: 'bg-red-100 text-red-700',    icon: <AlertOctagon className="w-3 h-3" /> },
  medium: { label: '중간',  cls: 'bg-amber-100 text-amber-700', icon: <AlertTriangle className="w-3 h-3" /> },
  low:    { label: '낮음',  cls: 'bg-blue-100 text-blue-700',   icon: <Info className="w-3 h-3" /> },
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLE[severity] || SEVERITY_STYLE.low
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  )
}

function EvidenceRow({ detection }: { detection: AbuseDetection }) {
  const [expanded, setExpanded] = useState(false)
  let evidence: Record<string, unknown> = {}
  try { evidence = JSON.parse(detection.evidence) } catch { /* ignore */ }

  return (
    <tr className={`border-t border-gray-100 ${detection.severity === 'high' ? 'bg-red-50/40' : ''}`}>
      <td className="px-4 py-3 whitespace-nowrap">
        <SeverityBadge severity={detection.severity} />
      </td>
      <td className="px-4 py-3">
        <p className="text-[12px] font-semibold text-gray-900">
          {PATTERN_LABEL[detection.pattern] ?? detection.pattern}
        </p>
        {detection.ref_type && (
          <p className="text-[11px] text-gray-500">{detection.ref_type}: {detection.ref_id}</p>
        )}
      </td>
      <td className="px-4 py-3 text-[11px] text-gray-500">
        {detection.user_id ? `user ${detection.user_id}` : '-'}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? '접기' : '상세'}
        </button>
        {expanded && (
          <pre className="mt-2 text-[10px] bg-gray-50 border border-gray-200 rounded-lg p-2 overflow-auto max-w-xs max-h-32 text-gray-700">
            {JSON.stringify(evidence, null, 2)}
          </pre>
        )}
      </td>
      <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
        {new Date(detection.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="px-4 py-3">
        {detection.reviewed ? (
          <span className="text-[11px] text-green-600 font-medium">검토 완료</span>
        ) : (
          <span className="text-[11px] text-gray-400">미검토</span>
        )}
      </td>
    </tr>
  )
}

export default function AdminAbusePage() {
  const [detections, setDetections] = useState<AbuseDetection[]>([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [patternFilter, setPatternFilter] = useState<string>('all')
  const token = localStorage.getItem('admin_token') || ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/abuse-detections', {
        params: {
          severity: severityFilter !== 'all' ? severityFilter : undefined,
          pattern: patternFilter !== 'all' ? patternFilter : undefined,
          limit: 200,
        },
        headers: { Authorization: `Bearer ${token}` },
      })
      setDetections(res.data?.detections ?? [])
    } catch {
      toast.error('어뷰징 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [severityFilter, patternFilter, token])

  useEffect(() => { load() }, [load])

  const highCount = detections.filter(d => d.severity === 'high').length
  const unreviewedCount = detections.filter(d => !d.reviewed).length

  return (
    <AdminLayout title="어뷰징 탐지">
      <DashboardPageHeader
        title="어뷰징 탐지 현황"
        subtitle="매시간 z-score 기반 이상 패턴 자동 탐지 결과입니다."
        icon={<Shield className="w-5 h-5" />}
        actions={
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[12px] text-gray-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />새로고침
          </button>
        }
      />

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mt-4 mb-5">
        {[
          { label: '전체', value: detections.length, cls: 'text-gray-900' },
          { label: 'HIGH 위험', value: highCount, cls: 'text-red-600' },
          { label: '미검토', value: unreviewedCount, cls: 'text-amber-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <p className={`text-[22px] font-black ${c.cls}`}>{c.value}</p>
            <p className="text-[11px] text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-xl text-[12px] text-gray-700 bg-white"
        >
          <option value="all">전체 심각도</option>
          <option value="high">HIGH</option>
          <option value="medium">MEDIUM</option>
          <option value="low">LOW</option>
        </select>
        <select
          value={patternFilter}
          onChange={e => setPatternFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-xl text-[12px] text-gray-700 bg-white"
        >
          <option value="all">전체 패턴</option>
          {Object.entries(PATTERN_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-[13px]">로딩 중...</div>
        ) : detections.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-[13px]">탐지된 패턴이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">심각도</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">패턴</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">대상</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">증거</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">탐지 시각</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-600">상태</th>
                </tr>
              </thead>
              <tbody>
                {detections.map(d => <EvidenceRow key={d.id} detection={d} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
