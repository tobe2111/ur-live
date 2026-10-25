/**
 * 🛡️ 2026-05-24: /account/settings 와 /user/profile 통합 — 사용자 요청.
 *   AccountSettingsPage 에 있던 unique 항목들을 통합:
 *   - 알림 설정 (push / email toggle)
 *   - 프로필 편집 모달 (이름 / 전화번호)
 *   - 앱 버전 + 캐시 초기화
 *   - 계정 탈퇴 링크
 *
 * 🧹 2026-10-11 — `ProfileEditModal`(이름·전화번호·사진)은 여기서 **제거**됐다. 대표 확정 A-2 로
 *   사람에 관한 설정이 `user-profile/profile-edit/ProfileEditSheet.tsx` **한 곳**으로 모였다.
 *   ⚠️ 되살리지 말 것 — 두 곳이 되면 그게 A-2 를 하게 만든 실제 결함(이름이 두 곳)이다.
 *   그리고 옛 모달은 이름을 `PATCH /api/auth/profile` 로 보내 **공개 유어샵 캐시를 purge 하지
 *   않았다**(남들에겐 한동안 옛 이름). 새 시트는 `curator/me/profile` 로 보낸다.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import { BellIcon, MailIcon } from '@/components/icons/urdeal-icons'
import api from '@/lib/api'
import { ROW_SHELL_CLS, ROW_LABEL_CLS } from './list-grammar'
import { toast } from '@/hooks/useToast'

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

  /**
   * 🔵 2026-09-30 — **평면 줄**(안 C). 종전엔 흰 판(`rounded-2xl bg-surface`) 안에 13px 행이었는데,
   *   설정 구역이 펼쳐지면서 바로 위 `내가 산 것` 목록과 **문법이 갈린** 것이 드러났다.
   *   치수·라벨은 `list-grammar` 에서 온다 — 손으로 적으면 또 갈린다.
   */
  const Toggle = ({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: () => void }) => (
    <div className={ROW_SHELL_CLS}>
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{icon}</span>
      <span className={ROW_LABEL_CLS}>{label}</span>
      <button
        type="button"
        onClick={onChange}
        aria-pressed={value}
        aria-label={value ? `${label} 끄기` : `${label} 켜기`}
        className={`relative w-[44px] h-[24px] rounded-full transition-colors duration-200 shrink-0 ${value ? 'bg-brand' : 'bg-gray-200 dark:bg-white/[0.15]'}`}
      >
        <span className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white dark:bg-[#11141C] rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  return (
    /* 🧱 가로 패딩 없음 — 줄이 자기 `px-4` 를 갖는다(구역 제목과 왼쪽 끝이 맞는다).
       라벨('알림 설정')도 없앴다: 구역 제목이 이미 `설정 · 고객지원` 이라, 12px 라벨을 두면
       한 화면에 제목 층이 셋이 된다(17 구역, 12 그룹, 15 행 — `list-grammar` 가 경고한 그것). */
    <div className="ur-content-medium lg:px-4">
      <div>
        <Toggle
          icon={<BellIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
          label={t('accountSettings.togglePush', { defaultValue: '푸시 알림' })}
          value={notif.push}
          onChange={() => toggle('push')}
        />
        <Toggle
          icon={<MailIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
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
    }
  }, [])

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
  /**
   * 🧹 2026-10-18 (대표 *"나머지 다 가장 이상적으로"*) — **개발자용 표시를 걷었다.**
   *   종전 두 줄은 `유어딜 v1.0.676 (20261018.0940)` + `최신 버전인지 확인`(또는 `최신 버전이에요`)이었다.
   *   ① 괄호 속 빌드 번호는 사람이 읽을 값이 아니다 — 고객센터가 물을 때는 `v1.0.676` 이면 충분하다.
   *      (빌드 번호가 필요한 사람을 위해 `title` 로만 남긴다 — 눌러 길게 보면 나온다.)
   *   ② "확인" 버튼은 **이미 자동으로 하는 일**을 사람에게 시켰다 — `version-check` 가 5분마다·탭 복귀마다
   *      새 배포를 확인해 화면 위에 새로고침 배너를 띄운다(`NewVersionBanner`). 상태 문구도 같은 이유로 뺐다.
   *   ⇒ 평소엔 **버전 한 줄**뿐이다. 새 버전이 확인됐을 때만 파란 버튼이 선다(종전 그대로 — 그때가 이
   *     영역이 존재하는 유일한 순간이다).
   *
   * ⚠️ 값을 `v1.4.2 (가운뎃점) …` 처럼 **띄어 쓴 가운뎃점으로 잇지 않는다**(`check-middle-dot-chain`).
   */
  return (
    /* 📐 2026-10-18 (대표 *"다 해줘"*): **왼쪽 정렬 + 자기 가로 여백 없음.** 이 부품은 마이 맨 아래 묶음 안에서만
       쓰이고 그 묶음이 이미 `px-4` 를 갖는다 — 여기서 또 주면 왼쪽으로 맞췄을 때 16px 들여쓰인다. 종전엔
       가운데 정렬이라 그 이중 여백이 안 보였을 뿐이다. 위의 고객센터 링크 줄(왼쪽)과 같은 선에 선다. */
    <div className="pt-4">
      <p className="text-[12px] text-gray-400 dark:text-white/30 tabular-nums" title={BUILD_HASH || undefined}>
        {t('accountSettings.appName', { defaultValue: '유어딜' })} v{APP_VERSION}
      </p>

      {hasUpdate && (
        <>
          <p className="mt-1 text-[12px] font-medium text-brand-text">
            {t('accountSettings.updateAvailable', { defaultValue: '새 버전이 나왔어요' })}
          </p>
          <button
            type="button"
            onClick={handleUpdate}
            className="mt-3 w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-[15px] font-bold transition-colors"
          >
            {t('accountSettings.updateNow', { defaultValue: '지금 업데이트' })}
          </button>
        </>
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
      className="inline-block py-2 text-[12px] text-gray-500 dark:text-white/40 hover:text-red-500 underline underline-offset-4 decoration-gray-300 dark:decoration-white/20 transition-colors"
    >
      {t('accountSettings.deleteAccount', { defaultValue: '회원 탈퇴' })}
    </Link>
  )
}
