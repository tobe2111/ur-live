import { ChevronLeft } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { useSafeBack } from '@/hooks/useSafeBack'
import { createElement, type ReactNode } from 'react'
import { REFUND_BODY, REFUND_CLS, REFUND_COPY, type RefundNode } from '@/shared/refund-policy-content'

/** 💸 2026-11-18 — 문구 트리(`REFUND_BODY`)를 그대로 그린다. 회사 값(`COMPANY`)·유효기간(`VOUCHER_VALIDITY_LABEL`)은 그 파일이 읽는다. */
function renderRefundNode(n: RefundNode, key: number): ReactNode {
  if (typeof n === 'string') return n
  return createElement(n.tag, { key, className: n.cls }, ...n.kids.map((k, i) => renderRefundNode(k, i)))
}

export default function RefundPolicyPage() {
  const goBack = useSafeBack('/')
  const { t } = useTranslation()

  return (
    <div className={REFUND_CLS.root}>
      {/* 🔗 url 을 `/refund-policy` → `/refund` 로 정정: 전자는 2026-07-29 부터 서버 301 별칭이라 canonical 이 리다이렉트를 가리키고 있었다. */}
      <SEO title={t('refundPolicy.seoTitle', { defaultValue: CONSUMER_SURFACE_SEO['/refund'].title })} description={t('refundPolicy.seoDesc', { defaultValue: CONSUMER_SURFACE_SEO['/refund'].description })} url="/refund" />

      {/* Header */}
      {/* 🩸 2026-10-13 — 토큰 이행에서 `bg-white/90 dark:bg-[#11141C]/90` 를 `bg-warm/90` 으로
          바꿨더니 **CSS 가 아예 안 나왔다**(`check-ghost-classes` 가 잡았다). `--bg` 는 hex 를 담은
          var() 라 Tailwind 가 알파를 합성하지 못한다 — 머리줄이 통째로 투명해진다.
          `CuratorEarningsPage` 가 같은 자리에서 남긴 처방대로 **불투명 면**으로 간다:
          페이지는 `bg-warm`, 머리줄은 `bg-surface` 라 두 면이 맞닿는 것 자체가 구분이 된다
          (불투명하면 `backdrop-blur` 는 보이는 일이 없으므로 함께 뺀다). 클래스는 `REFUND_CLS.header`. */}
      <div className={REFUND_CLS.header}>
        <div className={REFUND_CLS.headerRow}>
          <button onClick={goBack} aria-label={REFUND_COPY.back} className={REFUND_CLS.back}>
            <ChevronLeft className={REFUND_CLS.backIcon} />
          </button>
          <h1 className={REFUND_CLS.title}>{REFUND_COPY.title}</h1>
          <div className={REFUND_CLS.spacer} />
        </div>
      </div>

      {/* Content — 문구·구조 SSOT `shared/refund-policy-content.ts`(서버 첫 화면 `worker/utils/legal-first-screen.ts` 와 한 벌) */}
      <div className={REFUND_CLS.content}>{REFUND_BODY.map((n, i) => renderRefundNode(n, i))}</div>
    </div>
  )
}
