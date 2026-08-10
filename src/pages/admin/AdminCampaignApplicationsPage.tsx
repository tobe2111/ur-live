import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 📣 캠페인 신청자 관리 (/admin/campaign-applications) — 캠페인 코드 필터 + CSV 내보내기.
 *   데이터: campaign_applications (campaign-apply.routes SSOT). 읽기 전용.
 */
interface AppRow {
  id: number; campaign_code: string; user_id: string; name: string | null; phone: string | null
  email: string | null; contact: string | null; platform: string | null; account_url: string
  category: string | null; region: string | null; follower_size: string | null; collab_terms: string | null
  privacy_agreed_at: string | null; marketing_agreed_at: string | null; created_at: string
}
interface CampaignCount { campaign_code: string; cnt: number }

const PLATFORM_LABELS: Record<string, string> = {
  youtube: '유튜브', instagram: '인스타그램', naver_blog: '네이버 블로그', tistory: '티스토리', tiktok: '틱톡', etc: '기타',
}

export default function AdminCampaignApplicationsPage() {
  const [rows, setRows] = useState<AppRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignCount[]>([])
  const [filter, setFilter] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/admin/campaign-applications', { params: { campaign: filter || undefined, page, limit } })
      if (r.data?.success) {
        setRows(r.data.data.applications || [])
        setTotal(r.data.data.total || 0)
        setCampaigns(r.data.data.campaigns || [])
      }
    } catch { toast.error('신청자 목록을 불러오지 못했습니다') }
    finally { setLoading(false) }
  }, [filter, page])

  useEffect(() => { void load() }, [load])

  // 인증 헤더를 실은 blob 다운로드(평문 앵커는 Bearer 불가 — AdminDistrictCouponsPage 패턴)
  const downloadCsv = async () => {
    try {
      const r = await api.get('/api/admin/campaign-applications/export.csv', {
        params: { campaign: filter || undefined }, responseType: 'blob',
      })
      const url = URL.createObjectURL(r.data as Blob)
      const a = document.createElement('a')
      a.href = url; a.download = `campaign-${filter || 'all'}-applications.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch { toast.error('CSV 다운로드 실패') }
  }

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">캠페인 신청자</h1>
          <p className="text-sm text-gray-500 mt-0.5">캠페인 신청 페이지(/campaign/코드)로 접수된 인플루언서 — 총 {total.toLocaleString()}명</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white">
            <option value="">전체 캠페인</option>
            {campaigns.map(cmp => <option key={cmp.campaign_code} value={cmp.campaign_code}>{cmp.campaign_code} ({cmp.cnt})</option>)}
          </select>
          <button onClick={downloadCsv} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold">CSV 내보내기</button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500">신청자가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2.5 font-medium">신청일</th>
                <th className="px-3 py-2.5 font-medium">캠페인</th>
                <th className="px-3 py-2.5 font-medium">이름</th>
                <th className="px-3 py-2.5 font-medium">연락처</th>
                <th className="px-3 py-2.5 font-medium">플랫폼 · 계정</th>
                <th className="px-3 py-2.5 font-medium">분야 · 지역</th>
                <th className="px-3 py-2.5 font-medium">팔로워</th>
                <th className="px-3 py-2.5 font-medium">희망 조건</th>
                <th className="px-3 py-2.5 font-medium">동의</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.created_at?.slice(0, 10)}</td>
                  <td className="px-3 py-2.5"><span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">{r.campaign_code}</span></td>
                  <td className="px-3 py-2.5 text-gray-900">{r.name || '-'}<div className="text-xs text-gray-400">#{r.user_id}</div></td>
                  <td className="px-3 py-2.5 text-gray-600">{r.phone || r.contact || r.email || '-'}{r.phone && r.contact ? <div className="text-xs text-gray-400">{r.contact}</div> : null}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-gray-600">{PLATFORM_LABELS[r.platform || ''] || r.platform || '-'}</div>
                    <a href={r.account_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 break-all">{r.account_url}</a>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{r.category || '-'}{r.region ? <div className="text-xs text-gray-400">{r.region}</div> : null}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.follower_size ? Number(r.follower_size).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[220px]"><div className="line-clamp-3">{r.collab_terms || '-'}</div></td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {r.privacy_agreed_at ? '개인정보 ✓' : '개인정보 ✗'}<br />{r.marketing_agreed_at ? '마케팅 ✓' : '마케팅 ✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 disabled:opacity-40">이전</button>
          <span className="text-sm text-gray-500">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 disabled:opacity-40">다음</button>
        </div>
      )}
    </div>
  )
}
