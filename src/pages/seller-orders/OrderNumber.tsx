/**
 * 🔢 **주문번호 셀** — 짧은 번호를 크게, 전체 번호를 작게.
 *
 * 대표 신고 2026-09-21: *"주문번호 너무 복잡해"*. 셀러 표가 `GB-3-1789611467065` 를 통째로 그려서
 * 좁은 칸에서 `GB-3-` / `1789611467065` 로 **줄바꿈까지** 됐다(첨부 화면).
 *
 * 값 자체는 못 바꾼다 — 그건 토스가 아는 orderId 다(`shared/order-number-display` 머리말).
 * 그래서 **보는 법만** 바꾼다: 눈으로 찾는 건 짧은 쪽, 권위는 전체 쪽. 전체를 감추지 않는 이유도 거기 있다.
 */
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import { Check, Copy } from 'lucide-react'
import { shortOrderNo } from '@/shared/order-number-display'
// 🎬 2026-11-02 시안 7차 "번호 복사"(대표 "7차도 다 해주고") — 복사되면 번호 칸이 옅은 파랑으로 한 번 칠해졌다 빠지고, 체크가 톡 박힌다.
//   시안의 '한 칸씩 스침'은 번호가 한 덩어리 글자라 칸이 없어 한 번 칠하기로 했다.
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-copyno', `@keyframes ur-copyno { 0% { background-color: transparent; } 25% { background-color: var(--brand-tint); } 100% { background-color: transparent; } }@keyframes ur-copyok { 0% { transform: scale(.5); } 70% { transform: scale(1.2); } 100% { transform: none; } }.ur-copyno { border-radius: 4px; animation: ur-copyno .9s ease-out both; }.ur-copyok { animation: ur-copyok .3s cubic-bezier(.3,1.3,.5,1) both; }@media (prefers-reduced-motion: reduce){.ur-copyno,.ur-copyok{animation:none!important}}`)

interface Props {
  /** 저장된 전체 주문번호. */
  value: string
  /** 복사 버튼을 붙일지 — 상세 모달만 true(표에서는 행마다 버튼이 생겨 시끄럽다). */
  copyable?: boolean
}

export function OrderNumber({ value, copyable = false }: Props) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const short = shortOrderNo(value)
  const copyLabel = t('seller.copyOrderNumber', { defaultValue: '전체 주문번호 복사' })

  const copy = () => {
    // 클립보드가 막힌 환경(비-HTTPS·권한 거부)에서도 화면이 거짓말하지 않게 성공했을 때만 체크 표시.
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => { /* 복사 실패 — 전체 번호는 아래에 그대로 보이니 손으로 옮길 수 있다 */ })
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {/* 짧은 번호가 같은 값이면(이미 짧은 주문번호) 아래 줄과 중복이라 한 줄만 그린다 */}
        <span className={`font-mono text-sm font-semibold text-gray-900 tabular-nums${copied ? ' ur-copyno' : ''}`}>{short}</span>
        {copyable && (
          <button
            type="button"
            onClick={copy}
            title={copyLabel}
            aria-label={copyLabel}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            {copied ? <Check className="ur-copyok w-3.5 h-3.5 text-tone-ok" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {short !== value && (
        <p className="font-mono text-[11px] leading-tight text-gray-400 whitespace-nowrap">{value}</p>
      )}
    </div>
  )
}
