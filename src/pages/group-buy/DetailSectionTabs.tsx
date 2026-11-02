/**
 * 📑 이용권 상세 — 폰 구역 탭 (2026-11-02 대표 확정 상세 **C안 "탭형"**)
 *
 * 대표 원문: *"일단 지금 이용권 상세페이지 전체가 마음에 들지 않아 … 글자 크기들도 각각 너무 크고 공백이
 * 많은 느낌이야. 대기업 스러움이 필요한데"* → 시안 A/B/C 중 *"상세페이지 전체는 C안이 좋겠어"*.
 *
 * 머리(제목·가격) 바로 아래에 붙고, 내려가면 위 떠 있는 머리줄 밑에 **붙어 따라온다**(sticky).
 * 누르면 그 구역으로 내려가고, 지금 보고 있는 구역에 밑줄이 따라간다.
 *
 * ⚠️ 구역 id 는 PC 탭(`GroupBuyDetailPage` nav)과 **같은 것**을 쓴다 — 두 벌이면 언젠가 갈린다.
 *    PC 는 이 부품을 쓰지 않는다(`lg:hidden`) — PC 에는 기존 섹션 탭이 있다.
 */
import { useEffect, useState } from 'react'

export interface DetailSectionTab { id: string; label: string }

/** 떠 있는 머리줄(`DetailFloatingHeader`) 높이 — 위아래 0.625rem + 버튼 2.25rem, 노치가 있으면 그만큼. */
export const DETAIL_TABS_STICKY_TOP = 'calc(max(0.625rem, env(safe-area-inset-top)) + 2.875rem)'

export default function DetailSectionTabs({ tabs }: { tabs: DetailSectionTab[] }) {
  const [current, setCurrent] = useState(tabs[0]?.id ?? '')

  // 부모가 매번 새 배열을 넘겨도(폴링 리렌더) 구역이 같으면 관찰자를 다시 달지 않는다.
  const key = tabs.map((t) => t.id).join(',')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const els = tabs.map((t) => document.getElementById(t.id)).filter((e): e is HTMLElement => !!e)
    if (els.length === 0) return
    // 화면 위쪽(머리줄 + 탭 아래) 띠에 들어온 구역을 '지금' 으로 본다.
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (seen[0]) setCurrent(seen[0].target.id)
    }, { rootMargin: '-120px 0px -55% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (tabs.length < 2) return null

  return (
    <nav aria-label="상세 구역" className="lg:hidden sticky z-30 bg-[var(--gbd-bg)] shadow-[inset_0_-1px_0_var(--gbd-line2)]"
      style={{ top: DETAIL_TABS_STICKY_TOP }}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const on = t.id === current
          return (
            <button key={t.id} type="button" aria-current={on ? 'true' : undefined}
              onClick={() => { setCurrent(t.id); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
              className={`h-11 text-[15px] ${on ? 'font-bold' : 'font-medium'} bg-transparent border-0 cursor-pointer`}
              style={{ color: on ? 'var(--gbd-ink)' : 'var(--gbd-sub)', boxShadow: on ? 'inset 0 -2px 0 var(--gbd-ink)' : undefined }}>
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
