/**
 * 💬 인스타 자동 DM — 계정 연결 · 웹훅 정보 · 켜기/끄기.
 * ⚠️ 라이트 대시보드(AdminLayout) — dark: variant 금지.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Copy, Loader2, RefreshCw, Link2, Power, AlertTriangle } from 'lucide-react'
import { formatKST } from '@/utils/date'
import { apiError, type AutoDmStatus } from './types'

function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} 복사됨`) } catch { toast.error('복사하지 못했습니다') }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-gray-500">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-gray-50 px-2 py-1 text-xs text-gray-800">{value}</code>
      <button onClick={copy} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label={`${label} 복사`}>
        <Copy className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function ConnectPanel({ status, onChange }: { status: AutoDmStatus; onChange: () => void }) {
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const [cap, setCap] = useState(String(status.daily_cap))
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn() } finally { setBusy(null) }
  }

  const connect = () => run('connect', async () => {
    try {
      const { data } = await api.post('/api/admin/instagram-autodm/connect', { access_token: token, app_secret: secret })
      if (data?.success) {
        toast.success(`@${data.data?.username || '계정'} 연결됨`)
        if (!data.data?.subscribed) toast.error(`댓글 알림 구독 실패: ${data.data?.subscribe_error || '알 수 없음'} — 메타 앱 설정을 확인해 주세요`)
        setToken(''); setSecret(''); onChange()
      }
    } catch (e) { toast.error(apiError(e, '연결하지 못했습니다')) }
  })

  const toggle = (enabled: boolean) => run('toggle', async () => {
    if (enabled) {
      const ok = await confirmDialog({
        title: '자동 DM 을 켤까요?',
        message: '켜는 순간부터 키워드에 맞는 댓글을 단 사람에게 실제 DM 이 나갑니다.',
        confirmText: '켜기',
      })
      if (!ok) return
    }
    try {
      await api.post('/api/admin/instagram-autodm/settings', { enabled, daily_cap: Number(cap) })
      toast.success(enabled ? '자동 DM 이 켜졌습니다' : '자동 DM 이 꺼졌습니다')
      onChange()
    } catch (e) { toast.error(apiError(e, '설정을 저장하지 못했습니다')) }
  })

  const saveCap = () => run('cap', async () => {
    try {
      await api.post('/api/admin/instagram-autodm/settings', { enabled: status.enabled, daily_cap: Number(cap) })
      toast.success('일일 상한을 저장했습니다'); onChange()
    } catch (e) { toast.error(apiError(e, '저장하지 못했습니다')) }
  })

  const refresh = () => run('refresh', async () => {
    try { await api.post('/api/admin/instagram-autodm/refresh-token'); toast.success('토큰을 연장했습니다'); onChange() } catch (e) { toast.error(apiError(e, '토큰을 연장하지 못했습니다')) }
  })

  const unlink = () => run('unlink', async () => {
    const ok = await confirmDialog({ title: '연결을 해제할까요?', message: '토큰이 지워지고 자동 DM 이 꺼집니다. 규칙과 기록은 남습니다.', confirmText: '해제', danger: true })
    if (!ok) return
    try { await api.post('/api/admin/instagram-autodm/disconnect'); toast.success('연결을 해제했습니다'); onChange() } catch (e) { toast.error(apiError(e, '해제하지 못했습니다')) }
  })

  return (
    <div className="space-y-4">
      {!status.encryption_key_set && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-tone-warn-bg p-3 text-sm text-tone-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          DATA_ENCRYPTION_KEY 가 없어 토큰이 암호화되지 않고 저장됩니다. 연결 전에 환경변수를 확인해 주세요.
        </div>
      )}

      {/* 상태 + 켜기 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${status.enabled ? 'bg-tone-ok' : 'bg-gray-300'}`} />
              <span className="font-semibold text-gray-900">
                {status.enabled ? '자동 DM 작동 중' : '자동 DM 꺼짐'}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {status.connected ? <>연결 계정 <b className="text-gray-800">@{status.username}</b></> : '연결된 계정이 없습니다'}
              {' · '}켜진 규칙 {status.active_rules}개 · 최근 24시간 발송 {status.stats.sent24h}건
              {status.stats.failed24h > 0 && <span className="text-tone-bad"> · 실패 {status.stats.failed24h}건</span>}
            </p>
          </div>
          <Button
            onClick={() => toggle(!status.enabled)}
            disabled={busy !== null || (!status.enabled && (!status.connected || !status.has_app_secret))}
            variant={status.enabled ? 'outline' : 'default'}
          >
            {busy === 'toggle' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Power className="mr-1 h-4 w-4" />}
            {status.enabled ? '끄기' : '켜기'}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <span className="text-sm text-gray-600">하루 최대 발송</span>
          <input
            type="number" min={1} max={5000} value={cap} onChange={(e) => setCap(e.target.value)}
            className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-900"
          />
          <span className="text-sm text-gray-400">건 (넘으면 그날은 건너뜀 — 인스타 스팸 제한 방지)</span>
          <Button variant="outline" size="sm" onClick={saveCap} disabled={busy !== null}>저장</Button>
        </div>
        {status.connected && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            토큰 만료 예정 {status.token_expires_at ? formatKST(status.token_expires_at) : '알 수 없음'}
            {' · '}마지막 연장 {status.token_refreshed_at ? formatKST(status.token_refreshed_at) : '없음'}
            <span className="text-gray-400">(7일마다 자동 연장)</span>
            {status.token_refresh_error && <span className="text-tone-bad">연장 실패: {status.token_refresh_error}</span>}
            <button onClick={refresh} disabled={busy !== null} className="inline-flex items-center gap-1 underline">
              <RefreshCw className="h-3 w-3" /> 지금 연장
            </button>
            <button onClick={unlink} disabled={busy !== null} className="underline text-tone-bad">연결 해제</button>
          </div>
        )}
      </div>

      {/* 메타 앱에 넣을 값 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 font-semibold text-gray-900">① 메타 앱 웹훅 설정에 붙여 넣을 값</h3>
        <p className="mb-3 text-sm text-gray-500">
          Meta for Developers → 앱 → Instagram → API 설정(Instagram 로그인) → 웹훅 구성. 구독 필드는 <b>comments</b>.
        </p>
        <div className="space-y-2">
          <CopyRow label="콜백 URL" value={status.webhook_url} />
          <CopyRow label="확인 토큰" value={status.verify_token} />
        </div>
      </div>

      {/* 토큰 · 시크릿 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 font-semibold text-gray-900">② 계정 연결</h3>
        <p className="mb-3 text-sm text-gray-500">
          같은 화면의 '액세스 토큰 생성'으로 받은 토큰(장기 토큰)과 앱 설정의 <b>Instagram 앱 시크릿</b>을 넣어 주세요.
          {status.connected && ' 이미 연결돼 있으면 바꿀 값만 넣으면 됩니다.'}
        </p>
        <div className="space-y-2">
          <input
            type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off"
            placeholder={status.connected ? '새 액세스 토큰 (바꿀 때만)' : '액세스 토큰'}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
          <input
            type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off"
            placeholder={status.has_app_secret ? '앱 시크릿 (등록됨 — 바꿀 때만)' : 'Instagram 앱 시크릿 (32자리)'}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
          <Button onClick={connect} disabled={busy !== null || (!token && !status.connected) || (!token && !secret)}>
            {busy === 'connect' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}
            {status.connected ? '저장' : '연결'}
          </Button>
        </div>
      </div>
    </div>
  )
}
