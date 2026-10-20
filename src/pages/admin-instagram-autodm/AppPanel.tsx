/**
 * 💬 인스타 자동 DM 어드민 — 메타 앱 설정(유어딜 앱 1개) + 매장 계정 전체 스위치 + 공식 계정 토큰 붙여 넣기.
 * ⚠️ 라이트 대시보드(AdminLayout) — dark: variant 금지.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Copy, Loader2, Save, AlertTriangle } from 'lucide-react'
import { apiError, type AutoDmAppConfig } from '@/components/seller/instagram-autodm/types'

function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} 복사됨`) } catch { toast.error('복사하지 못했습니다') }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-gray-500">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-gray-50 px-2 py-1 text-xs text-gray-800">{value}</code>
      <button onClick={copy} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label={`${label} 복사`}>
        <Copy className="h-4 w-4" />
      </button>
    </div>
  )
}

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900'

export default function AppPanel({ app, onChange }: { app: AutoDmAppConfig; onChange: () => void }) {
  const [appId, setAppId] = useState(app.app_id || '')
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn() } finally { setBusy(null) }
  }

  const saveApp = () => run('app', async () => {
    try {
      await api.post('/api/admin/instagram-autodm/app', { app_id: appId, app_secret: secret })
      toast.success('앱 설정을 저장했습니다'); setSecret(''); onChange()
    } catch (e) { toast.error(apiError(e, '저장하지 못했습니다')) }
  })

  const toggleSellers = (on: boolean) => run('sellers', async () => {
    if (on) {
      const ok = await confirmDialog({
        title: '매장 계정 발송을 열까요?',
        message: '켜는 순간부터 사장님·중개사가 켜 둔 규칙대로 각자의 인스타에서 DM 이 나갑니다. 메타 앱 심사(고급 액세스)가 통과된 뒤에 여세요.',
        confirmText: '열기',
      })
      if (!ok) return
    }
    try {
      await api.post('/api/admin/instagram-autodm/app', { sellers_enabled: on })
      toast.success(on ? '매장 계정 발송을 열었습니다' : '매장 계정 발송을 닫았습니다'); onChange()
    } catch (e) { toast.error(apiError(e, '저장하지 못했습니다')) }
  })

  const pasteToken = () => run('paste', async () => {
    try {
      const { data } = await api.post('/api/admin/instagram-autodm/connect', { access_token: token })
      toast.success(`@${data?.data?.username || '계정'} 연결됨`)
      if (data?.data && !data.data.subscribed) toast.error(`댓글 알림 구독 실패: ${data.data.subscribe_error || '알 수 없음'}`)
      setToken(''); onChange()
    } catch (e) { toast.error(apiError(e, '연결하지 못했습니다')) }
  })

  return (
    <div className="space-y-4">
      {!app.encryption_key_set && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-tone-warn-bg p-3 text-sm text-tone-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          DATA_ENCRYPTION_KEY 가 없어 토큰이 암호화되지 않고 저장됩니다. 연결 전에 환경변수를 확인해 주세요.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 font-semibold text-gray-900">① 메타 앱에 붙여 넣을 값</h3>
        <p className="mb-3 text-sm text-gray-500">
          Meta for Developers → 앱 → Instagram → API 설정(Instagram 로그인). 웹훅 구독 필드는 <b>comments</b>,
          비즈니스 로그인의 리디렉션·권한 해제·데이터 삭제 주소와 앱 기본 설정의 개인정보처리방침 주소는 아래 그대로.
        </p>
        <div className="space-y-2">
          <CopyRow label="웹훅 콜백 URL" value={app.webhook_url} />
          <CopyRow label="웹훅 확인 토큰" value={app.verify_token} />
          <CopyRow label="리디렉션 URL" value={app.redirect_uri} />
          <CopyRow label="권한 해제 콜백" value={app.deauthorize_url} />
          <CopyRow label="데이터 삭제 콜백" value={app.data_deletion_url} />
          <CopyRow label="개인정보처리방침" value={app.privacy_url} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 font-semibold text-gray-900">② 유어딜 앱 정보</h3>
        <p className="mb-3 text-sm text-gray-500">같은 화면의 <b>Instagram 앱 ID</b> 와 <b>Instagram 앱 시크릿</b>. 공식 계정·매장 계정 모두 이 앱 하나로 연결됩니다.</p>
        <div className="space-y-2">
          <input className={field} value={appId} onChange={(e) => setAppId(e.target.value.replace(/\D/g, ''))} placeholder="Instagram 앱 ID (숫자)" />
          <input
            type="password" className={field} value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off"
            placeholder={app.has_app_secret ? '앱 시크릿 (등록됨 — 바꿀 때만)' : 'Instagram 앱 시크릿 (32자리)'}
          />
          <Button onClick={saveApp} disabled={busy !== null || (!secret && appId === (app.app_id || ''))}>
            {busy === 'app' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} 저장
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">③ 매장 계정 발송 (사장님·중개사)</h3>
            <p className="mt-1 text-sm text-gray-500">
              {app.sellers_enabled ? '열림 — 매장이 켜 둔 규칙대로 발송됩니다.' : '닫힘 — 매장은 연결·규칙 준비만 할 수 있고 발송은 0통입니다.'}
              {' '}메타 앱 심사(고급 액세스) 통과 전엔 닫아 두세요.
            </p>
          </div>
          <Button variant={app.sellers_enabled ? 'outline' : 'default'} onClick={() => toggleSellers(!app.sellers_enabled)} disabled={busy !== null}>
            {busy === 'sellers' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {app.sellers_enabled ? '닫기' : '열기'}
          </Button>
        </div>
      </div>

      <details className="rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">공식 계정을 토큰으로 직접 연결 (로그인 연결이 안 될 때)</summary>
        <div className="mt-3 space-y-2">
          <input type="password" className={field} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" placeholder="액세스 토큰" />
          <Button variant="outline" onClick={pasteToken} disabled={busy !== null || !token}>
            {busy === 'paste' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} 연결
          </Button>
        </div>
      </details>
    </div>
  )
}
