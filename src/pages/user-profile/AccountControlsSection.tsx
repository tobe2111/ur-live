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
  Bell, Mail, X,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatPhone } from '@/utils/format-phone'

// 🏭 2026-06-05 (사용자 요청): 버전 = v1.0.<커밋수> — 배포마다 숫자가 올라감(vite define __APP_VERSION__).
//   빌드 줄은 디버깅용 날짜+해시(__BUILD_VERSION__) 유지.
const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0')
const BUILD_VERSION = (typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : '')
const BUILD_HASH = BUILD_VERSION

// ─── 알림 토글 섹션 ──────────────────────────────
// 🛡️ 2026-06-12 (감사 1단계 — 실동작화): localStorage 전용 → 서버 연동.
//   GET/PATCH /api/account/notification-prefs (users.push_enabled/email_enabled).
//   localStorage 는 초기값 캐시로만 — 토글은 낙관 업데이트 + 실패 시 롤백.
export function NotificationToggleSection() {
  const { t } = useTranslation()
  const [notif, setNotif] = useState<{ push: boolean; email: boolean }>(() => {
    try {
      const s = localStorage.getItem('notif_settings')
      return s ? JSON.parse(s) : { push: true, email: true }
    } catch { return { push: true, email: true } }
  })

  useEffect(() => {
    let cancelled = false
    api.get('/api/account/notification-prefs')
      .then(res => {
        if (cancelled || !res.data?.success || !res.data.data) return
        const next = { push: res.data.data.push !== false, email: res.data.data.email !== false }
        setNotif(next)
        try { localStorage.setItem('notif_settings', JSON.stringify(next)) } catch { /* quota */ }
      })
      .catch(() => { /* 미로그인/네트워크 오류 — localStorage 캐시 유지 */ })
    return () => { cancelled = true }
  }, [])

  async function toggle(key: 'push' | 'email') {
    const prev = notif
    const next = { ...notif, [key]: !notif[key] }
    // 낙관 업데이트
    setNotif(next)
    try { localStorage.setItem('notif_settings', JSON.stringify(next)) } catch { /* quota */ }
    try {
      await api.patch('/api/account/notification-prefs', { [key]: next[key] })
    } catch {
      // 실패 롤백
      setNotif(prev)
      try { localStorage.setItem('notif_settings', JSON.stringify(prev)) } catch { /* quota */ }
      toast.error(t('accountSettings.notifSaveFailed', { defaultValue: '알림 설정 저장에 실패했습니다' }))
    }
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
        className={`relative w-[44px] h-[24px] rounded-full transition-colors duration-200 shrink-0 ${value ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-white/[0.15]'}`}
      >
        <span className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white dark:bg-[#11141C] rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('accountSettings.sectionNotification', { defaultValue: '알림 설정' })}</p>
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1D1F29]">
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

  /**
   * 📱 2026-09-07 (대표 *"앱 정보 부분에 지금 디자인? 너무 별로야. 그냥 줄글로 보여주면 되는데"* → 시안 "안 2").
   *
   * 종전엔 [섹션 라벨 + 흰 카드 + 구분선 3줄] 이었다. 문제는 카드 자체가 아니라 **바로 위와의 낙차**다 -
   * 이 위는 이미 11px 잔글씨 한 줄(고객센터/공지/약관, 평일 10:00~18:00)인데 거기서 갑자기 카드가 섰다.
   * 게다가 그 세 줄 중 **행동이 있는 줄은 하나**이고 그 행동은 새 버전이 있을 때만 의미가 있다
   * ⇒ 95% 의 시간 동안 빈 무게였다.
   *
   * 그리고 이건 취향이 아니라 이미 정해 둔 규칙이다(CLAUDE.md 🎫 표면 규칙):
   *   ⑥ "섹션 라벨 0" 이 `앱 정보` 라벨을 금지하고, ③ "숫자가 주인공" 은 이 자리에 주인공이 될 숫자가
   *   없다고 말한다. 이 파일의 2026-09-02 주석도 대표 지시를 *"버전 표기는 찾을 수 있으면 되는 정보"* 로
   *   적어 뒀는데, 카드는 찾을 수 있게 하는 것을 넘어 **보라고** 말하고 있었다.
   *
   * ⇒ 평소엔 잔글씨 두 줄. **업데이트가 있을 때만** 파란 버튼이 선다 - 그때가 이 영역이 존재하는
   *   유일한 순간이기 때문이다. 상태 줄은 **이미 하고 있는 조회**(마운트 시 `/api/version`)의 결과를
   *   그대로 말하는 것이라 새 요청이 0 이다.
   *
   * ⚠️ 값을 `v1.4.2 (가운뎃점) 3f01ed7 (가운뎃점) 최신` 처럼 **띄어 쓴 가운뎃점으로 잇지 않는다** -
   *   `check-middle-dot-chain` 래칫이 막는 형태다. 괄호와 줄바꿈으로 나눈 이유가 그것이다.
   */
  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      <p className="text-[11px] text-gray-400 dark:text-white/30 text-center tabular-nums">
        {t('accountSettings.appName', { defaultValue: '유어딜' })} v{APP_VERSION}
        {BUILD_HASH && <span className="font-mono"> ({BUILD_HASH})</span>}
      </p>

      {loading ? (
        <p className="mt-1 text-[11px] text-gray-500 dark:text-white/40 text-center">
          {t('accountSettings.checking', { defaultValue: '확인 중…' })}
        </p>
      ) : hasUpdate ? (
        <>
          <p className="mt-1 text-[11px] font-semibold text-brand-text text-center">
            {t('accountSettings.updateAvailable', { defaultValue: '새 버전이 나왔어요' })}
          </p>
          <button
            type="button"
            onClick={handleUpdate}
            className="mt-3 w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold transition-colors"
          >
            {t('accountSettings.updateNow', { defaultValue: '지금 업데이트' })}
          </button>
        </>
      ) : isLatest ? (
        <p className="mt-1 text-[11px] text-gray-500 dark:text-white/40 text-center">
          {t('accountSettings.isLatest', { defaultValue: '최신 버전이에요' })}
        </p>
      ) : (
        /* 조회 실패이거나 로컬 빌드 기록이 아직 없다 - **"최신" 이라고 말하면 안 된다.** */
        <p className="mt-1 text-center">
          <button
            type="button"
            onClick={handleCheck}
            className="text-[11px] text-gray-500 dark:text-white/40 underline underline-offset-4 decoration-gray-300 dark:decoration-white/20 active:text-gray-800 dark:active:text-white/75"
          >
            {checking
              ? t('accountSettings.checking', { defaultValue: '확인 중…' })
              : t('accountSettings.checkLatest', { defaultValue: '최신 버전인지 확인' })}
          </button>
        </p>
      )}
    </div>
  )
}

