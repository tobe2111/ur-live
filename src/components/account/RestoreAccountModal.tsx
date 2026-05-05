/**
 * 🛡️ 2026-05-01: Option B 복원 동의 모달.
 *
 * 카카오 OAuth 콜백 후 redirect URL 에 ?restorable=1&originalName=... 가 부착되면 표시.
 * 사용자가 30일 내 같은 카카오 계정으로 재가입한 경우.
 *
 * 두 가지 선택지:
 *   1. "이전 계정 복원하기" → POST /api/account/restore → 옛 user_id 로 세션 갱신
 *   2. "신규 계정으로 시작" → 모달 닫기 (현재 신규 row 그대로 사용)
 *
 * 30일 후 옛 계정은 hard purge cron 이 처리.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { X, RotateCcw } from 'lucide-react'

const RESTORE_PROCESSED_KEY = 'ur_restore_consent_handled_v1'

export default function RestoreAccountModal() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [show, setShow] = useState(false)
  const [originalName, setOriginalName] = useState<string | undefined>()
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    const isRestorable = searchParams.get('restorable') === '1'
    if (!isRestorable) return

    // 같은 페이지 안에서 한 번만 처리 (중복 모달 방지)
    try {
      if (sessionStorage.getItem(RESTORE_PROCESSED_KEY) === '1') return
    } catch { /* */ }

    const name = searchParams.get('originalName') || undefined
    setOriginalName(name)
    setShow(true)
  }, [searchParams])

  function cleanUrl() {
    const next = new URLSearchParams(searchParams)
    next.delete('restorable')
    next.delete('originalName')
    setSearchParams(next, { replace: true })
    try { sessionStorage.setItem(RESTORE_PROCESSED_KEY, '1') } catch { /* */ }
  }

  async function handleRestore() {
    if (restoring) return
    setRestoring(true)

    // 5s 안전망 — API hang 시도 모달 닫음
    const timeoutId = setTimeout(() => {
      setRestoring(false)
      toast.error(t('user.restoreTimeout', { defaultValue: '복원 요청이 지연됐어요. 다시 시도해주세요.' }))
    }, 5000)

    try {
      const res = await api.post('/api/account/restore', {}, { timeout: 5000 })
      clearTimeout(timeoutId)
      if (res.data?.success) {
        toast.success(t('user.restoreSuccess', { defaultValue: '이전 계정이 복원됐어요! 다시 로그인해주세요.' }))
        setShow(false)
        cleanUrl()
        // 복원 후엔 새 user_id 로 인증해야 하므로 로그아웃 후 재로그인 권유.
        try {
          localStorage.clear()
        } catch (clearErr) {
          if (import.meta.env.DEV) console.warn('[RestoreAccount] localStorage.clear failed:', clearErr)
          // partial clear 가능성 — 명시 에러 표시. 사용자가 인지하고 새로고침 가능.
          toast.error(t('user.restoreClearFailed', { defaultValue: '일부 데이터 청소 실패 — 브라우저를 새로고침 해주세요.' }))
        }
        setTimeout(() => { window.location.href = '/login' }, 800)
      } else {
        const errMsg = res.data?.error || '복원 실패'
        toast.error(errMsg)
        setRestoring(false)
      }
    } catch (e) {
      clearTimeout(timeoutId)
      if (import.meta.env.DEV) console.error('[RestoreAccount] failed:', e)
      toast.error(t('user.restoreError', { defaultValue: '복원 중 오류가 발생했어요.' }))
      setRestoring(false)
    }
  }

  function handleSkip() {
    setShow(false)
    cleanUrl()
    toast.success(t('user.newAccountStart', { defaultValue: '새 계정으로 시작합니다.' }))
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="bg-white dark:bg-[#0A0A0A] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
      >
        {/* 헤더 */}
        <div className="relative px-6 pt-6 pb-2">
          <button
            onClick={handleSkip}
            aria-label={t('common.close', { defaultValue: '닫기' })}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </button>
          <div className="w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center">
            <RotateCcw className="w-7 h-7 text-pink-500" />
          </div>
          <h2 id="restore-title" className="text-[18px] font-bold text-gray-900 dark:text-white">
            {t('user.restoreTitle', { defaultValue: '이전에 가입했던 계정이 있어요' })}
          </h2>
          <p className="text-[13px] text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
            {originalName ? <><strong className="text-gray-900 dark:text-white">{originalName}</strong> {t('user.restoreNamePrefix', { defaultValue: '님으로 ' })}</> : t('user.restoreKakaoPrefix', { defaultValue: '같은 카카오 계정으로 ' })}
            {t('user.restoreDesc', { defaultValue: '가입했던 기록이 있어요.' })}<br />
            {t('user.restoreQuestion', { defaultValue: '이전 계정을 복원하시겠어요? 30일 내 탈퇴한 계정만 복원할 수 있어요.' })}
          </p>
        </div>

        {/* 안내 박스 */}
        <div className="mx-6 my-3 p-3 bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100 rounded-xl">
          <p className="text-[12px] text-gray-700 dark:text-gray-200 leading-relaxed">
            <strong className="text-pink-600">{t('user.restoreWhenRestore', { defaultValue: '복원 시' })}</strong>: {t('user.restoreWhenRestoreDesc', { defaultValue: '이전 주문 내역, 쿠폰, 딜 포인트, 위시리스트 등 모든 데이터가 다시 살아나요.' })}
          </p>
          <p className="text-[12px] text-gray-700 dark:text-gray-200 leading-relaxed mt-1.5">
            <strong className="text-gray-500 dark:text-gray-400">{t('user.restoreWhenNew', { defaultValue: '신규 계정 선택 시' })}</strong>: {t('user.restoreWhenNewDesc', { defaultValue: '새로 시작합니다. 이전 데이터는 30일 후 영구 삭제돼요.' })}
          </p>
        </div>

        {/* 버튼 */}
        <div className="px-6 pb-6 pt-2 flex flex-col gap-2">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="w-full h-12 bg-pink-500 hover:bg-pink-600 active:scale-[0.98] disabled:opacity-50 text-white rounded-xl font-bold text-[14px] transition-all"
          >
            {restoring ? t('user.restoring', { defaultValue: '복원 중...' }) : t('user.restoreBtn', { defaultValue: '이전 계정 복원하기' })}
          </button>
          <button
            onClick={handleSkip}
            disabled={restoring}
            className="w-full h-11 text-gray-500 dark:text-gray-400 hover:text-gray-700 text-[13px] font-medium"
          >
            {t('user.newAccountBtn', { defaultValue: '새 계정으로 시작' })}
          </button>
        </div>
      </div>
    </div>
  )
}
