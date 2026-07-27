/**
 * 📊 수요 인텔리전스 패널 — "어느 나라가 무엇을 사는가".
 *   바이어 *연락처*는 플랫폼이 원천 마스킹하지만 **국가·품목·수량은 항상 보인다** → 그 신호를 읽는 화면.
 *   ① 관세청 무역통계(국가별 한국산 수출액=그 나라의 한국산 수요) ② 수집 인콰이어리(지금 찾는 품목).
 *   ⚠️ 어드민 라이트 테마 고정(dark: 금지). AdminBuyerPoolPage god 파일 방지를 위해 분리(CLAUDE.md 크기 룰).
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

type Row = Record<string, unknown>

/** 숫자 → USD 표기. null/NaN 안전(대시보드 ₩NaN 룰). */
const usd = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? '$' + Math.round(n).toLocaleString() : '$0' }

export default function DemandPanel({ onClose, onRaw }: { onClose: () => void; onRaw?: (json: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [inq, setInq] = useState<{ byCountry: Row[]; byCategory: Row[]; recent: Row[] }>({ byCountry: [], byCategory: [], recent: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  const load = useCallback(async () => {
    setBusy(true); setErr(false)
    try {
      const [d, q] = await Promise.all([
        api.get('/api/admin/buyer-pool/demand?limit=30'),
        api.get('/api/admin/buyer-pool/demand/inquiries?limit=30'),
      ])
      setRows(d.data?.rows || [])
      setInq({ byCountry: q.data?.byCountry || [], byCategory: q.data?.byCategory || [], recent: q.data?.recent || [] })
    } catch { setErr(true) } finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const collect = async () => {
    setBusy(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/demand/collect', {})
      const res = r.data?.result
      if (res?.ran) toast.success(`무역통계 ${res.fetched}건 조회 · ${res.saved}건 저장${res.fetched > 0 && res.mapped === 0 ? ' (⚠️ 필드 매핑 0 — 진단 확인)' : ''}`)
      else toast.error(res?.reason || '수집 실패')
      onRaw?.(JSON.stringify(res?.perUrl ?? res, null, 2)) // 매핑 실패 시 원본 키가 여기 보임
      await load()
    } catch { toast.error('수요 통계 수집 실패') } finally { setBusy(false) }
  }

  const diag = async () => {
    setBusy(true)
    try {
      const r = await api.get('/api/admin/buyer-pool/demand/diag')
      onRaw?.(JSON.stringify(r.data?.diag ?? r.data, null, 2))
    } catch (e) { onRaw?.('진단 호출 실패: ' + String(e)) } finally { setBusy(false) }
  }

  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold text-gray-900">📊 수요 인텔리전스 — 어느 나라가 무엇을 사는가</div>
        <div className="flex items-center gap-2">
          <button onClick={collect} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50">{busy ? '처리 중…' : '관세청 통계 수집'}</button>
          <button onClick={diag} disabled={busy} className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs disabled:opacity-50">🔍 필드 진단</button>
          <button onClick={onClose} className="text-xs text-gray-500 underline">닫기</button>
        </div>
      </div>

      {err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-center justify-between gap-2">
          <span>⚠️ 수요 데이터를 불러오지 못했습니다(조회 실패 — 0건과 다릅니다).</span>
          <button onClick={load} className="px-2 py-1 rounded bg-red-600 text-white text-xs shrink-0">다시 시도</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ① 관세청 무역통계 */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1">① 관세청 무역통계 — 국가별 한국산 수요</div>
          {rows.length === 0 ? (
            <div className="text-xs text-gray-500 bg-white rounded-lg border border-emerald-100 p-3 leading-relaxed">
              아직 데이터가 없습니다. Cloudflare 환경변수 <code className="bg-gray-100 px-1 rounded">TRADE_STATS_URLS</code> 에
              관세청 오픈API URL(serviceKey 포함)을 넣고 「관세청 통계 수집」을 누르세요.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-emerald-100 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600"><tr><th className="text-left px-2 py-1.5">국가</th><th className="text-right px-2 py-1.5">한국→수출(USD)</th><th className="text-right px-2 py-1.5">기간</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 text-gray-900">{String(r.country ?? '?')}{r.item_name ? <span className="text-gray-500"> · {String(r.item_name)}</span> : null}</td>
                      <td className="px-2 py-1.5 text-right text-gray-900 font-medium">{usd(r.export_usd)}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{String(r.latest_period ?? r.period ?? '-')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ② 수집 인콰이어리 — 연락처 없어도 유효한 실시간 수요 */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1">② 수집 인콰이어리 — 지금 찾는 품목</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {inq.byCategory.map((c, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-xs text-gray-700">{String(c.category ?? '?')} <b className="text-emerald-700">{String(c.n ?? 0)}</b></span>
            ))}
            {inq.byCategory.length === 0 && <span className="text-xs text-gray-500">수집된 인콰이어리가 없습니다.</span>}
          </div>
          <div className="bg-white rounded-lg border border-emerald-100 max-h-56 overflow-auto">
            {inq.recent.map((r, i) => (
              <div key={i} className="px-2 py-1.5 border-b border-gray-100 last:border-0 text-xs">
                <div className="text-gray-900">{String(r.inquiry_title ?? '')}</div>
                <div className="text-gray-500">{String(r.country ?? '?')}{r.est_volume ? ` · ${String(r.est_volume)}` : ''}{r.company ? ` · ${String(r.company)}` : ''}</div>
              </div>
            ))}
            {inq.recent.length === 0 && <div className="px-2 py-3 text-xs text-gray-500">인콰이어리 제목이 있는 리드가 없습니다.</div>}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-white border border-emerald-100 p-3 text-xs text-gray-700 leading-relaxed">
        <b>💡 이 데이터를 쓰는 법</b> — 바이어 <b>연락처는 플랫폼이 원천 마스킹</b>하지만 <b>국가·품목·수량은 항상 보입니다</b>.
        수요가 확인된 품목을 <b>buyKorea 판매자센터에 상품 등록</b>하면 KOTRA 해외무역관을 통해 바이어 문의가 들어옵니다(무료).
        또 <b>tradeKorea 바이어DB</b>에서는 이메일 없이 <b>거래제안서를 바로 발송</b>할 수 있습니다 — 합법적이고 지속 가능한 경로입니다.
      </div>
    </div>
  )
}
