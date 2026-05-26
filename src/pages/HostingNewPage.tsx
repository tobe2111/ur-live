/**
 * 🛡️ 2026-05-25 (migration 0280): 호스팅 카탈로그 + 1탭 모집 시작.
 *
 * /host/new
 *
 * 어드민이 등록한 voucher 상품 그리드 → 클릭 시 카드에 inline 호스팅 폼.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { hostingApi, type HostingCatalogItem } from '@/features/hosting/api/hosting-api'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'

const CATEGORIES: Array<{ key: string; label: string; emoji: string }> = [
  { key: '', label: '전체', emoji: '🛍️' },
  { key: 'meal_voucher', label: '식사', emoji: '🍽️' },
  { key: 'beauty_voucher', label: '뷰티', emoji: '💇' },
  { key: 'stay_voucher', label: '숙박', emoji: '🏨' },
  { key: 'activity_voucher', label: '액티비티', emoji: '🎯' },
  { key: 'health_voucher', label: '헬스', emoji: '💪' },
  { key: 'pet_voucher', label: '펫', emoji: '🐶' },
  { key: 'etc_voucher', label: '기타', emoji: '🎁' },
]

export default function HostingNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<HostingCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [target, setTarget] = useState<number>(5)
  const [note, setNote] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    hostingApi.catalog(category || undefined)
      .then(res => {
        if (!alive) return
        if (res.success) setItems(res.catalog)
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [category])

  async function handleStart(productId: number) {
    setSubmitting(true)
    try {
      const res = await hostingApi.startHosting(productId, { target_quantity: target, note: note.trim() || undefined })
      if (res.success && res.host) {
        toast.success(`🎉 공구가 시작됐어요! /g/${res.host.invite_code}`)
        navigate(`/host/${res.host.id}`)
      } else if (res.code === 'ALREADY_HOSTING') {
        toast.info('이미 호스팅 중인 상품이에요')
      } else {
        toast.error(res.error || '호스팅 시작 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '호스팅 시작 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SEO title={t('hosting.newTitle', { defaultValue: '공구 열기' })} noindex />
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white pb-24">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold">+ {t('hosting.newTitle', { defaultValue: '공구 열기' })}</h1>
            <button onClick={() => navigate('/host')} className="text-sm text-gray-500 dark:text-gray-400">{t('common.back')}</button>
          </div>
          {/* 카테고리 탭 */}
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto pt-3 -mx-4 px-4">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  category === cat.key
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('common.loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              {t('hosting.emptyCatalog', { defaultValue: '아직 카탈로그가 비어있어요' })}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map(item => (
                <div key={item.id} className={`bg-gray-50 dark:bg-[#121212] rounded-xl border ${selectedId === item.id ? 'border-pink-500' : 'border-gray-100 dark:border-[#1A1A1A]'} overflow-hidden`}>
                  <button
                    onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                    className="block w-full text-left"
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A]">
                      {(item.thumbnail || item.image_url) && (
                        <img src={item.thumbnail || item.image_url || ''} alt={item.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium line-clamp-2 mb-1">{item.name}</p>
                      <p className="text-sm font-bold text-pink-500 dark:text-pink-400">{formatWon(item.price)}</p>
                      {item.restaurant_name && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">📍 {item.restaurant_name}</p>}
                      {item.my_host_id && (
                        <p className="text-[10px] text-emerald-500 mt-1">✓ 호스팅 중</p>
                      )}
                    </div>
                  </button>

                  {/* inline 시작 폼 */}
                  {selectedId === item.id && !item.my_host_id && (
                    <div className="p-3 pt-0 border-t border-gray-100 dark:border-[#1A1A1A] space-y-2">
                      <div>
                        <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">목표 인원 (2-100)</label>
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={target}
                          onChange={(e) => setTarget(Math.max(2, Math.min(100, Number(e.target.value) || 5)))}
                          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">한 줄 소개</label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value.slice(0, 200))}
                          placeholder="같이 사실 분 모집!"
                          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
                        />
                      </div>
                      <button
                        onClick={() => handleStart(item.id)}
                        disabled={submitting}
                        className="w-full py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
                      >
                        {submitting ? '시작 중...' : '🎉 공구 시작'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
