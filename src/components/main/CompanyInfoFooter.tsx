/**
 * 🏢 홈 맨 아래 회사 정보 — 2026-11-02 대표 확정
 *
 * 대표 *"마이페이지 맨 밑에도 엉성하고, 대신 홈 페이지 맨 밑에 회사 정보들을 넣어줘"* + NOL 앱 화면
 * *"이런 식으로"*. 시안·구조: `docs/design/home-footer-company-info-2026-11-02.md`.
 *
 * 구조(NOL 그대로): 옅은 회색 면(화면 끝까지) → 회색 워드마크 → 회사 정보 줄글 13px → 밑줄 링크 묶음
 * (개인정보처리방침만 진하게 — 13px 라 굵기 규칙 ⑨ 상 700 대신 500 + 진한 잉크) → 중개자 고지 → 얇은 선 → ©. SNS 줄은 **뺐다** — 우리 공식 계정이 확정돼
 * 있지 않다(지어내지 않는다).
 *
 * 🔴 **왜 폰 홈에 있어야 하나**: 사업자 정보(상호·대표·사업자번호·통신판매업 신고·주소·연락처·호스팅)는
 *   초기 화면에서 확인할 수 있게 표시할 의무가 있는데, 폰 홈엔 그게 **하나도 없었다**(PC 홈의 `SiteFooter` 에만).
 *   값은 `shared/company-info.ts` 한 곳에서 온다.
 *
 * 🧾 판 없음(2026-11-02 A안 평면) — 회색 면은 판이 아니라 **페이지 끝을 알리는 바탕**이다(NOL 과 같은 자리).
 */
import UrDealLogo from '@/components/brand/UrDealLogo'
import {
  COMPANY_INFO_LINES, COMPANY_LINKS, COMPANY_INTERMEDIARY_NOTICE, COMPANY_COPYRIGHT,
} from '@/shared/company-info'

export default function CompanyInfoFooter({ className = '' }: { className?: string }) {
  return (
    <footer
      data-company-info
      className={`bg-black/[0.03] dark:bg-white/[0.03] text-gray-500 dark:text-gray-400 ${className}`}
    >
      <div className="ur-content-wide px-5 lg:px-8 pt-10 pb-28 lg:pb-12">
        {/* 회색 워드마크 — 브랜드색이 아니라 회색(NOL). 로고 부품이 색을 강제하므로 투명도로 낮춘다. */}
        <div className="opacity-50 grayscale">
          <UrDealLogo size={20} />
        </div>

        {/* ⚠️ 전역 `p { font-size: clamp(…) }` 가 <p> 에 직접 크기를 박으므로 줄마다 text-[13px] 를 단다(SiteFooter 와 같은 이유). */}
        <div className="mt-5 space-y-1">
          {COMPANY_INFO_LINES.map((line) => (
            <p key={line} className="text-[13px] leading-relaxed">{line}</p>
          ))}
        </div>

        <nav aria-label="회사 정보 링크" className="mt-5 flex flex-wrap gap-x-3 gap-y-2">
          {COMPANY_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={`text-[13px] underline underline-offset-4 decoration-gray-300 dark:decoration-white/20 ${l.strong ? 'font-medium text-gray-900 dark:text-white' : ''}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <p className="mt-8 text-[12px] leading-relaxed">{COMPANY_INTERMEDIARY_NOTICE}</p>

        <div className="mt-8 pt-5 border-t border-rule">
          <p className="text-[13px]">{COMPANY_COPYRIGHT}</p>
        </div>
      </div>
    </footer>
  )
}
