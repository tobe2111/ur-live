/**
 * 💬 인스타 자동 DM — 계정 연결 · 켜기/끄기 · 하루 상한. 어드민(공식 계정)·셀러(매장 계정) 공용.
 *
 * 연결은 **인스타 로그인**으로 한다 — 사장님·중개사는 토큰을 보지도 만지지도 않는다.
 * [인스타로 연결] → instagram.com 에서 로그인·허용 → 이 화면으로 돌아온다(?ig=connected).
 * ⚠️ 라이트 대시보드 — dark: variant 금지.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Loader2, RefreshCw, Link2, Power, AlertTriangle } from 'lucide-react'
import { formatKST } from '@/utils/date'
import { apiError, type AutoDmStatus } from './types'

export default function ConnectCard({ base, status, returnPath, fromMy = false, onChange }: {
  base: string; status: AutoDmStatus; returnPath: string
  /** 마이 시트 안에서 열렸나 — 인스타에서 돌아올 때 "마이로 돌아가기" 띠를 붙인다 */
  fromMy?: boolean
  onChange: () => void
}) {
  const [cap, setCap] = useState(String(status.daily_cap))
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn() } finally { setBusy(null) }
  }

  const connect = () => run('connect', async () => {
    try {
      const { data } = await api.get(`${base}/connect-url`, { params: { return: returnPath, ...(fromMy ? { from: 'my' } : {}) } })
      if (data?.data?.url) window.location.assign(data.data.url)
    } catch (e) { toast.error(apiError(e, '연결을 시작하지 못했습니다')) }
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
      await api.post(`${base}/settings`, { enabled, daily_cap: Number(cap) })
      toast.success(enabled ? '자동 DM 이 켜졌습니다' : '자동 DM 이 꺼졌습니다')
      onChange()
    } catch (e) { toast.error(apiError(e, '설정을 저장하지 못했습니다')) }
  })

  const saveCap = () => run('cap', async () => {
    try {
      await api.post(`${base}/settings`, { enabled: status.enabled, daily_cap: Number(cap) })
      toast.success('하루 최대 발송 수를 저장했습니다'); onChange()
    } catch (e) { toast.error(apiError(e, '저장하지 못했습니다')) }
  })

  const refresh = () => run('refresh', async () => {
    try { await api.post(`${base}/refresh-token`); toast.success('연결을 연장했습니다'); onChange() } catch (e) { toast.error(apiError(e, '연장하지 못했습니다')) }
  })

  const unlink = () => run('unlink', async () => {
    const ok = await confirmDialog({ title: '연결을 해제할까요?', message: '자동 DM 이 꺼지고 발송 기록(댓글 단 사람 정보)이 지워집니다. 키워드 규칙은 남아서 다시 연결하면 그대로 씁니다.', confirmText: '해제', danger: true })
    if (!ok) return
    try { await api.post(`${base}/disconnect`); toast.success('연결을 해제했습니다'); onChange() } catch (e) { toast.error(apiError(e, '해제하지 못했습니다')) }
  })

  const notice = !status.available
    ? '유어딜이 인스타 연동을 준비하고 있어요. 준비가 끝나면 연결 버튼이 동작합니다.'
    : !status.sellers_enabled
      ? '지금은 연결과 규칙 준비만 할 수 있어요. 유어딜 쪽 인스타 승인이 끝나면 켜 둔 규칙대로 발송이 시작됩니다.'
      : status.enable_block

  return (
    <div className="space-y-3">
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-tone-info-bg p-3 text-sm text-tone-info">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${status.enabled ? 'bg-tone-ok' : 'bg-gray-300'}`} />
              <span className="font-semibold text-gray-900">{status.enabled ? '자동 DM 작동 중' : '자동 DM 꺼짐'}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {status.connected ? <>연결 계정 <b className="text-gray-800">@{status.username}</b></> : '연결된 인스타 계정이 없습니다'}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              켜진 규칙 {status.active_rules}개, 최근 24시간 발송 {status.stats.sent24h}건
              {status.stats.failed24h > 0 && <span className="text-tone-bad">, 실패 {status.stats.failed24h}건</span>}
            </p>
          </div>
          {status.connected ? (
            <Button
              onClick={() => toggle(!status.enabled)}
              disabled={busy !== null || (!status.enabled && !!status.enable_block)}
              variant={status.enabled ? 'outline' : 'default'}
            >
              {busy === 'toggle' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Power className="mr-1 h-4 w-4" />}
              {status.enabled ? '끄기' : '켜기'}
            </Button>
          ) : (
            <Button onClick={connect} disabled={busy !== null || !status.available}>
              {busy === 'connect' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}
              인스타로 연결
            </Button>
          )}
        </div>

        {status.connected && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              <span className="text-sm text-gray-600">하루 최대 발송</span>
              <input
                type="number" min={1} max={status.cap_max} value={cap} onChange={(e) => setCap(e.target.value)}
                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-900"
              />
              <span className="text-sm text-gray-400">건 (최대 {status.cap_max} · 넘으면 그날은 건너뜀)</span>
              <Button variant="outline" size="sm" onClick={saveCap} disabled={busy !== null}>저장</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              연결 만료 예정 {status.token_expires_at ? formatKST(status.token_expires_at) : '알 수 없음'}
              <span className="text-gray-400">(쓰는 동안 자동 연장)</span>
              {status.token_refresh_error && <span className="text-tone-bad">연장 실패: {status.token_refresh_error}</span>}
              <button onClick={refresh} disabled={busy !== null} className="inline-flex items-center gap-1 underline">
                <RefreshCw className="h-3 w-3" /> 지금 연장
              </button>
              <button onClick={connect} disabled={busy !== null || !status.available} className="underline">다른 계정으로 다시 연결</button>
              <button onClick={unlink} disabled={busy !== null} className="text-tone-bad underline">연결 해제</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
