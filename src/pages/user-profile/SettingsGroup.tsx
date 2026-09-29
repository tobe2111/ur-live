/**
 * 🧹 2026-06-19 (대표 신고 — 마이 페이지 너무 번잡): 흩어진 설정 블록(알림/테마/언어/앱정보)을
 *   하나의 접이식 '설정' 그룹으로 합침. EarningsGroup 과 동일 패턴 — 자식 컴포넌트/데이터 로직 불변,
 *   표시 위계만 1탭 뒤로(기본 접힘). 설정은 자주 안 쓰므로 자산/이용내역이 먼저 보이도록.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsIcon } from '@/components/icons/urdeal-icons'
import { SectionTitle, FoldRow, rowIcon } from './list-grammar'

const LS_KEY = 'ur_my_settings_open_v1'

export default function SettingsGroup({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1' } catch { return false }
  })
  const toggle = () => {
    setOpen((v) => {
      try { localStorage.setItem(LS_KEY, v ? '0' : '1') } catch { /* quota */ }
      return !v
    })
  }
  return (
    /* 🔵 2026-09-29 (안 C): 접이식 **카드 버튼**(bg-surface 68px)이 **평면 펼침 줄**(48px)이 됐다.
       흰 판이 그 자체로 "파는 쪽" 표시자가 됐으므로(문법 머리말) 손님 구역의 판은 전부 걷는다.
       ⚠️ 접힘 자체는 그대로다 — 자식(토글·카드)은 페이지로 보낼 수 없어 *여기서* 열려야 한다.
       🧱 가로 패딩 없음: 줄이 자기 `px-4` 를 갖는다. */
    <div className="ur-content-medium lg:px-4">
      <SectionTitle>설정 · 고객지원</SectionTitle>
      <FoldRow
        icon={rowIcon(SettingsIcon)}
        label={t('my.settingsGroupTitle', { defaultValue: '설정 · 계정' })}
        hint={t('my.settingsGroupSub', { defaultValue: '알림 · 화면 테마 · 언어 · 앱 정보' })}
        open={open}
        onToggle={toggle}
      />
      {open && <div>{children}</div>}
    </div>
  )
}
