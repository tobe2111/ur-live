// Mobile Footer Component - v2.0
export default function MobileFooter() {
  return (
    <footer className="bg-gray-50 dark:bg-[#1A1C21] border-t border-gray-200 dark:border-[#2C2F35] py-4 px-4 mt-8">
      {/* Contact */}
      <div className="mb-3">
        <p style={{ fontSize: '9px', lineHeight: '1.2' }} className="text-gray-600 dark:text-gray-300 text-center">
          제휴 | 입점 문의 : <a href="mailto:jiwon@ur-team.com" className="text-purple-600 hover:underline">jiwon@ur-team.com</a>
        </p>
      </div>

      {/* 🧭 2026-07-19 (대표 — "3개 페이지를 서비스 최하단 링크 버튼으로"): 소개 랜딩 3종 pill 버튼 */}
      <div className="flex justify-center gap-1.5 mb-3 flex-wrap">
        <a href="/about" className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-[#2C2F35] text-[10px] font-bold text-gray-700 dark:text-gray-200">서비스 소개</a>
        <a href="/partners" className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-[#2C2F35] text-[10px] font-bold text-gray-700 dark:text-gray-200">🏪 입점 안내</a>
        <a href="/creators" className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-[#2C2F35] text-[10px] font-bold text-gray-700 dark:text-gray-200">✨ 크리에이터 모집</a>
      </div>

      {/* Links (서비스 소개는 위 pill 버튼으로 승격 — 중복 제거) */}
      <div className="flex justify-center gap-1.5 mb-3 flex-wrap">
        <a href="/terms" style={{ fontSize: '8px', lineHeight: '1.2' }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">서비스 이용약관</a>
        <span style={{ fontSize: '8px' }} className="text-gray-500 dark:text-gray-400">|</span>
        <a href="/privacy" style={{ fontSize: '8px', lineHeight: '1.2' }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">개인정보처리방침</a>
        <span style={{ fontSize: '8px' }} className="text-gray-500 dark:text-gray-400">|</span>
        <a href="/refund" style={{ fontSize: '8px', lineHeight: '1.2' }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">배송 및 환불 정책</a>
      </div>

      {/* Company Info */}
      <div className="space-y-0.5 text-center">
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">상호명: 리스터코퍼레이션 | 대표자: 정지원</p>
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">사업자등록번호: 479-09-02930 | 통신판매업신고: 2025-부산금정-0540</p>
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">사업장주소: 서울특별시 강남구 남부순환로359길 14, 3층(도곡동)</p>
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">대표이메일: jiwon@ur-team.com</p>
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-600 dark:text-gray-300">서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료</p>
      </div>

      {/* Copyright */}
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-[#2C2F35]">
        <p style={{ fontSize: '7px', lineHeight: '1.3' }} className="text-gray-500 dark:text-gray-400 text-center">
          © 2026 리스터코퍼레이션. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
