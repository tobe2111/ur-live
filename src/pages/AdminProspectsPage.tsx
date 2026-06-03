/**
 * 🛡️ 2026-05-27 (사용자 결정): admin 영업자 prospects 전체 검토 페이지.
 *
 * 모든 영업자 (agency / influencer) 가 등록한 매장 영입 prospects 일괄 검토.
 * - 분쟁 해결 (같은 매장 2 영업자 시 admin 결정)
 * - 부정 영업 적발 (가짜 prospects)
 * - 영업 활동 모니터링
 *
 * Status 필터: visiting / converted / expired
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SEO from '@/components/SEO'

type ProspectStatus = 'visiting' | 'converted' | 'expired'

interface Prospect {
  id: number
  introducer_type: 'agency' | 'influencer'
  introducer_id: string
  store_name: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  business_address: string | null
  notes: string | null
  proof_image_url: string | null
  status: ProspectStatus
  converted_seller_id: number | null
  first_sale_at: string | null
  commission_locked_at: string | null
  expires_at: string | null
  created_at: string
}

const STATUS_META: Record<ProspectStatus, { label: string; color: string }> = {
  visiting: { label: '영입 중', color: 'bg-amber-100 text-amber-700' },
  converted: { label: '가입 완료', color: 'bg-green-100 text-green-700' },
  expired: { label: '만료', color: 'bg-gray-100 text-gray-500' },
}

export default function AdminProspectsPage() {
  const [status, setStatus] = useState<ProspectStatus>('visiting')
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (status별 캐시).
  const { data: prospects = [], isLoading: loading, refetch } = useApiQuery<Prospect[]>(
    ['admin', 'prospects', status], '/api/admin/prospects',
    { params: { status }, select: (r: any) => (r?.success ? r.data || [] : []) },
  )
  const load = () => refetch()

  // 통계 — 영업자별 그룹
  const introducerStats = prospects.reduce((acc, p) => {
    const key = `${p.introducer_type}:${p.introducer_id}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const topIntroducers = Object.entries(introducerStats).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <>
      <SEO title="영업 prospects 검토 - admin" description="영업자 매장 영입 모니터링" url="/admin/prospects" />
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-gray-900">🤝 영업 prospects ({prospects.length})</h1>
            <Link to="/admin" className="text-xs text-gray-500">← admin</Link>
          </div>
          <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2">
            {(['visiting', 'converted', 'expired'] as ProspectStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  status === s ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </header>

        {/* Top 영업자 통계 */}
        {topIntroducers.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-bold text-gray-700 mb-2">Top 영업자 ({STATUS_META[status].label} 기준)</p>
              <div className="flex flex-wrap gap-2">
                {topIntroducers.map(([key, count]) => {
                  const [type, id] = key.split(':')
                  return (
                    <span key={key} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[11px] font-bold">
                      {type === 'agency' ? '🏢' : '🎤'} {id}: {count}건
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">로딩 중...</div>
          ) : prospects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm text-gray-500">{STATUS_META[status].label} prospects 없음</p>
            </div>
          ) : (
            prospects.map((p) => {
              const meta = STATUS_META[p.status]
              const introducerLabel = p.introducer_type === 'agency' ? '🏢 에이전시' : '🎤 인플루언서'
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">
                        {p.store_name || '(매장명 없음)'} <span className="text-[11px] text-gray-400 font-normal">#{p.id}</span>
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {p.contact_name && <span>{p.contact_name} · </span>}
                        {p.contact_phone || p.contact_email}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-600 mb-2">
                    <span>{introducerLabel} #{p.introducer_id}</span>
                    {p.business_address && <span>· 📍 {p.business_address}</span>}
                  </div>

                  {p.notes && (
                    <p className="text-[11px] text-gray-500 italic mb-2">💬 {p.notes}</p>
                  )}

                  {p.proof_image_url && (
                    <a href={p.proof_image_url} target="_blank" rel="noopener noreferrer">
                      <img src={p.proof_image_url} alt="증빙" className="w-32 h-20 object-cover rounded border border-gray-200" />
                    </a>
                  )}

                  {p.status === 'converted' && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-[11px]">
                      <span className="text-gray-600">셀러 #{p.converted_seller_id}</span>
                      {p.first_sale_at ? (
                        <span className="ml-2 text-green-600 font-bold">✅ 첫 매출 {new Date(p.first_sale_at).toLocaleDateString('ko-KR')} — commission 활성</span>
                      ) : (
                        <span className="ml-2 text-amber-600">⏳ 첫 매출 대기</span>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-400 mt-2">
                    등록: {new Date(p.created_at).toLocaleString('ko-KR')}
                    {p.expires_at && p.status === 'visiting' && <span> · 만료: {new Date(p.expires_at).toLocaleDateString('ko-KR')}</span>}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
