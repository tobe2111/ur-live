export default function SiteFooter() {
  return (
    <footer className="px-4 pt-6 pb-6 bg-white dark:bg-[#020202] border-t border-gray-100 dark:border-[#1A1A1A]">
      <div className="flex flex-col gap-1.5 footer-tiny">
        {/* 🛡️ 2026-05-21: 역할별 진입 CTA — 사용자/사장님/셀러/에이전시 가입 직접 link.
              마이페이지의 CTA grid 와 동일 destination. */}
        <div className="flex flex-col gap-1 mb-3 text-[12px] font-semibold">
          <a href="/referral" className="text-pink-600 dark:text-pink-400 hover:underline">
            🤝 공구 개최하기 →
          </a>
          <a href="/seller/register/supplier" className="text-emerald-600 dark:text-emerald-400 hover:underline">
            🏪 사장님이세요? 가게 입점 →
          </a>
          <a href="/seller/register/business" className="text-blue-600 dark:text-blue-400 hover:underline">
            📺 라이브 셀러로 시작 →
          </a>
          <a href="/agency/register/business" className="text-violet-600 dark:text-violet-400 hover:underline">
            🤵 에이전시 사업 시작 →
          </a>
        </div>

        {/* Contact */}
        <p className="text-gray-500 dark:text-gray-400">
          제휴 | 입점 문의 : jiwon@ur-team.com
        </p>

        {/* Links */}
        <div className="flex flex-wrap gap-x-1 text-gray-500 dark:text-gray-400">
          <a href="/terms" className="underline hover:text-white">서비스 이용약관</a>
          <span>|</span>
          <a href="/privacy" className="underline hover:text-white">개인정보처리방침</a>
          <span>|</span>
          <a href="/refund" className="underline hover:text-white">배송 및 환불 정책</a>
        </div>
        
        {/* Company Info */}
        <div className="flex flex-col gap-0.5 text-gray-500 dark:text-gray-400 leading-relaxed">
          <p>상호명: 리스터코퍼레이션 | 대표자: 정지원</p>
          <p>사업자등록번호: 479-09-02930 | 통신판매업신고: 2025-부산금정-0540</p>
          <p>사업장주소: 부산광역시 금정구 놀이마당로26 1402</p>
          <p>대표전화: 0507-0177-0432 | 대표이메일: jiwon@ur-team.com</p>
          <p>서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료</p>
        </div>
        
        {/* Copyright */}
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          © 2026 리스터코퍼레이션. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
