import React from 'react'

export default function SiteFooter() {
  return (
    <footer className="px-4 py-6 bg-background border-t border-gray-200">
      <div className="flex flex-col gap-2.5">
        {/* Contact - 11px */}
        <p className="text-[11px] text-gray-600 font-medium">
          제휴 | 입점 문의 : jiwon@ur-team.com
        </p>
        
        {/* Links - 11px */}
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-gray-600">
          <a href="/terms" className="underline hover:text-gray-900">서비스 이용약관</a>
          <span className="text-gray-400">|</span>
          <a href="/privacy" className="underline hover:text-gray-900">개인정보처리방침</a>
          <span className="text-gray-400">|</span>
          <a href="/refund" className="underline hover:text-gray-900">배송 및 환불 정책</a>
        </div>
        
        {/* Company Info - 10px */}
        <div className="flex flex-col gap-1 text-[10px] text-gray-500 leading-relaxed">
          <p>상호명: 리스터코퍼레이션 | 대표자: 정지원</p>
          <p>사업자등록번호: 479-09-02930 | 통신판매업신고: 2025-부산금정-0540</p>
          <p>사업장주소: 부산광역시 금정구 놀이마당로26 1402</p>
          <p>대표전화: 0507-0177-0432 | 대표이메일: jiwon@ur-team.com</p>
          <p>서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료</p>
        </div>
        
        {/* Copyright - 10px */}
        <p className="text-[10px] text-gray-400 mt-1">
          © 2026 리스터코퍼레이션. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
