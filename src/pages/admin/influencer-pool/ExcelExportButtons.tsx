import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 📊 인플루언서 풀 엑셀 내보내기 버튼群 — AdminInfluencerPoolPage 에서 추출(2026-07-28, 600줄 캡).
 *   variant='all'         : 풀 전체 + 매체별 분리 다운로드(같은 양식·카테고리별 시트)
 *   variant='contactable' : 수기 제휴 제안용 — 이메일 보유·브랜드 제외·미접촉·반송이력 없음만(점수순)
 *   서버 export 라 화면 로드분(500)과 무관하게 풀 전체가 나간다.
 */
const EXPORT_PLATS = [
  { v: 'youtube', label: '유튜브' }, { v: 'naver_blog', label: '네이버블로그' },
  { v: 'naver_cafe', label: '네이버카페' }, { v: 'tistory', label: '티스토리' },
]

export default function ExcelExportButtons({ variant }: { variant: 'all' | 'contactable' }) {
  const [exporting, setExporting] = useState(false)

  async function exportExcel(plat?: string, contactable?: boolean) {
    setExporting(true)
    try {
      // ⚠️ 20k행이면 ~40MB 스트리밍 — 기본 15s 타임아웃이면 다운로드 완료 전 중단("실패").
      //   서버는 pull 스트리밍이라 OOM 없음, 클라 타임아웃만 넉넉히(120s).
      const r = await api.get(
        `/api/admin/ads/influencer-pool/export?format=xls${plat ? `&platform=${plat}` : ''}${contactable ? '&contactable=1' : ''}`,
        { responseType: 'blob', timeout: 120000 },
      )
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.ms-excel' }))
      const label = (plat ? (EXPORT_PLATS.find(p => p.v === plat)?.label || plat) : '전체') + (contactable ? '-연락대상' : '')
      const a = document.createElement('a')
      a.href = url; a.download = `인플루언서풀-${label}-${new Date().toISOString().slice(0, 10)}.xls`; a.click()
      URL.revokeObjectURL(url)
      const size = (r.data as Blob).size
      toast.success(`📊 ${label} 다운로드 완료 (${size > 1048576 ? `${(size / 1048576).toFixed(1)}MB` : `${Math.round(size / 1024)}KB`})`)
    } catch (e) {
      const ax = e as { code?: string; response?: { status?: number } }
      if (ax.code === 'ECONNABORTED') toast.error('엑셀 내보내기 시간 초과 — 데이터가 많습니다. 잠시 후 다시 시도하거나 CSV를 이용하세요')
      else toast.error(`엑셀 내보내기 실패${ax.response?.status ? ` (HTTP ${ax.response.status})` : ''}`)
    } finally { setExporting(false) }
  }

  if (variant === 'contactable') {
    return (
      <button onClick={() => exportExcel(undefined, true)} disabled={exporting}
        className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium disabled:opacity-40"
        title="수기 제휴 제안용 — 이메일 보유 · 브랜드 제외 · 미접촉 · 반송이력 없음. 유어딜 적합 카테고리(맛집·뷰티·여행·숙소·카페 등)가 위, 그 안에서 점수 높은 순">
        {exporting ? '내보내는 중…' : '📇 연락 대상만 받기'}
      </button>
    )
  }

  return (
    <>
      <button onClick={() => exportExcel()} disabled={exporting}
        className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium disabled:opacity-50"
        title="풀 전체를 카테고리별 시트로 — 점수순 정렬·숫자 열·메일상태 포함(29열)">
        {exporting ? '내보내는 중…' : '📊 엑셀 다운로드 (전체)'}
      </button>
      {/* 🎯 매체별 분리 다운로드 — 같은 양식(29열·카테고리별 시트), 그 매체 행만. 파일명으로 구분됨. */}
      {EXPORT_PLATS.map(p => (
        <button key={p.v} onClick={() => exportExcel(p.v)} disabled={exporting}
          className="px-3 py-2 rounded-lg border border-emerald-200 bg-white text-emerald-700 text-sm disabled:opacity-50"
          title={`${p.label} 리드만 엑셀로 — 전체와 같은 양식(카테고리별 시트)`}>
          📊 {p.label}
        </button>
      ))}
    </>
  )
}
