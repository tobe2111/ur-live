/**
 * 📅 이용권 만료일을 카카오톡 캘린더에 넣는 버튼 (2026-10-11 대표 "1,2,4 해줄래" 중 2번)
 *
 * - 서버 게이트(`KAKAO_TALK_CALENDAR_ENABLED`)가 꺼져 있으면 **아무것도 그리지 않는다** — 카카오 콘솔에서
 *   톡캘린더 권한을 켜기 전에 버튼이 보이면 누르는 순간 동의 화면이 거절된다.
 * - 권한 미동의(`KAKAO_SCOPE_REQUIRED`)면 할 일을 sessionStorage 에 적어 두고 동의 화면으로 보낸다.
 *   돌아온 `KakaoConsentCallbackPage` 가 그 할 일을 이어서 실행한다(`runPendingKakaoAction`).
 * - 넣은 이용권은 localStorage 로 기억해 "넣었어요" 로 보여 준다(서버에 상태 컬럼을 늘리지 않는다 —
 *   두 번 넣어도 일정이 하나 더 생길 뿐 돈·권한에 닿지 않는다).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'

export const PENDING_KAKAO_ACTION_KEY = 'ur_kakao_consent_next'
const DONE_PREFIX = 'ur_tcal_'
const WALLET_PATH = '/my-vouchers'

let availability: Promise<boolean> | null = null
function isTalkCalendarAvailable(): Promise<boolean> {
  if (!availability) {
    availability = api.get('/api/kakao-social/calendar/voucher/available')
      .then((r) => !!r.data?.data?.enabled)
      .catch(() => { availability = null; return false })
  }
  return availability
}

function wasAdded(code: string): boolean {
  try { return localStorage.getItem(DONE_PREFIX + code) === '1' } catch { return false }
}
function markAdded(code: string) {
  try { localStorage.setItem(DONE_PREFIX + code, '1') } catch { /* 비공개 모드 */ }
}

type AddResult = 'ok' | 'consent' | 'error'

/** 서버에 일정 등록을 요청한다. 화면 처리(토스트)는 호출부가 한다. */
export async function addVoucherToTalkCalendar(code: string): Promise<{ result: AddResult; message?: string }> {
  try {
    await api.post('/api/kakao-social/calendar/voucher', { code })
    markAdded(code)
    return { result: 'ok' }
  } catch (err: unknown) {
    const data = (err as { response?: { data?: { code?: string; error?: string } } })?.response?.data
    if (data?.code === 'KAKAO_SCOPE_REQUIRED') return { result: 'consent' }
    return { result: 'error', message: data?.error }
  }
}

/** 동의 화면에서 돌아온 뒤 남겨 둔 할 일을 실행한다(`KakaoConsentCallbackPage`). 할 일이 없으면 null. */
export async function runPendingKakaoAction(): Promise<string | null> {
  let raw: string | null = null
  try { raw = sessionStorage.getItem(PENDING_KAKAO_ACTION_KEY); sessionStorage.removeItem(PENDING_KAKAO_ACTION_KEY) } catch { return null }
  if (!raw) return null
  let action: { type?: string; code?: string } | null = null
  try { action = JSON.parse(raw) } catch { return null }
  if (action?.type !== 'voucher_calendar' || typeof action.code !== 'string') return null
  const r = await addVoucherToTalkCalendar(action.code)
  if (r.result === 'ok') return '톡캘린더에 만료일을 넣었어요. 3일 전·하루 전에 알려 드려요'
  if (r.result === 'consent') return '카카오톡 캘린더 동의가 완료되지 않았어요'
  return r.message || '톡캘린더에 넣지 못했어요'
}

export default function TalkCalendarButton({ code }: { code: string }) {
  const [enabled, setEnabled] = useState(false)
  const [added, setAdded] = useState(() => wasAdded(code))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    isTalkCalendarAvailable().then((on) => { if (alive) setEnabled(on) })
    return () => { alive = false }
  }, [])

  if (!enabled) return null

  const onClick = async () => {
    if (busy || added) return
    setBusy(true)
    const r = await addVoucherToTalkCalendar(code)
    setBusy(false)
    if (r.result === 'ok') {
      setAdded(true)
      toast.success('톡캘린더에 만료일을 넣었어요. 3일 전·하루 전에 알려 드려요')
      return
    }
    if (r.result === 'consent') {
      const go = await confirmDialog({
        title: '카카오톡 캘린더 동의',
        message: '만료일을 톡캘린더에 넣으려면 한 번만 동의가 필요해요. 카카오 화면으로 이동할게요.',
        confirmText: '동의하러 가기',
      })
      if (!go) return
      try { sessionStorage.setItem(PENDING_KAKAO_ACTION_KEY, JSON.stringify({ type: 'voucher_calendar', code })) } catch { /* 없어도 동의는 된다 */ }
      window.location.href = `/auth/kakao/consent/start?scope=talk_calendar&return=${encodeURIComponent(WALLET_PATH)}`
      return
    }
    toast.error(r.message || '톡캘린더에 넣지 못했어요')
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-[12px] font-medium text-gray-900 dark:text-white underline underline-offset-2 active:opacity-60 disabled:opacity-50"
    >
      {added ? '톡캘린더에 넣었어요' : busy ? '넣는 중…' : '톡캘린더에 알림 넣기'}
    </button>
  )
}
