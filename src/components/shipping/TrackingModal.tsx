/**
 * 🛡️ 2026-05-25 (migration 0279): 인앱 배송 추적 모달.
 *
 * tracker.delivery API 결과를 timeline 으로 표시.
 * 실패 시 외부 페이지 링크 fallback (모달 내부에서 새 탭 이동 버튼).
 *
 * 사용:
 *   <TrackingModal orderId={order.id} onClose={() => setOpen(false)} />
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'

interface TrackingEvent {
  time?: string
  occurred_at?: string
  status?: { id: string; text: string } | string
  status_text?: string
  location?: { name: string | null } | string | null
  description?: string | null
}

interface TrackingData {
  has_tracking: boolean
  cached?: boolean
  courier?: { key: string; name: string }
  tracking_number?: string
  status?: string
  events?: TrackingEvent[]
  external_url?: string | null
  error?: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '준비 중', color: 'text-gray-500' },
  in_transit: { label: '배송 중', color: 'text-blue-500' },
  out_for_delivery: { label: '배송 출발', color: 'text-orange-500' },
  delivered: { label: '배송 완료', color: 'text-emerald-500' },
  returned: { label: '반송', color: 'text-red-500' },
  error: { label: '조회 실패', color: 'text-red-500' },
  unknown: { label: '확인 중', color: 'text-gray-400' },
}

interface TrackingModalProps {
  /** 본인 주문 ID — orderId 또는 (carrier+trackingNumber) 둘 중 하나 필수 */
  orderId?: string | number
  /** 반품 회수 송장 / 호스트 추적 등 임의 송장 — 인증 불필요 (public endpoint) */
  carrier?: string
  trackingNumber?: string
  /** 모달 제목 커스터마이즈 (예: 반품 추적) */
  title?: string
  onClose: () => void
}

export default function TrackingModal({ orderId, carrier, trackingNumber, title, onClose }: TrackingModalProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    // 🛡️ 2026-05-25: orderId 우선 — 본인 주문 인증된 추적. 없으면 carrier+number public 추적.
    const url = orderId
      ? `/api/shipping/order/${encodeURIComponent(String(orderId))}/track`
      : (carrier && trackingNumber)
        ? `/api/shipping/track/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`
        : null

    if (!url) {
      setError(t('shipping.fetchError', { defaultValue: '추적 정보를 불러올 수 없습니다' }))
      setLoading(false)
      return
    }

    api
      .get(url)
      .then((res) => {
        if (!alive) return
        if (res.data?.success) {
          // /track/:carrier/:number 응답은 { tracker: {...}, external_url, courier } 형식 — 통일
          if (!orderId && res.data.tracker) {
            setData({
              has_tracking: true,
              courier: res.data.courier,
              tracking_number: res.data.tracking_number,
              status: res.data.tracker.status,
              events: res.data.tracker.progresses ?? [],
              external_url: res.data.external_url,
              error: res.data.tracker.error,
            })
          } else {
            setData(res.data)
          }
        }
        else setError(res.data?.error || t('shipping.fetchError', { defaultValue: '추적 정보를 불러올 수 없습니다' }))
      })
      .catch((err) => {
        if (!alive) return
        setError(err?.response?.data?.error || t('shipping.fetchError', { defaultValue: '추적 정보를 불러올 수 없습니다' }))
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [orderId, carrier, trackingNumber, t])

  function getEventTime(ev: TrackingEvent): string {
    return ev.time || ev.occurred_at || ''
  }

  function getEventStatus(ev: TrackingEvent): string {
    if (typeof ev.status === 'string') return ev.status
    return ev.status?.text || ev.status_text || ''
  }

  function getEventLocation(ev: TrackingEvent): string {
    if (typeof ev.location === 'string') return ev.location
    return ev.location?.name || ''
  }

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] bg-white dark:bg-[#121212] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            📦 {t('shipping.trackingTitle', { defaultValue: '배송 추적' })}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A] flex items-center justify-center text-gray-500" aria-label="close">
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('common.loading')}</p>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-3">{error}</p>
            </div>
          ) : !data?.has_tracking ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 dark:text-gray-400">{t('shipping.notShipped', { defaultValue: '아직 발송되지 않았습니다' })}</p>
            </div>
          ) : (
            <>
              <section className="mb-5 p-3 bg-gray-50 dark:bg-[#0A0A0A] rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {data.courier?.name || '택배사'} · {data.tracking_number}
                </p>
                <p className={`text-lg font-bold ${STATUS_LABELS[data.status || 'unknown']?.color || 'text-gray-500'}`}>
                  {STATUS_LABELS[data.status || 'unknown']?.label || data.status}
                </p>
                {data.cached && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">캐시 데이터 · 60초 후 갱신</p>
                )}
              </section>

              {/* Timeline */}
              {data.events && data.events.length > 0 ? (
                <ol className="relative border-l-2 border-gray-200 dark:border-[#2A2A2A] ml-2 space-y-4">
                  {[...data.events].reverse().map((ev, i) => {
                    const isLatest = i === 0
                    return (
                      <li key={i} className="ml-4">
                        <div className={`absolute -left-[7px] w-3 h-3 rounded-full ${isLatest ? 'bg-pink-500 ring-2 ring-pink-500/30' : 'bg-gray-300 dark:bg-[#2A2A2A]'}`} />
                        <p className={`text-sm ${isLatest ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {getEventStatus(ev)}
                        </p>
                        {getEventLocation(ev) && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📍 {getEventLocation(ev)}</p>
                        )}
                        {getEventTime(ev) && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {new Date(getEventTime(ev)).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                  {t('shipping.noEvents', { defaultValue: '추적 정보가 아직 없습니다' })}
                </p>
              )}

              {/* 외부 페이지 fallback */}
              {data.external_url && (
                <a
                  href={data.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 block w-full text-center py-3 bg-gray-100 dark:bg-[#1A1A1A] hover:bg-gray-200 dark:hover:bg-[#2A2A2A] text-gray-700 dark:text-gray-200 text-sm font-bold rounded-xl transition-colors"
                >
                  🔗 {t('shipping.externalSite', { defaultValue: '택배사 페이지에서 보기' })}
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
