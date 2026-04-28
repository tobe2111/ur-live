import { useState, useEffect } from 'react'
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

export default function AdminNotificationSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/notification-settings')
      setSettings(res.data?.data || [])
    } catch {
      toast.error('설정 로드 실패')
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
      toast.success('변경 완료')
    } catch {
      toast.error('변경 실패')
    } finally {
      setSaving(null)
    }
  }

  return (
    <AdminLayout title="알림 채널 설정">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="알림 채널 설정"
          subtitle="알림 종류별로 어떤 채널 (대시보드/이메일/알림톡/푸시) 를 사용할지 설정합니다"
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">알림 종류</th>
                  {(['dashboard', 'email', 'alimtalk', 'push'] as const).map(ch => {
                    const info = CHANNEL_INFO[ch]
                    const Icon = info.icon
                    return (
                      <th key={ch} className="px-4 py-3 text-center font-bold text-gray-700">
                        <div className="flex flex-col items-center gap-1">
                          <Icon className={`w-4 h-4 ${info.color}`} />
                          <span className="text-xs">{info.label}</span>
                          <span className="text-[10px] text-gray-500 font-normal">{info.cost}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {settings.map(s => (
                  <tr key={s.notification_type} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 text-xs">{s.notification_type}</div>
                      {s.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{s.description}</div>
                      )}
                    </td>
                    {(['dashboard_enabled', 'email_enabled', 'alimtalk_enabled', 'push_enabled'] as const).map(col => {
                      const isLoading = saving === `${s.notification_type}:${col}`
                      const isOn = s[col] === 1
                      return (
                        <td key={col} className="px-4 py-3 text-center">
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                          ) : (
                            <button
                              onClick={() => toggle(s.notification_type, col, !isOn)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                isOn ? 'bg-pink-500' : 'bg-gray-300'
                              }`}
                              aria-label={`${col} 토글`}
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
        )}
      </div>
    </AdminLayout>
  )
}
