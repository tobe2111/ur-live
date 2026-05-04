// Mobile Footer Component - v2.0
export default function MobileFooter() {
  return (
    <footer className="bg-gray-50 dark:bg-[#121212] border-t border-gray-200 dark:border-[#2A2A2A] py-4 px-4 mt-8">
      {/* Contact */}
      <div className="mb-3">
        <p style={{ fontSize: '9px', lineHeight: '1.2' }} className="text-gray-600 dark:text-gray-300 text-center">
          제휴 | 입점 문의 : <a href="mailto:jiwon@ur-team.com" className="text-purple-600 hover:underline">jiwon@ur-team.com</a>
        </p>
      </div>

      {/* Links */}
      <div className="flex justify-center gap-1.5 mb-3 flex-wrap">
        <a href="/terms" style={{ fontSize: '8px', lineHeight: '1.2' }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700">서비스 이용약관</a>
        <span style={{ fontSize: '8px' }} className="text-gray-500 dark:text-gray-400">|</span>
        <a href="/privacy" style={{ fontSize: '8px', lineHeight: '1.2' }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700">개인정보처리방침</a>
        <span style={{ fontSize: '8px' }} className="text-gray-500 dark:text-gray-400">|</span>
        <a href="/refund" style={{ fontSize: '8px', lineHeight: '1.2' }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700">배송 및 환불 정책</a>
      </div>

      {/* Company Info */}
      <div className="space-y-0.5 text-center">
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">상호명: 리스터코퍼레이션 | 대표자: 정지원</p>
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">사업자등록번호: 479-09-02930 | 통신판매업신고: 2025-부산금정-0540</p>
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">사업장주소: 부산광역시 금정구 놀이마당로26 1402</p>
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">대표전화: 0507-0177-0432 | 대표이메일: jiwon@ur-team.com</p>
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료</p>
      </div>

      {/* Copyright */}
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-[#2A2A2A]">
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-500 dark:text-gray-400 text-center">
          © 2026 리스터코퍼레이션. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
