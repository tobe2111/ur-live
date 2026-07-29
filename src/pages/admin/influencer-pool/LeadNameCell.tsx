/**
 * 🏷️ 풀 목록의 **이름 칸** — 썸네일 + 이름 + 상태 배지들(점수·브랜드·거부·인바운드) + 플랫폼/핸들.
 *
 *   분리 이유: 배지는 신호가 하나 늘 때마다 한 줄씩 붙는 자리라(2026-07: 🏅점수 → 🏢브랜드 → 🚫거부)
 *   페이지 본문에 두면 god 파일 래칫(600줄)을 계속 밀어 올린다. 배지 = 표시 규칙이니 여기가 제자리다.
 *
 *   ⚠️ 배지 우선순위는 **강한 신호가 앞**: 거부 명시(본인 의사) > 브랜드 추정(우리 추정).
 */
import React from 'react'

/** 이 칸이 실제로 읽는 필드만 — 페이지의 Lead 타입에 구조적으로 호환된다(전체 타입 이동 불필요). */
export interface LeadNameCellLead {
  name: string
  url: string
  platform: string
  handle?: string | null
  thumbnail?: string | null
  lead_score?: number | null
  is_brand?: number | null
  opted_out?: number | null
  source?: string | null
}

const BADGE = 'ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium align-middle'

export const LeadNameCell = React.memo(function LeadNameCell(
  { lead: l, platformLabel }: { lead: LeadNameCellLead; platformLabel: Record<string, string> },
) {
  // 🐛 스킴 없는 옛 URL(blog.naver.com/..) 도 절대경로로 — 상대경로 404 방지
  const href = /^https?:\/\//i.test(l.url) ? l.url : `https://${(l.url || '').replace(/^\/+/, '')}`
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-gray-900 hover:underline">
      {l.thumbnail && <img src={l.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" />}
      <span>
        <span className="font-medium">{l.name}</span>
        {l.lead_score != null && (
          <span
            className={`${BADGE} font-bold ${l.lead_score >= 70 ? 'bg-emerald-100 text-emerald-700' : l.lead_score >= 45 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}
            title="리드 점수 0~100 — 연락가능성·규모적합도·활동성·카테고리핏 합산(야간 자동 채점)"
          >🏅{l.lead_score}</span>
        )}
        {/* 🚫 본인이 소개글에 "제안 사절"을 써 둔 사람 — 발송 큐에서 자동 제외된다(추정이 아니라 의사표시). */}
        {l.opted_out ? (
          <span className={`${BADGE} bg-rose-100 text-rose-700`}
            title="소개글에 제안 거부를 명시 — 연락하지 않습니다(발송 큐 자동 제외). 오탐이면 이 리드를 확인해 주세요."
          >🚫 제안거부</span>
        ) : null}
        {l.is_brand ? (
          <span className={`${BADGE} bg-gray-200 text-gray-600`}
            title="브랜드/기업 공식 채널 추정 — 인플루언서가 아닐 수 있음(노이즈 숨김에 포함)"
          >🏢 브랜드</span>
        ) : null}
        {l.source === 'inbound' && (
          <span className={`${BADGE} bg-violet-100 text-violet-700`} title="스스로 신청 · 사전동의">📥 신청</span>
        )}
        <span className="ml-1.5 text-xs text-gray-400">{platformLabel[l.platform] || l.platform}{l.handle ? ` · ${l.handle}` : ''}</span>
      </span>
    </a>
  )
})
