/**
 * 🎟️ **이용권을 매장에서 어떻게 쓰나** (2026-09-04 대표 — *"사용방법을 더 자세히. QR 제시를 할 수도
 * 있고 PIN 입력 요청을 가게에 해야할 수도 있잖아"*).
 *
 * ## 🩸 그전엔 한 줄이었다
 * 상세의 이용 안내에 **`사용 방법: 매장에서 교환권 제시`** 만 있었다. 손님이 매장에 도착해서
 * *무엇을 꺼내 무엇을 눌러야 하는지*를 모른다 — 그 순간의 막힘은 그대로 사장님 응대 부담이 된다.
 *
 * ## 실제로 두 갈래다 (`redemption-settings.ts` · `self-redeem-gate.ts`)
 * | 모드 | 손님이 하는 일 |
 * |---|---|
 * | `scan_only` | QR 을 보여 주고 **직원이 스캔**한다. 손님은 혼자 못 누른다 |
 * | `store_code`(기본) | 손님이 앱에서 누르되 **매장 확인코드(4~6자리)** 를 매장에 물어 입력한다 |
 *
 * 🔑 **두 방식은 양자택일이 아니다.** 직원 QR 스캔(`/:code/use-by-seller`)은 셀프 게이트 **밖**이라
 *   모드와 무관하게 항상 열려 있다(`self-redeem-gate.ts` 주석). 그래서 손님 입장의 1순위는
 *   **언제나 "QR 보여 주기"** 이고, 확인코드는 직원이 스캔을 못 할 때의 길이다.
 *
 * ⚠️ 상세 API 는 상품별 모드를 안 내려준다(`group-buy-public.routes` 는 사용 시점에만 조회).
 *   그래서 **모드와 무관하게 참인 순서**로만 쓴다 — 없는 것을 아는 척하지 않는다.
 *   모드를 내려주게 되면 그때 분기하면 된다.
 *
 * ## 2026-10-11 — 세로 목록 → **STEP 타일 3장** (대표 확정 "D안 + C안의 이용안내 형태, 디자인 고도화")
 * 접힌 세로 목록은 눌러야 보였고, 펼치면 글이 길었다. 손님이 매장 앞에서 보는 건 **세 동작**뿐이라
 * 타일 3장(아이콘 · STEP · 한 줄)으로 늘 펼쳐 두고, 예외(스캔이 안 될 때)는 타일 아래 한 줄로 뺐다.
 * 순서·사실은 그대로다: 1순위는 언제나 QR, 확인코드는 스캔이 안 될 때의 길.
 *
 * ## 2026-10-11 (같은 날) — 타일 → **세로 타임라인** (대표 시안 6종 중 *"1번으로 진행해줘"*)
 * 번호 원을 세로선으로 잇고, "스캔이 안 되면?" 을 **2단계 바로 아래 갈래**로 붙였다 — 예외가 어느
 * 순간의 일인지가 자리로 읽힌다. 3단계 원은 옅게(끝났다는 표시), 1·2는 브랜드 면.
 */

import { useEffect, useRef } from 'react'
import { ScanIcon, OkIcon } from '@/components/icons/urdeal-icons'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 12차 ① (대표 "응 바꿔줘") — 한 줄 글자 → **그림 셋**(QR 열기 · 직원에게 · 사용 완료).
//   같은 날 #2089 C안의 '한 줄 흐름' 을 대표가 이 모양으로 바꿨다. 스크롤로 닿으면 원이 차례로 켜진다(한 번).
//   원은 늘 켜진 색으로 그려 두고 움직임만 회색에서 출발한다 — JS 가 늦거나 꺼져도 다 켜진 그림이 보인다.
injectMotionCss('ur-m-howto', `@keyframes ur-howto-c { 0% { background-color: transparent; transform: scale(.8); } 70% { transform: scale(1.08); } 100% { transform: none; } }@keyframes ur-howto-t { from { opacity: .35; } }.ur-howto-on .ur-howto-c { animation: ur-howto-c .4s cubic-bezier(.3,1.3,.5,1) backwards; animation-delay: calc(var(--i, 0) * 380ms); }.ur-howto-on .ur-howto-t { animation: ur-howto-t .3s ease backwards; animation-delay: calc(var(--i, 0) * 380ms); }.ur-howto-on .ur-howto-ar { animation: ur-howto-t .3s ease backwards; animation-delay: calc(var(--i, 0) * 380ms + 200ms); }@media (prefers-reduced-motion: reduce){.ur-howto-on .ur-howto-c,.ur-howto-on .ur-howto-t,.ur-howto-on .ur-howto-ar{animation:none!important}}`)

