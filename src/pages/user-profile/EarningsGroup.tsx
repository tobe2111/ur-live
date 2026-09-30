/**
 * 🧭 2026-06-10 (UI 100점 패스 — 마이 최하점 원인): 수익·추천 카드 3연속 도배 → 접이식 그룹.
 *
 * 마이 첫 화면은 자산(딜 잔액·이용 내역) 중심이어야 하는데 프로모션성 카드가 점유하던 것을
 * 1탭 뒤로. 카드 컴포넌트/데이터 로직은 자식 그대로 — 표시 위계만 변경. 펼침 상태는 기억.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { WonCoinIcon } from '@/components/icons/urdeal-icons'
import { SectionTitle, FoldRow, rowIcon } from './list-grammar'

const LS_KEY = 'ur_my_earnings_open_v1'

export default function EarningsGroup({ children }: { children: ReactNode }) {
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
      <SectionTitle>수익 · 추천</SectionTitle>
      <FoldRow
        icon={rowIcon(WonCoinIcon)}
        label={t('my.earningsGroupTitle', { defaultValue: '내가 소개한 것' })}
        hint={t('my.earningsGroupSub', { defaultValue: '추천 적립 · 유어샵 수익 · 친구 초대' })}
        open={open}
        onToggle={toggle}
      />
      {open && <div>{children}</div>}
    </div>
  )
}
