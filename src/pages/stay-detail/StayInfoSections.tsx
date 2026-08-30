/**
 * 🏨 숙소 상세 — 본문 섹션 (제목 · 시설 · 안내표)
 *
 * ## 왜 뺐나 (2026-08-30 대표 "AI 티 안나는 디자인으로")
 * 숙소 상세는 **모든 블록이 같은 무게의 흰 라운드 카드**였다 — 날짜 박스, 시설 3칸, 객실,
 * 위치, 취소 정책이 전부 `bg-white border rounded-xl p-4 shadow-sm`. 카드가 리듬을 균일하게
 * 만들면 눈이 어디를 먼저 볼지 못 고르고, 그게 "자동 생성된 화면" 처럼 읽히는 가장 큰 원인이다.
 * 같은 레포의 공구 상세(`GroupBuyDetailPage`)는 이미 이걸 벗어나 있었다 — **헤어라인 스펙표**와
 * 16px/800 섹션 제목. 숙소만 뒤처져 있어서 여기로 맞춘다(두 상세가 갈리는 것도 그 자체로 티가 난다).
 *
 * ## 규칙
 * - 섹션 제목은 한 종류(`SectionTitle`) — 15px 는 본문과 안 갈리고, 13px 굵게는 위계가 없다.
 * - 시설은 **카드가 아니다**. 아이콘+낱말이 문장처럼 흐른다(야놀자·여기어때가 그렇게 한다).
 *   3분할 카드로 감싸면 "무료 주차" 세 글자에 테두리 하나를 쓰는 셈이라 화면이 시끄러워진다.
 * - 안내는 **헤어라인으로 나뉜 라벨+본문 블록**. 카드 세 장(취소/하우스룰/체크인)을 대신한다.
 *
 * ⚠️ 여기서 이모지 아이콘(📋 🔑 🛡️)을 쓰지 말 것. 되돌아오면 그 자리만 톤이 튄다.
 */
import React from 'react'

/** 섹션 제목 — 상세 페이지 전체에서 이것 하나만 쓴다(공구 상세 16/800/-.02em 와 동일 스펙). */
export function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-[16px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white ${className}`}>
      {children}
    </h2>
  )
}

/**
 * 시설 — 아이콘 + 낱말이 줄바꿈되며 흐른다. 카드·테두리 없음.
 * `items` 는 이미 아이콘이 매핑된 상태로 받는다(아이콘 매핑 SSOT 는 StayDetailPage.amenityMeta).
 */
export function AmenityFlow({ items }: { items: Array<{ key: string; label: string; icon: React.ReactNode }> }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2.5">
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1.5 text-[13.5px] text-gray-700 dark:text-gray-300">
          {it.icon}
          {it.label}
        </span>
      ))}
    </div>
  )
}

/**
 * 라벨이 위, 값이 아래로 떨어지는 안내 블록.
 * ⚠️ 라벨↔값을 한 줄에 좌우 정렬하는 표 형태도 만들어 봤는데 숙소에선 안 맞았다 —
 *    "체크인 48시간 전 100% 환불 · 24시간 전 50% 환불" 처럼 값이 길면 라벨과 뭉개지고
 *    화면 끝까지 밀린다(실제로 그렇게 렌더됐다). 값이 한 줄을 넘길 성질이면 이 형태다.
 *    값이 짧은 스펙표가 필요하면 공구 상세 '이용 안내'(GroupBuyDetailPage)를 볼 것.
 */
export function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-200 dark:border-[#2C2F35] pt-3.5 mt-3.5 first:mt-0">
      <div className="text-[13px] text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1.5 text-[14px] leading-relaxed text-gray-900 dark:text-white">{children}</div>
    </div>
  )
}
