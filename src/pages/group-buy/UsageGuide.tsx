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
 *
 * ## 2026-10-11 — 접기 폐지 · STEP 타일 · 빈 값은 안 말한다 (대표 "D안 + C안 이용안내 형태, 고도화")
 *   ① 3단계를 **늘 펼친다**(타일 3장이라 짧다 — 접을 이유였던 길이가 사라졌다).
 *   ② `사용기한` 은 값이 있을 때만 한 줄로 말한다. 종전 폴백 *"발급 후 사용 기간 적용"* 은
 *      아무 정보도 없는 문장이었다(대표 지적 "부연설명이 많다").
 *   ③ `사용 방법: QR 제시 · 확인코드` 행 삭제 — 바로 위 타일이 같은 말을 한다.
 */
import { safeDate } from '@/utils/safe-date'
import { ClockIcon } from '@/components/icons/urdeal-icons'
import RedeemHowTo from './RedeemHowTo'

const DEFAULT_TERMS = [
  '현장에서 추가 할인이나 다른 쿠폰과 중복 적용되지 않아요.',
  '잔액은 환불되지 않으니 한 번에 사용하시길 권장해요.',
]

export default function UsageGuide({
  voucherExpiry, voucherTerms,
}: { voucherExpiry?: string | null; voucherTerms?: string | null }) {
  const expiry = voucherExpiry ? safeDate(voucherExpiry)?.toLocaleDateString('ko-KR') : null
  const terms = voucherTerms
    ? voucherTerms.split('\n').map(s => s.trim()).filter(Boolean)
    : DEFAULT_TERMS

  return (
    <div style={{ padding: '20px 16px' }}>
      <h2 className="m-0 text-[15px] font-bold tracking-[-.01em]" style={{ color: 'var(--gbd-ink)' }}>이용 안내</h2>
      {expiry && (
        <p className="mt-2 flex items-center gap-1 text-[13px]" style={{ color: 'var(--gbd-sub)' }}>
          <ClockIcon className="w-4 h-4" />
          <span><b className="font-medium" style={{ color: 'var(--gbd-ink)' }}>{expiry}</b>까지 사용</span>
        </p>
      )}
      <div className="mt-3"><RedeemHowTo /></div>

      {/* 📎 유의사항은 접는다(대표 확정 시안 1) — 손님이 매장 앞에서 보는 건 위 세 단계다.
          `<details>` 라 상태가 없고(JS 0), 접혀도 화면 읽기 프로그램은 요약 줄을 읽는다. */}
      <details className="group mt-4 pt-3" style={{ borderTop: '1px solid var(--gbd-line2)' }}>
        <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[15px] font-medium" style={{ color: 'var(--gbd-ink)' }}>
          유의사항
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform group-open:rotate-180" style={{ color: 'var(--gbd-sub2)' }}><path d="M6 9l6 6 6-6" /></svg>
        </summary>
        <ul className="mt-2 m-0 p-0 list-none flex flex-col gap-1">
          {terms.map((line, i) => (
            <li key={i} className="flex gap-2 items-start text-[13px] leading-[1.5]" style={{ color: 'var(--gbd-sub)' }}>
              <span aria-hidden className="shrink-0 w-1 h-1 rounded-full mt-2" style={{ background: 'var(--gbd-sub2)' }} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
