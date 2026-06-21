import { REFERRAL_GROUP_DISCOUNT_DISABLED } from '@/shared/feature-flags'

export default function SiteFooter() {
  return (
    <footer className="px-4 pt-6 pb-6 bg-white dark:bg-[#020202] border-t border-gray-100 dark:border-[#1A1A1A]">
      <div className="flex flex-col gap-1.5 footer-tiny">
        {/* 🛡️ 2026-05-21: 역할별 진입 CTA — 사용자/사장님/셀러/에이전시 가입 직접 link.
              마이페이지의 CTA grid 와 동일 destination. */}
        <div className="flex flex-col gap-1 mb-3 text-[12px] font-semibold">
          {/* 🧭 2026-06-17: 그룹 referral(/referral) 숨김 — '공구 개최하기' CTA 비노출(플래그 false 면 복원). */}
          {!REFERRAL_GROUP_DISCOUNT_DISABLED && (
          <a href="/referral" className="text-pink-600 dark:text-pink-400 hover:underline">
            🤝 공구 개최하기 →
          </a>
          )}
          <a href="/seller/register/supplier" className="text-emerald-600 dark:text-emerald-400 hover:underline">
            🏪 사장님이세요? 가게 입점 →
          </a>
          <a href="/seller/register/business" className="text-blue-600 dark:text-blue-400 hover:underline">
            🎤 셀러로 시작 →
          </a>
          <a href="/agency/register/business" className="text-violet-600 dark:text-violet-400 hover:underline">
            🤵 에이전시 사업 시작 →
          </a>
          {/* 🛡️ 2026-06-04 도매몰 진입 플로우: 통합 소개 허브(/wholesale/intro)로 — 제조사 입점·유통사 가입 분기. */}
          <a href="/wholesale/intro" className="text-amber-600 dark:text-amber-400 hover:underline">
            📦 유통스타트 B2B 도매몰 (제조사·유통사) →
          </a>
        </div>

        {/* Contact */}
        <p className="text-gray-500 dark:text-gray-400">
          제휴 | 입점 문의 : <a href="/partnership" className="underline">광고/제휴 문의하기</a> · jiwon@ur-team.com
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
          <p>사업장주소: 서울특별시 강남구 남부순환로359길 14, 3층(도곡동)</p>
          <p>대표이메일: jiwon@ur-team.com</p>
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
