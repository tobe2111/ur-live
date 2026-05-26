/**
 * 🛡️ 2026-05-25 (migration 0280): 호스팅 페이지 (Phase 3 핵심 UX).
 *
 * /host                  - 본인 호스팅 목록 + summary
 * /host/new              - 카탈로그에서 1탭 호스팅 시작
 *
 * 라이트 테마 (마이페이지 정책 따라 라이트/다크 toggle).
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { hostingApi, type HostSession, type HostingSummary } from '@/features/hosting/api/hosting-api'
import { toast } from '@/hooks/useToast'
import { formatWon, formatNumber } from '@/utils/format'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: '모집 중', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
  achieved: { label: '🎉 달성', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
  expired: { label: '마감', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  cancelled: { label: '취소', color: 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-300' },
}

export default function HostingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [hosts, setHosts] = useState<HostSession[]>([])
  const [summary, setSummary] = useState<HostingSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    hostingApi.listMy()
      .then(res => {
        if (!alive) return
        if (res.success) {
          setHosts(res.hosts)
          setSummary(res.summary)
        }
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  async function copyInvite(host: HostSession) {
    const url = `${window.location.origin}/g/${host.invite_code}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('초대 링크가 복사되었어요')
    } catch { /* ignore */ }
  }

  async function handleCancel(id: number) {
    if (!confirm('이 호스팅을 취소할까요?')) return
    const res = await hostingApi.cancel(id)
    if (res.success) {
      toast.success('취소되었습니다')
      setHosts(hosts.map(h => h.id === id ? { ...h, status: 'cancelled' } : h))
    } else {
      toast.error(res.error || '취소 실패')
    }
  }

  return (
    <>
      <SEO title={t('hosting.title', { defaultValue: '내 공구 호스팅' })} noindex />
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white pb-24">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold">🎉 {t('hosting.title', { defaultValue: '내 공구 호스팅' })}</h1>
            <button
              onClick={() => navigate('/host/new')}
              className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold rounded-lg"
            >
              + {t('hosting.startNew', { defaultValue: '공구 열기' })}
            </button>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {summary && (
            <div className="grid grid-cols-4 gap-2 mb-6">
              {[
                { label: '전체', value: formatNumber(summary.total) },
                { label: '진행', value: formatNumber(summary.active), accent: 'text-blue-500' },
                { label: '성공', value: formatNumber(summary.achieved), accent: 'text-emerald-500' },
                { label: '적립', value: formatWon(summary.total_earnings), accent: 'text-pink-500' },
              ].map(card => (
                <div key={card.label} className="bg-gray-50 dark:bg-[#121212] rounded-xl p-3 border border-gray-100 dark:border-[#1A1A1A]">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">{card.label}</p>
                  <p className={`text-base font-bold ${card.accent || ''}`}>{card.value}</p>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('common.loading')}</p>
          ) : hosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-3">🎁</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('hosting.empty', { defaultValue: '아직 호스팅이 없어요. 친구와 함께 살 상품을 찾아보세요!' })}
              </p>
              <button
                onClick={() => navigate('/host/new')}
                className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl"
              >
                {t('hosting.startNew', { defaultValue: '공구 열기' })}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {hosts.map(host => {
                const status = STATUS_LABEL[host.status] || STATUS_LABEL.active
                return (
                  <div key={host.id} className="bg-gray-50 dark:bg-[#121212] rounded-xl p-4 border border-gray-100 dark:border-[#1A1A1A]">
                    <div className="flex gap-3 mb-3">
                      {(host.thumbnail || host.image_url) && (
                        <img src={host.thumbnail || host.image_url || ''} alt={host.product_name} className="w-16 h-16 rounded-lg object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.color}`}>{status.label}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatNumber(host.current_quantity)}/{formatNumber(host.target_quantity)}명
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">{host.product_name}</p>
                        {host.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">💬 {host.note}</p>}
                        <p className="text-xs text-pink-500 dark:text-pink-400 mt-1 font-bold">+{formatWon(host.total_earnings)} 적립</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyInvite(host)}
                        className="flex-1 py-2 bg-white dark:bg-[#1A1A1A] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg border border-gray-200 dark:border-[#2A2A2A]"
                      >
                        🔗 초대 링크
                      </button>
                      <Link
                        to={`/host/${host.id}`}
                        className="flex-1 py-2 bg-white dark:bg-[#1A1A1A] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg text-center border border-gray-200 dark:border-[#2A2A2A]"
                      >
                        👥 참여자
                      </Link>
                      {host.status === 'active' && (
                        <button
                          onClick={() => handleCancel(host.id)}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-bold rounded-lg"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
