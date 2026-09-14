/**
 * 🎟️ 이용 안내 — 스펙표 + 접히는 3단계 + 유의사항 (2026-09-14 대표 확정 "안 B")
 *
 * ## 왜 추출했나
 * 대표가 시안에서 안 B 를 골랐고 그 항목 중 하나가 **"이용 안내 3단계 접기"** 다. 그런데
 * `GroupBuyDetailPage.tsx` 는 파일크기 래칫에 **여유가 0**(944 / baseline 944)이라 한 줄도 못 늘린다.
 * 그래서 고치면서 옮긴다 — 이 블록은 상태도 데이터 조회도 없는 순수 표시라 가장 깨끗하게 떨어진다.
 *
 * ## 무엇이 달라졌나
 *   ① `사용처` 행 제거 — 매장명이 제목 위·셀러 카드·위치 카드에서 이미 세 번 나온다(4회차였다)
 *   ② `RedeemHowTo`(3단계)를 **기본 접기** — 처음 사는 사람에겐 필요하지만 늘 펼쳐 두면
 *      그 아래 유의사항·리뷰가 화면 밖으로 밀린다. 접어도 한 번 누르면 그대로 나온다.
 *
 * ⚠️ **접기이지 삭제가 아니다.** 2026-09-04 에 대표가 *"사용방법을 더 자세히"* 해서 만든 블록이고
 * (QR 이 안 될 때 확인코드를 물어보는 길), 지우면 매장에서 막힌 손님이 갈 곳이 없어진다.
 */
import { useState } from 'react'
import { safeDate } from '@/utils/safe-date'
import RedeemHowTo from './RedeemHowTo'

const DEFAULT_TERMS = [
  '현장에서 추가 할인이나 다른 쿠폰과 중복 적용되지 않아요.',
  '잔액은 환불되지 않으니 한 번에 사용하시길 권장해요.',
]

export default function UsageGuide({
  voucherExpiry, voucherTerms,
}: { voucherExpiry?: string | null; voucherTerms?: string | null }) {
  const [howToOpen, setHowToOpen] = useState(false)

  const rows = [
    { k: '사용기한', v: voucherExpiry ? `${safeDate(voucherExpiry)?.toLocaleDateString('ko-KR') ?? ''} 까지` : '발급 후 사용 기간 적용' },
    { k: '사용 방법', v: 'QR 제시 · 확인코드' },
  ]
  const terms = voucherTerms
    ? voucherTerms.split('\n').map(s => s.trim()).filter(Boolean)
    : DEFAULT_TERMS

  return (
    <div style={{ padding: '22px 18px' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>이용 안내</div>
      <div style={{ marginTop: 15 }}>
        {rows.map((row, i, arr) => (
          <div key={row.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderTop: '1px solid var(--gbd-line2)', borderBottom: i === arr.length - 1 ? '1px solid var(--gbd-line2)' : 'none' }}>
            <span style={{ fontSize: 13.5, color: 'var(--gbd-sub)', whiteSpace: 'nowrap' }}>{row.k}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gbd-ink)' }}>{row.v}</span>
          </div>
        ))}
      </div>

      {/* 접기 트리거 — 펼침 상태를 꺾쇠 회전으로 말한다(글자로 '펼치기/접기' 를 바꾸지 않는다). */}
      <button
        type="button"
        onClick={() => setHowToOpen(v => !v)}
        aria-expanded={howToOpen}
        style={{ marginTop: 18, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 0', background: 'transparent', border: 'none', borderTop: '1px solid var(--gbd-line2)', borderBottom: '1px solid var(--gbd-line2)', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--gbd-ink)' }}>매장에서 사용하는 방법</span>
        <span
          aria-hidden="true"
          style={{ flex: '0 0 auto', width: 8, height: 8, marginTop: howToOpen ? 3 : -3, borderRight: '1.7px solid var(--gbd-sub)', borderBottom: '1.7px solid var(--gbd-sub)', transform: howToOpen ? 'rotate(-135deg)' : 'rotate(45deg)', transition: 'transform .18s ease' }}
        />
      </button>
      {howToOpen && <RedeemHowTo hideTitle />}

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {terms.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ flex: '0 0 auto', width: 4, height: 4, borderRadius: '50%', background: 'var(--gbd-sub2)', marginTop: 8 }} />
            <span style={{ fontSize: 13, color: 'var(--gbd-sub)', lineHeight: 1.5 }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
