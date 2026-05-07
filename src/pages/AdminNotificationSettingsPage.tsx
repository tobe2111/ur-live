import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Bell, Mail, MessageSquare, Smartphone, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

/**
 * 🛡️ 2026-04-28: 알림 채널 설정 페이지.
 * 알림 종류별로 dashboard / email / alimtalk / push 채널 ON/OFF.
 */
interface Setting {
  notification_type: string
  dashboard_enabled: number
  email_enabled: number
  alimtalk_enabled: number
  push_enabled: number
  description: string | null
  updated_at: string
}

const CHANNEL_INFO: Record<string, { label: string; icon: typeof Bell; cost: string; color: string }> = {
  dashboard: { label: '대시보드', icon: Bell, cost: '무료', color: 'text-blue-600' },
  email: { label: '이메일', icon: Mail, cost: '무료 3000건/월', color: 'text-purple-600' },
  alimtalk: { label: '카카오 알림톡', icon: MessageSquare, cost: '8원/건', color: 'text-yellow-600' },
  push: { label: 'Web Push', icon: Smartphone, cost: '무료', color: 'text-green-600' },
}

// 🛡️ 2026-04-28: 38종 type 카테고리 grouping (UX). 코드 시드 순서와 일치.
const CATEGORY_LABELS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'signup', label: '가입·승인', types: ['seller_registered', 'seller_approved', 'seller_rejected', 'agency_registered', 'agency_approved'] },
  { key: 'order', label: '주문·배송', types: ['new_order', 'order_delivered', 'purchase_confirmed', 'return_request', 'order_cancelled', 'deal_payment'] },
  { key: 'settlement', label: '정산', types: ['settlement_completed', 'settlement_request', 'agency_settlement'] },
  { key: 'donation_review', label: '후원·리뷰', types: ['donation_received', 'new_review'] },
  { key: 'auction', label: '경매', types: ['auction_won', 'auction_outbid', 'auction_promoted'] },
  { key: 'inventory_deal', label: '재고·딜', types: ['low_stock', 'deal_charged'] },
  { key: 'gift', label: '선물', types: ['gift_received', 'gift_refunded'] },
  { key: 'seller_addon', label: '셀러 부가 서비스', types: ['supply_registered', 'sample_request', 'youtube_growth_request', 'youtube_growth_update'] },
  { key: 'user', label: '사용자 지향', types: ['order_paid', 'order_shipped', 'live_starting', 'wishlist_price_drop', 'coupon_expiring', 'password_reset', 'welcome'] },
  { key: 'ops', label: '운영', types: ['system_alert', 'payment_failed', 'inactive_seller', 'inactive_agency'] },
]

