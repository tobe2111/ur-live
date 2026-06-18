import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { MapPin, RefreshCw } from 'lucide-react'

interface DongRow { region_si: string; region_gu: string; region_dong: string; region_dong_code: string; product_count: number }
interface GuRow { region_si: string; region_gu: string; gu_code: string; product_count: number }

/**
 * 🗺️ 동네별 딜 밀도 — 매장 행정동 태깅(product_regions) 기반.
 * "어느 동네에 딜이 깔렸나 / 어디가 비었나"를 보고 영입 타겟(콜드스타트 밀도전략)을 결정.
 */
export default function AdminRegionDensityPage() {
  const [byGu, setByGu] = useState<GuRow[]>([])
  const [byDong, setByDong] = useState<DongRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/api/admin/region/density')
      if (res.data?.success) {
        setByGu(res.data.data?.by_gu || [])
        setByDong(res.data.data?.by_dong || [])
      } else {
        setError(res.data?.error || '불러오기에 실패했습니다')
      }
    } catch {
      setError('불러오기에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const totalDeals = byGu.reduce((s, g) => s + Number(g.product_count || 0), 0)

  return (
    <AdminLayout title="동네별 딜 밀도">
      <div className="p-4 lg:p-6 ur-content-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" /> 동네별 딜 밀도
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              매장 행정동 태깅 기반 — 어느 동네에 딜이 깔렸나 / 어디가 비었나 (영입 타겟 결정용)
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> 새로고침
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatCard label="활성 딜 (태깅됨)" value={totalDeals} />
          <StatCard label="딜 있는 구(區)" value={byGu.length} />
          <StatCard label="딜 있는 동(洞)" value={byDong.length} />
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">불러오는 중…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RegionTable title="구(區)별" rows={byGu.map((g) => ({ label: `${g.region_si} ${g.region_gu}`.trim(), count: g.product_count }))} />
            <RegionTable title="동(洞)별" rows={byDong.map((d) => ({ label: `${d.region_gu} ${d.region_dong}`.trim(), count: d.product_count }))} />
          </div>
        )}

        <p className="mt-5 text-xs text-gray-400">
          ※ 매장이 등록되면 매일 새벽 카카오 좌표→행정동 변환으로 자동 태깅됩니다. 빈 동네 = 영입 기회.
        </p>
      </div>
    </AdminLayout>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{Number(value || 0).toLocaleString('ko-KR')}</div>
    </div>
  )
}

function RegionTable({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900 text-sm">{title} 딜 밀도</div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">아직 태깅된 딜이 없어요. 매장이 등록되면 자동 집계됩니다.</div>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
          {rows.map((r, i) => (
            <li key={i} className="px-4 py-2.5 flex items-center gap-3">
              <span className="text-sm text-gray-700 flex-1 truncate">{r.label || '(미상)'}</span>
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
              </div>
              <span className="text-sm font-semibold text-gray-900 w-8 text-right">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
