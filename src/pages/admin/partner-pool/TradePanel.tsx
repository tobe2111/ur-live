import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber, kstShort } from '@/utils/format'

/**
 * 🎛️ **수집 업종 제어** — 배포 없이 "이 업종 더 캐라 / 저건 멈춰라".
 *
 *   서버는 원래부터 `WHERE active = 1` 로 돌고 있었다 — 끄는 기능이 없었던 게 아니라 **누를 데가**
 *   없었다. 이 패널은 그 스위치를 노출할 뿐, 새 메커니즘을 만들지 않는다.
 *
 *   단위가 업종인 이유: 키워드는 (지역 235 × 업종)의 곱이라 실측 4,546개다. 개별 토글이면
 *   "카페 그만" 이 235번의 클릭이 된다(인플루언서 화면이 같은 이유로 렉 수리를 겪었다).
 *
 *   ⚠️ 수확(저장) 순으로 정렬한다 — **어느 업종이 값을 만드는지 보여야 끌 결정을 할 수 있다.**
 *     0건인데 키워드만 많은 업종이 바로 후보다(예: 창고형 공동구매 705kw / 저장 0).
 */
export interface TradeRow {
  trade: string; category: string | null; tier?: number | null
  kw: number; active_kw: number; found: number; saved: number; last_run_at: string | null
}

/**
 * 두 풀(파트너·매장)이 **같은 컴포넌트**를 쓴다. 화면이 두 벌이면 한쪽만 고쳐져 갈라진다 —
 * 이 레포가 키워드 목록·우선 카테고리에서 이미 겪은 클래스.
 * 응답 모양이 다른 만큼만 `adapt` 로 흡수한다(매장은 업태 1행 = 지역 전체라 kw/active_kw 가 1/0).
 */
export interface TradePanelProps {
  endpoint: string
  title?: string
  unit?: string        // 'kw' 열 라벨 — 파트너는 '지역', 매장은 업태당 전 지역이라 '블록'
  adapt?: (raw: unknown[]) => TradeRow[]
}

const ERR_LABEL: Record<string, string> = {
  LAST_ACTIVE_TRADE: '마지막 켜진 업종은 끌 수 없습니다 — 전부 끄면 수집이 조용히 멈춥니다(화면은 정상으로 보입니다)',
  TRADE_NOT_FOUND: '해당 업종의 키워드를 찾지 못했습니다',
  INVALID_TRADE: '업종 이름이 올바르지 않습니다',
}

export default function TradePanel({ endpoint, title = '🎛️ 수집 업종 설정', unit = '지역', adapt }: TradePanelProps) {
  const [rows, setRows] = useState<TradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(endpoint)
      if (r.data?.success) setRows(adapt ? adapt(r.data.trades || []) : (r.data.trades || []))
    } catch { /* 상태줄이 이미 수집 상태를 보여준다 — 여기서 토스트까지 띄우면 소음 */ } finally { setLoading(false) }
  }, [endpoint, adapt])
  useEffect(() => { if (open) load() }, [open, load])

  async function toggle(t: TradeRow) {
    const next = t.active_kw === 0
    setBusy(t.trade)
    try {
      const r = await api.patch(endpoint, { trade: t.trade, active: next })
      if (r.data?.success) {
        toast.success(next ? `▶️ '${t.trade}' 수집 재개` : `⏸ '${t.trade}' 수집 중지`)
        await load()
      } else toast.error(ERR_LABEL[r.data?.error] || r.data?.error || '변경 실패')
    } catch (e) {
      const code = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(ERR_LABEL[code || ''] || '변경 실패')
    } finally { setBusy('') }
  }

  const activeTrades = rows.filter(t => t.active_kw > 0).length
  const totalKw = rows.reduce((a, t) => a + t.kw, 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-4">
      <details onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-gray-800">
          {title}
          <span className="ml-2 font-normal text-xs text-gray-500">
            {rows.length ? `${activeTrades}/${rows.length} 업종 켜짐 · 키워드 ${formatNumber(totalKw)}` : '배포 없이 업종을 켜고 끕니다'}
          </span>
        </summary>
        <div className="px-4 pb-4">
          {loading && <div className="py-6 text-center text-xs text-gray-400">불러오는 중…</div>}
          {!loading && !rows.length && <div className="py-6 text-center text-xs text-gray-400">키워드가 아직 시드되지 않았습니다</div>}
          {!loading && rows.length > 0 && (
            <>
              <p className="mb-2 text-[11px] leading-relaxed text-gray-500">
                업종을 끄면 그 업종의 <b>전 지역 키워드</b>가 한 번에 멈춥니다. 수확(저장) 순으로 정렬돼 있으니
                <b> 키워드는 많은데 저장이 0인 업종</b>이 끌 후보입니다. 변경은 다음 회차부터 적용됩니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-500">
                    <tr className="border-b border-gray-100">
                      <th className="px-2 py-2 text-left font-medium">업종</th>
                      <th className="px-2 py-2 text-right font-medium">{unit}</th>
                      <th className="px-2 py-2 text-right font-medium">발굴</th>
                      <th className="px-2 py-2 text-right font-medium">저장</th>
                      <th className="px-2 py-2 text-left font-medium">최근</th>
                      <th className="px-2 py-2 text-right font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(t => {
                      const on = t.active_kw > 0
                      const partial = on && t.active_kw < t.kw
                      return (
                        <tr key={t.trade} className={`border-b border-gray-50 ${on ? '' : 'opacity-50'}`}>
                          <td className="px-2 py-2 text-gray-800">
                            {t.trade}
                            {t.category && t.category !== t.trade && <span className="ml-1 text-gray-400">· {t.category}</span>}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-600">
                            {formatNumber(t.kw)}
                            {partial && <span className="ml-1 text-amber-600" title="일부만 켜져 있습니다">({formatNumber(t.active_kw)})</span>}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-600">{formatNumber(t.found)}</td>
                          <td className={`px-2 py-2 text-right font-semibold ${t.saved ? 'text-indigo-600' : 'text-gray-300'}`}>{formatNumber(t.saved)}</td>
                          <td className="px-2 py-2 text-gray-400">{t.last_run_at ? kstShort(t.last_run_at) : '—'}</td>
                          <td className="px-2 py-2 text-right">
                            <button
                              onClick={() => toggle(t)} disabled={busy === t.trade}
                              className={`rounded px-2 py-1 text-[11px] font-medium disabled:opacity-40 ${on ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >{busy === t.trade ? '…' : on ? 'ON' : 'OFF'}</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  )
}
