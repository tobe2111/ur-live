export function Footer() {
  return (
    <footer className="bg-secondary/50 px-5 py-6">
      <div className="space-y-3">
        {/* 제휴/입점 문의 */}
        <p className="text-gray-500" style={{ fontSize: "8px", lineHeight: "1.6" }}>
          제휴 | 입점 문의 : jiwon@ur-team.com
        </p>

        {/* 약관 링크 */}
        <div className="flex items-center gap-0 text-gray-500">
          <span className="underline underline-offset-2 cursor-pointer" style={{ fontSize: "8px", lineHeight: "1.6" }}>
            서비스 이용약관
          </span>
          <span className="mx-1.5" style={{ fontSize: "8px", lineHeight: "1.6" }}>|</span>
          <span className="underline underline-offset-2 cursor-pointer font-semibold" style={{ fontSize: "8px", lineHeight: "1.6" }}>
            개인정보처리방침
          </span>
          <span className="mx-1.5" style={{ fontSize: "8px", lineHeight: "1.6" }}>|</span>
          <span className="underline underline-offset-2 cursor-pointer" style={{ fontSize: "8px", lineHeight: "1.6" }}>
            배송 및 환불 정책
          </span>
        </div>

        {/* 사업자 정보 */}
        <div className="space-y-0.5 text-gray-500/70">
          <p style={{ fontSize: "8px", lineHeight: "1.6" }}>
            상호명: 리스터코퍼레이션 | 대표자: 정지원
          </p>
          <p style={{ fontSize: "8px", lineHeight: "1.6" }}>
            사업자등록번호: 479-09-02930 | 통신판매업신고: 2025-부산금정-0540
          </p>
          <p style={{ fontSize: "8px", lineHeight: "1.6" }}>
            사업장주소: 부산광역시 금정구 놀이마당로26 1402
          </p>
          <p style={{ fontSize: "8px", lineHeight: "1.6" }}>
            대표전화: 0507-0177-0432 | 대표이메일: jiwon@ur-team.com
          </p>
        </div>
      </div>
    </footer>
  )
}