/** 각 단계: 제목(무엇을) + 한 줄(어디서·누가). */
const STEP_ICONS = [
  // 📦 QR 그림은 여기 따로 그린다 — `QrScanIcon` 을 불러오면 그 파일이 이 화면 묶음에 들어가고,
  //   같은 그림을 쓰는 마이(사용처리 칸)가 이 화면 묶음 통째(+20KB)를 받게 된다(2026-11-02 실측).
  <svg key="qr" viewBox="0 0 32 32" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9V5.4A2.4 2.4 0 0 1 5.4 3H9M23 3h3.6A2.4 2.4 0 0 1 29 5.4V9M29 23v3.6a2.4 2.4 0 0 1-2.4 2.4H23M9 29H5.4A2.4 2.4 0 0 1 3 26.6V23" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" /><rect x="18" y="8.5" width="5.5" height="5.5" rx="1" /><rect x="8.5" y="18" width="5.5" height="5.5" rx="1" />
    <g fill="currentColor" stroke="none"><rect x="18" y="18" width="2.2" height="2.2" rx=".5" /><rect x="21.3" y="21.3" width="2.2" height="2.2" rx=".5" /></g>
  </svg>,
  <ScanIcon key="scan" className="w-[22px] h-[22px]" />,
  <OkIcon key="ok" className="w-[22px] h-[22px]" />,
] as const
const STEPS: readonly { n: string; t: string; d: string }[] = [
  { n: '1', t: 'QR 열기', d: '마이 → 내 이용권' },
  { n: '2', t: '직원에게 보여주기', d: '직원이 스캔해요' },
  { n: '3', t: '사용 완료', d: '따로 누를 건 없어요' },
]

/** 스캔이 안 될 때의 길 — 매장 확인코드(4~6자리, `self-redeem-gate`)와 일치. 집에서 미리 쓸 수 없다. */
export const REDEEM_FALLBACK = '직원에게 4~6자리 확인코드를 받아 입력해요. 확인코드는 매장에서만 알려 드려요.'

/**
 * ## 2026-11-02 — 세로 타임라인 → **한 줄 흐름** (대표 확정 상세 C안 — *"글자 크기들도 각각 너무 크고 공백이 많은 느낌"*)
 * 세로 타임라인이 화면 반 가까이(라이브 실측 약 330px)를 먹었다. 세 동작은 그대로 두고
 * [단계 › 단계 › 단계] 한 줄 + 예외 한 줄로 접는다. 순서·사실(1순위 QR · 확인코드는 스캔이 안 될 때)은 불변.
 */
export default function RedeemHowTo() {
  // 처음엔 화면 밖이었다가 들어올 때만 켠다 — 처음부터 보이는 자리면 그대로 둔다.
  const ref = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    let first = true
    const io = new IntersectionObserver(([e]) => {
      if (first) { first = false; if (e.isIntersecting) io.disconnect(); return }
      if (e.isIntersecting) { el.classList.add('ur-howto-on'); io.disconnect() }
    }, { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div>
      <ol ref={ref} className="m-0 p-0 list-none flex items-start" style={{ color: 'var(--gbd-ink)' }}>
        {STEPS.map(({ n, t, d }, i) => (
          <li key={n} className="contents" style={{ '--i': i } as React.CSSProperties}>
            <div className="flex-1 min-w-0 text-center" style={{ '--i': i } as React.CSSProperties}>
              <span className="ur-howto-c mx-auto mb-2 w-12 h-12 rounded-full bg-brand-tint text-brand-text flex items-center justify-center" aria-hidden="true">{STEP_ICONS[i]}</span>
              <span className="ur-howto-t block text-[13px] font-medium">{t}</span>
              <span className="ur-howto-t block mt-1 text-[12px]" style={{ color: 'var(--gbd-sub)' }}>{d}</span>
            </div>
            {i < STEPS.length - 1 && <span aria-hidden className="ur-howto-ar shrink-0 mt-3 text-[17px]" style={{ color: 'var(--gbd-sub2)', '--i': i } as React.CSSProperties}>›</span>}
          </li>
        ))}
      </ol>
      <p className="mt-4 mb-0 text-[12px] leading-[1.5]" style={{ color: 'var(--gbd-sub)' }}>
        <b className="font-medium">스캔이 안 되면?</b> {REDEEM_FALLBACK}
      </p>
    </div>
  )
}
