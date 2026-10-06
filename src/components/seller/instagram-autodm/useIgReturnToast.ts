/**
 * 💬 인스타 로그인에서 돌아왔을 때(?ig=connected|connected_nosub|cancelled|error&reason=…) 한 번 알리고
 * 주소에서 그 표시를 지운다 — 새로고침할 때마다 같은 알림이 다시 뜨지 않게.
 */
import { useEffect } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import { toast } from '@/hooks/useToast'

export function igReturnMessage(result: string | null, reason: string | null): { ok: boolean; text: string } | null {
  if (!result) return null
  if (result === 'connected') return { ok: true, text: '인스타 계정을 연결했어요' }
  if (result === 'connected_nosub') return { ok: false, text: '연결은 됐지만 댓글 알림 구독에 실패했어요. "다른 계정으로 다시 연결"을 한 번 눌러 주세요' }
  if (result === 'cancelled') return { ok: false, text: '인스타 연결을 취소했어요' }
  return { ok: false, text: (reason || '인스타 연결에 실패했어요').slice(0, 200) }
}

export function useIgReturnToast(params: URLSearchParams, setParams: SetURLSearchParams, onDone: () => void) {
  const result = params.get('ig')
  const reason = params.get('reason')
  useEffect(() => {
    const msg = igReturnMessage(result, reason)
    if (!msg) return
    if (msg.ok) toast.success(msg.text)
    else toast.error(msg.text)
    const next = new URLSearchParams(params)
    next.delete('ig'); next.delete('reason')
    setParams(next, { replace: true })
    onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, reason])
}
