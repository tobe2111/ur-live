/**
 * 🛡️ 2026-05-24: /account/settings 와 /user/profile 통합 — 사용자 요청.
 *   AccountSettingsPage 에 있던 unique 항목들을 통합:
 *   - 알림 설정 (push / email toggle)
 *   - 프로필 편집 모달 (이름 / 전화번호)
 *   - 앱 버전 + 캐시 초기화
 *   - 계정 탈퇴 링크
 *
 *   ProfileEditModal 은 외부에서 isOpen + onClose 제어 (UserProfilePage 의 "설정" 버튼이 트리거).
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bell, Mail, X, Loader2, CheckCircle2, RefreshCw,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useEscapeKey } from '@/hooks/useEscapeKey'

const APP_VERSION = '1.0.0'
const BUILD_HASH = (import.meta.env.VITE_APP_VERSION || '').slice(0, 7)

// ─── 알림 토글 섹션 ──────────────────────────────
export function NotificationToggleSection() {
  const { t } = useTranslation()
  const [notif, setNotif] = useState(() => {
    try {
      const s = localStorage.getItem('notif_settings')
      return s ? JSON.parse(s) : { push: true, email: true }
    } catch { return { push: true, email: true } }
  })
  function toggle(key: 'push' | 'email') {
    const next = { ...notif, [key]: !notif[key] }
    setNotif(next)
    localStorage.setItem('notif_settings', JSON.stringify(next))
  }

  const Toggle = ({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: () => void }) => (
    <div className="flex items-center gap-3 px-3.5 py-3" style={{ borderTop: 'var(--toggle-border, none)' }}>
      <span className="text-gray-900 dark:text-white/55">{icon}</span>
      <span className="flex-1 text-[13px] text-gray-900 dark:text-white">{label}</span>
      <button
        type="button"
        onClick={onChange}
        aria-pressed={value}
        aria-label={value ? `${label} 끄기` : `${label} 켜기`}
        className={`relative w-[44px] h-[24px] rounded-full transition-colors duration-200 shrink-0 ${value ? 'bg-pink-500' : 'bg-gray-100 dark:bg-white/[0.15]'}`}
      >
        <span className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white dark:bg-[#0A0A0A] rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('accountSettings.sectionNotification', { defaultValue: '알림 설정' })}</p>
      <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
        <Toggle
          icon={<Bell className="w-4 h-4" aria-hidden="true" />}
          label={t('accountSettings.togglePush', { defaultValue: '푸시 알림' })}
          value={notif.push}
          onChange={() => toggle('push')}
        />
        <Toggle
          icon={<Mail className="w-4 h-4" aria-hidden="true" />}
          label={t('accountSettings.toggleEmail', { defaultValue: '이메일 알림' })}
          value={notif.email}
          onChange={() => toggle('email')}
        />
      </div>
    </div>
  )
}

// ─── 앱 버전 / 캐시 초기화 섹션 ──────────────────────────────
export function AppVersionSection() {
  const { t } = useTranslation()
  const [serverVersion, setServerVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  const fetchVersion = async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' })
      const data = await res.json() as { success?: boolean; version?: string }
      if (data?.version && isMountedRef.current) setServerVersion(String(data.version))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    isMountedRef.current = true
    fetchVersion().finally(() => { if (isMountedRef.current) setLoading(false) })
    return () => {
      isMountedRef.current = false
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
    }
  }, [])

  const handleCheck = async () => {
    setChecking(true)
    await fetchVersion()
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
    checkTimerRef.current = setTimeout(() => { if (isMountedRef.current) setChecking(false) }, 500)
  }

  const handleUpdate = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.update()))
      }
    } catch { /* ignore */ }
    window.location.reload()
  }

  const localBuildVersion = (typeof window !== 'undefined' ? localStorage.getItem('ur_build_version') : null)
  const isLatest = !loading && serverVersion && localBuildVersion && serverVersion === localBuildVersion
  const hasUpdate = !loading && serverVersion && localBuildVersion && serverVersion !== localBuildVersion

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('accountSettings.appInfo', { defaultValue: '앱 정보' })}</p>
      <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[13px] text-gray-900 dark:text-white/75">{t('accountSettings.currentVersion', { defaultValue: '현재 버전' })}</span>
          <span className="text-[12px] font-medium text-gray-900 dark:text-white">v{APP_VERSION}</span>
        </div>
        {BUILD_HASH && (
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[13px] text-gray-900 dark:text-white/75">{t('accountSettings.build', { defaultValue: '빌드' })}</span>
            <span className="text-[11px] font-mono text-gray-900 dark:text-white/55">{BUILD_HASH}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[13px] text-gray-900 dark:text-white/75">{t('accountSettings.checkLatest', { defaultValue: '최신 버전 확인' })}</span>
          {loading ? (
            <span className="flex items-center gap-1.5 text-[12px] text-gray-900 dark:text-white/55">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 확인 중...
            </span>
          ) : !serverVersion ? (
            <button type="button" onClick={handleCheck} className="flex items-center gap-1 text-[12px] text-gray-900 dark:text-white/55 hover:text-gray-900 dark:hover:text-white transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} /> 다시 시도
            </button>
          ) : isLatest ? (
            <span className="flex items-center gap-1.5 text-[12px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> 최신 버전
            </span>
          ) : hasUpdate ? (
            <button type="button" onClick={handleUpdate} className="flex items-center gap-1 px-3 py-1 rounded-full bg-pink-500 text-white text-xs font-bold hover:bg-pink-600 transition-colors">
              <RefreshCw className="w-3 h-3" /> 업데이트
            </button>
          ) : (
            <button type="button" onClick={handleCheck} className="flex items-center gap-1 text-[12px] text-gray-900 dark:text-white/55 hover:text-gray-900 dark:hover:text-white transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} /> 확인
            </button>
          )}
        </div>
      </div>
      {hasUpdate && (
        <p className="mt-2 text-[11px] text-pink-400 px-2 text-center">새 버전이 준비되었습니다. 업데이트 버튼을 눌러 적용하세요.</p>
      )}
    </div>
  )
}

