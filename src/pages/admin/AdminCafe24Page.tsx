import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { formatKST } from '@/utils/date'
import {
  Store, Link2, Unlink, RefreshCw, Loader2,
  CheckCircle, AlertCircle, Package, Clock
} from 'lucide-react'

interface Cafe24Status {
  connected: boolean
  mall_id?: string
  token_expired?: boolean
  expires_at?: string
  scopes?: string
  synced_products?: number
  last_updated?: string
  reason?: string
}

function getToken() {
  return localStorage.getItem('admin_token') || localStorage.getItem('access_token')
}

export default function AdminCafe24Page() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<Cafe24Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Handle callback query params
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected === 'true') {
      toast.success('Cafe24 연동이 성공적으로 완료되었습니다.')
    }
    if (error) {
      toast.error(`Cafe24 연동 실패: ${error}`)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      setLoading(true)
      const token = getToken()
      const res = await api.get('/api/admin/cafe24/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setStatus(res.data.data)
    } catch (err) {
      console.error('[Cafe24] Status load failed:', err)
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    try {
      setConnecting(true)
      const token = getToken()
      const res = await api.get('/api/admin/cafe24/auth-url', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const { authUrl } = res.data.data
      window.location.href = authUrl
    } catch (err) {
      console.error('[Cafe24] Connect failed:', err)
      toast.error('연동 시작 실패: 환경변수를 확인해주세요.')
      setConnecting(false)
    }
  }

  async function handleSync() {
    try {
      setSyncing(true)
      const token = getToken()
      const res = await api.post('/api/admin/cafe24/sync', {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const { data } = res.data
      toast.success(`동기화 완료: 생성 ${data.created}개, 업데이트 ${data.updated}개${data.errors.length > 0 ? `, 오류 ${data.errors.length}개` : ''}`)
      await loadStatus()
    } catch (err: any) {
      console.error('[Cafe24] Sync failed:', err)
      toast.error(`동기화 실패: ${err.response?.data?.error || '알 수 없는 오류'}`)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Cafe24 연동을 해제하시겠습니까? 기존 동기화된 상품은 유지됩니다.')) return
    try {
      setDisconnecting(true)
      const token = getToken()
      await api.post('/api/admin/cafe24/disconnect', {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('Cafe24 연동 해제 완료')
      setStatus({ connected: false })
    } catch (err) {
      console.error('[Cafe24] Disconnect failed:', err)
      toast.error('연동 해제 실패')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <AdminLayout title="Cafe24 연동">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Status Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cafe24 연동 상태</h2>
              <p className="text-sm text-gray-500">상품 자동 동기화를 위한 Cafe24 연결</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : status?.connected ? (
            <div className="space-y-4">
              {/* Connected badge */}
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">연결됨</span>
                <span className="text-xs text-green-600 ml-auto">
                  Mall ID: {status.mall_id}
                </span>
              </div>

              {/* Token status */}
              {status.token_expired && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700">
                    토큰이 만료되었습니다. 동기화 시 자동으로 갱신됩니다.
                  </span>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500">동기화된 상품</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {status.synced_products ?? 0}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500">마지막 업데이트</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {status.last_updated
                      ? formatKST(status.last_updated)
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {syncing ? '동기화 중...' : '상품 동기화'}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors text-sm"
                >
                  {disconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                  연동 해제
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Cafe24 미연결</h3>
              <p className="text-xs text-gray-500 mb-6">
                Cafe24 쇼핑몰과 연동하여 상품을 자동으로 동기화하세요.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {connecting ? '연결 중...' : 'Cafe24 연동하기'}
              </button>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">연동 안내</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">1.</span>
              <span>Cafe24 쇼핑몰에 등록된 상품이 자동으로 동기화됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">2.</span>
              <span>상품명, 가격, 재고, 이미지 등 주요 정보가 동기화됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">3.</span>
              <span>주문 정보(읽기/쓰기) 권한도 포함되어 있어 추후 주문 연동이 가능합니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">4.</span>
              <span>결제는 기존 토스페이먼츠 PG를 계속 사용합니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">5.</span>
              <span>어드민 대시보드에서 직접 상품을 추가할 수도 있습니다.</span>
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  )
}
