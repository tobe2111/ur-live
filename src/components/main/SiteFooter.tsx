/**
 * 🦶 2026-07-20 (대표 — "하단 정보 이상적이지 않다 / 글씨 크기·내용 / 유통스타트 왜 있냐"): 푸터 재설계.
 *   - 이전: `footer-tiny`(전체 강제 8px !important) + 위계 없는 이모지 링크 나열 + 라이트모드
 *     `hover:text-white`(흰 배경에 흰 글씨) 버그 + 소비자 푸터에 도매몰(유통스타트) 링크 노출.
 *   - 이후: 표준 커머스 컬럼형(브랜드 / 유어딜 / 파트너 / 약관·정책) + 법적 고지 블록(11px — 법정 표기 관례).
 *   - 🧱 서비스 분리: 유통스타트 B2B 링크 **제거** — 도매몰은 별도 서비스(utongstart.com), 소비자
 *     표면에 비노출(CLAUDE.md 두 서비스 분리 룰). B2B 참여자는 자체 도메인으로 진입.
 *   - /blog 링크 유지(프리렌더 홈 포함 → 네이버 SEO 발견 경로 — 잠금 사항).
 */
import UrDealLogo from '@/components/brand/UrDealLogo'
import { REFERRAL_GROUP_DISCOUNT_DISABLED } from '@/shared/feature-flags'

const colTitle = 'text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5'
const colLink = 'block text-[13px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-[3px] transition-colors'

export default function SiteFooter() {
  return (
    <footer className="bg-white dark:bg-[#0F151D] border-t border-gray-100 dark:border-[#2A3446]">
      <div className="max-w-[1200px] mx-auto px-5 lg:px-8 pt-8 pb-6">
        {/* ── 상단: 브랜드 + 링크 컬럼 ── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* 브랜드 */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <UrDealLogo size={22} />
            <p className="mt-2.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
              우리 동네 이용권·공동구매·교환권을<br />할인가로, 매장에서 QR로 바로.
            </p>
            <a href="/partnership" className="inline-block mt-3 text-[12px] font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2A3446] rounded-full px-3.5 py-1.5 hover:border-brand hover:text-brand transition-colors">
              광고·제휴 문의 →
            </a>
          </div>

          {/* 유어딜 — 🧭 2026-07-20 (대표 "더 추가될 페이지?"): 실존 라우트만 추가(숙소/체험단/FAQ). */}
          <nav aria-label="유어딜">
            <h3 className={colTitle}>유어딜</h3>
            <a href="/about" className={colLink}>서비스 소개</a>
            <a href="/vouchers" className={colLink}>교환권</a>
            <a href="/map" className={colLink}>동네딜 지도</a>
            <a href="/new-openings" className={colLink}>우리 동네 새 가게</a>
            <a href="/stays" className={colLink}>숙소</a>
            <a href="/experience" className={colLink}>체험단 모집</a>
            <a href="/blog" className={colLink}>블로그</a>
            <a href="/faq" className={colLink}>자주 묻는 질문</a>
          </nav>

          {/* 파트너 */}
          <nav aria-label="파트너">
            <h3 className={colTitle}>파트너</h3>
            <a href="/partners" className={colLink}>사장님 가게 입점</a>
            <a href="/creators" className={colLink}>크리에이터 모집</a>
            <a href="/agency/register/business" className={colLink}>에이전시 시작</a>
            {!REFERRAL_GROUP_DISCOUNT_DISABLED && (
              <a href="/referral" className={colLink}>공구 개최하기</a>
            )}
          </nav>

          {/* 약관·정책 */}
          <nav aria-label="약관 및 정책">
            <h3 className={colTitle}>약관·정책</h3>
            <a href="/terms" className={colLink}>서비스 이용약관</a>
            <a href="/terms/seller" className={colLink}>판매자 약관</a>
            <a href="/terms/agency" className={colLink}>에이전시 파트너 약관</a>
            {/* 개인정보처리방침 — 정통망법 관례상 굵게 강조 */}
            <a href="/privacy" className={`${colLink} font-bold`}>개인정보처리방침</a>
            <a href="/refund" className={colLink}>배송 및 환불 정책</a>
          </nav>
        </div>

        {/* ── 하단: 법적 고지 (11px — 법정 표기 관례 크기) ──
            ⚠️ 전역 `p { font-size: clamp(15~17px) }`(index.css)가 <p> 에 직접 크기를 박아 부모 상속(11px)을
            이김 → 각 <p> 에 text-[11px] 를 직접(클래스 > 요소 선택자) 지정해야 실제 11px 로 렌더. */}
        <div className="mt-8 pt-5 border-t border-gray-100 dark:border-[#2A3446] text-gray-400 dark:text-gray-500">
          <p className="text-[11px] leading-[1.8]">
            상호명: 리스터코퍼레이션 · 대표자: 정지원 · 사업자등록번호: 479-09-02930 · 통신판매업신고: 2025-부산금정-0540
          </p>
          <p className="text-[11px] leading-[1.8]">
            사업장주소: 서울특별시 강남구 남부순환로359길 14, 3층(도곡동) · 대표이메일: jiwon@ur-team.com
          </p>
          <p className="text-[11px] leading-[1.8]">서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료</p>
          <p className="text-[11px] leading-[1.8] mt-2 text-gray-400 dark:text-gray-600">© 2026 리스터코퍼레이션. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