// ─── 계정 탈퇴 링크 ──────────────────────────────
export function DeleteAccountLink() {
  const { t } = useTranslation()
  return (
    <div className="ur-content-medium px-4 lg:px-8 mt-8 mb-6">
      <Link
        to="/account/delete-warning"
        className="block w-full py-3 px-4 text-center text-[13px] text-red-400 hover:text-red-500 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-colors"
      >
        {t('accountSettings.deleteAccount', { defaultValue: '회원 탈퇴' })}
      </Link>
    </div>
  )
}

// ─── 프로필 편집 모달 ──────────────────────────────
export function ProfileEditModal({ isOpen, onClose, initial, onSaved }: {
  isOpen: boolean
  onClose: () => void
  initial: { name: string; phone: string }
  onSaved: (updated: { name: string; phone: string }) => void
}) {
  const { t } = useTranslation()
  useEscapeKey(() => { if (isOpen) onClose() })
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (isOpen) setForm(initial) }, [isOpen, initial])

  if (!isOpen) return null

  async function save() {
    if (!form.name.trim()) { toast.error(t('accountSettings.nameRequired', { defaultValue: '이름을 입력해주세요' })); return }
    setLoading(true)
    try {
      const res = await api.patch('/api/auth/profile', { name: form.name.trim(), phone: form.phone.trim() })
      if (res.data.success) {
        localStorage.setItem('user_name', form.name.trim())
        onSaved({ name: form.name.trim(), phone: form.phone.trim() })
        onClose()
        toast.success(t('accountSettings.profileUpdated', { defaultValue: '프로필이 업데이트되었습니다' }))
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || t('accountSettings.updateFailed', { defaultValue: '업데이트 실패' }))
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[10100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl w-full max-w-md p-6 shadow-2xl mb-16 sm:mb-0" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('accountSettings.editProfile', { defaultValue: '프로필 수정' })}</h3>
          <button onClick={onClose} aria-label="닫기"><X className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              {t('accountSettings.editName', { defaultValue: '이름' })} <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="account-name" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] border border-gray-300 dark:border-[#2A2A2A] rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              placeholder={t('accountSettings.editNamePlaceholder', { defaultValue: '홍길동' })}
            />
          </div>
          <div>
            <label htmlFor="account-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              {t('accountSettings.editPhone', { defaultValue: '전화번호' })}
            </label>
            <input
              id="account-phone" type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] border border-gray-300 dark:border-[#2A2A2A] rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              placeholder="010-0000-0000"
            />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              기프티쇼 교환권 MMS 발송 / 알림톡 발송 용도. 회원 탈퇴 시까지 보유.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#2A2A2A] transition-colors">
            {t('accountSettings.editCancel', { defaultValue: '취소' })}
          </button>
          <button onClick={save} disabled={loading} className="flex-1 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50">
            {loading ? t('accountSettings.saving', { defaultValue: '저장 중...' }) : t('accountSettings.save', { defaultValue: '저장' })}
          </button>
        </div>
      </div>
    </div>
  )
}
