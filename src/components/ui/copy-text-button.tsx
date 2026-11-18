/**
 * 📋 2026-11-18 (대표 *"3번만 해줘. 복사 버튼 두면 되겠네"*) — 글자 선택을 막은 화면에서 **복사가 필요한 값**에 붙이는 버튼.
 *
 * 소비자 화면은 글자 선택·복사를 막는다(`src/lib/image-protect.ts`). 그런데 손님은 매장 주소·전화번호를
 * 지도 앱·메신저에 붙여넣는다 ⇒ 그 값 옆에 이 버튼을 둔다. 선택을 막기만 하고 버튼을 안 두면 훔치는 사람은
 * 못 막고 사는 사람만 불편해진다.
 *
 * 모양은 디자인 시스템의 조작 아이콘 규칙(lucide = 조작)을 따른 글자 버튼 하나다 — 판·테두리·그림자 없음.
 */
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import { toast } from '@/hooks/useToast'

/** 클립보드에 쓴다 — 권한이 없거나 옛 웹뷰면 임시 입력 칸으로 한 번 더 시도한다. 성공 여부를 돌려준다. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = String(text ?? '')
  if (!value) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch { /* 아래 폴백 */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function CopyTextButton({
  text, what, className,
}: {
  /** 복사할 값 */
  text: string
  /** 무엇을 복사하는지(접근성 이름·알림 문구) — 예: '주소' */
  what: string
  className?: string
}) {
  const { t } = useTranslation()
  const [done, setDone] = useState(false)
  if (!text) return null
  return (
    <button
      type="button"
      aria-label={t('common.copyWhat', { defaultValue: '{{what}} 복사', what })}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const ok = await copyTextToClipboard(text)
        if (ok) {
          setDone(true)
          toast.success(t('common.copiedWhat', { defaultValue: '{{what}}를 복사했어요', what }))
          setTimeout(() => setDone(false), 1500)
        } else {
          toast.error(t('common.copyFailed', { defaultValue: '복사에 실패했습니다.' }))
        }
      }}
      className={`shrink-0 inline-flex items-center min-h-[32px] px-2 bg-transparent border-0 cursor-pointer text-[12px] font-medium text-brand active:opacity-60 ${className || ''}`}
    >
      {done ? t('common.copied', { defaultValue: '복사됨' }) : t('common.copy', { defaultValue: '복사' })}
    </button>
  )
}
