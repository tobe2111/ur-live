/**
 * 📊 개업 컨설팅 브리핑 모달 — 매장 1곳의 상권 수치(경쟁 밀도·90일 개폐업·인근 동종) + 전화 멘트 초안.
 *   수치는 전부 자체 수집분 집계(허위 0) — 없으면 표시/문장 생략. z-index 표준(모달 10500).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

interface Briefing {
  store: { id: number; biz_name: string; category: string | null; region: string | null; addr_road: string | null; phone: string | null; email: string | null; apv_perm_ymd: string | null }
  competitors_active: number
  opened_90d: number
  closed_90d: number
  recent_openings: Array<{ biz_name: string; apv_perm_ymd: string | null }>
  script: string
  email_subject: string
  email_body: string
}

const fmtYmd = (y: string | null) => y && y.length === 8 ? `${y.slice(0, 4)}.${y.slice(4, 6)}.${y.slice(6, 8)}` : '—'

export default function OpeningBriefingModal({ prospectId, onClose }: { prospectId: number; onClose: () => void }) {
  const [b, setB] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.get(`/api/admin/store-prospects/${prospectId}/briefing`)
      .then(r => { if (alive && r.data?.success) setB(r.data) })
      .catch(() => { if (alive) toast.error('브리핑을 불러오지 못했습니다') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [prospectId])

  const copyScript = async () => {
    if (!b?.script) return
    try { await navigator.clipboard.writeText(b.script); toast.success('멘트가 복사되었습니다') }
    catch { toast.error('복사 실패 — 텍스트를 직접 선택해 주세요') }
  }

  const stat = (label: string, val: number, hint?: string) => (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
      <div className="text-lg font-bold text-gray-900">{formatNumber(val)}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
      {hint && <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="py-10 text-center text-gray-400">브리핑 생성 중…</div>
        ) : !b ? (
          <div className="py-10 text-center text-gray-400">브리핑을 만들 수 없습니다.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-gray-900">📊 {b.store.biz_name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[b.store.region, b.store.category].filter(Boolean).join(' · ')}
                  {b.store.apv_perm_ymd && <> · 인허가 {fmtYmd(b.store.apv_perm_ymd)}</>}
                  {b.store.phone && <> · 📞 {b.store.phone}</>}
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
            </div>

            {(b.store.region && b.store.category) ? (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {stat('동네 동종 영업 중', b.competitors_active, `${b.store.region} · ${b.store.category}`)}
                {stat('90일 개업', b.opened_90d)}
                {stat('90일 폐업', b.closed_90d, '인허가 변동 감지 기준')}
              </div>
            ) : (
              <p className="mt-4 text-xs text-amber-600">지역·업종 정보가 없어 상권 비교 수치를 만들 수 없습니다(멘트 기본형만 제공).</p>
            )}

            {b.recent_openings.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700 mb-1">인근 동종 최근 개업</div>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {b.recent_openings.map((r, i) => <li key={i}>· {r.biz_name} <span className="text-gray-400">({fmtYmd(r.apv_perm_ymd)})</span></li>)}
                </ul>
              </div>
            )}

            {/* ✉ 이메일 우선(대표 지시) — mailto 수동 발송(수집 ≠ 발송). 리포트 링크 포함. */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold text-gray-700">✉ 이메일 초안 <span className="font-normal text-gray-400">(상권 리포트 링크 포함)</span></div>
                <div className="flex gap-1.5">
                  <button onClick={async () => { try { await navigator.clipboard.writeText(`${b.email_subject}\n\n${b.email_body}`); toast.success('이메일 초안 복사됨') } catch { toast.error('복사 실패') } }}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-600 text-xs">복사</button>
                  {b.store.email && (
                    <a href={`mailto:${b.store.email}?subject=${encodeURIComponent(b.email_subject)}&body=${encodeURIComponent(b.email_body)}`}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs">✉ 메일 열기</a>
                  )}
                </div>
              </div>
              <textarea readOnly value={b.email_body} rows={8} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-xs leading-relaxed" />
              {!b.store.email && <p className="mt-1 text-[10px] text-amber-600">이 매장은 이메일 미확보 — 초안 복사 후 다른 채널로, 또는 전화 멘트 사용.</p>}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold text-gray-700">📞 전화 멘트 초안 <span className="font-normal text-gray-400">(실측 수치만 삽입 — 다듬어 쓰세요)</span></div>
                <button onClick={copyScript} className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs">복사</button>
              </div>
              <textarea readOnly value={b.script} rows={6} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-xs leading-relaxed" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