export default function AdminNotificationSettingsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/notification-settings')
      setSettings(res.data?.data || [])
    } catch {
      toast.error(t('admin.notificationSettings.loadFailed', { defaultValue: '설정 로드 실패' }))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const toggle = async (type: string, channel: keyof Setting, value: boolean) => {
    setSaving(`${type}:${channel}`)
    try {
      await api.put(`/api/admin/notification-settings/${type}`, { [channel]: value })
      setSettings(prev => prev.map(s =>
        s.notification_type === type ? { ...s, [channel]: value ? 1 : 0 } : s
      ))
      toast.success(t('admin.notificationSettings.changeSuccess', { defaultValue: '변경 완료' }))
    } catch {
      toast.error(t('admin.notificationSettings.changeFailed', { defaultValue: '변경 실패' }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <AdminLayout title={t('admin.notificationSettings.title', { defaultValue: '알림 채널 설정' })}>
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.notificationSettings.title', { defaultValue: '알림 채널 설정' })}
          subtitle={t('admin.notificationSettings.subtitle', { defaultValue: '알림 종류별로 어떤 채널 (대시보드/이메일/알림톡/푸시) 를 사용할지 설정합니다' })}
          icon={<Bell className="h-5 w-5" />}
        />

        {/* 채널 비용 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
          <div className="font-bold mb-1">💡 채널별 비용</div>
          <ul className="space-y-0.5 list-disc list-inside">
            <li><b>대시보드</b>: 무료, 사용자가 대시보드 들어와야 봄</li>
            <li><b>이메일</b>: Resend 무료 3000건/월, 이후 1.5원/건. 즉시 도달 90%</li>
            <li><b>카카오 알림톡</b>: 8원/건 (가장 높음). 도달률 100%, 사용자가 가장 잘 봄</li>
            <li><b>Web Push</b>: 무료, 사용자 알림 허용 시. 즉시 도달</li>
          </ul>
        </div>

        {loading ? <DashboardLoading /> : (
          <div className="space-y-4">
            {CATEGORY_LABELS.map(category => {
              const categorySettings = category.types
                .map(t => settings.find(s => s.notification_type === t))
                .filter((s): s is Setting => Boolean(s))

              if (categorySettings.length === 0) return null

              return (
                <div key={category.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{category.label}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-500 text-xs">type</th>
                          {(['dashboard', 'email', 'alimtalk', 'push'] as const).map(ch => {
                            const info = CHANNEL_INFO[ch]
                            const Icon = info.icon
                            return (
                              <th key={ch} className="px-2 py-2 text-center font-medium text-gray-500 text-xs">
                                <div className="flex flex-col items-center gap-0.5">
                                  <Icon className={`w-3.5 h-3.5 ${info.color}`} />
                                  <span className="text-[10px]">{info.label}</span>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {categorySettings.map(s => (
                          <tr key={s.notification_type} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-gray-900 text-xs">{s.notification_type}</div>
                              {s.description && (
                                <div className="text-xs text-gray-500 mt-0.5">{s.description}</div>
                              )}
                            </td>
                            {(['dashboard_enabled', 'email_enabled', 'alimtalk_enabled', 'push_enabled'] as const).map(col => {
                              const isLoading = saving === `${s.notification_type}:${col}`
                              const isOn = s[col] === 1
                              return (
                                <td key={col} className="px-2 py-2.5 text-center">
                                  {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                                  ) : (
                                    <button
                                      onClick={() => toggle(s.notification_type, col, !isOn)}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pink-300 ${
                                        isOn ? 'bg-pink-500' : 'bg-gray-300'
                                      }`}
                                      aria-label={`${s.notification_type} ${col.replace('_enabled', '')} ${isOn ? '끄기' : '켜기'}`}
                                      aria-pressed={isOn}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                        isOn ? 'translate-x-5' : 'translate-x-1'
                                      }`} />
                                    </button>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

            {/* 카테고리에 속하지 않은 type (DB에 신규 추가됐지만 카테고리 매핑 안 된 것) */}
            {(() => {
              const categorizedTypes = new Set(CATEGORY_LABELS.flatMap(c => c.types))
              const uncategorized = settings.filter(s => !categorizedTypes.has(s.notification_type))
              if (uncategorized.length === 0) return null
              return (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-200">
                    <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider">{t('admin.notificationSettings.uncategorized', { defaultValue: '기타 (미분류 — 코드 그룹 추가 필요)' })}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {uncategorized.map(s => (
                          <tr key={s.notification_type} className="border-b border-gray-50 last:border-b-0">
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-gray-900 text-xs">{s.notification_type}</div>
                              {s.description && <div className="text-xs text-gray-500 mt-0.5">{s.description}</div>}
                            </td>
                            {(['dashboard_enabled', 'email_enabled', 'alimtalk_enabled', 'push_enabled'] as const).map(col => {
                              const isLoading = saving === `${s.notification_type}:${col}`
                              const isOn = s[col] === 1
                              return (
                                <td key={col} className="px-2 py-2.5 text-center">
                                  {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                                  ) : (
                                    <button
                                      onClick={() => toggle(s.notification_type, col, !isOn)}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isOn ? 'bg-pink-500' : 'bg-gray-300'}`}
                                      aria-label={`${s.notification_type} ${col.replace('_enabled', '')} 토글`}
                                      aria-pressed={isOn}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </button>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