// ─── 계정 탈퇴 링크 ──────────────────────────────
// 🧹 2026-06-22 (대표 — 로그아웃↔탈퇴 간격 정합): 자체 mt-8/mb-6 래퍼 제거 →
//   부모(로그아웃 블록)의 space-y 흐름에 들어가 로그아웃과 동일 간격으로 정렬.
export function DeleteAccountLink() {
  const { t } = useTranslation()
  return (
    <Link
      to="/account/delete-warning"
      className="block w-full py-3 px-4 text-center text-[12px] text-gray-500 dark:text-white/40 hover:text-red-500 underline underline-offset-4 decoration-gray-300 dark:decoration-white/20 transition-colors"
    >
      {t('accountSettings.deleteAccount', { defaultValue: '회원 탈퇴' })}
    </Link>
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
    /**
     * 📞 2026-09-02 (대표 "프로필 수정에서 전화번호 입력은 필수로 둬줘")
     *
     * 이 서비스에서 전화번호는 선택 정보가 아니다 — 교환권은 **MMS 로 그 번호에 발송**되고
     * 이용권 사용·주문 안내도 알림톡으로 간다. 번호가 없으면 산 물건이 도착할 곳이 없다.
     * (교환권 결제 경로는 서버가 이미 `PHONE_REQUIRED` 로 막지만, 그건 **결제 순간**이라
     *  사용자는 계산대 앞에서야 알게 된다. 프로필에서 미리 받아 그 벽을 없앤다.)
     *
     * ⚠️ 형식까지 본다 — 빈칸만 막으면 "010" 한 글자로도 통과해 같은 문제가 남는다.
     *   `formatPhone` 이 하이픈을 넣으므로 하이픈 포함 010-0000-0000 형태를 받는다.
     */
    const phone = form.phone.trim()
    if (!phone) { toast.error(t('accountSettings.phoneRequired', { defaultValue: '전화번호를 입력해주세요 — 교환권·알림톡이 이 번호로 갑니다' })); return }
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) {
      toast.error(t('accountSettings.phoneInvalid', { defaultValue: '전화번호 형식을 확인해주세요 (010-0000-0000)' })); return
    }
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
      // 🛡️ 2026-05-24 React #31 fix: server 가 { error: { code, message } } 객체 반환 시
      //   string 으로 안전 추출 (이전: object 그대로 toast → React render 폭주).
      const ax = e as { response?: { data?: { error?: string | { code?: string; message?: string } } } }
      const errRaw = ax.response?.data?.error
      const errMsg = typeof errRaw === 'string' ? errRaw
        : (errRaw && typeof errRaw === 'object' && typeof errRaw.message === 'string') ? errRaw.message
        : t('accountSettings.updateFailed', { defaultValue: '업데이트 실패' })
      toast.error(errMsg)
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[10100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#11141C] rounded-2xl w-full max-w-md p-6 shadow-2xl mb-16 sm:mb-0" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
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
              className="w-full px-4 py-3 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none"
              placeholder={t('accountSettings.editNamePlaceholder', { defaultValue: '홍길동' })}
            />
          </div>
          <div>
            <label htmlFor="account-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              {t('accountSettings.editPhone', { defaultValue: '전화번호' })} <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="account-phone" type="tel" required inputMode="numeric" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
              maxLength={13}
              className="w-full px-4 py-3 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none"
              placeholder="010-0000-0000"
            />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              기프티쇼 교환권 MMS 발송 / 알림톡 발송 용도. 회원 탈퇴 시까지 보유.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 dark:bg-[#1D1F29] text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#2C2F35] transition-colors">
            {t('accountSettings.editCancel', { defaultValue: '취소' })}
          </button>
          <button onClick={save} disabled={loading} className="flex-1 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">
            {loading ? t('accountSettings.saving', { defaultValue: '저장 중...' }) : t('accountSettings.save', { defaultValue: '저장' })}
          </button>
        </div>
      </div>
    </div>
  )
}
