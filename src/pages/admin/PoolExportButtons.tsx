import { useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import PoolExportBatches from './PoolExportBatches'

/**
 * 📥 **풀 CSV 내보내기 버튼群** — 업체·매장 공용(2026-10-25).
 *
 * `[다음 500건] [전부 다시] [내보낸 묶음]` 셋은 두 화면이 똑같이 필요하고, 두 벌로 두면
 * 필터 조립·문구·`newOnly` 기본값이 반드시 갈라진다(이 레포가 반복해 당한 클래스).
 *
 * - **다음 500건**: 아직 안 받은 것만 + 받은 만큼 도장 → 다음엔 그 다음 묶음
 * - **전부 다시**: 도장 무시하고 전부. **도장도 안 찍는다** — 사본 한 번이 전 리드를 소진시키면 안 된다
 * - **내보낸 묶음**: 되돌리기(다운로드가 끊겼거나 파일을 잃었을 때의 유일한 복구 경로)
 *
 * 설계·실측 근거: `src/features/marketing/api/pool-export-batch.ts` 머리말.
 */
export default function PoolExportButtons({ pool, path, basename, query, batchHint }: {
  pool: 'company' | 'store'
  /** 내보내기 엔드포인트(쿼리 없이). */
  path: string
  /** 파일명 접두 — 날짜는 여기서 붙인다. */
  basename: string
  /** 지금 화면 필터 — **목록과 같은 조립**을 넘겨야 파일이 화면과 같아진다. */
  query: () => URLSearchParams
  /** '다음 500건' 버튼 툴팁에 덧붙일 풀별 안내(예: 매장 풀은 도달 채널이 전화다). */
  batchHint?: string
}) {
  // ⬇ `<a href>` 직링크는 관리자 토큰이 안 실려 FORBIDDEN 이다(2026-07-27 대표 신고) → 인증 axios blob 다운로드.
  const dl = useCallback(async (newOnly: boolean) => {
    try {
      const p = query()
      if (!newOnly) p.set('newOnly', '0')
      const r = await api.get(`${path}?${p.toString()}`, { responseType: 'blob' })
      const u = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' }))
      const el = document.createElement('a')
      el.href = u
      el.download = `${basename}${newOnly ? '' : '-all'}-${new Date().toISOString().slice(0, 10)}.csv`
      el.click(); URL.revokeObjectURL(u)
    } catch { toast.error('내보내기 실패 — 재로그인 후 시도') }
  }, [path, basename, query])

  return (
    <>
      <button onClick={() => dl(true)} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium"
        title={`⬇ 아직 받지 않은 500건만 — 받은 만큼 '내보냄' 표시가 찍혀 다음엔 그 다음 500건이 나옵니다. 화면 필터를 그대로 따릅니다(엑셀 호환 BOM).${batchHint ? ` ${batchHint}` : ''}`}>
        ⬇ 다음 500건
      </button>
      <button onClick={() => dl(false)} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-500 text-sm"
        title="이미 받은 것까지 포함해 전부(상한 2,000 — 넘으면 파일 마지막 줄에 적힙니다). 이 다운로드는 '내보냄' 표시를 찍지 않습니다">
        전부 다시
      </button>
      <PoolExportBatches pool={pool} />
    </>
  )
}
