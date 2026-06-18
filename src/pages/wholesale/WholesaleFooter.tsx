// ──────────────────────────────────────────────────────────────
// 🏪 유통스타트 도매몰 — 푸터 (2026-06-16 시안 정렬 — 유통스타트 도매몰.dc.html)
//   신뢰 배지 행 + (좌: 셰브론 로고·사업자정보·정책 링크 / 우: 고객센터·제휴문의). 라이트 고정.
// ──────────────────────────────────────────────────────────────
import { WT } from './wholesale-theme'
import { WholesaleWordmark } from '../wholesale-catalog/WholesaleLogo'

// 🏢 사업자정보 — 사람과고리 공식 정보(2026-06-16 사용자 제공). 한 곳만 고치면 푸터/고객센터 전체 반영.
export const BUSINESS_INFO = {
  company: '사람과고리',
  ceo: '송유미',
  bizRegNo: '108-20-56790',
  mailOrderNo: '제 20174-서울중구-0242호',
  tel: '02-2038-0996',
  fax: '0303-3443-4424',
  address: '서울 중구 동호로33길 24(오장동, 센트마 4093호)',
  // 🏦 입금 은행 — 우체국 (2026-06-18 사용자 제공). bankNo 채우면 무통장입금 안내가 자동 노출.
  bankName: '우체국',
  bankNo: '014084-02-129530',
  bankHolder: '사람과고리(송유미)',
  csEmail: 'jiwon@ur-team.com',
} as const

// 정책/안내 링크 (시안: 회사소개 · 이용약관 · 개인정보처리방침 · 입점안내)
const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: '회사소개', href: '/wholesale/intro' },
  { label: '이용약관', href: '/wholesale/terms' },
  { label: '개인정보처리방침', href: '/privacy' },
  { label: '입점안내', href: '/wholesale/start' },
]

// PG/에스크로/배송/신뢰 배지 (시안 그대로 — 텍스트 칩)
const TRUST_BADGES: string[] = [
  'KCP 결제',
  '구매안전(에스크로)',
  '국민은행 안심거래',
  '대한통운 택배',
  '공정위 표준약관',
  'COMODO SSL',
]

export default function WholesaleFooter() {
  return (
    <footer className="mt-6" style={{ background: '#fff', borderTop: '1px solid ' + WT.line }}>
      <div className="ur-content-wide px-5 lg:px-8 py-7">
        {/* 신뢰 배지 행 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {TRUST_BADGES.map((b) => (
            <span key={b} className="text-[11px] font-medium rounded-md px-2.5 py-1.5" style={{ color: WT.ink2, border: '1px solid ' + WT.line2 }}>{b}</span>
          ))}
        </div>

        {/* 본문 — 좌 사업자정보 / 우 고객센터 */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-6 sm:gap-8 pt-5" style={{ borderTop: '1px solid ' + WT.line }}>
          {/* 좌 — 로고 + 사업자정보 + 정책 링크 */}
          <div className="text-[12.5px] leading-[1.8]" style={{ color: WT.ink3 }}>
            <div className="mb-2.5">
              <WholesaleWordmark height={26} />
            </div>
            {BUSINESS_INFO.company} · 대표 {BUSINESS_INFO.ceo} · 사업자등록번호 {BUSINESS_INFO.bizRegNo}<br />
            통신판매신고 {BUSINESS_INFO.mailOrderNo}<br />
            주소 {BUSINESS_INFO.address}<br />
            {BUSINESS_INFO.bankNo && <>무통장 입금 {BUSINESS_INFO.bankName} {BUSINESS_INFO.bankNo} 예금주 {BUSINESS_INFO.bankHolder}<br /></>}
            <span className="inline-flex flex-wrap items-center gap-x-2 mt-1">
              {FOOTER_LINKS.map((l, i) => (
                <span key={l.label} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden style={{ color: WT.line2 }}>·</span>}
                  <a href={l.href} className="hover:underline" style={{ color: WT.ink4 }}>{l.label}</a>
                </span>
              ))}
            </span>
          </div>

          {/* 우 — 고객센터 · 제휴문의 */}
          <div className="text-[12.5px] leading-[1.7] sm:text-right shrink-0" style={{ color: WT.ink3 }}>
            <div className="text-[12px]">고객센터 · 제휴문의</div>
            <a href={`tel:${BUSINESS_INFO.tel}`} className="block text-[20px] font-extrabold my-0.5" style={{ color: WT.ink }}>Tel. {BUSINESS_INFO.tel}</a>
            <div>Fax. {BUSINESS_INFO.fax}</div>
            <a href={`mailto:${BUSINESS_INFO.csEmail}`} className="font-semibold hover:underline" style={{ color: WT.brand }}>{BUSINESS_INFO.csEmail}</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
