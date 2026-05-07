/**
 * SellerLiveBroadcastPage 의 모달 4종 (자체 추출).
 *
 *   - EndBroadcastModal: 방송 종료 확인
 *   - ConfirmModal:      범용 확인 (다양한 confirm 대체)
 *   - PromptModal:       텍스트 입력 (prompt 대체)
 *   - RecapModal:        방송 종료 후 통계 요약
 *
 * 🛡️ 2026-04-28: TD-006 / audit #10 부분 — SellerLiveBroadcastPage.tsx (2516줄)
 *   에서 자체 모달 ~160줄 분리. 모달은 self-contained 라 회귀 위험 적음.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, MessageSquare, ShoppingBag, DollarSign } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface LiveStreamLite {
  id: number
  title: string
}

// ── 방송 종료 확인 모달 ──────────────────────────────────────────
export function EndBroadcastModal({ stream, onConfirm, onCancel }: {
  stream: LiveStreamLite; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-gray-900">{t('seller.liveBroadcast.endConfirmTitle')}</h3>
          <p className="text-sm text-gray-600 truncate">{stream.title}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex items-start gap-2 text-gray-700">
            <span className="text-amber-500 shrink-0">●</span>
            <span>{t('seller.liveBroadcast.endWarn1')}</span>
          </div>
          <div className="flex items-start gap-2 text-gray-700">
            <span className="text-amber-500 shrink-0">●</span>
            <span>{t('seller.liveBroadcast.endWarn2')}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold">
            {t('seller.liveBroadcast.endBroadcast')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 범용 확인 모달 (다양한 confirm 대체) ─────────────────────────
export function ConfirmModal({ title, description, confirmLabel, confirmStyle = 'bg-red-600 hover:bg-red-700', onConfirm, onCancel }: {
  title: string; description: string; confirmLabel: string
  confirmStyle?: string; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 ${confirmStyle} text-white rounded-xl text-sm font-semibold`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 텍스트 입력 모달 (prompt 대체) ──────────────────────────────
export function PromptModal({ title, placeholder, confirmLabel, onConfirm, onCancel }: {
  title: string; placeholder: string; confirmLabel: string
  onConfirm: (value: string) => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <input autoFocus value={value} onChange={e => setValue(e.target.value.slice(0, 200))} placeholder={placeholder}
          maxLength={200}
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()) }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            {t('common.cancel')}
          </button>
          <button onClick={() => value.trim() && onConfirm(value.trim())} disabled={!value.trim()}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 방송 종료 후 리캡 모달 (P1-7) ────────────────────────────────
export function RecapModal({ stream, stats, onClose }: {
  stream: LiveStreamLite
  stats: { duration: string; viewers: number; chat: number; orders: number; revenue: number }
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t('seller.liveBroadcast.recapTitle')}</p>
          <h3 className="text-lg font-bold text-gray-900 truncate">{stream.title}</h3>
          <p className="text-xs text-gray-500">{stats.duration}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <Eye className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-blue-700">{formatNumber(stats.viewers)}</p>
            <p className="text-[10px] text-blue-600">{t('seller.liveBroadcast.statsViewers')}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <MessageSquare className="w-4 h-4 text-purple-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-purple-700">{formatNumber(stats.chat)}</p>
            <p className="text-[10px] text-purple-600">{t('seller.liveBroadcast.statsChat')}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <ShoppingBag className="w-4 h-4 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-amber-700">{stats.orders}</p>
            <p className="text-[10px] text-amber-600">{t('seller.liveBroadcast.statsOrders')}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-700">₩{formatNumber(stats.revenue)}</p>
            <p className="text-[10px] text-green-600">{t('seller.liveBroadcast.statsRevenue')}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            {t('common.close')}
          </button>
          <button onClick={() => { onClose(); navigate(`/seller/live-analytics/${stream.id}`) }}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">
            {t('seller.liveBroadcast.viewAnalytics')}
          </button>
        </div>
      </div>
    </div>
  )
}
